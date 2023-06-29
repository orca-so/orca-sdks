import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
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

export function createNewMint(ctx: TestContext, decimals: number = 6): Promise<PublicKey> {
  return createMint(
    ctx.connection,
    ctx.wallet.payer,
    ctx.wallet.publicKey,
    ctx.wallet.publicKey,
    decimals
  );
}
