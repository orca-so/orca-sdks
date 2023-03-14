import { execSync } from "child_process";

interface BumpOptions {
  before: string;
  after: string;
}

export function bump({ before, after }: BumpOptions) {
  if (!hasDeps()) {
    console.log("npm and git must be installed and in the PATH");
    return;
  }

  if (!hasMintlistChanges(before, after)) {
    console.log("No changes to mintlists detected");
    return;
  }

  if (!hasAddedMints(before, after)) {
    console.log("No new mints detected");
    return;
  }
}

// Diffs two mintlist.json files and determines whether any mints were added
function hasAddedMints(before: string, after: string) {
  const files = execSync(
    `git diff --name-only --diff-filter=d ${before} ${after} | grep '^src/mintlists/.*\.mintlist\.json$'`,
    { encoding: "utf-8" }
  );
  return true;
}

// Checks if a mintlist.json file was added or removed from the src/mintlists directory
// Returns true if a mintlist.json file was added or removed, false otherwise
function hasMintlistChanges(before: string, after: string) {
  const diff = execSync(`git diff --name-only ${before} ${after}`, { encoding: "utf-8" });
  const mintlistChanges = diff.split("\n").filter((line) => line.includes("src/mintlists"));
  return mintlistChanges.length > 0;
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
