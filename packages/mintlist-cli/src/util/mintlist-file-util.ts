import { Mintlist, Overrides } from "@orca-so/token-sdk";
import { readFileSync, writeFileSync } from "mz/fs";
import { resolve } from "path";
import path from "node:path";
import { Address, AddressUtil } from "@orca-so/common-sdk";

export class MintlistFileUtil {
  public static readMintlistSync(filePath: string): Mintlist {
    const paths = MintlistFileUtil.toValidFilePaths(filePath);
    if (paths.length !== 1) {
      throw new Error(`No valid mintlist found at ${filePath} - must be in src/mintlists`);
    }
    try {
      return this.fromString<Mintlist>(readFileSync(resolve(paths[0]), "utf-8"));
    } catch (e) {
      throw new Error(`Failed to parse mintlist at ${paths[0]}`);
    }
  }

  public static readOverridesSync(filePath: string): Overrides {
    try {
      return JSON.parse(readFileSync(resolve(filePath), "utf-8")) as Overrides;
    } catch (e) {
      throw new Error(`Failed to parse overrides at ${filePath}`);
    }
  }

  public static checkMintlistFormat(filePath: string): boolean {
    let mintlist;
    try {
      mintlist = MintlistFileUtil.readMintlistSync(filePath);
    } catch (e) {
      return false;
    }

    const mints = AddressUtil.toStrings(mintlist.mints);

    // Check that all mints are valid
    mints.forEach((mint) => {
      try {
        AddressUtil.toPubKey(mint);
      } catch (e) {
        return false;
      }
    });

    // Check mints are in ascending order
    for (let i = 1; i < mintlist.mints.length; i++) {
      if (MintlistFileUtil.cmpMint(mints[i], mints[i - 1]) <= 0) {
        return false;
      }
    }
    return true;
  }

  public static checkOverridesFormat(filePath: string): boolean {
    let overrides: Overrides;
    try {
      overrides = MintlistFileUtil.readOverridesSync(filePath);
    } catch (e) {
      return false;
    }

    const VALID_FIELDS = ["name", "symbol", "image"];
    Object.entries(overrides).forEach(([mint, metadata]) => {
      // Check that all mints are valid
      try {
        AddressUtil.toPubKey(mint);
      } catch (e) {
        return false;
      }
      // Check that all metadata fields are valid
      if (!Object.values(metadata).every((f) => VALID_FIELDS.includes(f))) {
        return false;
      }
    });

    // Check mints are in ascending order
    const mints = Object.keys(overrides);
    for (let i = 1; i < mints.length; i++) {
      if (MintlistFileUtil.cmpMint(mints[i], mints[i - 1]) <= 0) {
        return false;
      }
    }
    return true;
  }

  public static formatMintlist(filePath: string) {
    const mintlist = MintlistFileUtil.readMintlistSync(filePath);
    mintlist.mints.sort(MintlistFileUtil.cmpMint);
    MintlistFileUtil.writeJsonSync(filePath, mintlist);
  }

  public static formatOverrides(filePath: string) {
    const overrides = MintlistFileUtil.readOverridesSync(filePath);
    const formatted = Object.fromEntries(
      Object.entries(overrides).sort(([mintA], [mintB]) => MintlistFileUtil.cmpMint(mintA, mintB))
    );
    MintlistFileUtil.writeJsonSync(filePath, formatted);
  }

  public static fromString<T>(str: string): T {
    try {
      return JSON.parse(str) as T;
    } catch (e) {
      throw new Error(`Failed to parse from string`);
    }
  }

  public static validMintlistName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z\d]*(-[a-zA-Z\d]+)*\.mintlist\.json$/.test(name);
  }

  public static validOverridesName(name: string): boolean {
    return name === "overrides.json";
  }

  public static writeJsonSync(filePath: string, obj: any) {
    try {
      const fullPath = resolve(filePath);
      const json = JSON.stringify(obj, null, 2);
      writeFileSync(fullPath, json + "\n");
    } catch (e) {
      throw new Error(`Failed to write file at ${filePath}`);
    }
  }

  public static getFileName(filePath: string): string {
    const name = filePath.split(path.sep).pop();
    if (!name) {
      throw new Error("Invalid path");
    }
    return name;
  }

  public static toValidFilePaths(str: string): string[] {
    return str
      .split("\n")
      .filter((line) => line.length > 0)
      .filter((line) => MintlistFileUtil.validMintlistName(MintlistFileUtil.getFileName(line)));
  }

  public static cmpMint(a: Address, b: Address): number {
    return AddressUtil.toString(a).localeCompare(AddressUtil.toString(b));
  }
}
