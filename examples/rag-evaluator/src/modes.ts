import { currentPackageVersion } from "../../../evals/core/package-version.js";
import type {
  CascadeReport,
  ComparisonReport,
  EvaluationEvaluator,
  EvaluationMetadata,
  EvaluationReport,
} from "../../../evals/core/types.js";
import type { LoadedDataset } from "../../../evals/fixtures/jsonl.js";
import { evaluateCascade } from "../../../evals/runners/cascade.js";
import { compareEvaluations } from "../../../evals/runners/compare.js";
import { evaluateDataset } from "../../../evals/runners/evaluate.js";
import {
  DecisionEngine,
  MockProvider,
  createNoulAnswer,
  createProviderResult,
  defineDecision,
} from "../../../src/index.js";
import type { AnswersFor, Provider } from "../../../src/index.js";
import { type RagEvaluationReport, withRagComponentMetrics } from "./component-metrics.js";
import { diagnoseRag, diagnosisConfidence } from "./diagnosis.js";
import { correctnessQuestion, generationQuestions } from "./generation.js";
import { RAG_POLICY_METADATA, RAG_THRESHOLDS, applyRagDiagnosis } from "./policy.js";
import { retrievalQuestions } from "./retrieval.js";
import {
  type RagDiagnosis,
  type RagExpected,
  type RagJudgments,
  type RagMockScores,
  asRagState,
} from "./types.js";

export const ragQuestionsWithReference = {
  ...retrievalQuestions,
  ...generationQuestions,
  ...correctnessQuestion,
} as const;

export const ragQuestionsWithoutReference = {
  ...retrievalQuestions,
  ...generationQuestions,
} as const;

export const RAG_DECISION_VARIANTS = {
  withReference: "with-reference",
  withoutReference: "without-reference",
  mixed: "mixed",
} as const;

export type RagDecisionVariant = (typeof RAG_DECISION_VARIANTS)[keyof typeof RAG_DECISION_VARIANTS];

/** Backwards-compatible name for the reference-aware question set. */
export const ragQuestions = ragQuestionsWithReference;

type RagAnswers =
  | AnswersFor<typeof ragQuestionsWithReference>
  | AnswersFor<typeof ragQuestionsWithoutReference>;

/** The reference-aware decision asks correctness only when a reference exists. */
export const ragDecisionWithReference = defineDecision({
  id: "example.rag-evaluator.with-reference",
  version: "2",
  questions: ragQuestionsWithReference,
  policy: {
    kind: "custom",
    decide(answers) {
      return routeForDiagnosis(diagnosisFromAnswers(answers));
    },
  },
});

/** The reference-free decision excludes the reference-dependent correctness question. */
export const ragDecisionWithoutReference = defineDecision({
  id: "example.rag-evaluator.without-reference",
  version: "2",
  questions: ragQuestionsWithoutReference,
  policy: {
    kind: "custom",
    decide(answers) {
      return routeForDiagnosis(diagnosisFromAnswers(answers));
    },
  },
});

/** Default decision definition retained for callers with reference-bearing input. */
export const ragDecision = ragDecisionWithReference;

/** Derive the report variant from every row's reference-dependent question set. */
export function ragDecisionVariantForDataset<TExpected>(
  dataset: LoadedDataset<TExpected>,
): RagDecisionVariant {
  const variants = new Set(
    dataset.items.map((item) =>
      asRagState(item.state).referenceAnswer === undefined
        ? RAG_DECISION_VARIANTS.withoutReference
        : RAG_DECISION_VARIANTS.withReference,
    ),
  );
  if (variants.size !== 1) {
    return RAG_DECISION_VARIANTS.mixed;
  }
  const variant = variants.values().next().value;
  return variant ?? RAG_DECISION_VARIANTS.mixed;
}

/** Add a single contract identity only when the report contains one variant. */
export function ragDecisionMetadataForDataset<TExpected>(
  dataset: LoadedDataset<TExpected>,
): Pick<EvaluationMetadata, "decisionId" | "decisionVersion" | "decisionVariant"> {
  const decisionVariant = ragDecisionVariantForDataset(dataset);
  if (decisionVariant === RAG_DECISION_VARIANTS.withReference) {
    return {
      decisionId: ragDecisionWithReference.id,
      decisionVersion: ragDecisionWithReference.version,
      decisionVariant,
    };
  }
  if (decisionVariant === RAG_DECISION_VARIANTS.withoutReference) {
    return {
      decisionId: ragDecisionWithoutReference.id,
      decisionVersion: ragDecisionWithoutReference.version,
      decisionVariant,
    };
  }
  return { decisionVariant };
}

export interface RagComparisonReport extends Omit<ComparisonReport, "primary"> {
  readonly primary: RagEvaluationReport;
}

export interface RagCascadeReport extends Omit<CascadeReport, "primary"> {
  readonly primary: RagEvaluationReport;
}

export interface RagOfflineReports {
  readonly jevOnly: RagEvaluationReport;
  /** Baseline output has no component judgments, so no component metrics are attached. */
  readonly baseline: EvaluationReport;
  readonly comparison: RagComparisonReport;
  readonly cascade: RagCascadeReport;
}

export function createRagProvider(): MockProvider<typeof ragQuestionsWithReference> {
  return new MockProvider<typeof ragQuestionsWithReference>({
    resolver: (request) => {
      const state = asRagState(request.state);
      const baseAnswers = {
        chunkRelevanceC1: createNoulAnswer(state.mock.chunkRelevanceC1),
        chunkRelevanceC2: createNoulAnswer(state.mock.chunkRelevanceC2),
        contextSufficiency: createNoulAnswer(state.mock.contextSufficiency),
        contextConflict: createNoulAnswer(state.mock.contextConflict),
        answerRelevance: createNoulAnswer(state.mock.answerRelevance),
        groundedness: createNoulAnswer(state.mock.groundedness),
        contradiction: createNoulAnswer(state.mock.contradiction),
      };
      const answers =
        state.referenceAnswer === undefined
          ? baseAnswers
          : {
              ...baseAnswers,
              correctness: createNoulAnswer(requireCorrectness(state.mock)),
            };
      return createProviderResult<typeof ragQuestionsWithReference>(
        answers as unknown as AnswersFor<typeof ragQuestionsWithReference>,
        { model: "mock-rag", latencyMs: 15, usage: { inputTokens: 44, outputTokens: 8 } },
      );
    },
  });
}

export function createJevEvaluator(
  provider: Provider = createRagProvider(),
): EvaluationEvaluator<RagExpected> {
  const engine = new DecisionEngine(provider);
  return async (item) => {
    const state = asRagState(item.state);
    const hasReference = state.referenceAnswer !== undefined;
    const definition = hasReference ? ragDecisionWithReference : ragDecisionWithoutReference;
    const decisionVariant = hasReference
      ? RAG_DECISION_VARIANTS.withReference
      : RAG_DECISION_VARIANTS.withoutReference;
    const outcome = await engine.decide(definition, item.state);
    const judgments = judgmentsFromAnswers(outcome.answers);
    const diagnosis = applyRagDiagnosis(judgments);
    return {
      predicted: diagnosis,
      confidence: diagnosisConfidence(diagnosis, judgments),
      probability: judgments.generation.groundedness,
      route: outcome.route,
      model: outcome.model,
      latencyMs: outcome.latencyMs,
      ...(outcome.usage === undefined ? {} : { usage: outcome.usage }),
      metadata: {
        judgments,
        mode: "jev-only",
        decisionId: outcome.decisionId,
        decisionVersion: outcome.decisionVersion,
        decisionVariant,
      },
    };
  };
}

export function createBaselineEvaluator(): EvaluationEvaluator<RagExpected> {
  return async (item) => {
    const state = asRagState(item.state);
    return {
      predicted: state.baseline.diagnosis,
      confidence: state.baseline.confidence,
      model: "deterministic-baseline",
      latencyMs: 24,
      usage: { inputTokens: 52, outputTokens: 10 },
      metadata: { mode: "baseline" },
    };
  };
}

export async function evaluateRagOffline(
  dataset: LoadedDataset<RagExpected>,
): Promise<RagOfflineReports> {
  const clock = () => new Date("2026-01-01T00:00:00.000Z");
  const expectedLabel = (expected: RagExpected) => expected.diagnosis;
  const primaryOptions = {
    clock,
    expectedLabel,
    thresholds: [0.5, 0.8, 0.9],
    metadata: {
      ...ragDecisionMetadataForDataset(dataset),
      provider: "MockProvider",
      model: "mock-rag",
      packageVersion: currentPackageVersion(),
      policy: RAG_POLICY_METADATA,
    },
    pricingSnapshot: {
      version: "fixture-only-v1",
      currency: "USD" as const,
      models: {
        "mock-rag": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
      },
    },
  };
  const baselineOptions = {
    clock,
    expectedLabel,
    thresholds: [0.5, 0.8, 0.9],
    metadata: {
      provider: "DeterministicBaseline",
      model: "deterministic-baseline",
      packageVersion: currentPackageVersion(),
    },
    pricingSnapshot: {
      version: "fixture-only-v1",
      currency: "USD" as const,
      models: {
        "deterministic-baseline": {
          inputUsdPerMillionTokens: 1,
          outputUsdPerMillionTokens: 2,
        },
      },
    },
  };
  const jevOnly = withRagComponentMetrics(
    await evaluateDataset(dataset, createJevEvaluator(), primaryOptions),
    dataset,
  );
  const baseline = await evaluateDataset(dataset, createBaselineEvaluator(), baselineOptions);
  const comparisonBase = await compareEvaluations(
    dataset,
    createJevEvaluator(),
    createBaselineEvaluator(),
    { primary: primaryOptions, baseline: baselineOptions, clock },
  );
  const comparison: RagComparisonReport = {
    ...comparisonBase,
    primary: jevOnly,
    baseline,
  };
  const cascadeBase = await evaluateCascade(
    dataset,
    createJevEvaluator(),
    createBaselineEvaluator(),
    {
      primary: primaryOptions,
      fallback: baselineOptions,
      shouldFallback: (prediction) => prediction.route === "fallback",
      clock,
    },
  );
  const cascade: RagCascadeReport = {
    ...cascadeBase,
    primary: withRagComponentMetrics(cascadeBase.primary, dataset),
  };
  return { jevOnly, baseline, comparison, cascade };
}

function judgmentsFromAnswers(answers: RagAnswers): RagJudgments {
  const withReference = answers as AnswersFor<typeof ragQuestionsWithReference>;
  const correctness = "correctness" in withReference ? withReference.correctness.noul : undefined;
  return {
    retrieval: {
      chunkRelevance: {
        c1: answers.chunkRelevanceC1.noul,
        c2: answers.chunkRelevanceC2.noul,
      },
      sufficiency: answers.contextSufficiency.noul,
      conflict: answers.contextConflict.noul,
    },
    generation: {
      relevance: answers.answerRelevance.noul,
      groundedness: answers.groundedness.noul,
      contradiction: answers.contradiction.noul,
      ...(correctness === undefined ? {} : { correctness }),
    },
  };
}

function diagnosisFromAnswers(answers: RagAnswers): RagDiagnosis {
  return diagnoseRag(judgmentsFromAnswers(answers), RAG_THRESHOLDS);
}

function routeForDiagnosis(diagnosis: RagDiagnosis): "auto" | "fallback" | "review" {
  return diagnosis === "JUDGE_UNCERTAIN" ? "fallback" : "auto";
}

function requireCorrectness(scores: RagMockScores): number {
  if (scores.correctness === undefined) {
    throw new TypeError("RAG fixture with a reference answer requires a correctness score");
  }
  return scores.correctness;
}
