import { Connection, PublicKey, RecentPrioritizationFees } from "@solana/web3.js";
import { Instruction } from "./types";

export async function getPriorityFeeInLamports(
  connection: Connection,
  computeBudgetLimit: number,
  instructions: Instruction[],
  percentile: number
): Promise<number> {
  const recentPriorityFees = await connection.getRecentPrioritizationFees({
    lockedWritableAccounts: getLockWritableAccounts(instructions),
  });
  const priorityFee = getPriorityFeeSuggestion(recentPriorityFees, percentile);
  return (priorityFee * computeBudgetLimit) / 1_000_000;
}

function getPriorityFeeSuggestion(recentPriorityFees: RecentPrioritizationFees[], percentile: number): number {
  // Take the Xth percentile of all the slots returned
  const sortedPriorityFees = recentPriorityFees
    .sort((a, b) => a.prioritizationFee - b.prioritizationFee);
  const percentileIndex = Math.min(
    Math.max(Math.floor(sortedPriorityFees.length * percentile), 0),
    sortedPriorityFees.length - 1
  );
  return sortedPriorityFees[percentileIndex].prioritizationFee;
}

function getLockWritableAccounts(instructions: Instruction[]): PublicKey[] {
  const accountKeys = instructions
    .flatMap((instruction) => [...instruction.instructions, ...instruction.cleanupInstructions])
    .flatMap((instruction) => instruction.keys);
  const writableAccounts = accountKeys.filter((key) => key.isWritable).map((key) => key.pubkey);
  return Array.from(new Set(writableAccounts));
}
