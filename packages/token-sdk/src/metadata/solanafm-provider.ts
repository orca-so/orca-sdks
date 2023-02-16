import { AddressUtil } from "@orca-so/common-sdk";
import { Address } from "@project-serum/anchor";
import { MintString } from "../models";
import { SolanaFmClient, SolanaFmHttpClient, TokenResult } from "./client";
import { MetadataProvider, TokenMetadata } from "./models";

export class SolanaFmProvider implements MetadataProvider {
  private readonly client: SolanaFmClient = new SolanaFmHttpClient();

  async find(address: Address): Promise<Partial<TokenMetadata | null>> {
    const mint = AddressUtil.toPubKey(address);
    try {
      const token = await this.client.getToken(mint.toBase58());
      return convertToTokenMetadata(token);
    } catch (e) {
      console.error(`Unable to fetch ${mint.toBase58()} SolanaFM metadata`);
      return null;
    }
  }

  async findMany(addresses: Address[]): Promise<Record<MintString, Partial<TokenMetadata> | null>> {
    try {
      const response = await this.client.getTokens(
        addresses.map((a) => AddressUtil.toPubKey(a).toBase58())
      );
      return Object.fromEntries(
        response.map((token) => [token.tokenHash, convertToTokenMetadata(token)])
      );
    } catch (e) {
      console.error(`Unable to fetch SolanaFM metadata - ${e}`);
      return {};
    }
  }
}

function convertToTokenMetadata(value: TokenResult): Partial<TokenMetadata> {
  return {
    symbol: value.data.symbol,
    name: value.data.tokenName,
    image: value.data.logo,
  };
}
