import { AccountInfo, AccountLayout, NATIVE_MINT, Token, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { ZERO } from "../math";
import { deriveATA, Instruction, resolveOrCreateATA } from "../web3";

/**
 * @category Util
 */
export class TokenUtil {
  public static deserializeTokenAccount = (data: Buffer | undefined): AccountInfo | null => {
    if (!data) {
      return null;
    }

    const accountInfo = AccountLayout.decode(data);
    accountInfo.mint = new PublicKey(accountInfo.mint);
    accountInfo.owner = new PublicKey(accountInfo.owner);
    accountInfo.amount = u64.fromBuffer(accountInfo.amount);

    if (accountInfo.delegateOption === 0) {
      accountInfo.delegate = null;
      accountInfo.delegatedAmount = new u64(0);
    } else {
      accountInfo.delegate = new PublicKey(accountInfo.delegate);
      accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
    }

    accountInfo.isInitialized = accountInfo.state !== 0;
    accountInfo.isFrozen = accountInfo.state === 2;

    if (accountInfo.isNativeOption === 1) {
      accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
      accountInfo.isNative = true;
    } else {
      accountInfo.rentExemptReserve = null;
      accountInfo.isNative = false;
    }

    if (accountInfo.closeAuthorityOption === 0) {
      accountInfo.closeAuthority = null;
    } else {
      accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
    }

    return accountInfo;
  };

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
    amount: u64,
    getAccountRentExempt: () => Promise<number>,
    payer?: PublicKey
  ): Promise<Instruction> {
    invariant(!amount.eq(ZERO), "SendToken transaction must send more than 0 tokens.");

    // Specifically handle SOL, which is not a spl-token.
    if (tokenMint.equals(NATIVE_MINT)) {
      const sendSolTxn = SystemProgram.transfer({
        fromPubkey: sourceWallet,
        toPubkey: destinationWallet,
        lamports: BigInt(amount.toString())
      })
      return {
        instructions: [sendSolTxn],
        cleanupInstructions: [],
        signers: []
      }
    }

    const sourceTokenAccount = await deriveATA(sourceWallet, tokenMint);
    const { address: destinationTokenAccount, ...destinationAtaIx } = await resolveOrCreateATA(
      connection,
      destinationWallet,
      tokenMint,
      getAccountRentExempt,
      amount,
      payer
    );

    const transferIx = Token.createTransferCheckedInstruction(
      TOKEN_PROGRAM_ID,
      sourceTokenAccount,
      tokenMint,
      destinationTokenAccount,
      sourceWallet,
      [],
      new u64(amount.toString()),
      tokenDecimals
    );

    return {
      instructions: destinationAtaIx.instructions.concat(transferIx),
      cleanupInstructions: destinationAtaIx.cleanupInstructions,
      signers: destinationAtaIx.signers,
    };
  }
}
