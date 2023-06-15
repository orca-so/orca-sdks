import {
  AccountLayout,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import invariant from "tiny-invariant";
import { ZERO } from "../math";
import { Instruction, resolveOrCreateATA } from "../web3";
/**
 * @category Util
 */
export type ResolvedTokenAddressInstruction = {
  address: PublicKey;
} & Instruction;

/**
 * @category Util
 */
export class TokenUtil {
  public static isNativeMint(mint: PublicKey) {
    return mint.equals(NATIVE_MINT);
  }

  /**
   * Create an ix to send a native-mint and unwrap it to the user's wallet.
   * @param owner
   * @param amountIn
   * @param rentExemptLamports
   * @param payer
   * @param unwrapDestination
   * @returns
   */
  static createWrappedNativeAccountInstruction(
    owner: PublicKey,
    amountIn: BN,
    rentExemptLamports: number,
    payer?: PublicKey,
    unwrapDestination?: PublicKey
  ): ResolvedTokenAddressInstruction {
    const payerKey = payer ?? owner;
    const tempAccount = new Keypair();
    const unwrapDestinationKey = unwrapDestination ?? payer ?? owner;

    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payerKey,
      newAccountPubkey: tempAccount.publicKey,
      lamports: amountIn.toNumber() + rentExemptLamports,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    });

    const initAccountInstruction = createInitializeAccountInstruction(
      tempAccount.publicKey,
      NATIVE_MINT,
      owner
    );

    const closeWSOLAccountInstruction = createCloseAccountInstruction(
      tempAccount.publicKey,
      unwrapDestinationKey,
      owner
    );

    return {
      address: tempAccount.publicKey,
      instructions: [createAccountInstruction, initAccountInstruction],
      cleanupInstructions: [closeWSOLAccountInstruction],
      signers: [tempAccount],
    };
  }

  /**
   * Create an ix to send a spl-token / native-mint to another wallet.
   * This function will handle the associated token accounts internally for spl-token.
   * SOL is sent directly to the user's wallet.
   *
   * @param connection - Connection object
   * @param sourceWallet - PublicKey for the sender's wallet
   * @param destinationWallet - PublicKey for the receiver's wallet
   * @param tokenMint - Mint for the token that is being sent.
   * @param tokenDecimals - Decimal for the token that is being sent.
   * @param amount - Amount of token to send
   * @param getAccountRentExempt - Fn to fetch the account rent exempt value
   * @param payer - PublicKey for the payer that would fund the possibly new token-accounts. (must sign the txn)
   * @returns
   */
  static async createSendTokensToWalletInstruction(
    connection: Connection,
    sourceWallet: PublicKey,
    destinationWallet: PublicKey,
    tokenMint: PublicKey,
    tokenDecimals: number,
    amount: BN,
    getAccountRentExempt: () => Promise<number>,
    payer?: PublicKey
  ): Promise<Instruction> {
    invariant(!amount.eq(ZERO), "SendToken transaction must send more than 0 tokens.");

    // Specifically handle SOL, which is not a spl-token.
    if (tokenMint.equals(NATIVE_MINT)) {
      const sendSolTxn = SystemProgram.transfer({
        fromPubkey: sourceWallet,
        toPubkey: destinationWallet,
        lamports: BigInt(amount.toString()),
      });
      return {
        instructions: [sendSolTxn],
        cleanupInstructions: [],
        signers: [],
      };
    }

    const sourceTokenAccount = getAssociatedTokenAddressSync(tokenMint, sourceWallet);
    const { address: destinationTokenAccount, ...destinationAtaIx } = await resolveOrCreateATA(
      connection,
      destinationWallet,
      tokenMint,
      getAccountRentExempt,
      amount,
      payer
    );

    const transferIx = createTransferCheckedInstruction(
      sourceTokenAccount,
      tokenMint,
      destinationTokenAccount,
      sourceWallet,
      BigInt(amount.toString()),
      tokenDecimals
    );

    return {
      instructions: destinationAtaIx.instructions.concat(transferIx),
      cleanupInstructions: destinationAtaIx.cleanupInstructions,
      signers: destinationAtaIx.signers,
    };
  }
}
