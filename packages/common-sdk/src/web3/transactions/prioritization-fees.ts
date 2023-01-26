import { Address } from "@project-serum/anchor";
import { Connection } from "@solana/web3.js";

type PrioritizationFee = {
  slot: number;
  prioritizationFee: number;
};

export async function getRecentPrioritizationFee(connection: Connection, accounts: Address[] = []) {
  const res = await (connection as any)._rpcRequest("getRecentPrioritizationFees", [accounts]);

  const fees: PrioritizationFee[] = res.result.value;
  console.log(fees);

  const { sumFees, sumSlots } = fees.reduce(
    (acc, fee) => {
      const slotDistance = fee.slot - acc.previousSlot;
      return {
        sumFees: acc.sumFees + fee.prioritizationFee * slotDistance,
        sumSlots: acc.sumSlots + slotDistance,
        previousSlot: fee.slot,
      };
    },
    { sumFees: 0, sumSlots: 0, previousSlot: 0 }
  );

  return sumFees / sumSlots;
}
