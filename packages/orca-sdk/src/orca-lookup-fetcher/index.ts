import { LookupTable, LookupTableFetcher } from "@orca-so/common-sdk";
import { AddressLookupTableAccount, Connection, PublicKey } from "@solana/web3.js";
import { AxiosInstance } from "axios";

type OrcaLookupTableModel = {
  address: string;
  addresses: string[];
};

/**
 * Orca's implementation of LookupTableFetcher.
 *
 * This implementation fetches lookup tables from Orca's server to facilitate
 * ALT lookup for transactions.
 */
export class OrcaLookupTableFetcher implements LookupTableFetcher {
  private resolvedAltCache: { [key: string]: AddressLookupTableAccount } = {};
  private localLutCache: { [key: string]: LookupTable } = {};
  private localCacheMiss: Set<string> = new Set();
  private reverseAddressIndex: { [key: string]: Set<string> } = {};

  constructor(readonly server: AxiosInstance, readonly connection: Connection) {}

  async loadLookupTables(addresses: PublicKey[]): Promise<LookupTable[]> {
    // Server request ~ 200ms

    // Check whether any address is already indexed
    const matchedIndex = addresses.map((addr) => this.reverseAddressIndex[addr.toString()] || null);

    // Check to make sure either we've already missed a fetch on the address or that there is a match
    let allMatched = true;
    for (let i = 0; i < addresses.length; i++) {
      const matched = matchedIndex[i];
      if (matched == null && !this.localCacheMiss.has(addresses[i].toString())) {
        allMatched = false;
        break;
      }
    }

    // If all are matched or previously missed, use the cache
    if (allMatched) {
      const allLuts = [];
      for (let i = 0; i < matchedIndex.length; i++) {
        const rai = matchedIndex[i];
        if (rai) {
          allLuts.push(...Array.from(rai!));
        }
      }
      const lutSet = new Set(allLuts);
      return Array.from(lutSet).map((lut) => this.localLutCache[lut]);
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

  async getLookupTableAccountsForAddresses(
    addresses: PublicKey[]
  ): Promise<AddressLookupTableAccount[]> {
    const luts = await this.loadLookupTables(addresses);
    return (
      await Promise.all(
        luts.map(async (lut) => {
          if (this.resolvedAltCache[lut.address]) {
            return Promise.resolve(this.resolvedAltCache[lut.address]);
          } else {
            const alt = (await this.connection.getAddressLookupTable(new PublicKey(lut.address)))
              .value;
            if (alt != null) {
              this.resolvedAltCache[lut.address] = alt;
            }
            return alt;
          }
        })
      )
    ).filter((alt) => alt != null) as AddressLookupTableAccount[];
  }

  private updateCache(addresses: PublicKey[], lookupTables: LookupTable[]) {
    // If we find lookup tables, update local caches
    for (const lut of lookupTables) {
      const { address, containedAddresses } = lut;
      this.localLutCache[address] = lut;

      // Create a reverse index from contained address => lookupTable
      for (const containedAddr of containedAddresses) {
        let indexed = this.reverseAddressIndex[containedAddr];
        if (!indexed) {
          indexed = new Set();
        }
        indexed.add(address);
        this.reverseAddressIndex[containedAddr] = indexed;
      }
    }

    // For each original address, if no corresponding lookup table, add a miss
    for (const addr of addresses) {
      if (!this.reverseAddressIndex[addr.toString()]) {
        this.localCacheMiss.add(addr.toString());
      }
    }
  }
}
