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
  // Token-2022
  const MINT_BERN_2022 = "CKfatsPMUf8SkiURsDXs7eK6GWb4Jsd6UDbs7twMCWxo";

  it("find ok (Token)", async () => {
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

  it("find ok (Token-2022)", async () => {
    const timeoutMs = 2000;
    const metaplex_provider = new MetaplexProvider(ctx.connection, {loadImage: true, concurrency: 1, intervalMs: 1000, getOffChainMetadataTimeoutMs: timeoutMs});
    const fetcher = new TokenFetcher(ctx.connection).addProvider(metaplex_provider);

    const result = await fetcher.find(MINT_BERN_2022, true);
    expect(result).toBeDefined();
    expect(result.mint).toEqual(MINT_BERN_2022);
    expect(result.decimals).toEqual(5);
    // Metadata address for BERN is 6mbNeu9pSERJrJVuPiPyZCm1PPUw2CLBGmdn6dW75azw
    // But it is not one owned by Metaplex Token Metadata program (metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s).
    // Its owner program is META4s4fSmpkTbZoUsgC1oBnWB31vQcmnN8giPw51Zu (I cannot find the info about this program, but I guess it is provided by FlexBeam team)
    // Many Token-2022 tokens has no Metaplex metadata, so I expect to resolve their metadata by other providers.
    expect(result.name).toBeUndefined();
    expect(result.symbol).toBeUndefined();
    expect(result.image).toBeUndefined();
  });

  it("findMany ok (Token + Token-2022)", async () => {
    const timeoutMs = 2000;
    const metaplex_provider = new MetaplexProvider(ctx.connection, {loadImage: true, concurrency: 2, intervalMs: 1000, getOffChainMetadataTimeoutMs: timeoutMs});
    const fetcher = new TokenFetcher(ctx.connection).addProvider(metaplex_provider);

    const result = await fetcher.findMany([MINT_BONK, MINT_SHDW, MINT_BERN_2022], true);
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

    const resultBern = result.get(MINT_BERN_2022);
    expect(resultBern).toBeDefined();
    expect(resultBern?.mint).toEqual(MINT_BERN_2022);
    expect(resultBern?.decimals).toEqual(5);
    // see: comments on "find ok (Token-2022)" test
    expect(resultBern?.name).toBeUndefined();
    expect(resultBern?.symbol).toBeUndefined();
    expect(resultBern?.image).toBeUndefined();
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
