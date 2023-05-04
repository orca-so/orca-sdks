import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import {
  Token,
  TOKEN_PROGRAM_ID,
  AccountLayout,
  u64,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} from "@solana/spl-token";
import { resolveOrCreateATA, resolveOrCreateATAs } from "../../src/web3/ata-util";
import { TransactionBuilder } from "../../src/web3/transactions";
import { createNewMint, createTestContext, requestAirdrop } from "../test-context";

jest.setTimeout(100 * 1000 /* ms */);

describe("ata-util", () => {
  const ctx = createTestContext();
  const { connection, wallet } = ctx;

  const tokenGetATA = (owner: PublicKey, mint: PublicKey) =>
    Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, mint, owner);

  beforeAll(async () => {
    await requestAirdrop(ctx);
  });

  it("resolveOrCreateATA, wrapped sol", async () => {
    const { connection, wallet } = ctx;

    // verify address & instruction
    const notExpected = await tokenGetATA(wallet.publicKey, NATIVE_MINT);
    const resolved = await resolveOrCreateATA(
      connection,
      wallet.publicKey,
      NATIVE_MINT,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      new u64(LAMPORTS_PER_SOL),
      wallet.publicKey,
      false
    );
    expect(resolved.address.equals(notExpected)).toBeFalsy(); // non-ATA address
    expect(resolved.instructions.length).toEqual(2);
    expect(resolved.instructions[0].programId.equals(SystemProgram.programId)).toBeTruthy();
    expect(resolved.instructions[1].programId.equals(TOKEN_PROGRAM_ID)).toBeTruthy();
    expect(resolved.cleanupInstructions.length).toEqual(1);
    expect(resolved.cleanupInstructions[0].programId.equals(TOKEN_PROGRAM_ID)).toBeTruthy();
  });

  it("resolveOrCreateATA, not exist, modeIdempotent = false", async () => {
    const mint = await createNewMint(ctx);

    // verify address & instruction
    const expected = await tokenGetATA(wallet.publicKey, mint.publicKey);
    const resolved = await resolveOrCreateATA(
      connection,
      wallet.publicKey,
      mint.publicKey,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      new u64(0),
      wallet.publicKey,
      false
    );
    expect(resolved.address.equals(expected)).toBeTruthy();
    expect(resolved.instructions.length).toEqual(1);
    expect(resolved.instructions[0].data.length).toEqual(0); // no instruction data

    // verify transaction
    const preAccountData = await connection.getAccountInfo(resolved.address);
    expect(preAccountData).toBeNull();

    const builder = new TransactionBuilder(connection, wallet);
    builder.addInstruction(resolved);
    await builder.buildAndExecute();

    const postAccountData = await connection.getAccountInfo(resolved.address);
    expect(postAccountData?.owner.equals(TOKEN_PROGRAM_ID)).toBeTruthy();
  });

  it("resolveOrCreateATA, exist, modeIdempotent = false", async () => {
    const mint = await createNewMint(ctx);

    const expected = await mint.createAssociatedTokenAccount(wallet.publicKey);
    const preAccountData = await connection.getAccountInfo(expected);
    expect(preAccountData).not.toBeNull();

    // verify address & instruction
    const resolved = await resolveOrCreateATA(
      connection,
      wallet.publicKey,
      mint.publicKey,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      new u64(0),
      wallet.publicKey,
      false
    );
    expect(resolved.address.equals(expected)).toBeTruthy();
    expect(resolved.instructions.length).toEqual(0);
  });

  it("resolveOrCreateATA, created before execution, modeIdempotent = false", async () => {
    const mint = await createNewMint(ctx);

    const expected = await tokenGetATA(wallet.publicKey, mint.publicKey);
    const resolved = await resolveOrCreateATA(
      connection,
      wallet.publicKey,
      mint.publicKey,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      new u64(0),
      wallet.publicKey,
      false
    );
    expect(resolved.address.equals(expected)).toBeTruthy();
    expect(resolved.instructions.length).toEqual(1);
    expect(resolved.instructions[0].data.length).toEqual(0); // no instruction data

    // created before execution
    await mint.createAssociatedTokenAccount(wallet.publicKey);
    const accountData = await connection.getAccountInfo(expected);
    expect(accountData).not.toBeNull();

    // Tx should be fail
    const builder = new TransactionBuilder(connection, wallet);
    builder.addInstruction(resolved);
    await expect(builder.buildAndExecute()).rejects.toThrow();
  });

  it("resolveOrCreateATA, created before execution, modeIdempotent = true", async () => {
    const mint = await createNewMint(ctx);

    const expected = await tokenGetATA(wallet.publicKey, mint.publicKey);
    const resolved = await resolveOrCreateATA(
      connection,
      wallet.publicKey,
      mint.publicKey,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      new u64(0),
      wallet.publicKey,
      true
    );
    expect(resolved.address.equals(expected)).toBeTruthy();
    expect(resolved.instructions.length).toEqual(1);
    expect(resolved.instructions[0].data[0]).toEqual(1); // 1 byte data

    // created before execution
    await mint.createAssociatedTokenAccount(wallet.publicKey);
    const accountData = await connection.getAccountInfo(expected);
    expect(accountData).not.toBeNull();

    // Tx should be success even if ATA has been created
    const builder = new TransactionBuilder(connection, wallet);
    builder.addInstruction(resolved);
    await expect(builder.buildAndExecute()).resolves.toBeTruthy();
  });

  it("resolveOrCreateATAs, created before execution, modeIdempotent = false", async () => {
    const mints = await Promise.all([createNewMint(ctx), createNewMint(ctx), createNewMint(ctx)]);

    // create first ATA
    await mints[0].createAssociatedTokenAccount(wallet.publicKey);

    const expected = await Promise.all(
      mints.map((mint) => tokenGetATA(wallet.publicKey, mint.publicKey))
    );
    const resolved = await resolveOrCreateATAs(
      connection,
      wallet.publicKey,
      mints.map((mint) => ({ tokenMint: mint.publicKey, wrappedSolAmountIn: new u64(0) })),
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      wallet.publicKey,
      false
    );
    expect(resolved[0].address.equals(expected[0])).toBeTruthy();
    expect(resolved[1].address.equals(expected[1])).toBeTruthy();
    expect(resolved[2].address.equals(expected[2])).toBeTruthy();
    expect(resolved[0].instructions.length).toEqual(0); // already exists
    expect(resolved[1].instructions.length).toEqual(1);
    expect(resolved[2].instructions.length).toEqual(1);
    expect(resolved[1].instructions[0].data.length).toEqual(0); // no instruction data
    expect(resolved[2].instructions[0].data.length).toEqual(0); // no instruction data

    // create second ATA before execution
    await mints[1].createAssociatedTokenAccount(wallet.publicKey);

    const preAccountData = await connection.getMultipleAccountsInfo(expected);
    expect(preAccountData[0]).not.toBeNull();
    expect(preAccountData[1]).not.toBeNull();
    expect(preAccountData[2]).toBeNull();

    // Tx should be fail
    const builder = new TransactionBuilder(connection, wallet);
    builder.addInstructions(resolved);
    await expect(builder.buildAndExecute()).rejects.toThrow();
  });

  it("resolveOrCreateATAs, created before execution, modeIdempotent = true", async () => {
    const mints = await Promise.all([createNewMint(ctx), createNewMint(ctx), createNewMint(ctx)]);

    // create first ATA
    await mints[0].createAssociatedTokenAccount(wallet.publicKey);

    const expected = await Promise.all(
      mints.map((mint) => tokenGetATA(wallet.publicKey, mint.publicKey))
    );
    const resolved = await resolveOrCreateATAs(
      connection,
      wallet.publicKey,
      mints.map((mint) => ({ tokenMint: mint.publicKey, wrappedSolAmountIn: new u64(0) })),
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      wallet.publicKey,
      true
    );
    expect(resolved[0].address.equals(expected[0])).toBeTruthy();
    expect(resolved[1].address.equals(expected[1])).toBeTruthy();
    expect(resolved[2].address.equals(expected[2])).toBeTruthy();
    expect(resolved[0].instructions.length).toEqual(0); // already exists
    expect(resolved[1].instructions.length).toEqual(1);
    expect(resolved[2].instructions.length).toEqual(1);
    expect(resolved[1].instructions[0].data[0]).toEqual(1); // 1 byte data
    expect(resolved[2].instructions[0].data[0]).toEqual(1); // 1 byte data

    // create second ATA before execution
    await mints[1].createAssociatedTokenAccount(wallet.publicKey);

    const preAccountData = await connection.getMultipleAccountsInfo(expected);
    expect(preAccountData[0]).not.toBeNull();
    expect(preAccountData[1]).not.toBeNull();
    expect(preAccountData[2]).toBeNull();

    // Tx should be success even if second ATA has been created
    const builder = new TransactionBuilder(connection, wallet);
    builder.addInstructions(resolved);
    await expect(builder.buildAndExecute()).resolves.toBeTruthy();

    const postAccountData = await connection.getMultipleAccountsInfo(expected);
    expect(postAccountData[0]).not.toBeNull();
    expect(postAccountData[1]).not.toBeNull();
    expect(postAccountData[2]).not.toBeNull();
  });

  it("resolveOrCreateATA, owner changed ATA detected", async () => {
    const anotherWallet = Keypair.generate();
    const mint = await createNewMint(ctx);

    const ata = await mint.createAssociatedTokenAccount(wallet.publicKey);

    // should be ok
    const preOwnerChanged = await resolveOrCreateATA(
      connection,
      wallet.publicKey,
      mint.publicKey,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span)
    );
    expect(preOwnerChanged.address.equals(ata)).toBeTruthy();

    // owner change
    const builder = new TransactionBuilder(connection, wallet);
    builder.addInstruction({
      instructions: [
        Token.createSetAuthorityInstruction(
          TOKEN_PROGRAM_ID,
          ata,
          anotherWallet.publicKey,
          "AccountOwner",
          wallet.publicKey,
          []
        ),
      ],
      cleanupInstructions: [],
      signers: [],
    });
    await builder.buildAndExecute();

    // verify that owner have been changed
    const changed = await mint.getAccountInfo(ata);
    expect(changed.owner.equals(anotherWallet.publicKey)).toBeTruthy();

    // should be failed
    const postOwnerChangedPromise = resolveOrCreateATA(
      connection,
      wallet.publicKey,
      mint.publicKey,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span)
    );
    await expect(postOwnerChangedPromise).rejects.toThrow(/ATA with change of ownership detected/);
  });
});
