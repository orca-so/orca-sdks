import { Account, Mint } from "@solana/spl-token";
import { ParsableEntity } from "..";
import { Address } from "../../address-util";

export * from "./simple-cache-impl";

export type BasicSupportedTypes = Account | Mint;

/**
 * Options when fetching the accounts
 */
export type AccountFetchOpts = {
  // Accepted Time to live in milliseconds for a cache entry for this account request
  ttl: number;
};

/**
 * Interface for fetching and caching on-chain accounts 
 */
export interface AccountCache<T> {
  /**
   * Fetch an account from the cache or from the network
   * @param address The account address to fetch from cache or network
   * @param parser The parser to used for theses accounts
   * @param opts Options when fetching the accounts
   * @returns
   */
  getAccount: (
    address: Address,
    parser: ParsableEntity<T>,
    opts?: AccountFetchOpts
  ) => Promise<T | null>;

  /**
   * Fetch multiple accounts from the cache or from the network
   * @param address A list of account addresses to fetch from cache or network
   * @param parser The parser to used for theses accounts
   * @param opts Options when fetching the accounts
   * @returns a Map of addresses to accounts. The ordering of the Map iteration is the same as the ordering of the input addresses.
   */
  getAccounts: (
    address: Address[],
    parser: ParsableEntity<T>,
    opts?: AccountFetchOpts
  ) => Promise<ReadonlyMap<string, T | null>>;

  /**
   * Fetch multiple accounts from the cache or from the network and return as an array
   * @param address A list of account addresses to fetch from cache or network
   * @param parser The parser to used for theses accounts
   * @param opts Options when fetching the accounts
   * @returns an array of accounts. The ordering of the array is the same as the ordering of the input addresses.
   */
  getAccountsAsArray: (
    address: Address[],
    parser: ParsableEntity<T>,
    opts?: AccountFetchOpts
  ) => Promise<ReadonlyArray<T | null>>;

  /**
   * Refresh all accounts in the cache
   */
  refreshAll: () => Promise<void>;
}
