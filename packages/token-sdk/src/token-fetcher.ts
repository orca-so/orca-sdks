import { Connection } from "@solana/web3.js";
import { AccountFetcher, Address, ParsableEntity, SimpleAccountFetcher } from "@orca-so/common-sdk";
import { Token } from "./types";
import { AddressUtil, ParsableMintInfo } from "@orca-so/common-sdk";
import { Mint } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { MetadataProvider, MetadataUtil, ReadonlyMetadataMap, ReadonlyMetadata } from "./metadata";
import pTimeout from "p-timeout";

const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

type ReadonlyToken = Readonly<Token>;
type ReadonlyTokenMap = Map<string, ReadonlyToken>;

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

  public async find(address: Address, refresh: boolean = false): Promise<ReadonlyToken> {
    const mint = AddressUtil.toPubKey(address);
    const mintString = mint.toBase58();
    if (refresh || !this.contains(mintString)) {
      const mintInfo = await this.request(this.accountFetcher.getAccount(mint, ParsableMintInfo));
      invariant(mintInfo, "Mint not found");
      this._cache.set(mintString, {
        mint: mintString,
        decimals: mintInfo.decimals,
      });

      for (const provider of this.providers) {
        try {
          const metadata = await this.request(provider.find(address));
          this._cache.set(mintString, mergeMetadata(this._cache.get(mintString)!, metadata));
        } catch (err) {
          console.warn(`Failed to fetch from ${provider.constructor.name}: ${err}`);
          continue;
        }
        if (!MetadataUtil.isPartial(this._cache.get(mintString)!)) {
          break;
        }
      }
    }
    return this._cache.get(mintString)!;
  }

  public async findMany(addresses: Address[], refresh: boolean = false): Promise<ReadonlyTokenMap> {
    const mints = AddressUtil.toPubKeys(addresses);
    const misses = refresh ? mints : mints.filter((mint) => !this.contains(mint.toBase58()));

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
        let metadatas: ReadonlyMetadataMap;
        try {
          metadatas = await this.request(provider.findMany(next));
        } catch (e) {
          console.warn(`Metadata provider ${provider.constructor.name} timed out. Skipping...`);
          metadatas = new Map();
        }
        next = [];
        misses.forEach((mint) => {
          const mintString = mint.toBase58();
          this._cache.set(
            mintString,
            mergeMetadata(this._cache.get(mintString)!, metadatas.get(mintString))
          );
          if (MetadataUtil.isPartial(this._cache.get(mintString)!)) {
            next.push(mint);
          }
        });
        if (next.length === 0) {
          break;
        }
      }
    }

    return new Map(mints.map((mint) => [mint.toBase58(), this._cache.get(mint.toBase58())!]));
  }

  private contains(mint: string): boolean {
    return this._cache.get(mint) !== undefined;
  }

  private request<T>(promise: PromiseLike<T>) {
    return pTimeout(promise, this.timeoutMs);
  }
}

function mergeMetadata(token: Token, metadata?: ReadonlyMetadata): Token {
  if (metadata === null || metadata === undefined) {
    return token;
  }
  return {
    mint: token.mint,
    decimals: token.decimals,
    ...MetadataUtil.merge(token, metadata),
  };
}
