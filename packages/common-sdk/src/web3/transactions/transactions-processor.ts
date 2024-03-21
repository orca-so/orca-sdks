import {
  Commitment,
  Connection,
  PublicKey,
  Signer,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { Wallet } from "../wallet";
import { isVersionedTransaction } from "./transactions-builder";
import { SendTxRequest } from "./types";

/**
 * @deprecated
 */
export class TransactionProcessor {
  constructor(
    readonly connection: Connection,
    readonly wallet: Wallet,
    readonly commitment: Commitment = "confirmed"
  ) {}

  public async signTransaction(txRequest: SendTxRequest): Promise<{
    transaction: Transaction | VersionedTransaction;
    lastValidBlockHeight: number;
    blockhash: string;
  }> {
    const { transactions, lastValidBlockHeight, blockhash } = await this.signTransactions([
      txRequest,
    ]);
    return { transaction: transactions[0], lastValidBlockHeight, blockhash };
  }

  public async signTransactions(txRequests: SendTxRequest[]): Promise<{
    transactions: (Transaction | VersionedTransaction)[];
    lastValidBlockHeight: number;
    blockhash: string;
  }> {
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(
      this.commitment
    );
    const feePayer = this.wallet.publicKey;
    // to allow Wallet app to rewrite transaction (e.g. Priority Fee), signing order should be Wallet -> others.
    const notSignedTxs = txRequests.map((txRequest) => {
      return preRewriteTransaction(txRequest, feePayer, blockhash);
    });
    const walletSignedTxs = await this.wallet.signAllTransactions(notSignedTxs);
    const signedTxs = walletSignedTxs.map((tx, i) => postSignTransaction(tx, txRequests[i].signers));
    return {
      transactions: signedTxs,
      lastValidBlockHeight,
      blockhash,
    };
  }

  public async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    lastValidBlockHeight: number,
    blockhash: string
  ): Promise<string> {
    const execute = this.constructSendTransactions([transaction], lastValidBlockHeight, blockhash);
    const txs = await execute();
    const ex = txs[0];
    if (ex.status === "fulfilled") {
      return ex.value;
    } else {
      throw ex.reason;
    }
  }

  public constructSendTransactions(
    transactions: (Transaction | VersionedTransaction)[],
    lastValidBlockHeight: number,
    blockhash: string,
    parallel: boolean = true
  ): () => Promise<PromiseSettledResult<string>[]> {
    const executeTx = async (tx: Transaction | VersionedTransaction) => {
      const rawTxs = tx.serialize();
      return this.connection.sendRawTransaction(rawTxs, {
        preflightCommitment: this.commitment,
      });
    };

    const confirmTx = async (txId: string) => {
      const result = await this.connection.confirmTransaction(
        {
          signature: txId,
          lastValidBlockHeight: lastValidBlockHeight,
          blockhash,
        },
        this.commitment
      );

      if (result.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value)}`);
      }
    };

    return async () => {
      if (parallel) {
        const results = transactions.map(async (tx) => {
          const txId = await executeTx(tx);
          await confirmTx(txId);
          return txId;
        });

        return Promise.allSettled(results);
      } else {
        const results = [];
        for (const tx of transactions) {
          const txId = await executeTx(tx);
          await confirmTx(txId);
          results.push(txId);
        }
        return Promise.allSettled(results);
      }
    };
  }

  public async signAndConstructTransaction(txRequest: SendTxRequest): Promise<{
    signedTx: Transaction | VersionedTransaction;
    execute: () => Promise<string>;
  }> {
    const { transaction, lastValidBlockHeight, blockhash } = await this.signTransaction(txRequest);
    return {
      signedTx: transaction,
      execute: async () => this.sendTransaction(transaction, lastValidBlockHeight, blockhash),
    };
  }

  public async signAndConstructTransactions(
    txRequests: SendTxRequest[],
    parallel: boolean = true
  ): Promise<{
    signedTxs: (Transaction | VersionedTransaction)[];
    execute: () => Promise<PromiseSettledResult<string>[]>;
  }> {
    const { transactions, lastValidBlockHeight, blockhash } = await this.signTransactions(
      txRequests
    );
    const execute = this.constructSendTransactions(
      transactions,
      lastValidBlockHeight,
      blockhash,
      parallel
    );
    return { signedTxs: transactions, execute };
  }
}

function preRewriteTransaction(txRequest: SendTxRequest, feePayer: PublicKey, blockhash: string) {
  if (isVersionedTransaction(txRequest.transaction)) {
    let tx: VersionedTransaction = txRequest.transaction;
    return tx;
  } else {
    let tx: Transaction = txRequest.transaction;
    tx.feePayer = feePayer;
    tx.recentBlockhash = blockhash;
    return tx;
  }
}

function postSignTransaction(tx: Transaction | VersionedTransaction, signers: Signer[] | undefined) {
  if (isVersionedTransaction(tx)) {
    if (signers && signers.length > 0) {
      tx.sign(signers);
    }
    return tx;
  } else {
    signers?.forEach((s) => {
      tx.partialSign(s);
    });
    return tx;
  }
}