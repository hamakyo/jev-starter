import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSupportEvaluator } from "../../examples/support-routing/eval.js";
import { currentPackageVersion } from "../core/package-version.js";
import type { EvaluationEvaluator } from "../core/types.js";
import { loadJsonlFile } from "../fixtures/jsonl.js";
import { toJsonReport, toMarkdownReport } from "../reporters/index.js";
import { evaluateCascade } from "./cascade.js";
import { compareEvaluations } from "./compare.js";
import { evaluateDataset } from "./evaluate.js";

/** Run the repository-level offline harness with no API key or external request. */
export async function runOfflineEvaluation(): Promise<void> {
  const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const dataset = loadJsonlFile<string>(
    resolve(repositoryRoot, "examples/support-routing/fixture.jsonl"),
  );
  const primary = createSupportEvaluator();
  const baseline = createBaselineEvaluator();
  const options = {
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
    thresholds: [0.65, 0.9],
    metadata: { packageVersion: currentPackageVersion() },
  } as const;

  const report = await evaluateDataset(dataset, primary, options);
  const comparison = await compareEvaluations(dataset, createSupportEvaluator(), baseline, {
    primary: options,
    baseline: {
      ...options,
      metadata: { provider: "DeterministicBaseline", model: "baseline-fixture" },
    },
    clock: options.clock,
  });
  const cascade = await evaluateCascade(dataset, createSupportEvaluator(), baseline, {
    primary: options,
    fallback: {
      ...options,
      metadata: { provider: "DeterministicBaseline", model: "baseline-fixture" },
    },
    clock: options.clock,
  });

  console.log(toMarkdownReport(report));
  console.log(toMarkdownReport(comparison));
  console.log(toMarkdownReport(cascade));
  console.log(toJsonReport(report));
  console.log(toJsonReport(comparison));
  console.log(toJsonReport(cascade));
}

function createBaselineEvaluator(): EvaluationEvaluator<string> {
  return async () => ({
    predicted: "other",
    confidence: 0.5,
    model: "baseline-fixture",
    latencyMs: 20,
    usage: { inputTokens: 30, outputTokens: 8 },
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runOfflineEvaluation();
}
