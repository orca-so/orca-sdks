import { Address, AddressUtil } from "@orca-so/common-sdk";
import { Metadata, MetadataProvider } from "./types";

export class FileSystemProvider implements MetadataProvider {
  constructor(private _cache: Map<string, Metadata | null> = new Map()) {}

  setCache(cache: Map<string, Metadata | null>): void {
    this._cache = cache;
  }

  find(address: Address): Promise<Readonly<Metadata> | null> {
    const mint = AddressUtil.toPubKey(address).toBase58();
    return Promise.resolve(this._cache.get(mint) ?? null);
  }

  findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    const mints = AddressUtil.toPubKeys(addresses).map((mint) => mint.toBase58());
    return Promise.resolve(new Map(mints.map((mint) => [mint, this._cache.get(mint) ?? null])));
  }
}
