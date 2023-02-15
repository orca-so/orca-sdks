import { PublicKey } from "@solana/web3.js";

export type Token = TokenMint & TokenDecimals & Partial<TokenMetadata>;

export type TokenMint = { mint: PublicKey };
export type TokenDecimals = { decimals: number };

export type MintString = string;

export interface TokenMetadata {
  symbol: string;
  name: string;
  image: string;
}
export interface Tokenlist {
  mints: PublicKey[];
}
export interface TokenProvider {
  find(mint: PublicKey): Promise<Token>;
  findMany(mints: PublicKey[]): Promise<Record<MintString, Token[]>>;
}

export interface MetadataProvider {
  find(mint: PublicKey): Promise<Partial<TokenMetadata>>;
  findMany(mints: PublicKey[]): Promise<Record<MintString, Partial<TokenMetadata> | null>>;
}
