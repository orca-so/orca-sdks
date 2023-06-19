import {
  NATIVE_MINT,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { ZERO } from "../math";
import { ParsableTokenAccountInfo, getMultipleParsedAccounts } from "./network";
import { ResolvedTokenAddressInstruction, TokenUtil } from "./token-util";
import { EMPTY_INSTRUCTION } from "./transactions/types";

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param ownerAddress The user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @param payer Payer that would pay the rent for the creation of the ATAs
 * @param modeIdempotent Optional. Use CreateIdempotent instruction instead of Create instruction
 * @returns
 */
export async function resolveOrCreateATA(
  connection: Connection,
  ownerAddress: PublicKey,
  tokenMint: PublicKey,
  getAccountRentExempt: () => Promise<number>,
  wrappedSolAmountIn = ZERO,
  payer = ownerAddress,
  modeIdempotent: boolean = false
): Promise<ResolvedTokenAddressInstruction> {
  const instructions = await resolveOrCreateATAs(
    connection,
    ownerAddress,
    [{ tokenMint, wrappedSolAmountIn }],
    getAccountRentExempt,
    payer,
    modeIdempotent
  );
  return instructions[0]!;
}

type ResolvedTokenAddressRequest = {
  tokenMint: PublicKey;
  wrappedSolAmountIn?: BN;
};

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param ownerAddress The user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @param payer Payer that would pay the rent for the creation of the ATAs
 * @param modeIdempotent Optional. Use CreateIdempotent instruction instead of Create instruction
 * @returns
 */
export async function resolveOrCreateATAs(
  connection: Connection,
  ownerAddress: PublicKey,
  requests: ResolvedTokenAddressRequest[],
  getAccountRentExempt: () => Promise<number>,
  payer = ownerAddress,
  modeIdempotent: boolean = false
): Promise<ResolvedTokenAddressInstruction[]> {
  const nonNativeMints = requests.filter(({ tokenMint }) => !tokenMint.equals(NATIVE_MINT));
  const nativeMints = requests.filter(({ tokenMint }) => tokenMint.equals(NATIVE_MINT));

  if (nativeMints.length > 1) {
    throw new Error("Cannot resolve multiple WSolAccounts");
  }

  let instructionMap: { [tokenMint: string]: ResolvedTokenAddressInstruction } = {};
  if (nonNativeMints.length > 0) {
    const nonNativeAddresses = nonNativeMints.map(({ tokenMint }) =>
      getAssociatedTokenAddressSync(tokenMint, ownerAddress)
    );

    const tokenAccounts = await getMultipleParsedAccounts(
      connection,
      nonNativeAddresses,
      ParsableTokenAccountInfo
    );

    tokenAccounts.forEach((tokenAccount, index) => {
      const ataAddress = nonNativeAddresses[index]!;
      let resolvedInstruction;
      if (tokenAccount) {
        // ATA whose owner has been changed is abnormal entity.
        // To prevent to send swap/withdraw/collect output to the ATA, an error should be thrown.
        if (!tokenAccount.owner.equals(ownerAddress)) {
          throw new Error(`ATA with change of ownership detected: ${ataAddress.toBase58()}`);
        }

        resolvedInstruction = { address: ataAddress, ...EMPTY_INSTRUCTION };
      } else {
        const createAtaInstruction = modeIdempotent
          ? createAssociatedTokenAccountIdempotentInstruction(
              payer,
              ataAddress,
              ownerAddress,
              nonNativeMints[index]!.tokenMint
            )
          : createAssociatedTokenAccountInstruction(
              payer,
              ataAddress,
              ownerAddress,
              nonNativeMints[index]!.tokenMint
            );

        resolvedInstruction = {
          address: ataAddress,
          instructions: [createAtaInstruction],
          cleanupInstructions: [],
          signers: [],
        };
      }
      instructionMap[nonNativeMints[index].tokenMint.toBase58()] = resolvedInstruction;
    });
  }

  if (nativeMints.length > 0) {
    const accountRentExempt = await getAccountRentExempt();
    const wrappedSolAmountIn = nativeMints[0]?.wrappedSolAmountIn || ZERO;
    instructionMap[NATIVE_MINT.toBase58()] = TokenUtil.createWrappedNativeAccountInstruction(
      ownerAddress,
      wrappedSolAmountIn,
      accountRentExempt
    );
  }

  // Preserve order of resolution
  return requests.map(({ tokenMint }) => instructionMap[tokenMint.toBase58()]);
}
