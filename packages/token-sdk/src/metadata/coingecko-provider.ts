import { PublicKey } from "@solana/web3.js";
import pLimit, { Limit } from "p-limit";
import { CoingeckoClient, CoingeckoHttpClient, ContractResponse } from "./client/coingecko-client";
import { MetadataProvider, TokenMetadata } from "./models";

const DEFAULT_RPS = 50;
const SOLANA_ASSET_PLATFORM = "solana";

export class CoingeckoProvider implements MetadataProvider {
  private readonly client: CoingeckoClient;
  private readonly limit: Limit;

  constructor(apiKey?: string, rps: number = DEFAULT_RPS) {
    this.client = new CoingeckoHttpClient(apiKey);
    this.limit = pLimit(rps);
  }

  async find(mint: PublicKey): Promise<Partial<TokenMetadata | null>> {
    try {
      const contract = await this.client.getContract(SOLANA_ASSET_PLATFORM, mint.toBase58());
      return convertToTokenMetadata(contract);
    } catch (e) {
      console.error(`Unable to fetch ${mint.toBase58()} coingecko metadata`);
      return null;
    }
  }

  async findMany(mints: PublicKey[]): Promise<Record<string, Partial<TokenMetadata> | null>> {
    const metas = await Promise.all(mints.map((mint) => this.limit(async () => this.find(mint))));
    return Object.fromEntries(mints.map((mint, index) => [mint.toBase58(), metas[index]]));
  }
}

function convertToTokenMetadata(contract: ContractResponse): TokenMetadata {
  return {
    symbol: contract.symbol.toUpperCase(), // Coingecko symbols are lowercase
    name: contract.name,
    image: contract.image.large ?? contract.image.small ?? contract.image.thumb,
  };
}
