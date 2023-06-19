import { Account, Mint, unpackAccount, unpackMint } from "@solana/spl-token";
import { AccountInfo, PublicKey } from "@solana/web3.js";

/**
 * Static abstract class definition to parse entities.
 * @category Parsables
 */
export interface ParsableEntity<T> {
  /**
   * Parse account data
   *
   * @param accountData Buffer data for the entity
   * @returns Parsed entity
   */
  parse: (address: PublicKey, accountData: AccountInfo<Buffer> | undefined | null) => T | null;
}

/**
 * @category Parsables
 */
@staticImplements<ParsableEntity<Account>>()
export class ParsableTokenAccountInfo {
  private constructor() {}

  public static parse(
    address: PublicKey,
    data: AccountInfo<Buffer> | undefined | null
  ): Account | null {
    if (!data) {
      return null;
    }

    try {
      return unpackAccount(address, data);
    } catch (e) {
      console.error(`error while parsing TokenAccount ${address.toBase58()}: ${e}`);

      return null;
    }
  }
}

/**
 * @category Parsables
 */
@staticImplements<ParsableEntity<Mint>>()
export class ParsableMintInfo {
  private constructor() {}

  public static parse(
    address: PublicKey,
    data: AccountInfo<Buffer> | undefined | null
  ): Mint | null {
    if (!data) {
      return null;
    }

    try {
      return unpackMint(address, data);
    } catch (e) {
      console.error(`error while parsing Mint ${address.toBase58()}: ${e}`);
      return null;
    }
  }
}

/**
 * Class decorator to define an interface with static methods
 * Reference: https://github.com/Microsoft/TypeScript/issues/13462#issuecomment-295685298
 */
export function staticImplements<T>() {
  return <U extends T>(constructor: U) => {
    constructor;
  };
}
