import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvaluationReport } from "../../evals/core/types.js";
import { loadJsonlFile } from "../../evals/fixtures/jsonl.js";
import { type EvaluationAnyReport, toJsonReport } from "../../evals/reporters/json.js";
import { toMarkdownReport } from "../../evals/reporters/markdown.js";
import { evaluateSupportRouting } from "./eval.js";

export async function runSupportRoutingOffline(): Promise<EvaluationReport> {
  const directory = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const dataset = loadJsonlFile<string>(resolve(directory, "fixture.jsonl"));
  const report = await evaluateSupportRouting(dataset);
  assertExpectedReport(directory, report);
  console.log(toMarkdownReport(report));
  console.log(toJsonReport(report));
  return report;
}

function assertExpectedReport(directory: string, report: EvaluationReport): void {
  const expected = JSON.parse(readFileSync(resolve(directory, "expected-report.json"), "utf8")) as {
    accuracy: number;
    rows: number;
  };
  if (
    report.dataset.count !== expected.rows ||
    report.metrics.classification.accuracy !== expected.accuracy
  ) {
    throw new Error("support-routing offline report did not match expected-report.json");
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runSupportRoutingOffline();
}

export type { EvaluationAnyReport };
