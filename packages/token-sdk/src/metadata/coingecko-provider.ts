import { Address, AddressUtil } from "@orca-so/common-sdk";
import { CoinGeckoClient, CoinGeckoHttpClient, ContractResponse } from "./client/coingecko-client";
import { MetadataProvider, ReadonlyMetadata, ReadonlyMetadataMap, Metadata } from "./types";
import PQueue from "p-queue";

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_INTERVAL_MS = 1000;
const SOLANA_ASSET_PLATFORM = "solana";

interface Opts {
  apiKey?: string;
  concurrency?: number;
  intervalMs?: number;
}

export class CoinGeckoProvider implements MetadataProvider {
  private readonly client: CoinGeckoClient;
  private readonly queue: PQueue;

  constructor(opts: Opts = {}) {
    const { apiKey, concurrency = DEFAULT_CONCURRENCY, intervalMs = DEFAULT_INTERVAL_MS } = opts;
    this.client = new CoinGeckoHttpClient(apiKey);
    this.queue = new PQueue({ concurrency, interval: intervalMs });
  }

  async find(address: Address): Promise<ReadonlyMetadata> {
    const mintPubKey = AddressUtil.toPubKey(address);
    try {
      const contract = await this.client.getContract(SOLANA_ASSET_PLATFORM, mintPubKey.toBase58());
      return convertToTokenMetadata(contract);
    } catch (e) {
      console.error(`Error fetching ${mintPubKey.toBase58()} coingecko metadata - ${e}`);
      return null;
    }
  }

  async findMany(addresses: Address[]): Promise<ReadonlyMetadataMap> {
    const metas = await this.queue.addAll(addresses.map((a) => async () => this.find(a)));
    return new Map(
      AddressUtil.toPubKeys(addresses).map((mint, index) => [mint.toBase58(), metas[index]])
    );
  }
}

function convertToTokenMetadata(contract: ContractResponse | null): Partial<Metadata> | null {
  if (!contract) {
    return null;
  }
  return {
    symbol: contract.symbol.toUpperCase(), // Coingecko symbols are lowercase
    name: contract.name,
    image: contract.image.large ?? contract.image.small ?? contract.image.thumb,
  };
}
