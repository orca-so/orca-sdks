import { PublicKey } from "@solana/web3.js";
import { MintString } from "../models";

export interface MetadataProvider {
  find(mint: PublicKey): Promise<Partial<TokenMetadata | null>>;
  findMany(mints: PublicKey[]): Promise<Record<MintString, Partial<TokenMetadata> | null>>;
}

export interface TokenMetadata {
  symbol: string;
  name: string;
  image: string;
}
