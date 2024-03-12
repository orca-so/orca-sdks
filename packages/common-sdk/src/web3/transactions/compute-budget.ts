import { Connection, PublicKey, RecentPrioritizationFees } from "@solana/web3.js";
import { Instruction } from "./types";

export async function getPriorityFeeInLamports(
  connection: Connection,
  computeBudgetLimit: number,
  instructions: Instruction[],
): Promise<number> {
  const recentPriorityFees = await connection.getRecentPrioritizationFees({
    lockedWritableAccounts: getLockWritableAccounts(instructions),
  });
  const priorityFee = getPriorityFeeSuggestion(recentPriorityFees);
  return (priorityFee * computeBudgetLimit) / 1_000_000;
}

function getPriorityFeeSuggestion(recentPriorityFees: RecentPrioritizationFees[]): number {
  // Take the 80th percentile of the last 20 slots
  const sortedPriorityFees = recentPriorityFees
    .sort((a, b) => a.slot - b.slot)
    .slice(-20)
    .sort((a, b) => a.prioritizationFee - b.prioritizationFee);
  const percentileIndex = Math.floor(sortedPriorityFees.length * 0.8);
  return sortedPriorityFees[percentileIndex].prioritizationFee;
}

function getLockWritableAccounts(instructions: Instruction[]): PublicKey[] {
  const accountKeys = instructions
    .flatMap((instruction) => [...instruction.instructions, ...instruction.cleanupInstructions])
    .flatMap((instruction) => instruction.keys);
  const writableAccounts = accountKeys.filter((key) => key.isWritable).map((key) => key.pubkey);
  return Array.from(new Set(writableAccounts));
}
