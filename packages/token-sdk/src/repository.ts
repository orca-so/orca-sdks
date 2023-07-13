import { Address } from "@orca-so/common-sdk";
import { Mintlist, Token } from "./types";
import { TokenFetcher } from "./fetcher";

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
  private readonly mintMap: Map<string, string[]> = new Map();
  private readonly tagMap: Map<string, string[]> = new Map();
  private readonly excluded: Set<string> = new Set();

  constructor(private readonly fetcher: TokenFetcher) {}

  /**
   * Adds a mint to the repository. If the mint already exists, the tags are merged.
   * @param mint Mint to add
   * @param tags Tags to add to the mint
   * @returns This instance of the repository
   */
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

  /**
   * Adds multiple mints to the repository. If a mint already exists, the tags are merged. Tags are
   * added to all mints.
   * @param mints Mints to add
   * @param tags Tags to add to the mints
   * @returns This instance of the repository
   */
  addMints(mints: Address[], tags: string[] = []): TokenRepository {
    mints.forEach((mint) => this.addMint(mint, tags));
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
   * Gets token metadata and tags for a given mint. If the mint is excluded, null is returned.
   * @param mint Mint to get
   * @returns Token metadata and tags. Null if mint is excluded.
   */
  async get(mint: Address, refresh = false): Promise<TokenWithTags | null> {
    if (this.excluded.has(mint.toString())) {
      return null;
    }
    const token = await this.fetcher.find(mint, refresh);
    return { ...token, tags: this.mintMap.get(mint.toString()) ?? [] };
  }

  /**
   * Gets token metadata and tags for the given mints. If a mint is excluded, it is not returned.
   * @param mints Mints to get
   * @returns Token metadata and tags for the given mints. Excluded mints are not returned.
   */
  async getMany(mints: Address[], refresh = false): Promise<TokenWithTags[]> {
    const tokens = await this.fetcher.findMany(Array.from(mints), refresh);
    return Array.from(tokens.values())
      .filter((token) => !this.excluded.has(token.mint.toString()))
      .map((token) => ({
        ...token,
        tags: this.mintMap.get(token.mint.toString()) ?? [],
      }));
  }

  /**
   * Gets all token metadata and tags for all mints with the given tag. If a mint is excluded, it
   * is not returned.
   * @param tag Tag to get
   * @returns Token metadata and tags for all mints with the given tag. Excluded mints are not
   * returned.
   */
  async getByTag(tag: string, refresh = false): Promise<TokenWithTags[]> {
    const mints = this.tagMap.get(tag) ?? [];
    return this.getMany(mints, refresh);
  }
}
