import { PublicKey, Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import {
  Token,
  TOKEN_PROGRAM_ID,
  AccountLayout,
  u64,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} from "@solana/spl-token";
import { Wallet } from "@project-serum/anchor";
import { resolveOrCreateATA, resolveOrCreateATAs } from "../src/web3/ata-util";
import { TransactionBuilder } from "../src/web3/transactions";

jest.setTimeout(100 * 1000 /* ms */);

describe("ata-util", () => {
  const DEFAULT_RPC_ENDPOINT_URL = "http://localhost:8899";

  const connection = new Connection(DEFAULT_RPC_ENDPOINT_URL, "confirmed");
  const wallet = new Wallet(Keypair.generate());

  const tokenGetATA = (owner: PublicKey, mint: PublicKey) =>
    Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, mint, owner);

  const createNewMint = () =>
    Token.createMint(connection, wallet.payer, wallet.publicKey, null, 6, TOKEN_PROGRAM_ID);

  beforeAll(async () => {
    // airdrop to the test wallet
    const signature = await connection.requestAirdrop(wallet.publicKey, 1000 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
  });

  it("resolveOrCreateATA, wrapped sol", async () => {
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
    const mint = await createNewMint();

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
    const mint = await createNewMint();

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
    const mint = await createNewMint();

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
    const mint = await createNewMint();

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
    const mints = await Promise.all([createNewMint(), createNewMint(), createNewMint()]);

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
    const mints = await Promise.all([createNewMint(), createNewMint(), createNewMint()]);

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
});
