import { Keypair } from "@solana/web3.js";
import { MintInfo } from "@solana/spl-token";
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

  beforeAll(async () => {
    await requestAirdrop(ctx);
  });

  it("getParsedAccount, ok", async () => {
    const mint = await createNewMint(ctx);
    const expected = await mint.getMintInfo();
    const mintInfo = await getParsedAccount(ctx.connection, mint.publicKey, ParsableMintInfo);
    expectMintInfoEquals(mintInfo!, expected);
  });

  it("getMultipleParsedAccounts, some null", async () => {
    const mint = await createNewMint(ctx);
    const missing = Keypair.generate().publicKey;
    const mintInfos = await getMultipleParsedAccounts(
      ctx.connection,
      [mint.publicKey, missing],
      ParsableMintInfo
    );
    expectMintInfoEquals(mintInfos[0]!, await mint.getMintInfo());
    expect(mintInfos[1]).toBeNull();
  });

  it("getMultipleParsedAccounts, invalid type returns null", async () => {
    const mint = await createNewMint(ctx);
    const { ata } = await createAssociatedTokenAccount(ctx, mint.publicKey);
    const mintInfos = await getMultipleParsedAccounts(
      ctx.connection,
      [mint.publicKey, ata],
      ParsableMintInfo
    );
    expectMintInfoEquals(mintInfos[0]!, await mint.getMintInfo());
    expect(mintInfos[1]).toBeNull();
  });
});

function expectMintInfoEquals(actual: MintInfo, expected: MintInfo) {
  expect(actual.decimals).toEqual(expected.decimals);
  expect(actual.isInitialized).toEqual(expected.isInitialized);
  expect(actual.mintAuthority!.equals(expected.mintAuthority!)).toBeTruthy();
  expect(actual.freezeAuthority!.equals(expected.freezeAuthority!)).toBeTruthy();
  expect(actual.supply.eq(expected.supply)).toBeTruthy();
}
