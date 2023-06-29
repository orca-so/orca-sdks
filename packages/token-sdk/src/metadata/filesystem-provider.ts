import { Address, AddressUtil } from "@orca-so/common-sdk";
import { MetadataProvider, ReadonlyMetadata, ReadonlyMetadataMap } from "./types";

export class FileSystemProvider implements MetadataProvider {
  constructor(private readonly _cache: ReadonlyMetadataMap = new Map()) {}

  find(address: Address): Promise<ReadonlyMetadata> {
    const mint = AddressUtil.toPubKey(address).toBase58();
    return Promise.resolve(this._cache.get(mint) ?? null);
  }

  findMany(addresses: Address[]): Promise<ReadonlyMetadataMap> {
    const mints = AddressUtil.toPubKeys(addresses).map((mint) => mint.toBase58());
    return Promise.resolve(new Map(mints.map((mint) => [mint, this._cache.get(mint) ?? null])));
  }
}
