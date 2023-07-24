import { FileSystemProvider } from "../src/metadata";
import { TokenFetcher } from "../src/fetcher";
import { TokenRepository } from "../src/repository";
import { createNewMint, createTestContext, requestAirdrop } from "./test-context";
import { Mintlist } from "../src/types";
import { Keypair } from "@solana/web3.js";

jest.setTimeout(100 * 1000 /* ms */);

describe("token-repository", () => {
  const ctx = createTestContext();
  let mint1: string;
  let mint2: string;
  let mint3: string;
  let fetcher: TokenFetcher;

  beforeAll(async () => {
    await requestAirdrop(ctx);
    mint1 = (await createNewMint(ctx, 9)).toString();
    mint2 = (await createNewMint(ctx, 9)).toString();
    mint3 = (await createNewMint(ctx, 9)).toString();
    const p1 = new FileSystemProvider(
      new Map([
        [mint1, { name: "P1 Token", symbol: "P1", image: "https://p1.com" }],
        [mint2, { name: "P2 Token", symbol: "P2", image: "https://p2.com" }],
        [mint3, { name: "P3 Token", symbol: "P3", image: "https://p3.com" }],
      ])
    );
    fetcher = new TokenFetcher(ctx.connection).addProvider(p1);
  });

  it("addMint ok", async () => {
    const repo = new TokenRepository(fetcher).addMint(mint1, ["whitelisted"]).addMint(mint2);
    const token1 = await repo.get(mint1);
    expect(token1).toBeDefined();
    expect(token1?.mint).toEqual(mint1);
    expect(token1?.symbol).toEqual("P1");
    expect(token1?.tags).toEqual(["whitelisted"]);

    const token2 = await repo.get(mint2);
    expect(token2).toBeDefined();
    expect(token2?.mint).toEqual(mint2);
    expect(token2?.symbol).toEqual("P2");
    expect(token2?.tags).toEqual([]);
  });

  it("addMints ok", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository(fetcher).addMints(mints, ["whitelisted"]);
    const tokens = await repo.getMany(mints);
    expect(tokens.length).toEqual(3);
    mints.forEach((mint, i) => {
      expect(tokens[i]).toBeDefined();
      expect(tokens[i].mint).toEqual(mint);
      expect(tokens[i].symbol).toEqual(`P${i + 1}`);
      expect(tokens[i].tags).toEqual(["whitelisted"]);
    });
  });

  it("addMintlist ok", async () => {
    const mints = [mint1, mint2, mint3];
    const mintlist: Mintlist = {
      name: "Test Mintlist",
      version: "0.0.1",
      mints,
    };
    const repo = new TokenRepository(fetcher).addMintlist(mintlist, ["whitelisted"]);
    const tokens = await repo.getMany(mints);
    expect(tokens.length).toEqual(3);
    mints.forEach((mint, i) => {
      expect(tokens[i]).toBeDefined();
      expect(tokens[i].mint).toEqual(mint);
      expect(tokens[i].symbol).toEqual(`P${i + 1}`);
      expect(tokens[i].tags).toEqual(["whitelisted"]);
    });
  });

  it("add mints unique, appends tags", async () => {
    const repo = new TokenRepository(fetcher)
      .addMint(mint1, ["tag1"])
      .addMints([mint1], ["tag2"])
      .addMintlist({ name: "Test Mintlist", version: "0.0.1", mints: [mint1] }, ["tag3"]);

    const tokens = await repo.getAll();
    expect(tokens.length).toEqual(1);
    expect(tokens[0].mint).toEqual(mint1);
    expect(tokens[0].symbol).toEqual("P1");
    expect(tokens[0].tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("get ok", async () => {
    const repo = new TokenRepository(fetcher).addMint(mint1, ["tag1"]);
    const token = await repo.get(mint1);
    expect(token).toBeDefined();
    expect(token?.mint).toEqual(mint1);
    expect(token?.symbol).toEqual("P1");
    expect(token?.tags).toEqual(["tag1"]);
  });

  it("getMany ok", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository(fetcher).addMints(mints, ["tag1"]);
    const tokens = await repo.getMany(mints);
    expect(tokens.length).toEqual(3);
    mints.forEach((mint, i) => {
      expect(tokens[i]).toBeDefined();
      expect(tokens[i].mint).toEqual(mint);
      expect(tokens[i].symbol).toEqual(`P${i + 1}`);
      expect(tokens[i].tags).toEqual(["tag1"]);
    });
  });

  it("getByTag ok", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository(fetcher)
      .addMints(mints, ["whitelisted"])
      .addMint(mint1, ["coingecko"]);
    const whitelisted = await repo.getByTag("whitelisted");
    expect(whitelisted.length).toEqual(3);
    whitelisted.forEach((token, i) => {
      expect(token).toBeDefined();
      expect(token.mint).toEqual(mints[i]);
      expect(token.symbol).toEqual(`P${i + 1}`);
      expect(token.tags.includes("whitelisted")).toBeTruthy();
    });

    const coingecko = await repo.getByTag("coingecko");
    expect(coingecko.length).toEqual(1);
    expect(coingecko[0]).toBeDefined();
    expect(coingecko[0].mint).toEqual(mint1);
    expect(coingecko[0].symbol).toEqual("P1");
    expect(coingecko[0].tags[0]).toEqual("whitelisted");
    expect(coingecko[0].tags[1]).toEqual("coingecko");
  });

  it("get refresh refetches token metadata", async () => {
    const p1 = new FileSystemProvider(new Map([[mint1, { name: "P1 Token", symbol: "P1" }]]));
    fetcher = new TokenFetcher(ctx.connection).addProvider(p1);

    const repo = new TokenRepository(fetcher).addMint(mint1);
    let token = await repo.get(mint1);
    expect(token).toBeDefined();
    expect(token?.name).toEqual("P1 Token");
    expect(token?.symbol).toEqual("P1");
    expect(token?.image).toBeUndefined();

    const p2 = new FileSystemProvider(
      new Map([[mint1, { name: "P1 Token", symbol: "P1", image: "https://new_image.com" }]])
    );
    fetcher.addProvider(p2);
    token = await repo.get(mint1, true);
    expect(token).toBeDefined();
    expect(token?.name).toEqual("P1 Token");
    expect(token?.symbol).toEqual("P1");
    expect(token?.image).toEqual("https://new_image.com");
  });

  it("excludeMints omitted from gets", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository(fetcher)
      .addMints(mints, ["whitelisted"])
      .excludeMints([mint1])
      .addMint(mint1);
    let tokens = await repo.getAll();
    expect(tokens.length).toEqual(2);
    expect(tokens[0].mint).toEqual(mint2);
    expect(tokens[1].mint).toEqual(mint3);

    repo.excludeMintlist({ name: "Test Mintlist", version: "0.0.1", mints: [mint2] });
    tokens = await repo.getAll();
    expect(tokens.length).toEqual(1);
    expect(tokens[0].mint).toEqual(mint3);
  });

  it("missing mints excluded from gets", async () => {
    const missingMint = Keypair.generate().publicKey.toString();
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository(fetcher).addMints(mints, ["tag1"]);
    const tokens = await repo.getMany([missingMint]);
    expect(tokens.length).toEqual(0);
    const token = await repo.get(missingMint);
    expect(token).toBeNull();
  });

  it("overrides ok", async () => {
    const overrides = {
      [mint1]: { name: "Override P1" },
    };
    const repo = new TokenRepository(fetcher).addMint(mint1, ["tag1"]).setOverrides(overrides);
    const token = await repo.get(mint1);
    expect(token).toBeDefined();
    expect(token?.mint).toEqual(mint1);
    expect(token?.name).toEqual("Override P1");
    expect(token?.symbol).toEqual("P1");
    expect(token?.tags).toEqual(["tag1"]);
  });
});
