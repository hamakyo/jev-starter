import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { currentPackageVersion } from "../../evals/core/package-version.js";
import { loadJsonlFile } from "../../evals/fixtures/jsonl.js";
import { toJsonReport, toMarkdownReport } from "../../evals/reporters/index.js";
import { evaluateDataset } from "../../evals/runners/evaluate.js";
import { DecisionEngine, JevProvider } from "../../src/index.js";
import { agentDecisionGate } from "./decision.js";

export async function runAgentDecisionGateLive(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is required for examples:live; no external request was made");
  }
  const directory = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const dataset = loadJsonlFile<string>(resolve(directory, "fixture.jsonl"));
  const engine = new DecisionEngine(new JevProvider(new TypeSafeClient({ apiKey })));
  const report = await evaluateDataset(
    dataset,
    async (item) => {
      const outcome = await engine.decide(agentDecisionGate, item.state);
      return {
        predicted: outcome.answers.nextAction.choice,
        confidence: outcome.answers.nextAction.confidence,
        probabilities: outcome.answers.nextAction.probabilities,
        route: outcome.route,
        model: outcome.model,
        latencyMs: outcome.latencyMs,
        ...(outcome.usage === undefined ? {} : { usage: outcome.usage }),
      };
    },
    {
      metadata: {
        decisionId: agentDecisionGate.id,
        decisionVersion: agentDecisionGate.version,
        packageVersion: currentPackageVersion(),
      },
    },
  );
  console.log(toMarkdownReport(report));
  console.log(toJsonReport(report));
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runAgentDecisionGateLive();
}
