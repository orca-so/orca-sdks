import { Provider } from "@project-serum/anchor";
import { Transaction, Signer, TransactionInstruction, ConfirmOptions } from "@solana/web3.js";
import { TransactionProcessor } from "./transactions-processor";
import { Instruction, TransactionPayload } from "./types";

/**
 * @category Transactions Util
 */
export type TransformableInstruction = Instruction & {
  toTx: () => TransactionBuilder;
};

/**
 * @category Transactions Util
 */
export type BuildOptions = {
  // If false, creates a transaction without a blockhash
  // If true, creates a transaction by requesting latestBlockhash
  // If object, creates a transaction by using object
  latestBlockhash:
    | boolean
    | {
        blockhash: string;
        lastValidBlockHeight: number;
      };
};

/**
 * @category Transactions Util
 */
export class TransactionBuilder {
  private provider: Provider;
  private instructions: Instruction[];
  private signers: Signer[];

  constructor(provider: Provider) {
    this.provider = provider;
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
  // TODO: Anchor 0.24+ removes .wallet from Provider
  async build(options: BuildOptions = { latestBlockhash: false }): Promise<TransactionPayload> {
    const { latestBlockhash } = options;
    let recentBlockhash;
    if (latestBlockhash === true) {
      recentBlockhash = (await this.provider.connection.getLatestBlockhash("singleGossip"))
        .blockhash;
    } else if (latestBlockhash !== false && latestBlockhash.blockhash) {
      recentBlockhash = latestBlockhash.blockhash;
    }

    const transaction = new Transaction({
      recentBlockhash,
      feePayer: this.provider.wallet.publicKey,
    });

    const ix = this.compressIx(true);

    transaction.add(...ix.instructions);
    transaction.feePayer = this.provider.wallet.publicKey;

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
    const tp = new TransactionProcessor(this.provider);
    const { execute } = await tp.signAndConstructTransaction(tx);
    return execute();
  }

  /**
   * Send multiple transactions at once.
   * @deprecated This method is here for legacy reasons and we prefer the use of TransactionProcessor
   */
  static async sendAll(provider: Provider, txns: TransactionBuilder[], opts?: ConfirmOptions) {
    const txRequest = await Promise.all(
      txns.map(async (txBuilder) => {
        const { transaction, signers } = await txBuilder.build();
        return { tx: transaction, signers };
      })
    );
    return await provider.sendAll(txRequest, opts);
  }
}
