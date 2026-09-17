import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentDecisionGateOffline } from "./agent-decision-gate/run-offline.js";
import { runLlmJudgeOffline } from "./llm-judge/run-offline.js";
import { runSupportRoutingOffline } from "./support-routing/run-offline.js";

/** Run all three small reference patterns without a key or external request. */
export async function runExamplesOffline(): Promise<void> {
  await runSupportRoutingOffline();
  await runAgentDecisionGateOffline();
  await runLlmJudgeOffline();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runExamplesOffline();
}
