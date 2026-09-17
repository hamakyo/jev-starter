import type { EntryType } from "@typesafe-ai/sdk";
import { currentPackageVersion } from "../../evals/core/package-version.js";
import type { EvaluationEvaluator, EvaluationReport } from "../../evals/core/types.js";
import type { LoadedDataset } from "../../evals/fixtures/jsonl.js";
import { evaluateDataset } from "../../evals/runners/evaluate.js";
import {
  DecisionEngine,
  MockProvider,
  createNoulAnswer,
  createProviderResult,
} from "../../src/index.js";
import { type judgeQuestions, llmJudge } from "./decision.js";

interface JudgeState {
  readonly fixtureId: string;
  readonly probability: number;
}

export function createJudgeProvider(): MockProvider<typeof judgeQuestions> {
  return new MockProvider<typeof judgeQuestions>({
    resolver: (request) => {
      const state = asJudgeState(request.state);
      return createProviderResult<typeof judgeQuestions>(
        { grounded: createNoulAnswer(state.probability) },
        { model: "mock-judge", latencyMs: 10, usage: { inputTokens: 16, outputTokens: 3 } },
      );
    },
  });
}

export function createJudgeEvaluator(): EvaluationEvaluator<string> {
  const engine = new DecisionEngine(createJudgeProvider());
  return async (item) => {
    const outcome = await engine.decide(llmJudge, item.state);
    const probability = outcome.answers.grounded.noul;
    return {
      predicted: probability >= 0.5 ? "pass" : "fail",
      probability,
      confidence: Math.max(probability, 1 - probability),
      route: outcome.route,
      model: outcome.model,
      latencyMs: outcome.latencyMs,
      ...(outcome.usage === undefined ? {} : { usage: outcome.usage }),
    };
  };
}

export async function evaluateLlmJudge(dataset: LoadedDataset<string>): Promise<EvaluationReport> {
  return evaluateDataset(dataset, createJudgeEvaluator(), {
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
    metadata: {
      decisionId: llmJudge.id,
      decisionVersion: llmJudge.version,
      provider: "MockProvider",
      model: "mock-judge",
      packageVersion: currentPackageVersion(),
      policy: llmJudge.policy,
    },
    binaryActual: (expected) => expected === "pass",
    binaryBandThresholds: [{ negativeThreshold: 0.1, positiveThreshold: 0.9 }],
    thresholds: [0.5, 0.9],
    pricingSnapshot: {
      version: "fixture-only-v1",
      currency: "USD",
      models: {
        "mock-judge": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
      },
    },
  });
}

function asJudgeState(state: EntryType): JudgeState {
  if (
    typeof state !== "object" ||
    state === null ||
    Array.isArray(state) ||
    typeof state.fixtureId !== "string" ||
    typeof state.probability !== "number"
  ) {
    throw new TypeError("LLM judge fixture state has an invalid shape");
  }
  return state as unknown as JudgeState;
}
