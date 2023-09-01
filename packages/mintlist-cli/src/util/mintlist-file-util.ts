import { Mintlist, Metadata } from "@orca-so/token-sdk";
import { readFileSync, writeFileSync } from "mz/fs";
import { resolve } from "path";
import path from "node:path";
import { AddressUtil } from "@orca-so/common-sdk";

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

  public static readOverridesSync(filePath: string): MetadataOverrides {
    try {
      return JSON.parse(readFileSync(resolve(filePath), "utf-8")) as MetadataOverrides;
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
    for (let i = 1; i < mintlist.mints.length; i++) {
      // Expect ascending order
      if (mints[i].localeCompare(mints[i - 1]) <= 0) {
        return false;
      }
    }
    return true;
  }

  public static checkOverridesFormat(filePath: string): boolean {
    let overrides;
    try {
      overrides = MintlistFileUtil.readOverridesSync(filePath);
    } catch (e) {
      return false;
    }

    const mints = Object.keys(overrides);
    for (let i = 1; i < mints.length; i++) {
      // Expect ascending order
      if (mints[i].localeCompare(mints[i - 1]) <= 0) {
        return false;
      }
    }
    return true;
  }

  public static formatMintlist(filePath: string) {
    const mintlist = MintlistFileUtil.readMintlistSync(filePath);
    const mints = AddressUtil.toStrings(mintlist.mints);
    // Sort ascending order
    mints.sort((a, b) => a.localeCompare(b));
    mintlist.mints = mints;
    MintlistFileUtil.writeJsonSync(filePath, mintlist);
  }

  public static formatOverrides(filePath: string) {
    const overrides = MintlistFileUtil.readOverridesSync(filePath);
    // Sort ascending order
    const formatted = Object.fromEntries(
      Object.entries(overrides).sort(([mintA], [mintB]) => mintA.localeCompare(mintB))
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
    return /^overrides.json$/.test(name);
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
}

export type MetadataOverrides = Record<string, Partial<Metadata>>;
