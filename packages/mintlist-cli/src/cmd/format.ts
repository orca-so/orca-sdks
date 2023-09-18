import * as fs from "fs";
import * as path from "path";
import { MintlistFileUtil } from "../util/mintlist-file-util";

export function format(dir: string) {
  // Read directory contents
  const files = fs.readdirSync(dir);

  // Iterate over each file or sub-directory
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // If it's a directory, recurse into it
    if (stat.isDirectory()) {
      format(filePath);
    } else if (stat.isFile()) {
      // If it's a file, check if it's a JSON file and has a specific pattern in its name
      if (path.extname(file) === ".json") {
        if (MintlistFileUtil.validMintlistName(file)) {
          MintlistFileUtil.formatMintlist(filePath);
        }
        if (MintlistFileUtil.validOverridesName(file)) {
          MintlistFileUtil.formatOverrides(filePath);
        }
      }
    }
  }
}
