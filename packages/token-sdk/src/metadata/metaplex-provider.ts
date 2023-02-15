import { isMetadata, Metaplex, Nft, Sft } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { MintString } from "../models";
import pLimit, { Limit } from "p-limit";
import { MetadataProvider, TokenMetadata } from "./models";

const DEFAULT_RPS = 50;

export class MetaplexProvider implements MetadataProvider {
  private readonly metaplex: Metaplex;
  private readonly limit: Limit;

  constructor(connection: Connection, rps: number = DEFAULT_RPS) {
    this.metaplex = Metaplex.make(connection);
    this.limit = pLimit(rps);
  }

  async find(mint: PublicKey): Promise<Partial<TokenMetadata | null>> {
    let metadata;
    try {
      metadata = await this.metaplex.nfts().findByMint({ mintAddress: mint });
    } catch (e) {
      return null;
    }

    // Use the Token Standard field to determine version of the metadata
    // https://docs.metaplex.com/programs/token-metadata/token-standard#the-token-standard-field
    if (!metadata.tokenStandard) {
      return transformMetadataV1_0(metadata);
    }
    return transformMetadataV1_1(metadata);
  }

  async findMany(mints: PublicKey[]): Promise<Record<MintString, Partial<TokenMetadata> | null>> {
    const results = await this.metaplex.nfts().findAllByMintList({ mints });
    const loaded = await Promise.all(
      results.map((result) => {
        if (!result) {
          return null;
        } else if (isMetadata(result)) {
          return this.limit(async () => this.metaplex.nfts().load({ metadata: result }));
        } else {
          return result;
        }
      })
    );
    return Object.fromEntries(
      loaded.map((metadata, index) => {
        const mint = mints[index].toBase58();
        let result: Partial<TokenMetadata> | null = null;
        if (metadata) {
          if (!metadata.tokenStandard) {
            result = transformMetadataV1_0(metadata);
          } else {
            result = transformMetadataV1_1(metadata);
          }
        }
        return [mint, result];
      })
    );
  }
}

// Token is v1.0 standard. Many 1.0 tokens do not have off-chain JSON metadata.
// https://docs.metaplex.com/programs/token-metadata/changelog/v1.0
function transformMetadataV1_0(token: Sft | Nft): Partial<TokenMetadata> {
  return {
    symbol: token.symbol,
    name: token.name,
    image: token.jsonLoaded && token.json ? token.json.image : undefined,
  };
}

// Token is v1.1 standard, which means there should be an off-chain JSON metadata file.
function transformMetadataV1_1(token: Sft | Nft): Partial<TokenMetadata> {
  if (!token.jsonLoaded || !token.json) {
    throw new Error(`Metadata JSON should be present for v1.1 token: ${token.address.toBase58()}`);
  }
  return {
    symbol: token.json.symbol,
    name: token.json.name,
    image: token.json.image,
  };
}
