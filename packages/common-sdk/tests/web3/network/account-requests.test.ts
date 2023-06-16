import { getMint, Mint } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { getMultipleParsedAccounts, getParsedAccount, ParsableMintInfo } from "../../../src/web3";
import {
  createAssociatedTokenAccount,
  createNewMint,
  createTestContext,
  requestAirdrop,
} from "../../test-context";

jest.setTimeout(100 * 1000 /* ms */);

describe("account-requests", () => {
  const ctx = createTestContext();
  // Silence the errors when we evaluate invalid token accounts.
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  beforeAll(async () => {
    await requestAirdrop(ctx);
  });

  it("getParsedAccount, ok", async () => {
    const mint = await createNewMint(ctx);
    const expected = await getMint(ctx.connection, mint);

    const mintInfo = await getParsedAccount(ctx.connection, mint, ParsableMintInfo);
    expectMintEquals(mintInfo!, expected);
  });

  it("getMultipleParsedAccounts, some null", async () => {
    const mint = await createNewMint(ctx);
    const missing = Keypair.generate().publicKey;
    const mintInfos = await getMultipleParsedAccounts(
      ctx.connection,
      [mint, missing],
      ParsableMintInfo
    );

    expectMintEquals(mintInfos[0]!, await getMint(ctx.connection, mint));
    expect(mintInfos[1]).toBeNull();
  });

  it("getMultipleParsedAccounts, invalid type returns null", async () => {
    const mint = await createNewMint(ctx);
    const { ata } = await createAssociatedTokenAccount(ctx, mint);
    const mintInfos = await getMultipleParsedAccounts(
      ctx.connection,
      [mint, ata],
      ParsableMintInfo
    );
    expectMintEquals(mintInfos[0]!, await getMint(ctx.connection, mint));
    expect(mintInfos[1]).toBeNull();
  });

  it("getMultipleParsedAccounts, separate chunks", async () => {
    const mints = await Promise.all(Array.from({ length: 10 }, async () => await createNewMint(ctx)));
    const mintInfos = await getMultipleParsedAccounts(
      ctx.connection,
      mints,
      ParsableMintInfo,
      2
    );

    // Verify all mints are fetched and are in order
    expect(mintInfos.length === mints.length);
    mints.forEach((mint, i) => {
      expect(mintInfos[i]!.address.equals(mint));
    })
  });
});

function expectMintEquals(actual: Mint, expected: Mint) {
  expect(actual.decimals).toEqual(expected.decimals);
  expect(actual.isInitialized).toEqual(expected.isInitialized);
  expect(actual.mintAuthority!.equals(expected.mintAuthority!)).toBeTruthy();
  expect(actual.freezeAuthority!.equals(expected.freezeAuthority!)).toBeTruthy();
  expect(actual.supply === expected.supply).toBeTruthy();
}
