import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryRoot = mkdtempSync(join(tmpdir(), "jev-starter-pack-check-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", temporaryRoot], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const archive = readdirSync(temporaryRoot).find((name) => name.endsWith(".tgz"));
  if (archive === undefined) {
    throw new Error("pnpm pack did not produce an archive");
  }
  console.log(`Pack check passed: ${archive}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
