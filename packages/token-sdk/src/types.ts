import { TokenMetadata } from "./metadata";

export type Token = TokenMint & TokenDecimals & Partial<TokenMetadata>;

export interface TokenMint {
  mint: string;
}

export interface TokenDecimals {
  decimals: number;
}

export interface Tokenlist {
  name: string;
  tokens: Token[];
}

export interface Mintlist {
  name: string;
  mints: string[];
}
