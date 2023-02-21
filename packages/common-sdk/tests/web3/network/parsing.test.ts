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
    const parsed = ParsableTokenAccountInfo.parse(account!.data);

    expect(parsed).toBeDefined();
    if (!parsed) {
      throw new Error("parsed is undefined");
    }
    expect(parsed.mint.equals(mint)).toBeTruthy();
    expect(parsed.isInitialized).toEqual(true);
    expect(parsed.amount.eqn(0)).toBeTruthy();
  });
});
