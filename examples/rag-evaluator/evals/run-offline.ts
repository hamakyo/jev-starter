import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJsonlFile } from "../../../evals/fixtures/jsonl.js";
import { toJsonReport, toMarkdownReport } from "../../../evals/reporters/index.js";
import { evaluateRagOffline } from "../src/modes.js";
import type { RagExpected } from "../src/types.js";

export async function runRagOffline(): Promise<void> {
  const directory = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const dataset = loadJsonlFile<RagExpected>(resolve(directory, "evals/dataset.jsonl"));
  const reports = await evaluateRagOffline(dataset);
  const expected = JSON.parse(
    readFileSync(resolve(directory, "reports/expected-report.json"), "utf8"),
  ) as {
    rows: number;
    jevOverallAccuracy: number;
    cascadeFallbackRate: number;
    contextSufficiencyAccuracy: number;
    correctnessCount: number;
  };
  const noReference = reports.jevOnly.observations.find(
    (observation) => observation.id === "rag-008",
  );
  const noReferenceJudgments = noReference?.metadata?.judgments as
    | { readonly generation?: { readonly correctness?: unknown } }
    | undefined;
  if (
    reports.jevOnly.dataset.count !== expected.rows ||
    reports.jevOnly.metrics.classification.overallAccuracy !== expected.jevOverallAccuracy ||
    reports.cascade.fallbackRate !== expected.cascadeFallbackRate ||
    reports.jevOnly.componentMetrics.retrieval.contextSufficiency?.accuracy !==
      expected.contextSufficiencyAccuracy ||
    reports.jevOnly.componentMetrics.generation.correctness?.count !== expected.correctnessCount ||
    reports.baseline.componentMetrics !== undefined ||
    reports.cascade.fallback.componentMetrics !== undefined ||
    reports.cascade.endToEnd.componentMetrics !== undefined ||
    noReference?.route !== "auto" ||
    noReference?.metadata?.decisionVariant !== "without-reference" ||
    noReferenceJudgments?.generation?.correctness !== undefined
  ) {
    throw new Error("RAG offline reports did not match reports/expected-report.json");
  }
  console.log(toMarkdownReport(reports.jevOnly));
  console.log(toMarkdownReport(reports.comparison));
  console.log(toMarkdownReport(reports.cascade));
  console.log(toJsonReport(reports.jevOnly));
  console.log(toJsonReport(reports.comparison));
  console.log(toJsonReport(reports.cascade));
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runRagOffline();
}
