import {
  isMetadata,
  Metaplex,
  Nft,
  Sft,
  Metadata as MetaplexMetadata,
  toMetaplexFile,
  Amount,
  MetaplexFile,
} from "@metaplex-foundation/js";
import { Connection } from "@solana/web3.js";
import { MetadataProvider, Metadata } from "./types";
import { Address, AddressUtil } from "@orca-so/common-sdk";
import fetch from "isomorphic-unfetch";
import PQueue from "p-queue";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_INTERVAL_MS = 1000;

interface Opts {
  concurrency?: number;
  intervalMs?: number;
  /**
   * Flag that indicates whether to load offchain JSON data used to populate image.
   * False by default.
   * https://github.com/metaplex-foundation/js#load
   */
  loadImage?: boolean;
}

export class MetaplexProvider implements MetadataProvider {
  private readonly metaplex: Metaplex;
  private readonly queue: PQueue;
  private readonly opts: Opts;

  constructor(connection: Connection, opts: Opts = {}) {
    const { concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.metaplex = createMetaplex(connection);

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

// HACK: to avoid the following error
// TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
//
// https://github.com/metaplex-foundation/js/issues/459 (closed but not fixed)
//
// Without this hack, the download of the Json file containing the Metadata will fail
// and "image" metadata will not be retrieved. However, no error will occur.
//
// reference: https://github.com/metaplex-foundation/js/blob/4c2c4eafc2158ab6970073f3d49181228ed54260/packages/js/src/plugins/storageModule/StorageClient.ts#L72-L75
function createMetaplex(connection: Connection): Metaplex {
  const metaplex = Metaplex.make(connection);
  metaplex.storage().setDriver(storageDriver);
  return metaplex;
}

const storageDriver = {
  download: async (uri: string, options: any) => {
    const response = await fetch(uri, options);
    const buffer = await response.arrayBuffer();
    return toMetaplexFile(buffer, uri);
  },
  getUploadPrice: function (bytes: number): Promise<Amount> {
    throw new Error("Function not implemented.");
  },
  upload: function (file: MetaplexFile): Promise<string> {
    throw new Error("Function not implemented.");
  },
};
