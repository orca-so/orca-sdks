import { AddressUtil } from "@orca-so/common-sdk";
import { Address } from "@project-serum/anchor";
import {
  MetadataProvider,
  ReadonlyTokenMetadata,
  ReadonlyTokenMetadataMap,
  TokenMetadata,
} from "./types";

export class FileSystemProvider implements MetadataProvider {
  constructor(private readonly _cache: Record<string, Partial<TokenMetadata>> = {}) {}

  find(address: Address): Promise<ReadonlyTokenMetadata> {
    const mint = AddressUtil.toPubKey(address).toBase58();
    return Promise.resolve(this._cache[mint] ?? null);
  }

  findMany(addresses: Address[]): Promise<ReadonlyTokenMetadataMap> {
    const mints = AddressUtil.toPubKeys(addresses).map((mint) => mint.toBase58());
    return Promise.resolve(
      Object.fromEntries(mints.map((mint) => [mint, this._cache[mint] ?? null]))
    );
  }
}
