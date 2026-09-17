import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly version?: unknown;
}

/** Read the repository package version for reproducible source-tree eval reports. */
export function currentPackageVersion(): string {
  const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageManifest;
  if (typeof manifest.version !== "string" || manifest.version.trim().length === 0) {
    throw new TypeError("package.json must contain a non-empty version");
  }
  return manifest.version;
}
