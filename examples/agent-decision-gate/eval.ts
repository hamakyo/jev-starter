import type { EntryType } from "@typesafe-ai/sdk";
import { currentPackageVersion } from "../../evals/core/package-version.js";
import type { EvaluationEvaluator, EvaluationReport } from "../../evals/core/types.js";
import type { LoadedDataset } from "../../evals/fixtures/jsonl.js";
import { evaluateDataset } from "../../evals/runners/evaluate.js";
import {
  DecisionEngine,
  MockProvider,
  createChoiceAnswer,
  createProviderResult,
} from "../../src/index.js";
import { type AgentAction, agentDecisionGate, agentQuestions } from "./decision.js";

interface AgentState {
  readonly fixtureId: string;
  readonly action: AgentAction;
  readonly confidence: number;
}

export function createAgentProvider(): MockProvider<typeof agentQuestions> {
  return new MockProvider<typeof agentQuestions>({
    resolver: (request) => {
      const state = asAgentState(request.state);
      const otherLabels = Object.keys(agentQuestions.nextAction.criteria).filter(
        (label) => label !== state.action,
      );
      const remaining = (1 - state.confidence) / otherLabels.length;
      const probabilities = Object.fromEntries(
        Object.keys(agentQuestions.nextAction.criteria).map((label) => [
          label,
          label === state.action ? state.confidence : remaining,
        ]),
      ) as Record<AgentAction, number>;
      return createProviderResult<typeof agentQuestions>(
        {
          nextAction: createChoiceAnswer<typeof agentQuestions.nextAction.criteria>({
            choice: state.action,
            confidence: state.confidence,
            probabilities,
          }),
        },
        { model: "mock-agent", latencyMs: 8, usage: { inputTokens: 18, outputTokens: 5 } },
      );
    },
  });
}

export function createAgentEvaluator(): EvaluationEvaluator<string> {
  const engine = new DecisionEngine(createAgentProvider());
  return async (item) => {
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
  };
}

export async function evaluateAgentDecisionGate(
  dataset: LoadedDataset<string>,
): Promise<EvaluationReport> {
  return evaluateDataset(dataset, createAgentEvaluator(), {
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
    metadata: {
      decisionId: agentDecisionGate.id,
      decisionVersion: agentDecisionGate.version,
      provider: "MockProvider",
      model: "mock-agent",
      packageVersion: currentPackageVersion(),
      policy: agentDecisionGate.policy,
    },
    thresholds: [0.6, 0.9],
    pricingSnapshot: {
      version: "fixture-only-v1",
      currency: "USD",
      models: {
        "mock-agent": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
      },
    },
  });
}

function asAgentState(state: EntryType): AgentState {
  if (
    typeof state !== "object" ||
    state === null ||
    Array.isArray(state) ||
    typeof state.fixtureId !== "string" ||
    typeof state.action !== "string" ||
    !Object.prototype.hasOwnProperty.call(agentQuestions.nextAction.criteria, state.action) ||
    typeof state.confidence !== "number"
  ) {
    throw new TypeError("Agent fixture state has an invalid shape");
  }
  return state as unknown as AgentState;
}
