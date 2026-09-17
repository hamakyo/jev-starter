import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryRoot = mkdtempSync(join(tmpdir(), "jev-starter-package-check-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", temporaryRoot], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const archive = readdirSync(temporaryRoot).find((name) => name.endsWith(".tgz"));
  if (archive === undefined) {
    throw new Error("pnpm pack did not produce an archive");
  }

  const consumer = join(temporaryRoot, "consumer");
  mkdirSync(consumer);
  execFileSync("pnpm", ["init"], { cwd: consumer, stdio: "ignore" });
  execFileSync("pnpm", ["install", "--ignore-scripts", "--offline", join(temporaryRoot, archive)], {
    cwd: consumer,
    stdio: "pipe",
  });
  const packageJson = JSON.parse(
    readFileSync(join(consumer, "node_modules/jev-starter/package.json"), "utf8"),
  );
  if (packageJson.exports?.["."]?.import !== "./dist/index.js") {
    throw new Error("Packed package does not expose the expected ESM entry point");
  }
  writeFileSync(
    join(consumer, "smoke.mjs"),
    "const packageApi = await import('jev-starter');\nif (typeof packageApi.DecisionEngine !== 'function' || typeof packageApi.MockProvider !== 'function') process.exit(1);\n",
  );
  execFileSync("node", ["smoke.mjs"], { cwd: consumer, stdio: "pipe" });
  console.log(`Package clean-install check passed: ${archive}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
