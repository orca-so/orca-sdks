import { LookupTable, LookupTableFetcher } from "@orca-so/common-sdk";
import { AddressLookupTableAccount, Connection, PublicKey } from "@solana/web3.js";
import { AxiosInstance } from "axios";

type OrcaLookupTableModel = {
  address: string;
  addresses: string[];
};

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

/**
 * Orca's implementation of LookupTableFetcher.
 *
 * This implementation fetches lookup tables from Orca's server to facilitate
 * ALT lookup for transactions.
 */
export class OrcaLookupTableFetcher implements LookupTableFetcher {
  // TODO: Cached values here need an invalidation path to prevent stale data
  private resolvedAltCache: { [key: string]: CacheEntry<AddressLookupTableAccount> } = {};
  private localLutCache: { [key: string]: CacheEntry<LookupTable> } = {};
  private localCacheMiss: { [key: string]: number } = {};
  private reverseAddressIndex: { [key: string]: Set<string> } = {};

  constructor(
    readonly server: AxiosInstance,
    readonly connection: Connection,
    private cacheTTL: number = DEFAULT_CACHE_TTL
  ) { }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Query the Orca server for lookup tables for the given addresses and load it into cache.
   * @param addresses - The addresses to query for. Only a maximum of 50 address is supported.
   * @returns The lookup tables for the given addresses.
   */
  async loadLookupTables(addresses: PublicKey[]): Promise<LookupTable[]> {
    // Server request ~ 200ms

    // Check whether any address is already indexed
    const matchedIndex = addresses.map((addr) => this.reverseAddressIndex[addr.toString()] || null);

    // Check to make sure either we've already missed a fetch on the address or that there is a match
    let allMatched = true;
    for (let i = 0; i < addresses.length; i++) {
      const matched = matchedIndex[i];
      const hasMiss = this.localCacheMiss[addresses[i].toString()] && this.isCacheValid(this.localCacheMiss[addresses[i].toString()]);
      if (matched == null && !hasMiss) {
        allMatched = false;
        break;
      }
    }

    // If all are matched or previously missed (and cache is valid), use the cache
    if (allMatched) {
      const allLuts = [];
      for (let i = 0; i < matchedIndex.length; i++) {
        const rai = matchedIndex[i];
        if (rai) {
          allLuts.push(...Array.from(rai!));
        }
      }
      const lutSet = new Set(allLuts);
      const validLuts = Array.from(lutSet)
        .map((lut) => {
          const cached = this.localLutCache[lut];
          return cached && this.isCacheValid(cached.timestamp) ? cached.value : null;
        })
        .filter((lut): lut is LookupTable => lut !== null);
      
      if (validLuts.length === lutSet.size) {
        return validLuts;
      }
    }

    // Otherwise, lookup all addresses from the server, and update the cache
    const response = await this.server.request({
      url: "/lookup-table",
      method: "get",
      params: {
        addresses: addresses.map((addr) => addr.toBase58()).join(","),
      },
    });

    const lookupTables: LookupTable[] | undefined = response?.data?.lookupTables.map(
      (lut: OrcaLookupTableModel) => {
        return {
          address: lut.address,
          containedAddresses: lut.addresses,
        };
      }
    );
    if (lookupTables) {
      this.updateCache(addresses, lookupTables);
      return lookupTables;
    }
    return [];
  }

  /**
   * Fetches the AddressLookupTableAccount for the given addresses.
   * @param addresses - The addresses to fetch the lookup table accounts for. Only a maximum of 50 address is supported.
   * @returns The AddressLookupTableAccount for the given addresses.
   */
  async getLookupTableAccountsForAddresses(
    addresses: PublicKey[]
  ): Promise<AddressLookupTableAccount[]> {
    const luts = await this.loadLookupTables(addresses);
    return (
      await Promise.all(
        luts.map(async (lut) => {
          const cached = this.resolvedAltCache[lut.address];
          if (cached && this.isCacheValid(cached.timestamp)) {
            return Promise.resolve(cached.value);
          } else {
            const alt = (await this.connection.getAddressLookupTable(new PublicKey(lut.address)))
              .value;
            if (alt != null) {
              this.resolvedAltCache[lut.address] = {
                value: alt,
                timestamp: Date.now()
              };
            }
            return alt;
          }
        })
      )
    ).filter((alt) => alt != null) as AddressLookupTableAccount[];
  }

  private updateCache(addresses: PublicKey[], lookupTables: LookupTable[]) {
    const now = Date.now();
    
    // If we find lookup tables, update local caches
    for (const lut of lookupTables) {
      const { address, containedAddresses } = lut;
      this.localLutCache[address] = {
        value: lut,
        timestamp: now
      };

      // Create a reverse index from contained address => lookupTable
      for (const containedAddr of containedAddresses) {
        let indexed = this.reverseAddressIndex[containedAddr];
        if (!indexed) {
          indexed = new Set();
          this.reverseAddressIndex[containedAddr] = indexed;
        }
        indexed.add(address);
      }
    }

    // For each original address, if no corresponding lookup table, add a miss
    for (const addr of addresses) {
      if (!this.reverseAddressIndex[addr.toString()]) {
        this.localCacheMiss[addr.toString()] = now;
      }
    }
  }
}
