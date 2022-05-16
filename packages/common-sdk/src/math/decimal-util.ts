import { u64 } from "@solana/spl-token";
import Decimal from "decimal.js";

export class DecimalUtil {
  public static adjustDecimals(input: Decimal, shift = 0): Decimal {
    return input.div(Decimal.pow(10, shift));
  }

  public static fromU64(input: u64, shift = 0): Decimal {
    return new Decimal(input.toString()).div(new Decimal(10).pow(shift));
  }

  public static fromNumber(input: number, shift = 0): Decimal {
    return new Decimal(input).div(new Decimal(10).pow(shift));
  }

  public static toU64(input: Decimal, shift = 0): u64 {
    if (input.isNeg()) {
      throw new Error("Negative decimal value ${input} cannot be converted to u64.");
    }

    const shiftedValue = input.mul(new Decimal(10).pow(shift));
    const zeroDecimalValue = shiftedValue.trunc();
    return new u64(zeroDecimalValue.toString());
  }
}
