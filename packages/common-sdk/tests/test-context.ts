import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import TestWallet from "./utils/test-wallet";
export const DEFAULT_RPC_ENDPOINT_URL = "http://localhost:8899";

export interface TestContext {
  connection: Connection;
  wallet: TestWallet;
}

export function createTestContext(url: string = DEFAULT_RPC_ENDPOINT_URL): TestContext {
  return {
    connection: new Connection(url, "confirmed"),
    wallet: new TestWallet(Keypair.generate()),
  };
}

export async function requestAirdrop(ctx: TestContext, numSol: number = 1000): Promise<void> {
  const signature = await ctx.connection.requestAirdrop(
    ctx.wallet.publicKey,
    numSol * LAMPORTS_PER_SOL
  );
  const latestBlockhash = await ctx.connection.getLatestBlockhash();
  await ctx.connection.confirmTransaction({ signature, ...latestBlockhash });
}

export function createNewMint(ctx: TestContext): Promise<Token> {
  return Token.createMint(
    ctx.connection,
    ctx.wallet.payer,
    ctx.wallet.publicKey,
    ctx.wallet.publicKey,
    6,
    TOKEN_PROGRAM_ID
  );
}

export async function createAssociatedTokenAccount(
  ctx: TestContext,
  mint?: PublicKey
): Promise<{ ata: PublicKey; mint: PublicKey }> {
  let tokenMint = mint || (await createNewMint(ctx)).publicKey;
  const token = new Token(ctx.connection, tokenMint, TOKEN_PROGRAM_ID, ctx.wallet.payer);
  return { ata: await token.createAssociatedTokenAccount(ctx.wallet.publicKey), mint: tokenMint };
}
