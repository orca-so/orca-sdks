import { Connection } from "@solana/web3.js";
import { Address } from "@project-serum/anchor";
import { Token } from "./types";
import {
  AddressUtil,
  getMultipleParsedAccounts,
  getParsedAccount,
  ParsableMintInfo,
} from "@orca-so/common-sdk";
import { MintInfo } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { MetadataProvider, MetadataUtil, TokenMetadata } from "./metadata";
import pTimeout from "p-timeout";

const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

type ReadonlyToken = Readonly<Token>;
type ReadonlyTokenMap = Readonly<Record<string, ReadonlyToken>>;

export class TokenFetcher {
  private readonly connection: Connection;
  private readonly providers: MetadataProvider[] = [];
  private readonly timeoutMs: number;
  private _cache: Record<string, Token> = {};

  constructor(connection: Connection, timeoutMs: number = TIMEOUT_MS) {
    this.connection = connection;
    this.timeoutMs = timeoutMs;
  }

  public setCache(cache: Record<string, Token>): TokenFetcher {
    this._cache = cache;
    return this;
  }

  public addProvider(provider: MetadataProvider): TokenFetcher {
    this.providers.push(provider);
    return this;
  }

  public async find(address: Address): Promise<ReadonlyToken> {
    const mint = AddressUtil.toPubKey(address);
    const mintString = mint.toBase58();
    if (!this.contains(mintString)) {
      const mintInfo = await this.request(
        getParsedAccount(this.connection, mint, ParsableMintInfo)
      );
      invariant(mintInfo, "Mint info not found");
      this._cache[mintString] = {
        mint: mintString,
        decimals: mintInfo.decimals,
      };

      for (const provider of this.providers) {
        try {
          const metadata = await this.request(provider.find(address));
          this._cache[mintString] = mergeMetadata(this._cache[mintString], metadata);
        } catch (err) {
          console.warn(`Failed to fetch from ${provider.constructor.name}: ${err}`);
          continue;
        }
        if (!MetadataUtil.isPartial(this._cache[mintString])) {
          break;
        }
      }
    }
    return { ...this._cache[mintString] };
  }

  public async findMany(addresses: Address[]): Promise<ReadonlyTokenMap> {
    const mints = AddressUtil.toPubKeys(addresses);
    const misses = mints.filter((mint) => !this.contains(mint.toBase58()));

    if (misses.length > 0) {
      const mintInfos = (
        await this.request(getMultipleParsedAccounts(this.connection, misses, ParsableMintInfo))
      ).filter((mintInfo): mintInfo is MintInfo => mintInfo !== null);
      invariant(misses.length === mintInfos.length, "At least one mint info not found");
      misses.forEach((mint, index) => {
        const mintString = mint.toBase58();
        this._cache[mintString] = {
          mint: mintString,
          decimals: mintInfos[index].decimals,
        };
      });

      let next = misses;
      for (const provider of this.providers) {
        let metadatas: Record<string, Partial<TokenMetadata> | null>;
        try {
          metadatas = await this.request(provider.findMany(next));
        } catch (e) {
          console.warn(`Metadata provider ${provider.constructor.name} timed out. Skipping...`);
          metadatas = {};
        }
        next = [];
        misses.forEach((mint) => {
          const mintString = mint.toBase58();
          this._cache[mintString] = mergeMetadata(this._cache[mintString], metadatas[mintString]);
          if (MetadataUtil.isPartial(this._cache[mintString])) {
            next.push(mint);
          }
        });
        if (next.length === 0) {
          break;
        }
      }
    }

    return Object.fromEntries(
      mints.map((mint) => [mint.toBase58(), { ...this._cache[mint.toBase58()] }])
    );
  }

  private contains(mint: string): boolean {
    return !!this._cache[mint] && !MetadataUtil.isPartial(this._cache[mint]);
  }

  private request<T>(promise: PromiseLike<T>) {
    return pTimeout(promise, this.timeoutMs);
  }
}

function mergeMetadata(token: Token, metadata: Partial<TokenMetadata> | null): Token {
  if (metadata === null) {
    return token;
  }
  return {
    mint: token.mint,
    decimals: token.decimals,
    ...MetadataUtil.merge(token, metadata),
  };
}
