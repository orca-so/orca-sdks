import { Connection } from "@solana/web3.js";
import { Address } from "@project-serum/anchor";
import { Token } from "./models";
import {
  AddressUtil,
  getMultipleParsedAccounts,
  getParsedAccount,
  ParsableMintInfo,
} from "@orca-so/common-sdk";
import { MintInfo } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { MetadataProvider, TokenMetadata } from "./metadata";

export class TokenFetcher {
  private readonly connection: Connection;
  private readonly _cache: Record<string, Token> = {};
  private readonly providers: MetadataProvider[] = [];

  private constructor(connection: Connection, cache: Record<string, Token> = {}) {
    this.connection = connection;
    this._cache = cache;
  }

  public static from(connection: Connection, cache?: Record<string, Token>): TokenFetcher {
    return new TokenFetcher(connection, cache);
  }

  public addProvider(provider: MetadataProvider): TokenFetcher {
    this.providers.push(provider);
    return this;
  }

  public async find(address: Address): Promise<Token> {
    const mint = AddressUtil.toPubKey(address);
    const mintString = mint.toBase58();
    if (!this._cache[mintString]) {
      const mintInfo = await getParsedAccount(this.connection, mint, ParsableMintInfo);
      invariant(mintInfo, "Mint info not found");
      const metadata = mergeMetadata(
        await Promise.all(this.providers.map((provider) => provider.find(mint)))
      );
      this._cache[mintString] = {
        mint,
        decimals: mintInfo.decimals,
        ...metadata,
      };
    }
    return { ...this._cache[mintString] };
  }

  public async findMany(addresses: Address[]): Promise<Record<string, Token>> {
    const mints = AddressUtil.toPubKeys(addresses);
    const misses = mints.filter((mint) => !this._cache[mint.toBase58()]);

    if (misses.length > 0) {
      const mintInfos = (
        await getMultipleParsedAccounts(this.connection, misses, ParsableMintInfo)
      ).filter((mintInfo): mintInfo is MintInfo => mintInfo !== null);
      invariant(misses.length === mintInfos.length, "At least one mint info not found");

      const metadatas = await Promise.all(
        this.providers.map((provider) => provider.findMany(misses))
      );

      misses.forEach((mint, index) => {
        const mintString = mint.toBase58();
        const merged = mergeMetadata(metadatas.map((m) => m[mintString]));
        this._cache[mintString] = {
          mint,
          decimals: mintInfos[index].decimals,
          ...merged,
        };
      });
    }

    return Object.fromEntries(
      mints.map((mint) => [mint.toBase58(), { ...this._cache[mint.toBase58()] }])
    );
  }
}

function mergeMetadata(metadatas: Partial<TokenMetadata | null>[]): Partial<TokenMetadata> {
  const merged: Partial<TokenMetadata> = {};
  metadatas.forEach((metadata) => {
    if (!metadata) {
      return;
    }
    if (!merged.name) {
      merged.name = metadata.name;
    }
    if (!merged.symbol) {
      merged.symbol = metadata.symbol;
    }
    if (!merged.image) {
      merged.image = metadata.image;
    }
  });
  return merged;
}
