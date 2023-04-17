import {
  AddressLookupTableAccount,
  Commitment,
  Connection,
  SendOptions,
  Signer,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Wallet } from "../wallet";
import { Instruction, TransactionPayload } from "./types";

/** 
  Build options when building a transaction using TransactionBuilder
  @param latestBlockhash
  The latest blockhash to use when building the transaction.
  @param blockhashCommitment
  If latestBlockhash is not provided, the commitment level to use when fetching the latest blockhash.
  @param maxSupportedTransactionVersion
  The transaction version to build. If set to "legacy", the transaction will
  be built using the legacy transaction format. Otherwise, the transaction
  will be built using the VersionedTransaction format.
  @param lookupTableAccounts
  If the build support VersionedTransactions, allow providing the lookup
  table accounts to use when building the transaction. This is only used
  when maxSupportedTransactionVersion is set to a number.
 */
export type BuildOptions = LegacyBuildOption | V0BuildOption;

type LegacyBuildOption = {
  maxSupportedTransactionVersion: "legacy";
} & BaseBuildOption;

type V0BuildOption = {
  maxSupportedTransactionVersion: number;
  lookupTableAccounts?: AddressLookupTableAccount[];
} & BaseBuildOption;

type BaseBuildOption = {
  latestBlockhash?: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
  blockhashCommitment: Commitment;
};

const LEGACY_TX_UNIQUE_KEYS_LIMIT = 35;

/**
 * A set of options that the builder will use by default, unless overridden by the user in each method.
 */
export type TransactionBuilderOptions = {
  defaultBuildOption: BuildOptions;
  defaultSendOption: SendOptions;
  defaultConfirmationCommitment: Commitment;
};

export const defaultTransactionBuilderOptions: TransactionBuilderOptions = {
  defaultBuildOption: {
    maxSupportedTransactionVersion: 0,
    blockhashCommitment: "confirmed",
  },
  defaultSendOption: {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  },
  defaultConfirmationCommitment: "confirmed",
};

/**
 * Transaction builder for composing, building and sending transactions.
 * @category Transactions
 */
export class TransactionBuilder {
  private instructions: Instruction[];
  private signers: Signer[];
  private opts: TransactionBuilderOptions;

  constructor(
    readonly connection: Connection,
    readonly wallet: Wallet,
    defaultOpts?: TransactionBuilderOptions
  ) {
    this.instructions = [];
    this.signers = [];
    this.opts = defaultOpts ?? defaultTransactionBuilderOptions;
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

  /**
   * Checks whether this builder contains any instructions.
   * @returns Whether this builder contains any instructions.
   */
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
   * Returns the size of the current transaction in bytes. Measurement method can differ based on the maxSupportedTransactionVersion.
   * @param userOptions - Options to override the default build options
   * @returns the size of the current transaction in bytes.
   * @throws error if there is an error measuring the transaction size.
   *         This can happen if the transaction is too large, or if the transaction contains too many keys to be serialized.
   */
  async txnSize(userOptions?: Partial<BuildOptions>): Promise<number> {
    const finalOptions = { ...this.opts.defaultBuildOption, ...userOptions };
    if (this.isEmpty()) {
      return 0;
    }
    const request = await this.build(finalOptions);
    const tx = request.transaction;
    return isVersionedTransaction(tx) ? measureV0Tx(tx) : measureLegacyTx(tx);
  }

  /**
   * Constructs a transaction payload with the gathered instructions
   * @param userOptions - Options to override the default build options
   * @returns a TransactionPayload object that can be excuted or agregated into other transactions
   */
  async build(userOptions?: Partial<BuildOptions>): Promise<TransactionPayload> {
    const finalOptions = { ...this.opts.defaultBuildOption, ...userOptions };
    const { latestBlockhash, maxSupportedTransactionVersion, blockhashCommitment } = finalOptions;

    let recentBlockhash = latestBlockhash;
    if (!recentBlockhash) {
      recentBlockhash = await this.connection.getLatestBlockhash(blockhashCommitment);
    }

    const ix = this.compressIx(true);

    const allSigners = ix.signers.concat(this.signers);


    if (maxSupportedTransactionVersion === "legacy") {
      const transaction = new Transaction({
        ...recentBlockhash,
        feePayer: this.wallet.publicKey,
      });
      transaction.add(...ix.instructions);
      transaction.feePayer = this.wallet.publicKey;

      return {
        transaction: transaction,
        signers: allSigners,
        recentBlockhash,
      };
    }

    const txnMsg = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      payerKey: this.wallet.publicKey,
      instructions: ix.instructions,
    });

    const { lookupTableAccounts } = finalOptions;

    const msg = txnMsg.compileToV0Message(lookupTableAccounts);
    txnMsg.compileToLegacyMessage
    const v0txn = new VersionedTransaction(msg);

    return {
      transaction: v0txn,
      signers: allSigners,
      recentBlockhash,
    };
  }

  /**
   * Constructs a transaction payload with the gathered instructions, sign it with the provider and send it out
   * @param options - Options to build the transaction. . Overrides the default options provided in the constructor.
   * @param sendOptions - Options to send the transaction. Overrides the default options provided in the constructor.
   * @param confirmCommitment - Commitment level to wait for transaction confirmation. Overrides the default options provided in the constructor.
   * @returns the txId of the transaction
   */
  async buildAndExecute(
    options?: Partial<BuildOptions>,
    sendOptions?: Partial<SendOptions>,
    confirmCommitment?: Commitment
  ): Promise<string> {
    const sendOpts = { ...this.opts.defaultSendOption, ...sendOptions };
    const btx = await this.build(options);
    const txn = btx.transaction;
    const resolvedConfirmCommitment = confirmCommitment ?? this.opts.defaultConfirmationCommitment;

    let txId: string;
    if (isVersionedTransaction(txn)) {
      const signedTxn = await this.wallet.signTransaction(txn);
      signedTxn.sign(btx.signers);
      txId = await this.connection.sendTransaction(signedTxn, sendOpts);
    } else {
      const signedTxn = await this.wallet.signTransaction(txn);
      btx.signers.filter((s): s is Signer => s !== undefined).forEach((keypair) => signedTxn.partialSign(keypair));
      txId = await this.connection.sendRawTransaction(signedTxn.serialize(), sendOpts);
    }

    const result = await this.connection.confirmTransaction(
      {
        signature: txId,
        ...btx.recentBlockhash,
      },
      resolvedConfirmCommitment
    );

    const confirmTxErr = result.value.err;
    if (confirmTxErr) {
      throw new Error(confirmTxErr.toString());
    }

    return txId;
  }
}

/**
 * Checks if a transaction is a versioned transaction.
 * @param tx Transaction to check.
 * @returns True if the transaction is a versioned transaction.
 */
export const isVersionedTransaction = (
  tx: Transaction | VersionedTransaction
): tx is VersionedTransaction => {
  return "version" in tx;
};

function measureLegacyTx(tx: Transaction): number {
  // Due to the high cost of serialize, if the number of unique accounts clearly exceeds the limit of legacy transactions,
  // serialize is not performed and a determination of infeasibility is made.
  const uniqueKeys = new Set<string>();
  for (const instruction of tx.instructions) {
    for (const key of instruction.keys) {
      uniqueKeys.add(key.pubkey.toBase58());
    }
    uniqueKeys.add(instruction.programId.toBase58());
  }
  if (uniqueKeys.size > LEGACY_TX_UNIQUE_KEYS_LIMIT) {
    throw new Error("Unable to measure transaction size. Too many unique keys in transaction.");
  }

  try {
    const serialized = tx.serialize({ requireAllSignatures: false });
    return toBuffer(serialized).toString("base64").length;
  } catch (e: unknown) {
    throw new Error("Unable to measure transaction size. Unable to serialize transaction.");
  }
}

function measureV0Tx(tx: VersionedTransaction): number {
  try {
    const serialized = tx.serialize();
    return toBuffer(serialized).toString("base64").length;
  } catch (e) {
    throw new Error("Unable to measure transaction size. Unable to serialize transaction.");
  }
}

const toBuffer = (arr: Buffer | Uint8Array | Array<number>): Buffer => {
  if (Buffer.isBuffer(arr)) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
};
