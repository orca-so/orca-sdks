import { isMetadata, Metaplex, Nft, Sft } from "@metaplex-foundation/js";
import { Connection } from "@solana/web3.js";
import { Address } from "@project-serum/anchor";
import { MetadataProvider, TokenMetadata } from "./types";
import { AddressUtil } from "@orca-so/common-sdk";
import PQueue from "p-queue";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_INTERVAL_MS = 1000;

interface Opts {
  concurrency?: number;
  intervalMs?: number;
}

export class MetaplexProvider implements MetadataProvider {
  private readonly metaplex: Metaplex;
  private readonly queue: PQueue;

  constructor(connection: Connection, opts: Opts = {}) {
    const { concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.metaplex = Metaplex.make(connection);
    this.queue = new PQueue({ concurrency, interval: intervalMs });
  }

  async find(address: Address): Promise<Partial<TokenMetadata> | null> {
    let metadata;
    try {
      metadata = await this.metaplex
        .nfts()
        .findByMint({ mintAddress: AddressUtil.toPubKey(address) });
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

  async findMany(addresses: Address[]): Promise<Record<string, Partial<TokenMetadata> | null>> {
    const mints = AddressUtil.toPubKeys(addresses);
    const results = await this.metaplex.nfts().findAllByMintList({ mints });
    const loaded = await Promise.all(
      results.map((result) => {
        if (!result) {
          return null;
        } else if (isMetadata(result)) {
          return this.queue.add(async () => this.metaplex.nfts().load({ metadata: result }));
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
  const metadata: Partial<TokenMetadata> = {
    symbol: token.symbol,
    name: token.name,
  };
  if (token.jsonLoaded && token.json) {
    metadata.image = token.json.image;
  }
  return metadata;
}

// Token is v1.1 standard, which means there should be an off-chain JSON metadata file.
function transformMetadataV1_1(token: Sft | Nft): Partial<TokenMetadata> {
  if (!token.jsonLoaded || !token.json) {
    console.error(
      `Failed to load v1.1 data for ${token.symbol} - ${token.address.toBase58()} - ${token.uri}`
    );
    // Return the on-chain, non v1.1 metadata as a fallback
    return { symbol: token.symbol, name: token.name };
  }
  return {
    symbol: token.json.symbol,
    name: token.json.name,
    image: token.json.image,
  };
}
