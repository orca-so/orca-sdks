import { Address, AddressUtil } from "@orca-so/common-sdk";
import PQueue from "p-queue";
import { SolanaFmClient, SolanaFmHttpClient, TokenResponseResult } from "./client";
import { MetadataProvider, Metadata } from "./types";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_INTERVAL_MS = 1000;

interface Opts {
  concurrency?: number;
  intervalMs?: number;
}

export class SolanaFmProvider implements MetadataProvider {
  private readonly client: SolanaFmClient;
  private readonly queue: PQueue;

  constructor(opts: Opts = {}) {
    const { concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.queue = new PQueue({ concurrency, interval: intervalMs });
    this.client = new SolanaFmHttpClient();
  }

  async find(address: Address): Promise<Readonly<Metadata> | null> {
    const mint = AddressUtil.toPubKey(address);
    try {
      const token = await this.client.getToken(mint.toBase58());
      return convertToTokenMetadata(token);
    } catch (e) {
      console.error(`Unable to fetch ${mint.toBase58()} SolanaFM metadata`);
      return null;
    }
  }

  async findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    const mints = AddressUtil.toPubKeys(addresses).map((m) => m.toBase58());
    const responses: Promise<TokenResponseResult[]>[] = [];
    const chunkSize = 50;
    for (let i = 0; i < mints.length; i += chunkSize) {
      const chunk = mints.slice(i, i + chunkSize);
      responses.push(this.queue.add(async () => this.client.getTokens(chunk)));
    }

    try {
      const combined = (await Promise.all(responses)).flat();
      return new Map(combined.map((token) => [token.tokenHash, convertToTokenMetadata(token)]));
    } catch (e) {
      console.error(`Unable to fetch SolanaFM metadata - ${e}`);
      return new Map();
    }
  }
}

function convertToTokenMetadata(value: TokenResponseResult): Metadata {
  return {
    symbol: value.data.symbol,
    name: value.data.tokenName,
    image: value.data.logo,
  };
}
