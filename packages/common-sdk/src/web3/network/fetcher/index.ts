import { Account, Mint } from "@solana/spl-token";
import { ParsableEntity } from "..";
import { Address } from "../../address-util";

export * from "./simple-fetcher-impl";

export type BasicSupportedTypes = Account | Mint;

/**
 * Interface for fetching and caching on-chain accounts
 */
export interface AccountFetcher<T, AccountFetchOptions> {
  /**
   * Fetch an account from the cache or from the network
   * @param address The account address to fetch from cache or network
   * @param parser The parser to used for theses accounts
   * @param opts Options when fetching the accounts
   * @returns
   */
  getAccount: <U extends T>(
    address: Address,
    parser: ParsableEntity<U>,
    opts?: AccountFetchOptions
  ) => Promise<U | null>;

  /**
   * Fetch multiple accounts from the cache or from the network
   * @param address A list of account addresses to fetch from cache or network
   * @param parser The parser to used for theses accounts
   * @param opts Options when fetching the accounts
   * @returns a Map of addresses to accounts. The ordering of the Map iteration is the same as the ordering of the input addresses.
   */
  getAccounts: <U extends T>(
    address: Address[],
    parser: ParsableEntity<U>,
    opts?: AccountFetchOptions
  ) => Promise<ReadonlyMap<string, U | null>>;

  /**
   * Fetch multiple accounts from the cache or from the network and return as an array
   * @param address A list of account addresses to fetch from cache or network
   * @param parser The parser to used for theses accounts
   * @param opts Options when fetching the accounts
   * @returns an array of accounts. The ordering of the array is the same as the ordering of the input addresses.
   */
  getAccountsAsArray: <U extends T>(
    address: Address[],
    parser: ParsableEntity<U>,
    opts?: AccountFetchOptions
  ) => Promise<ReadonlyArray<U | null>>;
}
