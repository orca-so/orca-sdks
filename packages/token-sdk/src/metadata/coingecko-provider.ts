import { AddressUtil } from "@orca-so/common-sdk";
import { Address } from "@project-serum/anchor";
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

  async find(address: Address): Promise<Partial<TokenMetadata | null>> {
    const mintPubKey = AddressUtil.toPubKey(address);
    try {
      const contract = await this.client.getContract(SOLANA_ASSET_PLATFORM, mintPubKey.toBase58());
      return convertToTokenMetadata(contract);
    } catch (e) {
      console.error(`Unable to fetch ${mintPubKey.toBase58()} coingecko metadata`);
      return null;
    }
  }

  async findMany(addresses: Address[]): Promise<Record<string, Partial<TokenMetadata> | null>> {
    const metas = await Promise.all(addresses.map((a) => this.limit(async () => this.find(a))));
    return Object.fromEntries(
      AddressUtil.toPubKeys(addresses).map((mint, index) => [mint.toBase58(), metas[index]])
    );
  }
}

function convertToTokenMetadata(contract: ContractResponse): TokenMetadata {
  return {
    symbol: contract.symbol.toUpperCase(), // Coingecko symbols are lowercase
    name: contract.name,
    image: contract.image.large ?? contract.image.small ?? contract.image.thumb,
  };
}
