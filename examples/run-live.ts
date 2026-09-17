import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentDecisionGateLive } from "./agent-decision-gate/run-live.js";
import { runLlmJudgeLive } from "./llm-judge/run-live.js";
import { runSupportRoutingLive } from "./support-routing/run-live.js";

/** Run all live reference patterns only after the caller explicitly supplies a key. */
export async function runExamplesLive(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is required for examples:live; no external request was made");
  }
  await runSupportRoutingLive();
  await runAgentDecisionGateLive();
  await runLlmJudgeLive();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runExamplesLive();
}
