import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { currentPackageVersion } from "../../../evals/core/package-version.js";
import { loadJsonlFile } from "../../../evals/fixtures/jsonl.js";
import { toJsonReport, toMarkdownReport } from "../../../evals/reporters/index.js";
import { evaluateDataset } from "../../../evals/runners/evaluate.js";
import { JevProvider } from "../../../src/index.js";
import { withRagComponentMetrics } from "../src/component-metrics.js";
import { createJevEvaluator, ragDecisionMetadataForDataset } from "../src/modes.js";
import type { RagExpected } from "../src/types.js";

export async function runRagLive(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is required for rag:live; no external request was made");
  }
  const directory = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const dataset = loadJsonlFile<RagExpected>(resolve(directory, "evals/dataset.jsonl"));
  const report = withRagComponentMetrics(
    await evaluateDataset(
      dataset,
      createJevEvaluator(new JevProvider(new TypeSafeClient({ apiKey }))),
      {
        expectedLabel: (expected) => expected.diagnosis,
        metadata: {
          ...ragDecisionMetadataForDataset(dataset),
          packageVersion: currentPackageVersion(),
        },
      },
    ),
    dataset,
  );
  console.log(toMarkdownReport(report));
  console.log(toJsonReport(report));
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runRagLive();
}
