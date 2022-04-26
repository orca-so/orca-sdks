import { Address, translateAddress, utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * @category Transactions Util
 */
export type PDA = { publicKey: PublicKey; bump: number };

/**
 * @category Transactions Util
 */
export class AddressUtil {
  public static toPubKey(address: Address): PublicKey {
    return translateAddress(address);
  }

  /**
   * @category Transactions Util
   */
  public static toPubKeys(addresses: Address[]): PublicKey[] {
    return addresses.map((address) => AddressUtil.toPubKey(address));
  }

  /**
   * @category Transactions Util
   */
  public static findProgramAddress(
    seeds: (Uint8Array | Buffer)[],
    programId: PublicKey
  ): PDA {
    const [publicKey, bump] = utils.publicKey.findProgramAddressSync(
      seeds,
      programId
    );
    return { publicKey, bump };
  }
}
