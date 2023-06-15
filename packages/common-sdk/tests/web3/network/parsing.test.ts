import { ParsableTokenAccountInfo } from "../../../src/web3";
import {
  createAssociatedTokenAccount,
  createTestContext,
  requestAirdrop,
} from "../../test-context";

jest.setTimeout(100 * 1000 /* ms */);

describe("parsing", () => {
  const ctx = createTestContext();

  beforeAll(async () => {
    await requestAirdrop(ctx);
  });

  it("ParsableTokenAccountInfo", async () => {
    const { ata, mint } = await createAssociatedTokenAccount(ctx);
    const account = await ctx.connection.getAccountInfo(ata);
    const parsed = ParsableTokenAccountInfo.parse(ata, account);

    expect(parsed).toBeDefined();
    if (!parsed) {
      throw new Error("parsed is undefined");
    }
    const parsedData = parsed.data;
    expect(parsedData.mint.equals(mint)).toBeTruthy();
    expect(parsedData.isInitialized).toEqual(true);
    expect(parsedData.amount === 0n).toBeTruthy();
  });
});
