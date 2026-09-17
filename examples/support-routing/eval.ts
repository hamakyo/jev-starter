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
import { type SupportCategory, type supportQuestions, supportRouting } from "./decision.js";

interface SupportState {
  readonly fixtureId: string;
  readonly category: SupportCategory;
  readonly confidence: number;
}

export function createSupportProvider(): MockProvider<typeof supportQuestions> {
  return new MockProvider<typeof supportQuestions>({
    resolver: (request) => {
      const state = asSupportState(request.state);
      const confidence = state.confidence;
      const wrongProbability = (1 - confidence) / 2;
      return createProviderResult<typeof supportQuestions>(
        {
          category: createChoiceAnswer<typeof supportQuestions.category.criteria>({
            choice: state.category,
            confidence,
            probabilities: {
              billing: state.category === "billing" ? confidence : wrongProbability,
              technical: state.category === "technical" ? confidence : wrongProbability,
              other: state.category === "other" ? confidence : wrongProbability,
            },
          }),
        },
        { model: "mock-support", latencyMs: 12, usage: { inputTokens: 24, outputTokens: 6 } },
      );
    },
  });
}

export function createSupportEvaluator(): EvaluationEvaluator<string> {
  const engine = new DecisionEngine(createSupportProvider());
  return async (item) => {
    const outcome = await engine.decide(supportRouting, item.state);
    return {
      predicted: outcome.answers.category.choice,
      confidence: outcome.answers.category.confidence,
      probabilities: outcome.answers.category.probabilities,
      route: outcome.route,
      model: outcome.model,
      latencyMs: outcome.latencyMs,
      ...(outcome.usage === undefined ? {} : { usage: outcome.usage }),
    };
  };
}

export async function evaluateSupportRouting(
  dataset: LoadedDataset<string>,
): Promise<EvaluationReport> {
  return evaluateDataset(dataset, createSupportEvaluator(), {
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
    metadata: {
      decisionId: supportRouting.id,
      decisionVersion: supportRouting.version,
      provider: "MockProvider",
      model: "mock-support",
      packageVersion: currentPackageVersion(),
      policy: supportRouting.policy,
    },
    thresholds: [0.65, 0.9],
    pricingSnapshot: {
      version: "fixture-only-v1",
      currency: "USD",
      models: {
        "mock-support": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
      },
    },
  });
}

function asSupportState(state: EntryType): SupportState {
  if (
    typeof state !== "object" ||
    state === null ||
    Array.isArray(state) ||
    typeof state.fixtureId !== "string" ||
    (state.category !== "billing" &&
      state.category !== "technical" &&
      state.category !== "other") ||
    typeof state.confidence !== "number"
  ) {
    throw new TypeError("Support fixture state has an invalid shape");
  }
  return state as unknown as SupportState;
}
