import { MintlistFileUtil } from "../util/mintlist-file-util";

export function removeMint(mintlistPath: string, removeMints: string[]) {
  let mintlist = MintlistFileUtil.readMintlistSync(mintlistPath);
  const mints = mintlist.mints;
  let numRemoved = 0;
  for (const mint of removeMints) {
    const index = mints.indexOf(mint);
    if (index !== -1) {
      mints.splice(index, 1);
      numRemoved++;
    }
  }
  mints.sort(MintlistFileUtil.cmpMint);
  mintlist.mints = mints;
  MintlistFileUtil.writeJsonSync(mintlistPath, mintlist);

  console.log(`Removed ${numRemoved} mints from ${mintlist.name} (${mintlistPath})`);
}
