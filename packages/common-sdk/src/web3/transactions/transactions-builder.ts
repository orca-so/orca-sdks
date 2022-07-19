import { AnchorProvider } from "@project-serum/anchor";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import {
  Connection,
  Transaction,
  Signer,
  TransactionInstruction,
  ConfirmOptions,
} from "@solana/web3.js";
import { TransactionProcessor } from "./transactions-processor";
import { Instruction, TransactionPayload } from "./types";

/**
 * @category Transactions Util
 */
export class TransactionBuilder {
  private instructions: Instruction[];
  private signers: Signer[];

  constructor(readonly connection: Connection, readonly wallet: Wallet) {
    this.instructions = [];
    this.signers = [];
  }

  addInstruction(instruction: Instruction): TransactionBuilder {
    this.instructions.push(instruction);
    return this;
  }

  addSigner(signer: Signer): TransactionBuilder {
    this.signers.push(signer);
    return this;
  }

  isEmpty(): boolean {
    return this.instructions.length == 0;
  }

  /**
   * Compresses all instructions & signers in this builder
   * into one single instruction
   * @param compressPost Compress all post instructions into the instructions field
   * @returns Instruction object containing all
   */
  compressIx(compressPost: boolean): Instruction {
    let instructions: TransactionInstruction[] = [];
    let cleanupInstructions: TransactionInstruction[] = [];
    let signers: Signer[] = [];
    this.instructions.forEach((curr) => {
      instructions = instructions.concat(curr.instructions);
      // Cleanup instructions should execute in reverse order
      cleanupInstructions = curr.cleanupInstructions.concat(cleanupInstructions);
      signers = signers.concat(curr.signers);
    });

    if (compressPost) {
      instructions = instructions.concat(cleanupInstructions);
      cleanupInstructions = [];
    }

    return {
      instructions: [...instructions],
      cleanupInstructions: [...cleanupInstructions],
      signers,
    };
  }

  /**
   * Constructs a transaction payload with the gathered instructions
   * @returns a TransactionPayload object that can be excuted or agregated into other transactions
   */
  async build(): Promise<TransactionPayload> {
    let recentBlockhash = await this.connection.getLatestBlockhash("singleGossip");

    const transaction = new Transaction({
      ...recentBlockhash,
      feePayer: this.wallet.publicKey,
    });

    const ix = this.compressIx(true);

    transaction.add(...ix.instructions);
    transaction.feePayer = this.wallet.publicKey;

    return {
      transaction: transaction,
      signers: ix.signers.concat(this.signers),
    };
  }

  /**
   * Constructs a transaction payload with the gathered instructions, sign it with the provider and send it out
   * @returns the txId of the transaction
   */
  async buildAndExecute(): Promise<string> {
    const tx = await this.build();
    const tp = new TransactionProcessor(this.connection, this.wallet);
    const { execute } = await tp.signAndConstructTransaction(tx);
    return execute();
  }

  /**
   * Send multiple transactions at once.
   * @deprecated This method is here for legacy reasons and we prefer the use of TransactionProcessor
   */
  static async sendAll(
    provider: AnchorProvider,
    txns: TransactionBuilder[],
    opts?: ConfirmOptions
  ) {
    const txRequest = await Promise.all(
      txns.map(async (txBuilder) => {
        const { transaction, signers } = await txBuilder.build();
        return { tx: transaction, signers };
      })
    );
    return await provider.sendAll(txRequest, opts);
  }
}
