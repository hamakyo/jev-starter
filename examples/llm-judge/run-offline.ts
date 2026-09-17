import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvaluationReport } from "../../evals/core/types.js";
import { loadJsonlFile } from "../../evals/fixtures/jsonl.js";
import { toJsonReport, toMarkdownReport } from "../../evals/reporters/index.js";
import { evaluateLlmJudge } from "./eval.js";

export async function runLlmJudgeOffline(): Promise<EvaluationReport> {
  const directory = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const dataset = loadJsonlFile<string>(resolve(directory, "fixture.jsonl"));
  const report = await evaluateLlmJudge(dataset);
  const expected = JSON.parse(readFileSync(resolve(directory, "expected-report.json"), "utf8")) as {
    rows: number;
    accuracy: number;
  };
  if (
    report.dataset.count !== expected.rows ||
    report.metrics.classification.accuracy !== expected.accuracy
  ) {
    throw new Error("llm-judge offline report did not match expected-report.json");
  }
  console.log(toMarkdownReport(report));
  console.log(toJsonReport(report));
  return report;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runLlmJudgeOffline();
}
