import { CoinGeckoProvider } from "../src/metadata";
import { TokenFetcher } from "../src/fetcher";
import { createTestContext } from "./test-context";

jest.setTimeout(100 * 1000 /* ms */);

describe("coingecko-provider", () => {
  // mainnet
  const ctx = createTestContext("https://api.mainnet-beta.solana.com");

  // Token-2022
  const MINT_BERN_2022 = "CKfatsPMUf8SkiURsDXs7eK6GWb4Jsd6UDbs7twMCWxo";
  const MINT_CIF_2022 = "G3vWvAaXPHCnncnyAbq6yBRXqfRtEV3h7vExzasZeT6g";

  it("find ok (Token-2022)", async () => {
    const coingecko_provider = new CoinGeckoProvider();
    const fetcher = new TokenFetcher(ctx.connection).addProvider(coingecko_provider);

    const result = await fetcher.find(MINT_BERN_2022, true);
    expect(result).toBeDefined();
    expect(result.mint).toEqual(MINT_BERN_2022);
    expect(result.decimals).toEqual(5);
    // https://api.coingecko.com/api/v3/coins/solana/contract/CKfatsPMUf8SkiURsDXs7eK6GWb4Jsd6UDbs7twMCWxo
    expect(result.name).toEqual("BonkEarn");
    expect(result.symbol).toEqual("BERN"); // provider uses toUpperCase
    expect(result.image).toEqual("https://assets.coingecko.com/coins/images/32946/large/bonkearn.jpeg?1699927347");
  });

  it("findMany ok (Token-2022)", async () => {
    const coingecko_provider = new CoinGeckoProvider();
    const fetcher = new TokenFetcher(ctx.connection).addProvider(coingecko_provider);

    const result = await fetcher.findMany([MINT_BERN_2022, MINT_CIF_2022], true);
    const resultBern = result.get(MINT_BERN_2022);
    expect(resultBern).toBeDefined();
    expect(resultBern?.mint).toEqual(MINT_BERN_2022);
    expect(resultBern?.decimals).toEqual(5);
    // https://api.coingecko.com/api/v3/coins/solana/contract/CKfatsPMUf8SkiURsDXs7eK6GWb4Jsd6UDbs7twMCWxo
    expect(resultBern?.name).toEqual("BonkEarn");
    expect(resultBern?.symbol).toEqual("BERN"); // provider uses toUpperCase
    expect(resultBern?.image).toEqual("https://assets.coingecko.com/coins/images/32946/large/bonkearn.jpeg?1699927347");

    const resultCif = result.get(MINT_CIF_2022);
    expect(resultCif).toBeDefined();
    expect(resultCif?.mint).toEqual(MINT_CIF_2022);
    expect(resultCif?.decimals).toEqual(6);
    // https://api.coingecko.com/api/v3/coins/solana/contract/G3vWvAaXPHCnncnyAbq6yBRXqfRtEV3h7vExzasZeT6g
    expect(resultCif?.name).toEqual("CatwifHat");
    expect(resultCif?.symbol).toEqual("CIF"); // provider uses toUpperCase
    expect(resultCif?.image).toEqual("https://assets.coingecko.com/coins/images/33787/large/photo1702849323.jpeg?1702981844");
  });

});
