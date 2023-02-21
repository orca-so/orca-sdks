import { PublicKey } from "@solana/web3.js";
import { AccountInfo, MintInfo, MintLayout, u64 } from "@solana/spl-token";
import { TokenUtil } from "../token-util";

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
  parse: (accountData: Buffer | undefined | null) => T | null;
}

/**
 * @category Parsables
 */
@staticImplements<ParsableEntity<AccountInfo>>()
export class ParsableTokenAccountInfo {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): AccountInfo | null {
    if (!data) {
      return null;
    }

    try {
      return TokenUtil.deserializeTokenAccount(data);
    } catch (e) {
      console.error(`error while parsing TokenAccount: ${e}`);
      return null;
    }
  }
}

/**
 * @category Parsables
 */
@staticImplements<ParsableEntity<MintInfo>>()
export class ParsableMintInfo {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): MintInfo | null {
    if (!data) {
      return null;
    }

    try {
      if (data.byteLength !== MintLayout.span) {
        throw new Error("Invalid data length for MintInfo");
      }
      const buffer = MintLayout.decode(data);
      const mintInfo: MintInfo = {
        mintAuthority:
          buffer.mintAuthorityOption === 0 ? null : new PublicKey(buffer.mintAuthority),
        supply: u64.fromBuffer(buffer.supply),
        decimals: buffer.decimals,
        isInitialized: buffer.isInitialized !== 0,
        freezeAuthority:
          buffer.freezeAuthority === 0 ? null : new PublicKey(buffer.freezeAuthority),
      };

      return mintInfo;
    } catch (e) {
      console.error(`error while parsing MintInfo: ${e}`);
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
