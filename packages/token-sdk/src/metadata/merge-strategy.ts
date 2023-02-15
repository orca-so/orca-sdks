import { PublicKey } from "@solana/web3.js";
import { MintString } from "../models";
import { MetadataProvider, TokenMetadata } from "./models";

export type MetadataMergeStrategy = (
  mints: PublicKey[],
  providers: MetadataProvider[]
) => Promise<Record<MintString, Partial<TokenMetadata>>>;

// Get metadata from all providers
// Merge metadata with providers earlier in the list taking precendence
export const DEFAULT_MERGE_STRATEGY = async (
  mints: PublicKey[],
  providers: MetadataProvider[]
): Promise<Record<MintString, Partial<TokenMetadata>>> => {
  const metadatas = await Promise.all(providers.map((provider) => provider.findMany(mints)));
  const results: Record<MintString, Partial<TokenMetadata>> = {};
  mints.forEach((mint) => {
    const mintString = mint.toBase58();
    const merged: Partial<TokenMetadata> = {};
    metadatas.forEach((metadata) => {
      const data = metadata[mintString];
      if (!data) {
        return;
      }
      if (!merged.name) {
        merged.name = data.name;
      }
      if (!merged.symbol) {
        merged.symbol = data.symbol;
      }
      if (!merged.image) {
        merged.image = data.image;
      }
    });
    results[mintString] = merged;
  });
  return results;
};
