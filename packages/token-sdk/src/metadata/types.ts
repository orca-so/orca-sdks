import { Address } from "@project-serum/anchor";

export type ReadonlyTokenMetadata = Readonly<Partial<TokenMetadata>> | null;
export type ReadonlyTokenMetadataMap = Readonly<Record<string, ReadonlyTokenMetadata>>;

export interface MetadataProvider {
  find(address: Address): Promise<ReadonlyTokenMetadata>;
  findMany(addresses: Address[]): Promise<ReadonlyTokenMetadataMap>;
}

export interface TokenMetadata {
  symbol: string;
  name: string;
  image: string;
}
