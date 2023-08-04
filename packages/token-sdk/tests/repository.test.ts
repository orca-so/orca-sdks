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
    const repo = new TokenRepository().addMint(mint1, ["whitelisted"]).addMint(mint2);
    const token1 = await repo.fetch(fetcher, mint1);
    expect(token1).toBeDefined();
    expect(token1?.mint).toEqual(mint1);
    expect(token1?.symbol).toEqual("P1");
    expect(token1?.tags).toEqual(["whitelisted"]);
    expect(token1?.exists).toBeTruthy();

    const token2 = await repo.fetch(fetcher, mint2);
    expect(token2).toBeDefined();
    expect(token2?.mint).toEqual(mint2);
    expect(token2?.symbol).toEqual("P2");
    expect(token2?.tags).toEqual([]);
    expect(token2?.exists).toBeTruthy();
  });

  it("addMints ok", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository().addMints(mints, ["whitelisted"]);
    const tokens = await repo.fetchMany(fetcher, mints);
    expect(tokens.length).toEqual(3);
    mints.forEach((mint, i) => {
      expect(tokens[i]).toBeDefined();
      expect(tokens[i].mint).toEqual(mint);
      expect(tokens[i].symbol).toEqual(`P${i + 1}`);
      expect(tokens[i].tags).toEqual(["whitelisted"]);
      expect(tokens[i].exists).toBeTruthy();
    });
  });

  it("addMintlist ok", async () => {
    const mints = [mint1, mint2, mint3];
    const mintlist: Mintlist = {
      name: "Test Mintlist",
      version: "0.0.1",
      mints,
    };
    const repo = new TokenRepository().addMintlist(mintlist, ["whitelisted"]);
    const tokens = await repo.fetchMany(fetcher, mints);
    expect(tokens.length).toEqual(3);
    mints.forEach((mint, i) => {
      expect(tokens[i]).toBeDefined();
      expect(tokens[i].mint).toEqual(mint);
      expect(tokens[i].symbol).toEqual(`P${i + 1}`);
      expect(tokens[i].tags).toEqual(["whitelisted"]);
      expect(tokens[i].exists).toBeTruthy();
    });
  });

  it("add mints unique, appends tags", async () => {
    const repo = new TokenRepository()
      .addMint(mint1, ["tag1"])
      .addMints([mint1], ["tag2"])
      .addMintlist({ name: "Test Mintlist", version: "0.0.1", mints: [mint1] }, ["tag3"]);

    const tokens = await repo.fetchAll(fetcher);
    expect(tokens.length).toEqual(1);
    expect(tokens[0].mint).toEqual(mint1);
    expect(tokens[0].symbol).toEqual("P1");
    expect(tokens[0].tags).toEqual(["tag1", "tag2", "tag3"]);
    expect(tokens[0].exists).toBeTruthy();
  });

  it("tagMints does not add to repository", async () => {
    const repo = new TokenRepository().tagMints([mint1, mint2], ["tag2"]);
    let tokens = await repo.fetchAll(fetcher);
    expect(tokens.length).toEqual(0);
  });

  it("tagMints adds to existing mint", async () => {
    const repo = new TokenRepository().addMint(mint1, ["tag1"]).tagMints([mint1], ["tag2"]);
    let tokens = await repo.fetchAll(fetcher);
    expect(tokens.length).toEqual(1);
    expect(tokens[0].mint).toEqual(mint1);
    expect(tokens[0].tags).toEqual(["tag1", "tag2"]);
    expect(tokens[0].exists).toBeTruthy();
  });

  it("mints added after tagMints still have tag", async () => {
    const repo = new TokenRepository().tagMints([mint1], ["tag1"]);
    let tokens = await repo.fetchAll(fetcher);
    expect(tokens.length).toEqual(0);

    tokens = await repo.fetchMany(fetcher, [mint1]);
    expect(tokens.length).toEqual(1);
    expect(tokens[0].mint).toEqual(mint1);
    expect(tokens[0].tags).toEqual(["tag1"]);
    expect(tokens[0].exists).toBeFalsy();

    repo.addMint(mint1);
    tokens = await repo.fetchAll(fetcher);
    expect(tokens.length).toEqual(1);
    expect(tokens[0].mint).toEqual(mint1);
    expect(tokens[0].tags).toEqual(["tag1"]);
    expect(tokens[0].exists).toBeTruthy();
  });

  it("fetch ok", async () => {
    const repo = new TokenRepository().addMint(mint1, ["tag1"]);
    const token1 = await repo.fetch(fetcher, mint1);
    expect(token1).toBeDefined();
    expect(token1?.mint).toEqual(mint1);
    expect(token1?.symbol).toEqual("P1");
    expect(token1?.tags).toEqual(["tag1"]);
    expect(token1?.exists).toBeTruthy();

    const token2 = await repo.fetch(fetcher, mint2);
    expect(token2).toBeDefined();
    expect(token2?.mint).toEqual(mint2);
    expect(token2?.symbol).toEqual("P2");
    expect(token2?.tags).toEqual([]);
    expect(token2?.exists).toBeFalsy();
  });

  it("fetchMany ok", async () => {
    const repo = new TokenRepository().addMints([mint1], ["tag1"]);
    const tokens = await repo.fetchMany(fetcher, [mint1, mint2]);
    expect(tokens.length).toEqual(2);

    expect(tokens[0]).toBeDefined();
    expect(tokens[0]?.mint).toEqual(mint1);
    expect(tokens[0]?.symbol).toEqual("P1");
    expect(tokens[0]?.tags).toEqual(["tag1"]);
    expect(tokens[0]?.exists).toBeTruthy();

    expect(tokens[1]).toBeDefined();
    expect(tokens[1]?.mint).toEqual(mint2);
    expect(tokens[1]?.symbol).toEqual("P2");
    expect(tokens[1]?.tags).toEqual([]);
    expect(tokens[1]?.exists).toBeFalsy();
  });

  it("fetchByTag ok", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository()
      .addMints(mints, ["whitelisted"])
      .addMint(mint1, ["coingecko"]);
    const whitelisted = await repo.fetchByTag(fetcher, "whitelisted");
    expect(whitelisted.length).toEqual(3);
    whitelisted.forEach((token, i) => {
      expect(token).toBeDefined();
      expect(token.mint).toEqual(mints[i]);
      expect(token.symbol).toEqual(`P${i + 1}`);
      expect(token.tags.includes("whitelisted")).toBeTruthy();
      expect(token.exists).toBeTruthy();
    });

    const coingecko = await repo.fetchByTag(fetcher, "coingecko");
    expect(coingecko.length).toEqual(1);
    expect(coingecko[0]).toBeDefined();
    expect(coingecko[0].mint).toEqual(mint1);
    expect(coingecko[0].symbol).toEqual("P1");
    expect(coingecko[0].tags[0]).toEqual("whitelisted");
    expect(coingecko[0].tags[1]).toEqual("coingecko");
  });

  it("fetch refresh token metadata", async () => {
    const p1 = new FileSystemProvider(new Map([[mint1, { name: "P1 Token", symbol: "P1" }]]));
    fetcher = new TokenFetcher(ctx.connection).addProvider(p1);

    const repo = new TokenRepository().addMint(mint1);
    let token = await repo.fetch(fetcher, mint1);
    expect(token).toBeDefined();
    expect(token?.name).toEqual("P1 Token");
    expect(token?.symbol).toEqual("P1");
    expect(token?.image).toBeUndefined();
    expect(token?.exists).toBeTruthy();

    const p2 = new FileSystemProvider(
      new Map([[mint1, { name: "P1 Token", symbol: "P1", image: "https://new_image.com" }]])
    );
    fetcher.addProvider(p2);
    token = await repo.fetch(fetcher, mint1, true);
    expect(token).toBeDefined();
    expect(token?.name).toEqual("P1 Token");
    expect(token?.symbol).toEqual("P1");
    expect(token?.image).toEqual("https://new_image.com");
    expect(token?.exists).toBeTruthy();
  });

  it("missing mints included in fetches but marked not exist", async () => {
    const mints = [mint1, mint2, mint3];
    const repo = new TokenRepository();
    const tokens = await repo.fetchMany(fetcher, mints);
    expect(tokens.length).toEqual(3);
    tokens.forEach((token) => {
      expect(token).toBeDefined();
      expect(token.exists).toBeFalsy();
    });
    const token = await repo.fetch(fetcher, mint1);
    expect(token).toBeDefined();
    expect(token?.exists).toBeFalsy();
  });

  it("overrides ok", async () => {
    const overrides = {
      [mint1]: { name: "Override P1" },
      [mint2]: { name: "Override P2", symbol: "P2-override" },
    };
    const repo = new TokenRepository().addMint(mint1, ["tag1"]).setOverrides(overrides);
    const token1 = await repo.fetch(fetcher, mint1);
    expect(token1).toBeDefined();
    expect(token1?.mint).toEqual(mint1);
    expect(token1?.name).toEqual("Override P1");
    expect(token1?.symbol).toEqual("P1");
    expect(token1?.tags).toEqual(["tag1"]);
    expect(token1?.exists).toBeTruthy();

    const token2 = await repo.fetch(fetcher, mint2);
    expect(token2).toBeDefined();
    expect(token2?.mint).toEqual(mint2);
    expect(token2?.name).toEqual("Override P2");
    expect(token2?.symbol).toEqual("P2-override");
    expect(token2?.tags).toEqual([]);
    expect(token2?.exists).toBeFalsy();
  });

  it("has", async () => {
    const overrides = {
      [mint1]: { name: "Override P1" },
    };
    const repo = new TokenRepository().addMint(mint1, ["tag1"]).setOverrides(overrides);
    expect(repo.has(mint1)).toBeTruthy();
    expect(repo.has(mint1, "tag1")).toBeTruthy();
    expect(repo.has(mint1, "whitelisted")).toBeFalsy();
    expect(repo.has(mint2)).toBeFalsy();
    expect(repo.has(mint2, "tag1")).toBeFalsy();

    repo.tagMint(mint2, ["whitelisted"]);
    expect(repo.has(mint2)).toBeFalsy();
  });
});
