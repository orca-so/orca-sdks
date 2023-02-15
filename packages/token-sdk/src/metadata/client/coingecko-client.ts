import fetch from "isomorphic-unfetch";
import invariant from "tiny-invariant";

const CG_API_URL = "https://api.coingecko.com/api/v3";
const CG_PRO_API_URL = "https://pro-api.coingecko.com/api/v3";

export interface CoingeckoClient {
  getContract(assetPlatform: string, contract: string): Promise<ContractResponse>;
}

export class CoingeckoHttpClient implements CoingeckoClient {
  private readonly apiKey?: string;
  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private buildUrl(path: string): string {
    return this.apiKey
      ? `${CG_PRO_API_URL}${path}?x_cg_pro_api_key=${this.apiKey}`
      : `${CG_API_URL}${path}`;
  }

  async getContract(assetPlatform: string, contract: string): Promise<ContractResponse> {
    const path = `/coins/${assetPlatform}/contract/${contract}`;
    let response;
    try {
      response = await fetch(this.buildUrl(path));
    } catch (e) {
      throw new Error(`Unexpected error fetching ${path}: ${e}`);
    }
    invariant(response.ok, `Unexpected status code fetching ${path}: ${response.status}`);
    const json = await response.json();
    invariant(isContractResponse(json), "Unexpected coingecko response type");
    return json;
  }
}

function isContractResponse(value: any): value is ContractResponse {
  return typeof value === "object" && value !== null && "contract_address" in value;
}

// Minimum subset of Coingecko's response
export interface ContractResponse {
  contract_address: string;
  id: string;
  name: string;
  symbol: string;
  image: {
    large: string;
    small: string;
    thumb: string;
  };
}
