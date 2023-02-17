import { Address } from "@project-serum/anchor";

export interface MetadataProvider {
  find(address: Address): Promise<Partial<TokenMetadata | null>>;
  findMany(addresses: Address[]): Promise<Record<string, Partial<TokenMetadata> | null>>;
}

export interface TokenMetadata {
  symbol: string;
  name: string;
  image: string;
}
