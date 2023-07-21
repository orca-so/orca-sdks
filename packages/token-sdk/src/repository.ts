import { Address, AddressUtil } from "@orca-so/common-sdk";
import { Mintlist, Token } from "./types";
import { TokenFetcher } from "./fetcher";
import { Overrides } from "./metadata";
import { Connection } from "@solana/web3.js";

/**
 * Token with tags. Tags are strings that can be used to label tokens that do not exist on-chain.
 */
export type TokenWithTags = Token & { tags: string[] };

/**
 * Repository for managing a local instance of token mints and fetching token metadata.
 *
 * Mints can also be tagged with a string. This is useful when groups of mints need to be handled
 * together. For example, a UI may want to mark all mints labeled with a "whitelisted" tag.
 *
 * All mints managed by an instance of this class can be retrieved to represent all tokens in the
 * local state.
 */
export class TokenRepository {
  // Map from mint to tags
  private readonly mintMap: Map<string, Set<string>> = new Map();
  // Map from tag to mints
  private readonly tagMap: Map<string, Set<string>> = new Map();
  // Set of mints to exclude from retrieval of tokens via get methods
  private readonly excluded: Set<string> = new Set();

  constructor(private readonly fetcher: TokenFetcher) {}

  /**
   * Adds a mint to the repository. If the mint already exists, the tags are merged.
   * @param mint Mint to add
   * @param tags Tags to add to the mint
   * @returns This instance of the repository
   */
  addMint(mint: Address, tags: string[] = []): TokenRepository {
    return this.addMints([mint], tags);
  }

  /**
   * Adds multiple mints to the repository. If a mint already exists, the tags are merged. Tags are
   * added to all mints.
   * @param mints Mints to add
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  addMints(mints: Address[], tags: string[] = []): TokenRepository {
    mints.forEach((mint) => {
      const mintString = mint.toString();
      if (!this.mintMap.has(mintString)) {
        this.mintMap.set(mintString, new Set());
      }
      const tagSet = this.mintMap.get(mintString)!;
      tags.forEach((tag) => tagSet.add(tag));
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
   * Add all mints in a mintlist to the repository. If a mint already exists, the tags are merged.
   * Tags are added to all mints.
   * @param mintlist Mintlist to add
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  addMintlist(mintlist: Mintlist, tags: string[] = []): TokenRepository {
    return this.addMints(mintlist.mints, tags);
  }

  /**
   * Excludes mints from the repository. Excluded mints will not be returned by the repository in
   * any get methods. Once a mint is excluded, it cannot be unexcluded. If an excluded mint is added
   * to the repository, it will still be excluded.
   * @param mints Mints to exclude
   * @returns This instance of the repository
   */
  excludeMints(mints: Address[]): TokenRepository {
    mints.forEach((mint) => this.excluded.add(mint.toString()));
    return this;
  }

  /**
   * Excludes all mints in a mintlist from the repository. Excluded mints will not be returned by
   * the repository in any get methods. Once a mint is excluded, it cannot be unexcluded. If an
   * excluded mint is added to the repository, it will still be excluded.
   * @param mintlist Mintlist to exclude
   * @returns This instance of the repository
   */
  excludeMintlist(mintlist: Mintlist): TokenRepository {
    return this.excludeMints(mintlist.mints);
  }

  /**
   * Gets all token metadata and tags for all unexcluded mints in the repository.
   * @returns All token metadatas with tags in the repository
   */
  async getAll(refresh = false): Promise<TokenWithTags[]> {
    const mints = this.mintMap.keys();
    return this.getMany(Array.from(mints), refresh);
  }

  /**
   * Gets token metadata and tags for a given mint.
   * If the mint is excluded, null is returned.
   * If the mint is not in the repository, null is returned.
   * @param mint Mint to get
   * @returns Token metadata and tags. Null if mint is excluded.
   */
  async get(mint: Address, refresh = false): Promise<TokenWithTags | null> {
    const mintString = mint.toString();
    if (this.excluded.has(mintString) || !this.mintMap.has(mintString)) {
      return null;
    }
    const token = await this.fetcher.find(mint, refresh);
    const tagSet = this.mintMap.get(mint.toString());
    const tags = tagSet ? Array.from(tagSet) : [];
    return { ...token, tags };
  }

  /**
   * Gets token metadata and tags for the given mints that are in the repository.
   * If a mint is excluded, it is not returned.
   * If a mint is not in the repository, it is not returned.
   * @param mints Mints to get
   * @returns Token metadata and tags for the given mints. Excluded mints are not returned.
   */
  async getMany(mints: Address[], refresh = false): Promise<TokenWithTags[]> {
    const filteredMints = AddressUtil.toStrings(mints).filter(
      (mint) => this.mintMap.has(mint) && !this.excluded.has(mint)
    );
    const tokens = await this.fetcher.findMany(filteredMints, refresh);
    return Array.from(tokens.values()).map((token) => {
      const tagSet = this.mintMap.get(token.mint.toString());
      const tags = tagSet ? Array.from(tagSet) : [];
      return { ...token, tags };
    });
  }

  /**
   * Gets all token metadata and tags for all mints with the given tag.
   * If a mint is excluded, it is not returned.
   * If a mint is not in the repository, it is not returned.
   * @param tag Tag to get
   * @returns Token metadata and tags for all mints with the given tag. Excluded mints are not
   * returned.
   */
  async getByTag(tag: string, refresh = false): Promise<TokenWithTags[]> {
    const mintSet = this.tagMap.get(tag);
    if (!mintSet) {
      return [];
    }
    return this.getMany(Array.from(mintSet), refresh);
  }

  /**
   * Returns true if the given mint is in the repository and has the given tag.
   * @param mint Mint to check
   * @param tag Tag to check
   * @returns True if the mint is in the repository and has the given tag
   */
  hasTag(mint: Address, tag: string): boolean {
    const mintString = mint.toString();
    const tagSet = this.mintMap.get(mintString);
    return tagSet?.has(tag) ?? false;
  }

  /**
   * Sets metadata overrides for the repository. Overrides metadata take precedence over all other
   * metadata sources.
   * @param overrides Metadata overrides
   * @returns This instance of the repository
   */
  setOverrides(overrides: Overrides): TokenRepository {
    this.fetcher.setOverrides(overrides);
    return this;
  }
}
