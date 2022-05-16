import { Provider } from "@project-serum/anchor";
import { Commitment, PublicKey, Signer, Transaction } from "@solana/web3.js";
import { SendTxRequest } from "./types";

// Only used internally
enum TransactionStatus {
  CONFIRMED,
  EXPIRED,
}

export class TransactionProcessor {
  constructor(readonly provider: Provider, readonly commitment: Commitment = "confirmed") {}

  public async signTransaction(txRequest: SendTxRequest): Promise<{
    transaction: Transaction;
    lastValidBlockHeight: number;
  }> {
    const { transactions, lastValidBlockHeight } = await this.signTransactions([txRequest]);
    return { transaction: transactions[0], lastValidBlockHeight };
  }

  public async signTransactions(txRequests: SendTxRequest[]): Promise<{
    transactions: Transaction[];
    lastValidBlockHeight: number;
  }> {
    // TODO: Neither Solana nor Anchor currently correctly handle latest block height confirmation
    const { blockhash, lastValidBlockHeight } = await this.provider.connection.getLatestBlockhash(
      this.commitment
    );
    const feePayer = this.provider.wallet.publicKey;
    const pSignedTxs = txRequests.map((txRequest) => {
      return rewriteTransaction(txRequest, feePayer, blockhash);
    });
    const transactions = await this.provider.wallet.signAllTransactions(pSignedTxs);
    return {
      transactions,
      lastValidBlockHeight,
    };
  }

  public async sendTransaction(
    transaction: Transaction,
    lastValidBlockHeight: number
  ): Promise<string> {
    const execute = this.constructSendTransactions([transaction], lastValidBlockHeight);
    const txs = await execute();
    const ex = txs[0];
    if (ex.status === "fulfilled") {
      return ex.value;
    } else {
      throw ex.reason;
    }
  }

  public constructSendTransactions(
    transactions: Transaction[],
    lastValidBlockHeight: number,
    parallel: boolean = true
  ): () => Promise<PromiseSettledResult<string>[]> {
    return async () => {
      let done = false;
      const isDone = () => done;

      // We separate the block expiry promise so that it can be shared for all the transactions
      const expiry = checkBlockHeightExpiry(
        this.provider,
        lastValidBlockHeight,
        this.commitment,
        isDone
      );
      const txs = transactions.map((tx) => tx.serialize());
      const txPromises = txs.map(async (tx) =>
        confirmOrExpire(this.provider, tx, this.commitment, expiry)
      );
      let results: PromiseSettledResult<string>[] = [];
      if (parallel) {
        results = await Promise.allSettled(txPromises);
      } else {
        for (const txPromise of txPromises) {
          // We might be able to have these transactions individually signed and updated, but not sure
          // of the implications of the resigning - could be quite annoying from a user perspective
          // if their wallet forces them to sign for each
          results.push(await promiseToSettled(txPromise));
        }
      }
      done = true;
      return results;
    };
  }

  public async signAndConstructTransaction(txRequest: SendTxRequest): Promise<{
    signedTx: Transaction;
    execute: () => Promise<string>;
  }> {
    const { transaction, lastValidBlockHeight } = await this.signTransaction(txRequest);
    return {
      signedTx: transaction,
      execute: async () => this.sendTransaction(transaction, lastValidBlockHeight),
    };
  }

  public async signAndConstructTransactions(
    txRequests: SendTxRequest[],
    parallel: boolean = true
  ): Promise<{
    signedTxs: Transaction[];
    execute: () => Promise<PromiseSettledResult<string>[]>;
  }> {
    const { transactions, lastValidBlockHeight } = await this.signTransactions(txRequests);
    const execute = this.constructSendTransactions(transactions, lastValidBlockHeight, parallel);
    return { signedTxs: transactions, execute };
  }
}

async function promiseToSettled<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    const value = await promise;
    return {
      status: "fulfilled",
      value: value,
    };
  } catch (err) {
    return {
      status: "rejected",
      reason: err,
    };
  }
}

/**
 * Send a tx and confirm that it has reached `commitment` or expiration
 */
async function confirmOrExpire(
  provider: Provider,
  tx: Buffer,
  commitment: Commitment,
  expiry: Promise<TransactionStatus>
) {
  const txId = await provider.connection.sendRawTransaction(tx, {
    preflightCommitment: commitment,
  });

  // Inlined to properly clear subscription id if expired before signature
  let subscriptionId;

  // Subscribe to onSignature to detect that the transactionId has been
  // signed with the `commitment` level
  const confirm = new Promise((resolve, reject) => {
    try {
      subscriptionId = provider.connection.onSignature(
        txId,
        () => {
          subscriptionId = undefined;
          resolve(TransactionStatus.CONFIRMED);
        },
        commitment
      );
    } catch (err) {
      reject(err);
    }
  });

  try {
    // Race confirm and expiry to see whether the transaction is confirmed or expires
    const status = await Promise.race([confirm, expiry]);
    if (status === TransactionStatus.CONFIRMED) {
      return txId;
    } else {
      throw new Error("Transaction failed to be confirmed before expiring");
    }
  } finally {
    if (subscriptionId) {
      provider.connection.removeSignatureListener(subscriptionId);
    }
  }
}

async function checkBlockHeightExpiry(
  provider: Provider,
  lastValidBlockHeight: number,
  commitment: Commitment,
  isDone: () => boolean
) {
  while (!isDone()) {
    let blockHeight = await provider.connection.getBlockHeight(commitment);
    if (blockHeight > lastValidBlockHeight) {
      break;
    }
    // The more remaining valid blocks, the less frequently we need to check
    await sleep((lastValidBlockHeight - blockHeight) * 5 + 500);
  }
  return TransactionStatus.EXPIRED;
}

function rewriteTransaction(txRequest: SendTxRequest, feePayer: PublicKey, blockhash: string) {
  const signers = txRequest.signers ?? [];
  const tx = txRequest.transaction;
  tx.feePayer = feePayer;
  tx.recentBlockhash = blockhash;
  signers.filter((s): s is Signer => s !== undefined).forEach((keypair) => tx.partialSign(keypair));
  return tx;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
