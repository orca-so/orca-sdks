import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
export const DEFAULT_RPC_ENDPOINT_URL = "http://localhost:8899";

export interface TestContext {
  connection: Connection;
  wallet: Wallet;
}

export function createTestContext(url: string = DEFAULT_RPC_ENDPOINT_URL): TestContext {
  return {
    connection: new Connection(url, "confirmed"),
    wallet: new Wallet(Keypair.generate()),
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

export function createNewMint(ctx: TestContext, decimals: number = 6): Promise<Token> {
  return Token.createMint(
    ctx.connection,
    ctx.wallet.payer,
    ctx.wallet.publicKey,
    ctx.wallet.publicKey,
    decimals,
    TOKEN_PROGRAM_ID
  );
}
