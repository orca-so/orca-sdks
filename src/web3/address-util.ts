import { Address, translateAddress, utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * @category Util
 */
export type PDA = { publicKey: PublicKey; bump: number };

/**
 * @category Util
 */
export class AddressUtil {
  public static toPubKey(address: Address): PublicKey {
    return translateAddress(address);
  }

  public static toPubKeys(addresses: Address[]): PublicKey[] {
    return addresses.map((address) => AddressUtil.toPubKey(address));
  }

  public static findProgramAddress(seeds: (Uint8Array | Buffer)[], programId: PublicKey): PDA {
    const [publicKey, bump] = utils.publicKey.findProgramAddressSync(seeds, programId);
    return { publicKey, bump };
  }
}
