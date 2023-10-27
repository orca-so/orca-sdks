
import { Connection, PublicKey } from "@solana/web3.js";
import { MetadataProvider, Metadata } from "./types";
import { Address, AddressUtil } from "@orca-so/common-sdk";
import PQueue from "p-queue";
import { MetaplexClient, MetaplexHttpClient, OffChainMetadata } from "./client";

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
  private readonly connection: Connection;
  private readonly client: MetaplexClient;
  private readonly queue: PQueue;
  private readonly opts: Opts;

  constructor(connection: Connection, opts: Opts = {}) {
    const { concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.connection = connection;
    this.client = new MetaplexHttpClient();
    this.queue = new PQueue({ concurrency, interval: intervalMs });
    this.opts = opts;
  }

  async find(address: Address): Promise<Readonly<Metadata> | null> {
    const pda = this.client.getMetadataAddress(new PublicKey(address));
    const info = await this.connection.getAccountInfo(pda);
    if (!info) {
      return null;
    }
    const meta = this.client.parseOnChainMetadata(pda, info.data);
    if (!meta) {
      return null;
    }
    let image: string | undefined;
    if (this.opts.loadImage) {
      const json = await this.client.getOffChainMetadata(meta);
      if (json) {
        image = json.image;
      }
    }
    return { symbol: meta.symbol, name: meta.name, image };
  }

  async findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    const mints = AddressUtil.toPubKeys(addresses);
    const pdas = mints.map((mint) => this.client.getMetadataAddress(mint));

    // chunk the requests into groups of 100 since this is the max number of accounts
    // that can be fetched in a single request using `getMultipleAccountsInfo`
    let datas = Array<Buffer | null>(pdas.length);
    const dataHandlers = Array<() => Promise<void>>();
    const chunkSize = 100;
    for (let i = 0; i < pdas.length; i += chunkSize) {
      const chunk = pdas.slice(i, i + chunkSize);
      dataHandlers.push(async () => {
        const chunkInfos = await this.connection.getMultipleAccountsInfo(chunk);
        for (let j = 0; j < chunkInfos.length; j++) {
          datas[i + j] = chunkInfos[j]?.data ?? null;
        }
      });
    }

    await this.queue.addAll(dataHandlers);

    const metas = datas.map((data, index) => data ? this.client.parseOnChainMetadata(pdas[index], data) : null);
    let jsons = Array<OffChainMetadata | null>(metas.length);
    const jsonHandlers = Array<() => Promise<void>>();
    if (this.opts.loadImage) {
      for (let i = 0; i < metas.length; i += 1) {
        const meta = metas[i];
        if (!meta) {
          continue;
        }
        jsonHandlers.push(async () => {
          const json = await this.client.getOffChainMetadata(meta);
          jsons[i] = json;
        });
      }
    }

    await this.queue.addAll(jsonHandlers);

    const map = new Map<string, Metadata | null>();

    for (let i = 0; i < pdas.length; i += 1) {
      const mint = mints[i];
      const meta = metas[i];
      const json = jsons[i];
      if (!meta) {
        continue;
      }
      const result = { symbol: meta.symbol, name: meta.name, image: json?.image };
      map.set(mint.toString(), result);
    }

    return map;
  }
}
