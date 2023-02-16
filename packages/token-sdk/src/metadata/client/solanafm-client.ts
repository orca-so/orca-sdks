import fetch from "isomorphic-unfetch";
import invariant from "tiny-invariant";

const SOLANA_FM_API_URL = "https://api.solana.fm/v0";
const TOKENS_PATH = "tokens";

export interface SolanaFmClient {
  getToken(tokenHash: string): Promise<TokenResult>;
  getTokens(tokenHashes: string[]): Promise<TokenResult[]>;
}

export class SolanaFmHttpClient implements SolanaFmClient {
  async getToken(tokenHash: string): Promise<TokenResult> {
    const url = `${SOLANA_FM_API_URL}/${TOKENS_PATH}/${tokenHash}`;
    let response;
    try {
      response = await fetch(url);
    } catch (e) {
      throw new Error(`Unexpected error fetching ${url}: ${e}`);
    }
    invariant(response.ok, `Unexpected status code fetching ${url}: ${response.status}`);
    const json = await response.json();
    invariant(isGetTokenResponse(json), "Unexpected SolanaFM getToken response type");
    invariant(json.status === "success", "Unexpected SolanaFM getToken response status");
    return json.result;
  }

  async getTokens(tokenHashes: string[]): Promise<TokenResult[]> {
    const url = `${SOLANA_FM_API_URL}/${TOKENS_PATH}`;

    const responses: Promise<GetTokensResponse>[] = [];
    const chunkSize = 50;

    for (let i = 0; i < tokenHashes.length; i += chunkSize) {
      const chunk = tokenHashes.slice(i, i + chunkSize);
      const res = fetch(url, {
        method: "post",
        body: JSON.stringify({ tokenHashes: chunk }),
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json());
      responses.push(res);
    }
    const results = await Promise.all(responses);
    return results
      .map((res) => {
        invariant(isGetTokensResponse(res), "Unexpected SolanaFM getTokens response type");
        invariant(res.status === "success", "Unexpected SolanaFM getToken response status");
        return res.result;
      })
      .flat();
  }
}

export interface GetTokenResponse {
  status: string;
  message: string;
  result: TokenResult;
}

export interface GetTokensResponse {
  status: string;
  message: string;
  result: TokenResult[];
}

export interface TokenResult {
  tokenHash: string;
  data: {
    mint: string;
    tokenName: string;
    symbol: string;
    decimals: number;
    description: string;
    logo: string;
    tags: string[];
    verified: "true" | "false";
    network: string[];
    metadataToken: string;
  };
}

function isGetTokenResponse(value: any): value is GetTokenResponse {
  return (
    typeof value === "object" && value !== null && "result" in value && "tokenHash" in value.result
  );
}

function isGetTokensResponse(value: any): value is GetTokensResponse {
  return (
    typeof value === "object" && value !== null && "result" in value && Array.isArray(value.result)
  );
}
