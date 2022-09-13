import { AccountInfo, AccountLayout, Token, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
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
   * Creates a set of instructions to send a token to another wallet.
   * This instruction set will check and create the address of ATAs of the receiving wallet.
   * Will automatically handle SOL tokens as well.
   */
  static async createSendTokensToWalletInstruction(
    connection: Connection,
    sourceWallet: PublicKey,
    destionationWallet: PublicKey,
    tokenMint: PublicKey,
    tokenDecimals: number,
    amount: u64,
    getAccountRentExempt: () => Promise<number>,
    payer?: PublicKey
  ): Promise<Instruction> {
    invariant(!amount.eq(ZERO), "SendToken transaction must send more than 0 tokens.");

    const sourceTokenAccount = await deriveATA(sourceWallet, tokenMint);
    const { address: destinationTokenAccount, ...destionationAtaIx } = await resolveOrCreateATA(
      connection,
      destionationWallet,
      tokenMint,
      getAccountRentExempt,
      amount, //
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
      instructions: destionationAtaIx.instructions.concat(transferIx),
      cleanupInstructions: destionationAtaIx.cleanupInstructions,
      signers: destionationAtaIx.signers,
    };
  }
}
