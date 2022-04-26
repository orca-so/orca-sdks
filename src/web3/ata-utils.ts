import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { deserializeTokenAccount } from "./deserialize-token-account";
import {
  createWSOLAccountInstructions,
  ResolvedTokenAddressInstruction,
} from "../helpers/token-instructions";
import { EMPTY_INSTRUCTION } from "./transactions-builder";

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param ownerAddress The user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @returns
 */
export async function resolveOrCreateATA(
  connection: Connection,
  ownerAddress: PublicKey,
  tokenMint: PublicKey,
  wrappedSolAmountIn = new u64(0)
): Promise<ResolvedTokenAddressInstruction> {
  if (!tokenMint.equals(NATIVE_MINT)) {
    const ataAddress = await deriveATA(ownerAddress, tokenMint);

    const tokenAccountInfo = await connection.getAccountInfo(ataAddress);
    const tokenAccount = deserializeTokenAccount(tokenAccountInfo?.data);
    if (tokenAccount) {
      return { address: ataAddress, ...EMPTY_INSTRUCTION };
    }

    const createAtaInstruction = Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      tokenMint,
      ataAddress,
      ownerAddress,
      ownerAddress
    );

    return {
      address: ataAddress,
      instructions: [createAtaInstruction],
      cleanupInstructions: [],
      signers: [],
    };
  } else {
    const accountRentExempt =
      await connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    return createWSOLAccountInstructions(
      ownerAddress,
      wrappedSolAmountIn,
      accountRentExempt
    );
  }
}

export async function deriveATA(
  ownerAddress: PublicKey,
  tokenMint: PublicKey
): Promise<PublicKey> {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    tokenMint,
    ownerAddress
  );
}
