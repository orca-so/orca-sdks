import { PublicKey } from "@solana/web3.js";
import { TokenMetadata } from "./metadata";

export type Token = TokenMint & TokenDecimals & Partial<TokenMetadata>;

export type TokenMint = { mint: PublicKey };
export type TokenDecimals = { decimals: number };

export type MintString = string;

export interface Tokenlist {
  mints: PublicKey[];
}

export interface MintStringList {
  mints: MintString[];
}
