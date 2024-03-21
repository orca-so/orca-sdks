import { Connection } from "@solana/web3.js";
import { Token } from "./types";
import {
  Address,
  AddressUtil,
  ParsableMintInfo,
  getMultipleParsedAccounts,
  getParsedAccount,
} from "@orca-so/common-sdk";
import { Mint } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { Metadata, MetadataProvider, MetadataUtil } from "./metadata";
import pTimeout from "p-timeout";

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export class TokenFetcher {
  private readonly providers: MetadataProvider[] = [];
  private readonly connection: Connection;
  private readonly timeoutMs: number;
  private _cache: Map<string, Token> = new Map();

  constructor(connection: Connection, timeoutMs: number = TIMEOUT_MS) {
    this.connection = connection;
    this.timeoutMs = timeoutMs;
  }

  public setCache(cache: Map<string, Token>): TokenFetcher {
    this._cache = cache;
    return this;
  }

  public addProvider(provider: MetadataProvider): TokenFetcher {
    this.providers.push(provider);
    return this;
  }

  public async find(address: Address, refresh: boolean = false): Promise<Readonly<Token>> {
    const mint = AddressUtil.toPubKey(address);
    const mintString = mint.toBase58();
    if (refresh || !this._cache.has(mintString)) {
      const mintInfo = await this.request(
        getParsedAccount(this.connection, mint, ParsableMintInfo)
      );
      invariant(mintInfo, "Mint not found");
      this._cache.set(mintString, { mint: mintString, decimals: mintInfo.decimals });

      for (const provider of this.providers) {
        try {
          let token = this._cache.get(mintString);
          invariant(token, "Expecting token to be in cache");
          const metadata = await this.request(provider.find(address));
          token = mergeMetadata(token, metadata);
          this._cache.set(mintString, token);
          if (!MetadataUtil.isPartial(token)) {
            break;
          }
        } catch (err) {
          console.warn(`Failed to fetch from ${provider.constructor.name}: ${err}`);
          continue;
        }
      }
    }
    return this._cache.get(mintString)!;
  }

  public async findMany(
    addresses: Address[],
    refresh: boolean = false
  ): Promise<ReadonlyMap<string, Token>> {
    const mints = AddressUtil.toStrings(addresses);
    const misses = refresh ? mints : mints.filter((mint) => !this._cache.has(mint));

    if (misses.length > 0) {
      const mintInfos = (
        await this.request(getMultipleParsedAccounts(this.connection, misses, ParsableMintInfo))
      ).filter((mintInfo): mintInfo is Mint => mintInfo !== null);

      invariant(misses.length === mintInfos.length, "At least one mint info not found");
      misses.forEach((mint, index) => {
        this._cache.set(mint, {
          mint,
          decimals: mintInfos[index].decimals,
        });
      });

      let next = misses;
      for (const provider of this.providers) {
        let metadatas: ReadonlyMap<string, Metadata | null>;
        try {
          metadatas = await this.request(provider.findMany(next));
        } catch (e) {
          console.warn(`Metadata provider ${provider.constructor.name} timed out. Skipping...`);
          metadatas = new Map();
        }
        next = [];
        misses.forEach((mint) => {
          const cachedValue = this._cache.get(mint);
          invariant(cachedValue, "Expecting token to be in cache");
          const token = mergeMetadata(cachedValue, metadatas.get(mint));
          this._cache.set(mint, token);
          if (MetadataUtil.isPartial(token)) {
            next.push(mint);
          }
        });
        if (next.length === 0) {
          break;
        } else {
          console.warn(`Missed ${next.length} tokens from ${provider.constructor.name}. Trying next provider...`)
        }
      }
    }

    return new Map(mints.map((mint) => [mint, this._cache.get(mint)!]));
  }

  private request<T>(promise: PromiseLike<T>) {
    return pTimeout(promise, this.timeoutMs);
  }
}

function mergeMetadata(token: Token, metadata?: Readonly<Metadata> | null): Token {
  if (!metadata) {
    return token;
  }
  return {
    mint: token.mint,
    decimals: token.decimals,
    ...MetadataUtil.merge(token, metadata),
  };
}
