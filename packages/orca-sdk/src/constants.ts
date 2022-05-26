import { Percentage } from "@orca-so/common-sdk";

export const DEFAULT_SLIPPAGE = Percentage.fromFraction(1, 1000); // 0.1%
export const ZERO_SLIPPAGE = Percentage.fromFraction(0, 1000);
