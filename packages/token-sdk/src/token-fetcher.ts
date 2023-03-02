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

interface Opts {
  timeoutMs?: number;
  cache?: Record<string, Token>;
}

type ReadonlyToken = Readonly<Token>;
type ReadonlyTokenMap = Readonly<Record<string, ReadonlyToken>>;

export class TokenFetcher {
  private readonly connection: Connection;
  private readonly _cache: Record<string, Token>;
  private readonly providers: MetadataProvider[] = [];
  private readonly timeoutMs: number;

  private constructor(connection: Connection, opts: Opts) {
    this.connection = connection;
    this._cache = opts.cache ?? {};
    this.timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  }

  public static from(connection: Connection, opts: Opts = {}): TokenFetcher {
    return new TokenFetcher(connection, opts);
  }

  public addProvider(provider: MetadataProvider): TokenFetcher {
    this.providers.push(provider);
    return this;
  }

  public async find(address: Address): Promise<ReadonlyToken> {
    const mint = AddressUtil.toPubKey(address);
    const mintString = mint.toBase58();
    if (!this._cache[mintString]) {
      const mintInfo = await getParsedAccount(this.connection, mint, ParsableMintInfo);
      invariant(mintInfo, "Mint info not found");
      this._cache[mintString] = {
        mint: mintString,
        decimals: mintInfo.decimals,
      };

      for (const provider of this.providers) {
        const metadata = await provider.find(mint);
        const cachedValue = this._cache[mintString];
        this._cache[mintString] = {
          mint: cachedValue.mint,
          decimals: cachedValue.decimals,
          ...MetadataUtil.merge(cachedValue, metadata),
        };
        if (!MetadataUtil.isPartial(this._cache[mintString])) {
          break;
        }
      }
    }
    return { ...this._cache[mintString] };
  }

  public async findMany(addresses: Address[]): Promise<ReadonlyTokenMap> {
    const mints = AddressUtil.toPubKeys(addresses);
    const misses = mints.filter(
      (mint) =>
        !this._cache[mint.toBase58()] || MetadataUtil.isPartial(this._cache[mint.toBase58()])
    );

    if (misses.length > 0) {
      console.log(`Fetching mint info for ${misses.length} mints...`);
      const mintInfos = (
        await pTimeout(
          getMultipleParsedAccounts(this.connection, misses, ParsableMintInfo),
          this.timeoutMs
        )
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
          console.log(
            `Fetching metadata for ${next.length} mints from ${provider.constructor.name}...`
          );
          metadatas = await pTimeout(provider.findMany(next), this.timeoutMs);
        } catch (e) {
          console.warn(`Metadata provider ${provider.constructor.name} timed out. Skipping...`);
          metadatas = {};
        }
        next = [];
        misses.forEach((mint) => {
          const mintString = mint.toBase58();
          const cachedValue = this._cache[mintString];
          if (metadatas[mintString]) {
            this._cache[mintString] = {
              mint: cachedValue.mint,
              decimals: cachedValue.decimals,
              ...MetadataUtil.merge(cachedValue, metadatas[mintString]),
            };
          }
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
}
