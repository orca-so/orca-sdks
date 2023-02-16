import { Address } from "@project-serum/anchor";
import { MintString } from "../models";

export interface MetadataProvider {
  find(address: Address): Promise<Partial<TokenMetadata | null>>;
  findMany(addresses: Address[]): Promise<Record<MintString, Partial<TokenMetadata> | null>>;
}

export interface TokenMetadata {
  symbol: string;
  name: string;
  image: string;
}
