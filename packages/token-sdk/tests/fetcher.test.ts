import { Address } from "@orca-so/common-sdk";
import { TokenFetcher } from "../src/fetcher";
import { FileSystemProvider, Metadata, MetadataProvider } from "../src/metadata";
import { createNewMint, createTestContext, requestAirdrop } from "./test-context";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

jest.setTimeout(100 * 1000 /* ms */);

describe("token-fetcher", () => {
  const ctx = createTestContext();

  beforeAll(async () => {
    await requestAirdrop(ctx);
  });

  it("provider priority", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const p1 = new FileSystemProvider(
      new Map([[mint, { name: "P1 Token", symbol: "P1", image: "https://p1.com" }]])
    );
    const p2 = new FileSystemProvider(
      new Map([[mint, { name: "P2 Token", symbol: "P2", image: "https://p2.com" }]])
    );
    const fetcher = new TokenFetcher(ctx.connection).addProvider(p1).addProvider(p2);
    const metadata = await fetcher.find(mint);
    expect(metadata.name).toEqual("P1 Token");
    expect(metadata.symbol).toEqual("P1");
    expect(metadata.image).toEqual("https://p1.com");
    expect(metadata.decimals).toEqual(9);
  });

  it("merge results", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const p0 = new IncrementProvider();
    const p1 = new FileSystemProvider(new Map([[mint, { symbol: "TOKEN_SYMBOL" }]]));
    const p2 = new FileSystemProvider(
      new Map([[mint, { name: "TOKEN_NAME", symbol: "WRONG_SYMBOL" }]])
    );
    const p3 = new FileSystemProvider(
      new Map([[mint, { image: "TOKEN_IMAGE", name: "WRONG_NAME" }]])
    );
    const fetcher = new TokenFetcher(ctx.connection)
      .addProvider(p0)
      .addProvider(p1)
      .addProvider(p2)
      .addProvider(p3);
    const metadata = await fetcher.find(mint);
    expect(metadata.name).toEqual("TOKEN_NAME");
    expect(metadata.symbol).toEqual("TOKEN_SYMBOL");
    expect(metadata.image).toEqual("TOKEN_IMAGE");
    expect(metadata.decimals).toEqual(9);
    expect(p0.getCount(mint)).toEqual(1);

    const metadata2 = (await fetcher.findMany([mint])).get(mint);
    expect(metadata2).toEqual(metadata);
    expect(p0.getCount(mint)).toEqual(1);
  });

  it("cache entry with partial metadata is cache hit", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const p1 = new FileSystemProvider(
      new Map([[mint, { name: "TOKEN_NAME", symbol: "TOKEN_SYMBOL", image: "TOKEN_IMAGE" }]])
    );
    const fetcher = new TokenFetcher(ctx.connection)
      .setCache(new Map([[mint, { mint, decimals: 9, tokenProgram: TOKEN_PROGRAM_ID, name: "ORIGINAL_TOKEN_NAME" }]]))
      .addProvider(p1);
    const metadata = await fetcher.find(mint);
    expect(metadata.name).toEqual("ORIGINAL_TOKEN_NAME");
    expect(metadata.symbol).toBeUndefined();
    expect(metadata.image).toBeUndefined();
    expect(metadata.tokenProgram.toString()).toEqual(TOKEN_PROGRAM_ID.toString());
    expect(metadata.decimals).toEqual(9);
    expect(metadata.mint).toEqual(mint);
  });

  it("find with refresh fetches new data", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const p1 = new FileSystemProvider(
      new Map([[mint, { name: "TOKEN_NAME", symbol: "TOKEN_SYMBOL", image: "TOKEN_IMAGE" }]])
    );
    const fetcher = new TokenFetcher(ctx.connection)
      .setCache(new Map([[mint, { mint, decimals: 9, tokenProgram: TOKEN_PROGRAM_ID, name: "ORIGINAL_TOKEN_NAME" }]]))
      .addProvider(p1);
    const metadata = await fetcher.find(mint, true);
    expect(metadata.name).toEqual("TOKEN_NAME");
    expect(metadata.symbol).toEqual("TOKEN_SYMBOL");
    expect(metadata.image).toEqual("TOKEN_IMAGE");
    expect(metadata.tokenProgram.toString()).toEqual(TOKEN_PROGRAM_ID.toString());
    expect(metadata.decimals).toEqual(9);
    expect(metadata.mint).toEqual(mint);
  });

  it("findMany with refresh fetches new data", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const p1 = new FileSystemProvider(
      new Map([[mint, { name: "TOKEN_NAME", symbol: "TOKEN_SYMBOL", image: "TOKEN_IMAGE" }]])
    );
    const fetcher = new TokenFetcher(ctx.connection)
      .setCache(new Map([[mint, { mint, decimals: 9, tokenProgram: TOKEN_PROGRAM_ID, name: "ORIGINAL_TOKEN_NAME" }]]))
      .addProvider(p1);
    const metadata = (await fetcher.findMany([mint], true)).get(mint)!;
    expect(metadata.name).toEqual("TOKEN_NAME");
    expect(metadata.symbol).toEqual("TOKEN_SYMBOL");
    expect(metadata.image).toEqual("TOKEN_IMAGE");
    expect(metadata.tokenProgram.toString()).toEqual(TOKEN_PROGRAM_ID.toString());
    expect(metadata.decimals).toEqual(9);
    expect(metadata.mint).toEqual(mint);
  });

  it("timeout recovers", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const timeoutProvider = new TimeoutMetadataProvider();
    const fetcher = new TokenFetcher(ctx.connection, 10).addProvider(timeoutProvider);
    const metadata = await fetcher.find(mint);
    expect(metadata.decimals).toEqual(9);
    expect(metadata.mint).toEqual(mint);
    expect(metadata.name).toBeFalsy();
    expect(metadata.symbol).toBeFalsy();
    expect(metadata.image).toBeFalsy();

    const metadata2 = (await fetcher.findMany([mint])).get(mint);
    expect(metadata2).toEqual(metadata);
  });

  it("provider does not get invoked if all metadata found before", async () => {
    const mint = (await createNewMint(ctx, 9)).toString();
    const p1 = new FileSystemProvider(
      new Map([[mint, { name: "P1 Token", symbol: "P1", image: "https://p1.com" }]])
    );
    const incrementProvider = new IncrementProvider();
    const fetcher = new TokenFetcher(ctx.connection).addProvider(p1).addProvider(incrementProvider);
    await fetcher.find(mint);
    expect(incrementProvider.getCount(mint)).toEqual(0);

    await fetcher.findMany([mint]);
    expect(incrementProvider.getCount(mint)).toEqual(0);
  });
});

class TimeoutMetadataProvider implements MetadataProvider {
  async find(_: Address): Promise<Readonly<Metadata> | null> {
    await sleep(5000);
    throw new Error("Unexpected timeout");
  }
  async findMany(_: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    await sleep(5000);
    throw new Error("Unexpected timeout");
  }
}

class IncrementProvider implements MetadataProvider {
  counters: Record<string, number> = {};
  async find(address: Address): Promise<Readonly<Metadata> | null> {
    if (!this.counters[address.toString()]) {
      this.counters[address.toString()] = 0;
    }
    this.counters[address.toString()] += 1;
    return {};
  }
  async findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>> {
    for (const address of addresses) {
      await this.find(address);
    }
    return new Map();
  }
  getCount(address: Address): number {
    return this.counters[address.toString()] || 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
