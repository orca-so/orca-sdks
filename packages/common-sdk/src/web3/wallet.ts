import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export interface Wallet {
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
  publicKey: PublicKey;
}
