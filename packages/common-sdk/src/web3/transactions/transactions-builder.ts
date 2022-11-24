import { AnchorProvider } from "@project-serum/anchor";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import {
  ConfirmOptions,
  Connection,
  Signer,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { TransactionProcessor } from "./transactions-processor";
import { Instruction, TransactionPayload } from "./types";

/**
 * @category Transactions Util
 */
export type BuildOptions = {
  latestBlockhash:
  | {
    blockhash: string;
    lastValidBlockHeight: number;
  }
  | undefined;
};

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

  /**
   * Append an instruction into this builder.
   * @param instruction - An Instruction
   * @returns Returns this transaction builder.
   */
  addInstruction(instruction: Instruction): TransactionBuilder {
    this.instructions.push(instruction);
    return this;
  }

  /**
   * Append a list of instructions into this builder.
   * @param instructions - A list of Instructions
   * @returns Returns this transaction builder.
   */
  addInstructions(instructions: Instruction[]): TransactionBuilder {
    this.instructions = this.instructions.concat(instructions);
    return this;
  }

  /**
   * Prepend a list of instructions into this builder.
   * @param instruction - An Instruction
   * @returns Returns this transaction builder.
   */
  prependInstruction(instruction: Instruction): TransactionBuilder {
    this.instructions.unshift(instruction);
    return this;
  }

  /**
   * Prepend a list of instructions into this builder.
   * @param instructions - A list of Instructions
   * @returns Returns this transaction builder.
   */
  prependInstructions(instructions: Instruction[]): TransactionBuilder {
    this.instructions = instructions.concat(this.instructions);
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
   * Returns the size of the current transaction in bytes.
   * @returns the size of the current transaction in bytes.
   * @throws error if transaction is over maximum package size.
   */
  async txnSize(options: BuildOptions = { latestBlockhash: undefined }) {
    if (this.isEmpty()) {
      return 0;
    }
    const request = await this.build(options);
    return request.transaction.serialize({ requireAllSignatures: false }).length;
  }

  /**
   * Constructs a transaction payload with the gathered instructions
   * @returns a TransactionPayload object that can be excuted or agregated into other transactions
   */
  async build(options: BuildOptions = { latestBlockhash: undefined }): Promise<TransactionPayload> {
    const { latestBlockhash } = options;
    let recentBlockhash = !latestBlockhash
      ? await this.connection.getLatestBlockhash("singleGossip")
      : latestBlockhash;

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
