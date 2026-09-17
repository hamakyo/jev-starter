import type {
  EvaluationComponentMetric,
  EvaluationComponentMetrics,
  EvaluationObservation,
  EvaluationReport,
} from "../../../evals/core/types.js";
import type { LoadedDataset } from "../../../evals/fixtures/jsonl.js";
import { binaryBrierScore } from "../../../evals/metrics/brier.js";
import { calibrationMetrics } from "../../../evals/metrics/calibration.js";
import type { RagExpected, RagJudgments } from "./types.js";
import { asRagExpected } from "./types.js";

export interface RagComponentMetrics extends EvaluationComponentMetrics {
  readonly retrieval: Readonly<Record<string, EvaluationComponentMetric>>;
  readonly generation: Readonly<Record<string, EvaluationComponentMetric>>;
}

export interface RagEvaluationReport extends EvaluationReport {
  readonly componentMetrics: RagComponentMetrics;
}

/** Attach retrieval/generation judgment metrics without replacing final diagnosis metrics. */
export function withRagComponentMetrics(
  report: EvaluationReport,
  dataset: LoadedDataset<RagExpected>,
): RagEvaluationReport {
  return {
    ...report,
    componentMetrics: calculateRagComponentMetrics(dataset, report.observations),
  };
}

/** Calculate accuracy, Brier, and ECE for every labeled RAG component judgment. */
export function calculateRagComponentMetrics(
  dataset: LoadedDataset<RagExpected>,
  observations: readonly EvaluationObservation[],
): RagComponentMetrics {
  const expectedById = new Map(
    dataset.items.map((item) => [item.id, asRagExpected(item.expected)]),
  );
  const records = successfulJudgmentRecords(observations, expectedById);
  const retrieval: Record<string, EvaluationComponentMetric> = {};
  const generation: Record<string, EvaluationComponentMetric> = {};

  for (const key of ["c1", "c2"]) {
    retrieval[`chunkRelevance.${key}`] = metricFor(
      records.flatMap((record) => {
        const probability = record.judgments.retrieval.chunkRelevance[key];
        const actual = record.expected.retrieval.chunkRelevance[key];
        return probability === undefined || actual === undefined ? [] : [{ probability, actual }];
      }),
    );
  }
  retrieval.contextSufficiency = metricFor(
    records.map((record) => ({
      probability: record.judgments.retrieval.sufficiency,
      actual: record.expected.retrieval.contextSufficiency,
    })),
  );
  retrieval.contextConflict = metricFor(
    records.map((record) => ({
      probability: record.judgments.retrieval.conflict,
      actual: record.expected.retrieval.contextConflict,
    })),
  );
  generation.answerRelevance = metricFor(
    records.map((record) => ({
      probability: record.judgments.generation.relevance,
      actual: record.expected.generation.answerRelevance,
    })),
  );
  generation.groundedness = metricFor(
    records.map((record) => ({
      probability: record.judgments.generation.groundedness,
      actual: record.expected.generation.groundedness,
    })),
  );
  generation.contradiction = metricFor(
    records.map((record) => ({
      probability: record.judgments.generation.contradiction,
      actual: record.expected.generation.contradiction,
    })),
  );
  const correctness = records.flatMap((record) => {
    const probability = record.judgments.generation.correctness;
    const actual = record.expected.generation.correctness;
    return probability === undefined || actual === undefined ? [] : [{ probability, actual }];
  });
  if (correctness.length > 0) {
    generation.correctness = metricFor(correctness);
  }

  return { retrieval, generation };
}

interface JudgmentRecord {
  readonly expected: RagExpected;
  readonly judgments: RagJudgments;
}

interface BinaryJudgmentSample {
  readonly probability: number;
  readonly actual: boolean;
}

function successfulJudgmentRecords(
  observations: readonly EvaluationObservation[],
  expectedById: ReadonlyMap<string, RagExpected>,
): readonly JudgmentRecord[] {
  return observations.flatMap((observation) => {
    if (observation.status !== "success") {
      return [];
    }
    const expected = expectedById.get(observation.id);
    const judgments = asRagJudgments(observation.metadata?.judgments);
    return expected === undefined || judgments === undefined ? [] : [{ expected, judgments }];
  });
}

function metricFor(samples: readonly BinaryJudgmentSample[]): EvaluationComponentMetric {
  const correct = samples.filter((sample) => sample.probability >= 0.5 === sample.actual).length;
  return {
    count: samples.length,
    correct,
    accuracy: safeRatio(correct, samples.length),
    brier: binaryBrierScore(samples),
    calibration: calibrationMetrics(
      samples.map((sample) => ({
        confidence: Math.max(sample.probability, 1 - sample.probability),
        correct: sample.probability >= 0.5 === sample.actual,
      })),
    ),
  };
}

function asRagJudgments(value: unknown): RagJudgments | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const retrieval = value.retrieval;
  const generation = value.generation;
  if (!isRecord(retrieval) || !isRecord(generation)) {
    return undefined;
  }
  const chunkRelevance = asProbabilityRecord(retrieval.chunkRelevance);
  if (chunkRelevance === undefined) {
    return undefined;
  }
  if (
    !isProbability(retrieval.sufficiency) ||
    !isProbability(retrieval.conflict) ||
    !isProbability(generation.relevance) ||
    !isProbability(generation.groundedness) ||
    !isProbability(generation.contradiction) ||
    (generation.correctness !== undefined && !isProbability(generation.correctness))
  ) {
    return undefined;
  }
  return {
    retrieval: {
      chunkRelevance,
      sufficiency: retrieval.sufficiency,
      conflict: retrieval.conflict,
    },
    generation: {
      relevance: generation.relevance,
      groundedness: generation.groundedness,
      contradiction: generation.contradiction,
      ...(generation.correctness === undefined ? {} : { correctness: generation.correctness }),
    },
  };
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function asProbabilityRecord(value: unknown): Readonly<Record<string, number>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  if (entries.length === 0 || !entries.every(([, probability]) => isProbability(probability))) {
    return undefined;
  }
  return Object.fromEntries(entries) as Readonly<Record<string, number>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
