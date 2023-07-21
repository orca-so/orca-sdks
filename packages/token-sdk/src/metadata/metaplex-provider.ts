import {
  isMetadata,
  Metaplex,
  Nft,
  Sft,
  Metadata as MetaplexMetadata,
} from "@metaplex-foundation/js";
import { Connection } from "@solana/web3.js";
import { MetadataProvider, Metadata } from "./types";
import { Address, AddressUtil } from "@orca-so/common-sdk";
import PQueue from "p-queue";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_INTERVAL_MS = 1000;

interface Opts {
  concurrency?: number;
  intervalMs?: number;
  loadImage?: boolean;
}

export class MetaplexProvider implements MetadataProvider {
  private readonly metaplex: Metaplex;
  private readonly queue: PQueue;
  private readonly opts: Opts;

  constructor(connection: Connection, opts: Opts = {}) {
    const { concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.metaplex = Metaplex.make(connection);
    this.queue = new PQueue({ concurrency, interval: intervalMs });
    this.opts = opts;
  }

  async find(address: Address): Promise<Readonly<Metadata> | null> {
    let metadata;
    try {
      metadata = await this.metaplex
        .nfts()
        .findByMint({ mintAddress: AddressUtil.toPubKey(address) });
    } catch (e) {
      return null;
    }
    return transformMetadata(metadata);
  }

  async findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    const mints = AddressUtil.toPubKeys(addresses);
    const results = await this.metaplex.nfts().findAllByMintList({ mints });
    const loaded = await Promise.all(
      results.map((result) => {
        if (!result) {
          return null;
        } else if (this.opts.loadImage && isMetadata(result)) {
          return this.queue.add(async () => this.metaplex.nfts().load({ metadata: result }));
        } else {
          return result;
        }
      })
    );
    return new Map(
      loaded.map((metadata, index) => {
        const mint = mints[index].toBase58();
        const result = metadata ? transformMetadata(metadata) : null;
        return [mint, result];
      })
    );
  }
}

// https://docs.metaplex.com/programs/token-metadata/token-standard
function transformMetadata(token: Sft | Nft | MetaplexMetadata): Metadata {
  const metadata: Metadata = {
    symbol: token.symbol,
    name: token.name,
  };
  // Image is in offchain JSON file. Only populate if JSON file was loaded.
  if (token.jsonLoaded && token.json) {
    metadata.image = token.json.image;
  }
  return metadata;
}
