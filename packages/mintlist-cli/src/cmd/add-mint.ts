import { PublicKey } from "@solana/web3.js";
import { MintlistFileUtil } from "../util/mintlist-file-util";

export function addMint(mintlistPath: string, addMints: string[]) {
  let mintlist = MintlistFileUtil.readMintlistSync(mintlistPath);
  const mints = mintlist.mints;
  const addedMints = [];
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
      continue;
    }

    mints.push(mint);
    addedMints.push(mint);
  }

  mints.sort();
  mintlist.mints = mints;
  MintlistFileUtil.writeJsonSync(mintlistPath, mintlist);

  if (addedMints.length === 0) {
    console.log("No mints added");
  } else {
    console.log(`Added ${addedMints.length} mints to ${mintlist.name}:\n${addedMints.join("\n")}`);
  }
}
