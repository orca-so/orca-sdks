import { Address } from "@orca-so/common-sdk";
import { Mintlist, Token } from "./types";
import { TokenFetcher } from "./fetcher";

export type TokenWithTags = Token & { tags: string[] };

export class TokenRepository {
  private readonly mintMap: Map<string, string[]> = new Map();
  private readonly tagMap: Map<string, string[]> = new Map();
  private readonly excluded: Set<string> = new Set();

  constructor(private readonly fetcher: TokenFetcher) {}

  addMint(mint: Address, tags: string[] = []): TokenRepository {
    const mintString = mint.toString();
    const tagSet = new Set(this.mintMap.get(mintString));
    tags.forEach((tag) => tagSet.add(tag));
    this.mintMap.set(mintString, Array.from(tagSet));

    tags.forEach((tag) => {
      const mintSet = new Set(this.tagMap.get(tag));
      mintSet.add(mintString);
      this.tagMap.set(tag, Array.from(mintSet));
    });
    return this;
  }

  addMints(mints: Address[], tags: string[] = []): TokenRepository {
    mints.forEach((mint) => this.addMint(mint, tags));
    return this;
  }

  addMintlist(mintlist: Mintlist, tags: string[] = []): TokenRepository {
    return this.addMints(mintlist.mints, tags);
  }

  excludeMints(mints: Address[]): TokenRepository {
    mints.forEach((mint) => this.excluded.add(mint.toString()));
    return this;
  }

  async getAll(): Promise<TokenWithTags[]> {
    const mints = this.mintMap.keys();
    return this.getMany(Array.from(mints));
  }

  async get(mint: Address): Promise<TokenWithTags | null> {
    if (this.excluded.has(mint.toString())) {
      return null;
    }
    const token = await this.fetcher.find(mint);
    return { ...token, tags: this.mintMap.get(mint.toString()) ?? [] };
  }

  async getMany(mints: Address[]): Promise<TokenWithTags[]> {
    const tokens = await this.fetcher.findMany(Array.from(mints));
    return Array.from(tokens.values())
      .filter((token) => !this.excluded.has(token.mint.toString()))
      .map((token) => ({
        ...token,
        tags: this.mintMap.get(token.mint.toString()) ?? [],
      }));
  }

  async getByTag(tag: string): Promise<TokenWithTags[]> {
    const mints = this.tagMap.get(tag) ?? [];
    return this.getMany(mints);
  }
}
