import { PublicKey } from "@solana/web3.js";
import { MintlistFileUtil } from "../util/mintlist-file-util";

export function addMint(mintlistPath: string, addMints: string[]) {
  let mintlist = MintlistFileUtil.readMintlistSync(mintlistPath);
  const mints = mintlist.mints;
  let numAdded = 0;
  for (const mint of addMints) {
    // Check mint is valid pubkey
    try {
      new PublicKey(mint);
    } catch (e) {
      console.log(`Invalid mint ${mint}`);
      continue;
    }

    // Check mint doesn't already exist
    const exists = mints.indexOf(mint) !== -1;
    if (exists) {
      console.log(`Mint ${mint} already exists in ${mintlist.name} (${mintlistPath})`);
      continue;
    }

    mints.push(mint);
    numAdded++;
  }

  mints.sort();
  mintlist.mints = mints;
  MintlistFileUtil.writeJsonSync(mintlistPath, mintlist);

  console.log(`Added ${numAdded} mints to ${mintlist.name} (${mintlistPath})`);
}
