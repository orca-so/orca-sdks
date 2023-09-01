import * as fs from "fs";
import * as path from "path";
import { MintlistFileUtil } from "../util/mintlist-file-util";

/**
 * Initiates the check for formatting issues in JSON files within a given directory.
 * If any errors are found, the process exits with a status code of 1.
 *
 * @param {string} dir - The directory path to start checking.
 */
export function checkFormat(dir: string) {
  const errors = traverseDirectory(dir, checkFileFormat);
  if (errors.length > 0) {
    console.error(`${errors.length} file(s) had formatting errors:\n${errors.join("\n")}`);
    process.exit(1);
  }
}

/**
 * Recursively traverses a directory and applies a given callback function to each file.
 *
 * @param {string} dir - The directory to traverse.
 * @param {(filePath: string) => string[]} callback - The function to apply to each file. Should return an array of error strings.
 * @returns {string[]} - An array of file paths that had issues as determined by the callback.
 */
function traverseDirectory(dir: string, callback: (filePath: string) => string[]): string[] {
  let errors: string[] = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      errors = errors.concat(traverseDirectory(filePath, callback));
    } else if (stat.isFile()) {
      errors = errors.concat(callback(filePath));
    }
  }

  return errors;
}

/**
 * Checks the format of a given JSON file based on its name.
 *
 * @param {string} filePath - The full path of the file to check.
 * @returns {string[]} - An array containing the file path if it had a formatting error, or an empty array otherwise.
 */
function checkFileFormat(filePath: string): string[] {
  const errors: string[] = [];
  const file = path.basename(filePath);

  if (path.extname(file) === ".json") {
    if (
      (MintlistFileUtil.validMintlistName(file) &&
        !MintlistFileUtil.checkMintlistFormat(filePath)) ||
      (MintlistFileUtil.validOverridesName(file) &&
        !MintlistFileUtil.checkOverridesFormat(filePath))
    ) {
      errors.push(filePath);
    }
  }

  return errors;
}
