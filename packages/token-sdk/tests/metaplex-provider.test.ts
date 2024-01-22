import { MetaplexProvider } from "../src/metadata";
import { TokenFetcher } from "../src/fetcher";
import { createTestContext } from "./test-context";

jest.setTimeout(100 * 1000 /* ms */);

describe("metaplex-provider", () => {
  // mainnet
  const ctx = createTestContext("https://api.mainnet-beta.solana.com");

  // ORCA has metadata, but not has image info, so use BONK and SHDW
  const MINT_BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
  const MINT_SHDW = "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y";

  it("find ok", async () => {
    const timeoutMs = 2000;
    const metaplex_provider = new MetaplexProvider(ctx.connection, {loadImage: true, concurrency: 1, intervalMs: 1000, getOffChainMetadataTimeoutMs: timeoutMs});
    const fetcher = new TokenFetcher(ctx.connection).addProvider(metaplex_provider);

    const result = await fetcher.find(MINT_BONK, true);
    expect(result).toBeDefined();
    expect(result.mint).toEqual(MINT_BONK);
    expect(result.decimals).toEqual(5);
    expect(result.name).toEqual("Bonk");
    expect(result.symbol).toEqual("Bonk"); // Their symbol is Bonk (not BONK)...
    expect(result.image).toEqual("https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I");
  });

  it("findMany ok", async () => {
    const timeoutMs = 2000;
    const metaplex_provider = new MetaplexProvider(ctx.connection, {loadImage: true, concurrency: 2, intervalMs: 1000, getOffChainMetadataTimeoutMs: timeoutMs});
    const fetcher = new TokenFetcher(ctx.connection).addProvider(metaplex_provider);

    const result = await fetcher.findMany([MINT_BONK, MINT_SHDW], true);
    const resultBonk = result.get(MINT_BONK);
    expect(resultBonk).toBeDefined();
    expect(resultBonk?.mint).toEqual(MINT_BONK);
    expect(resultBonk?.decimals).toEqual(5);
    expect(resultBonk?.name).toEqual("Bonk");
    expect(resultBonk?.symbol).toEqual("Bonk"); // Their symbol is Bonk (not BONK)...
    expect(resultBonk?.image).toEqual("https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I");

    const resultShdw = result.get(MINT_SHDW);
    expect(resultShdw).toBeDefined();
    expect(resultShdw?.mint).toEqual(MINT_SHDW);
    expect(resultShdw?.decimals).toEqual(9);
    expect(resultShdw?.name).toEqual("Shadow Token");
    expect(resultShdw?.symbol).toEqual("SHDW");
    expect(resultShdw?.image).toEqual("https://shdw-drive.genesysgo.net/FDcC9gn12fFkSU2KuQYH4TUjihrZxiTodFRWNF4ns9Kt/250x250_with_padding.png");
  });

  it("find timeout", async () => {
    const timeoutMs = 1;
    const metaplex_provider = new MetaplexProvider(ctx.connection, {loadImage: true, concurrency: 1, intervalMs: 1000, getOffChainMetadataTimeoutMs: timeoutMs});
    const fetcher = new TokenFetcher(ctx.connection).addProvider(metaplex_provider);

    const result = await fetcher.find(MINT_BONK, true);
    expect(result).toBeDefined();
    expect(result.mint).toEqual(MINT_BONK);
    expect(result.decimals).toEqual(5);
    expect(result.name).toEqual("Bonk");
    expect(result.symbol).toEqual("Bonk");

    // 1ms is too short to fetch offchain metadata, so we expect image to be undefined
    expect(result.image).toBeUndefined();
  });

  it("findMany timeout", async () => {
    const timeoutMs = 1;
    const metaplex_provider = new MetaplexProvider(ctx.connection, {loadImage: true, concurrency: 2, intervalMs: 1000, getOffChainMetadataTimeoutMs: timeoutMs});
    const fetcher = new TokenFetcher(ctx.connection).addProvider(metaplex_provider);

    const result = await fetcher.findMany([MINT_BONK, MINT_SHDW], true);
    const resultBonk = result.get(MINT_BONK);
    expect(resultBonk).toBeDefined();
    expect(resultBonk?.mint).toEqual(MINT_BONK);
    expect(resultBonk?.decimals).toEqual(5);
    expect(resultBonk?.name).toEqual("Bonk");
    expect(resultBonk?.symbol).toEqual("Bonk");

    const resultShdw = result.get(MINT_SHDW);
    expect(resultShdw).toBeDefined();
    expect(resultShdw?.mint).toEqual(MINT_SHDW);
    expect(resultShdw?.decimals).toEqual(9);
    expect(resultShdw?.name).toEqual("Shadow Token");
    expect(resultShdw?.symbol).toEqual("SHDW");

    // 1ms is too short to fetch offchain metadata, so we expect image to be undefined
    expect(resultBonk?.image).toBeUndefined();
    expect(resultShdw?.image).toBeUndefined();
  });

});
