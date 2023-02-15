import { Connection, PublicKey } from "@solana/web3.js";
import { MetadataProvider, MintString, Token, TokenMetadata } from "../token";
import { getMultipleParsedAccounts, ParsableMintInfo } from "@orca-so/common-sdk";
import { MintInfo } from "@solana/spl-token";
import invariant from "tiny-invariant";

export class TokenProvider {
  private readonly connection: Connection;
  private readonly _cache: Record<MintString, Token> = {};
  private readonly providers: MetadataProvider[];
  private readonly mergeStrategy: MetadataMergeStrategy;

  constructor(
    connection: Connection,
    providers: MetadataProvider[],
    mergeStrategy: MetadataMergeStrategy = defaultMergeStrategy
  ) {
    this.connection = connection;
    this.providers = providers;
    this.mergeStrategy = mergeStrategy;
  }

  // TODO(tmoc): Add static constructors that also build from a cache.
  public static fromCache(connection: Connection, providers: MetadataProvider[], cache: string) {}

  async find(mint: PublicKey): Promise<Token> {
    const mintString = mint.toBase58();
    if (!this._cache[mintString]) {
      const buffer = await this.connection.getAccountInfo(mint);
      const mintInfo = ParsableMintInfo.parse(buffer?.data);
      invariant(mintInfo, "Mint info not found");
      const metadata = await this.mergeStrategy([mint], this.providers);
      this._cache[mintString] = { mint, decimals: mintInfo.decimals, ...metadata[mintString] };
    }
    return this._cache[mintString];
  }

  async findMany(mints: PublicKey[]): Promise<Record<MintString, Token>> {
    const misses = mints.filter((mint) => !this._cache[mint.toBase58()]);

    if (misses.length > 0) {
      const mintInfos = (
        await getMultipleParsedAccounts(this.connection, misses, ParsableMintInfo)
      ).filter((mintInfo): mintInfo is MintInfo => mintInfo !== null);
      invariant(misses.length === mintInfos.length, "At least one mint info not found");

      const metadatas = await this.mergeStrategy(misses, this.providers);
      misses.forEach((mint, index) => {
        const mintString = mint.toBase58();
        this._cache[mintString] = {
          mint,
          decimals: mintInfos[index].decimals,
          ...metadatas[mintString],
        };
      });
    }

    return Object.fromEntries(mints.map((mint) => [mint.toBase58(), this._cache[mint.toBase58()]]));
  }
}

export type MetadataMergeStrategy = (
  mints: PublicKey[],
  providers: MetadataProvider[]
) => Promise<Record<MintString, Partial<TokenMetadata>>>;

// Get metadata from all providers
// Merge metadata with providers earlier in the list taking precendence
async function defaultMergeStrategy(
  mints: PublicKey[],
  providers: MetadataProvider[]
): Promise<Record<MintString, Partial<TokenMetadata>>> {
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
}
