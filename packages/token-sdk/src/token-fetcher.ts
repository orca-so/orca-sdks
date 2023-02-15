import { Connection, PublicKey } from "@solana/web3.js";
import { MintString, Token } from "./models";
import { getMultipleParsedAccounts, getParsedAccount, ParsableMintInfo } from "@orca-so/common-sdk";
import { MintInfo } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { MetadataProvider, MetadataMergeStrategy, DEFAULT_MERGE_STRATEGY } from "./metadata";

export class TokenFetcher {
  private readonly connection: Connection;
  private readonly _cache: Record<MintString, Token> = {};
  private readonly providers: MetadataProvider[] = [];
  private mergeStrategy: MetadataMergeStrategy = DEFAULT_MERGE_STRATEGY;

  private constructor(connection: Connection, cache: Record<MintString, Token> = {}) {
    this.connection = connection;
    this._cache = cache;
  }

  public static from(connection: Connection, cache?: Record<MintString, Token>): TokenFetcher {
    return new TokenFetcher(connection, cache);
  }

  public addProvider(provider: MetadataProvider): TokenFetcher {
    this.providers.push(provider);
    return this;
  }

  public setMergeStrategy(mergeStrategy: MetadataMergeStrategy): TokenFetcher {
    this.mergeStrategy = mergeStrategy;
    return this;
  }

  public async find(mint: PublicKey): Promise<Token> {
    const mintString = mint.toBase58();
    if (!this._cache[mintString]) {
      const mintInfo = await getParsedAccount(this.connection, mint, ParsableMintInfo);
      invariant(mintInfo, "Mint info not found");
      const metadata = await this.mergeStrategy([mint], this.providers);
      this._cache[mintString] = { mint, decimals: mintInfo.decimals, ...metadata[mintString] };
    }
    return { ...this._cache[mintString] };
  }

  public async findMany(mints: PublicKey[]): Promise<Record<MintString, Token>> {
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

    return Object.fromEntries(
      mints.map((mint) => [mint.toBase58(), { ...this._cache[mint.toBase58()] }])
    );
  }
}
