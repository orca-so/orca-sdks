import { Mintlist } from "@orca-so/token-sdk";
import { execSync } from "child_process";
import { MetadataOverrides, MintlistFileUtil } from "../util/mintlist-file-util";

interface BumpOptions {
  before: string;
  after: string;
}

type VersionChange = "major" | "minor" | "patch";

/**
 * Bumps the version of the package based on the changes in the mintlists.
 * If a mintlist is added or removed, a major version bump is performed.
 * If the only change is removed mints, a minor version bump is performed.
 * If the only change is added mints or updated overrides, a patch version bump is performed.
 */
export function bump({ before, after }: BumpOptions) {
  if (!hasDeps()) {
    console.log("npm and git must be installed and in the PATH");
    process.exit(1);
  }

  if (hasUncommittedChanges()) {
    console.log("Must have clear working directory");
    process.exit(1);
  }

  const versionChange = getVersionChange(before, after);
  if (!versionChange) {
    return;
  }

  const version = execSync(`npm version ${versionChange}`, { encoding: "utf-8" }).trim();
  console.log(`${version}`);
}

function getVersionChange(before: string, after: string): VersionChange | undefined {
  if (hasMintlistChanges(before, after)) {
    return "major";
  }
  const { hasAdded, hasRemoved } = diffMintlists(before, after);
  if (hasRemoved) {
    return "minor";
  }
  if (hasAdded || diffOverrides(before, after)) {
    return "patch";
  }
}

function diffOverrides(before: string, after: string): boolean {
  const beforeOverrides = MintlistFileUtil.fromString<MetadataOverrides>(
    execSync(`git show ${before}:src/overrides.json`, {
      encoding: "utf-8",
    })
  );
  const afterOverrides = MintlistFileUtil.fromString<MetadataOverrides>(
    execSync(`git show ${after}:src/overrides.json`, {
      encoding: "utf-8",
    })
  );

  if (Object.keys(beforeOverrides).length !== Object.keys(afterOverrides).length) {
    return true;
  }

  for (const [mint, metadata] of Object.entries(beforeOverrides)) {
    if (
      !afterOverrides[mint] ||
      metadata.image !== afterOverrides[mint].image ||
      metadata.name !== afterOverrides[mint].name ||
      metadata.symbol !== afterOverrides[mint].symbol
    ) {
      return true;
    }
  }

  return false;
}

function diffMintlists(before: string, after: string): { hasAdded: boolean; hasRemoved: boolean } {
  const files = MintlistFileUtil.toValidFilePaths(
    execSync(`git diff --name-only --diff-filter=ad ${before} ${after}`, {
      encoding: "utf-8",
    })
  );

  let hasAdded = false;
  let hasRemoved = false;
  for (const filePath of files) {
    if (!exists(before, filePath) || !exists(after, filePath)) {
      continue;
    }

    const beforeFile = MintlistFileUtil.fromString<Mintlist>(
      execSync(`git show ${before}:${filePath}`, { encoding: "utf-8" })
    );
    const afterFile = MintlistFileUtil.fromString<Mintlist>(
      execSync(`git show ${after}:${filePath}`, { encoding: "utf-8" })
    );
    if (hasAddedMints(beforeFile, afterFile)) {
      hasAdded = true;
    }
    if (hasAddedMints(afterFile, beforeFile)) {
      hasRemoved = true;
    }
  }

  return { hasAdded, hasRemoved };
}

// Returns true if the right mintlist has mints that are not in the left mintlist
function hasAddedMints(left: Mintlist, right: Mintlist): boolean {
  const beforeSet = new Set(left.mints);
  for (const mint of right.mints) {
    if (!beforeSet.has(mint)) {
      return true;
    }
  }
  return false;
}

function exists(hash: string, filePath: string) {
  const flag = execSync(`git ls-tree ${hash} ${filePath} | wc -l`, { encoding: "utf-8" })
    .trim()
    .split("\n")[0];
  return flag === "1";
}

// Checks if a mintlist.json file was added or removed from the src/mintlists directory
// Returns true if a mintlist.json file was added or removed, false otherwise
function hasMintlistChanges(before: string, after: string) {
  const beforeMintlists = MintlistFileUtil.toValidFilePaths(
    execSync(`git ls-tree --name-only ${before} src/**/**`, {
      encoding: "utf-8",
    })
  );
  const afterMintlists = MintlistFileUtil.toValidFilePaths(
    execSync(`git ls-tree --name-only ${after} src/**/**`, {
      encoding: "utf-8",
    })
  );
  return beforeMintlists.sort().toString() !== afterMintlists.sort().toString();
}

// Checks if npm and git are installed and in the PATH
// Returns true if both are installed, false otherwise
function hasDeps() {
  try {
    execSync("git --version", { stdio: "ignore" });
    execSync("npm --version", { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// Checks if there are uncommitted changes in the working tree
// Returns true if there are uncommitted changes, false otherwise
function hasUncommittedChanges() {
  const diff = execSync("git diff --name-only", { encoding: "utf-8" });
  return diff.length > 0;
}
