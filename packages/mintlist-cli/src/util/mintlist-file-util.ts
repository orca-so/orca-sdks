import { Mintlist, TokenMetadata } from "@orca-so/token-sdk";
import { readFileSync, writeFileSync } from "mz/fs";
import { resolve } from "path";
import path from "node:path";

export class MintlistFileUtil {
  public static readMintlistSync(filePath: string): Mintlist {
    try {
      return this.fromString<Mintlist>(readFileSync(resolve(filePath), "utf-8"));
    } catch (e) {
      throw new Error(`Failed to parse mintlist at ${filePath}`);
    }
  }

  public static readOverridesSync(filePath: string): MetadataOverrides {
    try {
      return JSON.parse(readFileSync(resolve(filePath), "utf-8")) as MetadataOverrides;
    } catch (e) {
      throw new Error(`Failed to parse overrides at ${filePath}`);
    }
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

  public static validTokenlistName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z\d]*(-[a-zA-Z\d]+)*\.tokenlist\.json$/.test(name);
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
}

export type MetadataOverrides = Record<string, Partial<TokenMetadata>>;
