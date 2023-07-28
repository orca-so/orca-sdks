import { Address, AddressUtil } from "@orca-so/common-sdk";
import { Mintlist, Token } from "./types";
import { TokenFetcher } from "./fetcher";
import { Overrides } from "./metadata";

/**
 * Result of fetching a token from the repository.
 */
export type TokenResult = Token & {
  // Tags associated with the mint in the repository
  tags: string[];
  // Flag indicating if the mint was added to the repository
  exists: boolean;
};

type MintEntry = {
  exists: boolean;
  tags: Set<string>;
};

/**
 * Manages a local database of tokens mints and provides a way to attach additional metadata for
 * tokens by augmenting the results from a TokenFetcher.
 *
 * Tags - Enables adding tags to mints that can be used for labeling and filtering. Tags can be set
 * for mints without adding the mints to the repository.
 *
 * Overrides - Enables overriding metadata for mints. Overrides are applied to fetched tokens.
 *
 * Fetching- Provides methods for fetching token metadata that also includes tags and a flag that
 * indicates whether the token was added to this repository.
 */
export class TokenRepository {
  // Map from mint to mint tags and existence
  private readonly mintMap: Map<string, MintEntry> = new Map();
  // Map from tag to mints
  private readonly tagMap: Map<string, Set<string>> = new Map();
  // Map of metadata overrides applied to fetched TokenResults
  private overrides: Overrides = {};

  constructor() {
    this.toTokenResult = this.toTokenResult.bind(this);
  }

  /**
   * Adds a mint to the repository with the given tags. If the mint exists, tags are merged.
   * @param mint Mint to add
   * @param tags Tags to add to the mint
   * @returns This instance of the repository
   */
  addMint(mint: Address, tags: string[] = []): TokenRepository {
    return this.setMints([mint], tags, true);
  }

  /**
   * Adds multiple mints to the repository with the given tags. If a mint exists, tags are merged.
   * Tags are added to all mints.
   * @param mints Mints to add
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  addMints(mints: Address[], tags: string[] = []): TokenRepository {
    return this.setMints(mints, tags, true);
  }

  /**
   * Add all mints in a mintlist to the repository. If a mint exists, tags are merged. Tags are
   * added to all mints.
   * @param mintlist Mintlist to add
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  addMintlist(mintlist: Mintlist, tags: string[] = []): TokenRepository {
    return this.setMints(mintlist.mints, tags, true);
  }

  /**
   * Tags a mint with the given tags without adding the mint to the repository. If the mint is added
   * later, it will have the given tags.
   * @param mint Mint to tag
   * @param tags Tags to add to the mint
   * @returns This instance of the repository
   */
  tagMint(mint: Address, tags: string[]): TokenRepository {
    return this.setMints([mint], tags, false);
  }

  /**
   * Tags multiple mints with the given tags without adding the mints to the repository. If the
   * mints are added later, they will have the given tags.
   * @param mints Mints to tag
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  tagMints(mints: Address[], tags: string[]): TokenRepository {
    return this.setMints(mints, tags, false);
  }

  /**
   * Tags all mints in a mintlist with the given tags without adding the mints to the repository.
   * If the mints are added later, they will have the given tags.
   * @param mintlist Mintlist to tag
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  tagMintlist(mintlist: Mintlist, tags: string[]): TokenRepository {
    return this.setMints(mintlist.mints, tags, false);
  }

  /**
   * Fetches all token metadata and tags for all unexcluded mints in the repository.
   *
   * @param fetcher TokenFetcher to use
   * @param refresh If true, fetches metadata from all providers. If false, uses cached metadata.
   * @returns All token metadatas with tags in the repository
   */
  async fetchAll(fetcher: TokenFetcher, refresh = false): Promise<TokenResult[]> {
    const mints = Array.from(this.mintMap.entries())
      .filter(([, entry]) => entry.exists)
      .map(([mint]) => mint);
    return this.fetchMany(fetcher, mints, refresh);
  }

  /**
   * Fetches token metadata and tags for a given mint.
   * If the mint is excluded, null is returned.
   * If the mint is not in the repository, null is returned.
   *
   * @param fetcher TokenFetcher to use
   * @param mint Mint to get
   * @param refresh If true, fetches metadata from all providers. If false, uses cached metadata.
   * @returns Token metadata and tags. Null if mint is excluded.
   */
  async fetch(fetcher: TokenFetcher, mint: Address, refresh = false): Promise<TokenResult> {
    const token = await fetcher.find(mint, refresh);
    return this.toTokenResult(token);
  }

  /**
   * Fetches token metadata and tags for the given mints that are in the repository.
   * If a mint is excluded, it is not returned.
   * If a mint is not in the repository, it is not returned.
   *
   * @param fetcher TokenFetcher to use
   * @param mints Mints to get
   * @param refresh If true, fetches metadata from all providers. If false, uses cached metadata.
   * @returns Token metadata and tags for the given mints. Excluded mints are not returned.
   */
  async fetchMany(
    fetcher: TokenFetcher,
    mints: Address[],
    refresh = false
  ): Promise<TokenResult[]> {
    const tokens = await fetcher.findMany(mints, refresh);
    return Array.from(tokens.values()).map(this.toTokenResult);
  }

  /**
   * Fetches all token metadata and tags for all mints with the given tag.
   * If a mint is excluded, it is not returned.
   * If a mint is not in the repository, it is not returned.
   * @param fetcher TokenFetcher to use
   * @param tag Tag to get
   * @param refresh If true, fetches metadata from all providers. If false, uses cached metadata.
   * @returns Token metadata and tags for all mints with the given tag. Excluded mints are not
   * returned.
   */
  async fetchByTag(fetcher: TokenFetcher, tag: string, refresh = false): Promise<TokenResult[]> {
    const mintSet = this.tagMap.get(tag);
    if (!mintSet) {
      return [];
    }
    return this.fetchMany(fetcher, Array.from(mintSet), refresh);
  }

  /**
   * Returns true if the given mint is in the repository and, if tag is provided, has the given tag.
   * @param mint Mint to check
   * @param tag Tag to check
   * @returns True if the mint is in the repository and has the given tag
   */
  has(mint: Address, tag?: string): boolean {
    const mintString = mint.toString();
    if (tag === undefined) {
      return this.mintMap.has(mintString);
    }
    const entry = this.mintMap.get(mintString);
    return entry?.tags.has(tag) ?? false;
  }

  /**
   * Sets metadata overrides for the repository. Overrides metadata take precedence over all other
   * metadata sources.
   * @param overrides Metadata overrides
   * @returns This instance of the repository
   */
  setOverrides(overrides: Overrides): TokenRepository {
    this.overrides = overrides;
    return this;
  }

  /**
   * Internal method to set mint metadata in the repository. The entry stores tags as well as a flag
   * indicating existence in the repository.
   * @param mints Mints to process
   * @param tags Tags to add to the mints
   * @param addToRepo Flag indicating whether to add the mints to the repository
   * @returns This instance of the repository
   */
  private setMints(mints: Address[], tags: string[] = [], addToRepo: boolean): TokenRepository {
    mints.forEach((mint) => {
      const mintString = mint.toString();
      if (!this.mintMap.has(mintString)) {
        this.mintMap.set(mintString, { exists: addToRepo, tags: new Set() });
      }
      const entry = this.mintMap.get(mintString)!;
      if (addToRepo) {
        entry.exists = true;
      }
      tags.forEach((tag) => entry.tags.add(tag));
      this.mintMap.set(mintString, entry);
    });

    tags.forEach((tag) => {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      const mintSet = this.tagMap.get(tag)!;
      AddressUtil.toStrings(mints).forEach((mint) => mintSet.add(mint));
    });
    return this;
  }

  /**
   * Converts to TokenResult by adding tags, overrides, and exist flag derived from repo state.
   * @param token Token to convert
   * @returns TokenResult with tags and existence flag
   */
  private toTokenResult(token: Token): TokenResult {
    const mintString = token.mint.toString();
    const entry = this.mintMap.get(mintString);
    const overrides = this.overrides[mintString];
    return {
      ...token,
      ...overrides,
      exists: entry ? entry.exists : false,
      tags: entry ? Array.from(entry.tags) : [],
    };
  }
}
