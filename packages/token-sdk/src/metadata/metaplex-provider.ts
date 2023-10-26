
import { Connection } from "@solana/web3.js";
import { MetadataProvider, Metadata } from "./types";
import { Address, AddressUtil } from "@orca-so/common-sdk";
import PQueue from "p-queue";
import { Context, publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchJsonMetadata, fetchMetadata, fetchAllMetadata, findMetadataPda, Metadata as MetaplexMetadata, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_INTERVAL_MS = 1000;

interface Opts {
  concurrency?: number;
  intervalMs?: number;
  /**
   * Flag that indicates whether to load offchain JSON data used to populate image.
   * True by default.
   * https://github.com/metaplex-foundation/js#load
   */
  loadImage?: boolean;
}

export class MetaplexProvider implements MetadataProvider {
  private readonly ctx: Context;
  private readonly queue: PQueue;
  private readonly opts: Opts;

  constructor(connection: Connection, opts: Opts = {}) {
    const { concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.ctx = createUmi(connection.rpcEndpoint);

    this.queue = new PQueue({ concurrency, interval: intervalMs });
    this.opts = opts;
  }

  async find(address: Address): Promise<Readonly<Metadata> | null> {
    try {
      const pda = findMetadataPda(this.ctx, { mint: publicKey(address)});
      const meta = await fetchMetadata(this.ctx, pda);
      let image: string | undefined;
      if (this.opts.loadImage) {
        const json = await fetchJsonMetadata(this.ctx, meta.uri);
        image = json.image;
      }
      return { symbol: meta.symbol, name: meta.name, image };
    } catch (e) {
      return null;
    }
  }

  async findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    const mints = AddressUtil.toPubKeys(addresses);
    const pdas = mints.map((mint) => findMetadataPda(this.ctx, { mint: publicKey(mint)}));
    const metas = await fetchAllMetadata(this.ctx, pdas);
    let jsons = Array<JsonMetadata | undefined>(metas.length);
    if (this.opts.loadImage) {
      jsons = await this.queue.addAll(
        metas.map((meta) => async () => fetchJsonMetadata(this.ctx, meta.uri))
      );
    }

    return new Map(
      metas.map((meta, index) => {
        const mint = mints[index].toBase58();
        const json = jsons[index];
        const result = { symbol: meta.symbol, name: meta.name, image: json?.image };
        return [mint, result];
      })
    );
  }
}
