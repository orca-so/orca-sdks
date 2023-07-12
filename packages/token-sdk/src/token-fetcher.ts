import { Connection } from "@solana/web3.js";
import { Token } from "./types";
import {
  AccountFetcher,
  Address,
  AddressUtil,
  ParsableEntity,
  ParsableMintInfo,
  SimpleAccountFetcher,
} from "@orca-so/common-sdk";
import { Mint } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { Metadata, MetadataProvider, MetadataUtil } from "./metadata";
import pTimeout from "p-timeout";

const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export class TokenFetcher {
  private readonly providers: MetadataProvider[] = [];
  private readonly timeoutMs: number;
  private readonly accountFetcher: AccountFetcher<Mint, any>;
  private _cache: Map<string, Token> = new Map();

  constructor(connection: Connection, timeoutMs: number = TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
    this.accountFetcher = new SimpleAccountFetcher(
      connection,
      new Map<ParsableEntity<Mint>, number>([[ParsableMintInfo, Number.POSITIVE_INFINITY]])
    );
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
      const mintInfo = await this.request(this.accountFetcher.getAccount(mint, ParsableMintInfo));
      invariant(mintInfo, "Mint not found");

      let token: Token = {
        mint: mintString,
        decimals: mintInfo.decimals,
      };
      for (const provider of this.providers) {
        try {
          const metadata = await this.request(provider.find(address));
          token = mergeMetadata(token, metadata);
          this._cache.set(mintString, token);
        } catch (err) {
          console.warn(`Failed to fetch from ${provider.constructor.name}: ${err}`);
          continue;
        }
        if (!MetadataUtil.isPartial(token)) {
          break;
        }
      }
    }
    return this._cache.get(mintString)!;
  }

  public async findMany(
    addresses: Address[],
    refresh: boolean = false
  ): Promise<ReadonlyMap<string, Token>> {
    const mints = AddressUtil.toPubKeys(addresses);
    const misses = refresh ? mints : mints.filter((mint) => !this._cache.has(mint.toBase58()));

    if (misses.length > 0) {
      const mintInfos = (
        await this.request(this.accountFetcher.getAccountsAsArray(misses, ParsableMintInfo))
      ).filter((mintInfo): mintInfo is Mint => mintInfo !== null);
      invariant(misses.length === mintInfos.length, "At least one mint info not found");
      misses.forEach((mint, index) => {
        const mintString = mint.toBase58();
        this._cache.set(mintString, {
          mint: mintString,
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
          const mintString = mint.toBase58();
          const cachedValue = this._cache.get(mintString);
          invariant(cachedValue, "Cache should have been populated with mint info");
          const token = mergeMetadata(cachedValue, metadatas.get(mintString));
          this._cache.set(mintString, token);
          if (MetadataUtil.isPartial(token)) {
            next.push(mint);
          }
        });
        if (next.length === 0) {
          break;
        }
      }
    }

    return new Map(
      mints.map((mint) => {
        const cachedValue = this._cache.get(mint.toBase58());
        invariant(cachedValue, "expecting mints to be in cache");
        return [mint.toBase58(), cachedValue];
      })
    );
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
