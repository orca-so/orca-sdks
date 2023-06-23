import { Connection } from "@solana/web3.js";
import { AccountFetcher } from ".";
import { Address, AddressUtil } from "../../address-util";
import { getMultipleAccountsInMap } from "../account-requests";
import { ParsableEntity } from "../parsing";

type CachedContent<T> = {
  parser: ParsableEntity<T>;
  fetchedAt: number;
  value: T | null;
};

export type RetentionPolicy<T> = ReadonlyMap<ParsableEntity<T>, number>;

/**
 * Options when fetching the accounts
 */
export type SimpleAccountFetchOptions = {
  // Accepted maxAge in milliseconds for a cache entry hit for this account request.
  maxAge?: number;
};

// SimpleAccountFetcher is a simple implementation of AccountCache that stores the fetched
// accounts in memory. If TTL is not provided, it will use TTL defined in the the retention policy
// for the parser. If that is also not provided, the request will always prefer the cache value.
export class SimpleAccountFetcher<T, FetchOptions extends SimpleAccountFetchOptions>
  implements AccountFetcher<T, FetchOptions>
{
  cache: Map<string, CachedContent<T>> = new Map();
  constructor(readonly connection: Connection, readonly retentionPolicy: RetentionPolicy<T>) {
    this.cache = new Map<string, CachedContent<T>>();
  }

  async getAccount<U extends T>(
    address: Address,
    parser: ParsableEntity<U>,
    opts?: FetchOptions | undefined,
    now: number = Date.now()
  ): Promise<U | null> {
    const addressKey = AddressUtil.toPubKey(address);
    const addressStr = AddressUtil.toString(address);

    const cached = this.cache.get(addressStr);
    const maxAge = this.getMaxAge(this.retentionPolicy.get(parser), opts);
    const elapsed = !!cached ? now - (cached?.fetchedAt ?? 0) : Number.NEGATIVE_INFINITY;
    const expired = elapsed > maxAge;

    if (!!cached && !expired) {
      return cached.value as U | null;
    }

    try {
      const accountInfo = await this.connection.getAccountInfo(addressKey);
      const value = parser.parse(addressKey, accountInfo);
      this.cache.set(addressStr, { parser, value, fetchedAt: now });
      return value;
    } catch (e) {
      this.cache.set(addressStr, { parser, value: null, fetchedAt: now });
      return null;
    }
  }

  private getMaxAge(parserMaxAge?: number, opts?: SimpleAccountFetchOptions): number {
    if (opts?.maxAge !== undefined) {
      return opts.maxAge;
    }
    return parserMaxAge ?? Number.POSITIVE_INFINITY;
  }

  async getAccounts<U extends T>(
    addresses: Address[],
    parser: ParsableEntity<U>,
    opts?: SimpleAccountFetchOptions | undefined,
    now: number = Date.now()
  ): Promise<ReadonlyMap<string, U | null>> {
    const addressStrs = AddressUtil.toStrings(addresses);
    await this.populateCache(addressStrs, parser, opts, now);

    // Build a map of the results, insert by the order of the addresses parameter
    const result = new Map<string, U | null>();
    addressStrs.forEach((addressStr) => {
      const cached = this.cache.get(addressStr);
      const value = cached?.value as U | null;
      result.set(addressStr, value);
    });

    return result;
  }

  async getAccountsAsArray<U extends T>(
    addresses: Address[],
    parser: ParsableEntity<U>,
    opts?: FetchOptions | undefined,
    now: number = Date.now()
  ): Promise<ReadonlyArray<U | null>> {
    const addressStrs = AddressUtil.toStrings(addresses);
    await this.populateCache(addressStrs, parser, opts, now);

    // Rebuild an array containing the results, insert by the order of the addresses parameter
    const result = new Array<U | null>();
    addressStrs.forEach((addressStr) => {
      const cached = this.cache.get(addressStr);
      const value = cached?.value as U | null;
      result.push(value);
    });

    return result;
  }

  async refreshAll(now: number = Date.now()) {
    const addresses = Array.from(this.cache.keys());
    const fetchedAccountsMap = await getMultipleAccountsInMap(this.connection, addresses);

    for (const [key, cachedContent] of this.cache.entries()) {
      const parser = cachedContent.parser;
      const fetchedEntry = fetchedAccountsMap.get(key);
      const value = parser.parse(AddressUtil.toPubKey(key), fetchedEntry);
      this.cache.set(key, { parser, value, fetchedAt: now });
    }
  }
  private async populateCache<U extends T>(
    addresses: Address[],
    parser: ParsableEntity<U>,
    opts?: SimpleAccountFetchOptions | undefined,
    now: number = Date.now()
  ) {
    const addressStrs = AddressUtil.toStrings(addresses);
    const maxAge = this.getMaxAge(this.retentionPolicy.get(parser), opts);

    // Filter out all unexpired accounts to get the accounts to fetch
    const undefinedAccounts = addressStrs.filter((addressStr) => {
      const cached = this.cache.get(addressStr);
      const elapsed = !!cached ? now - (cached?.fetchedAt ?? 0) : Number.NEGATIVE_INFINITY;
      const expired = elapsed > maxAge;
      return !cached || expired;
    });

    // Fetch all undefined accounts and place in cache
    // TODO: We currently do not support contextSlot consistency across the batched getMultipleAccounts call
    // If the addresses list contain accounts in the 1st gMA call as subsequent calls and the gMA returns on different contextSlots,
    // the returned results can be inconsistent and unexpected by the user.
    if (undefinedAccounts.length > 0) {
      const fetchedAccountsMap = await getMultipleAccountsInMap(this.connection, undefinedAccounts);
      undefinedAccounts.forEach((key) => {
        const fetchedEntry = fetchedAccountsMap.get(key);
        const value = parser.parse(AddressUtil.toPubKey(key), fetchedEntry);
        this.cache.set(key, { parser, value, fetchedAt: now });
      });
    }
  }
}
