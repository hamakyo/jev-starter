import { classifyDecisionError, errorName } from "../../src/observability/error-category.js";
import type {
  EvaluationCase,
  EvaluationClassificationMetrics,
  EvaluationEvaluator,
  EvaluationMetadata,
  EvaluationMetrics,
  EvaluationObservation,
  EvaluationPrediction,
  EvaluationReport,
  EvaluationRunOptions,
} from "../core/types.js";
import type { LoadedDataset } from "../fixtures/jsonl.js";
import { type BinaryBandSample, binaryBandMetrics } from "../metrics/binary-band.js";
import {
  type BinaryBrierSample,
  type MulticlassBrierSample,
  binaryBrierScore,
  multiclassBrierScore,
} from "../metrics/brier.js";
import { type CalibrationSample, calibrationMetrics } from "../metrics/calibration.js";
import { type ClassificationSample, classificationMetrics } from "../metrics/classification.js";
import { latencyMetrics } from "../metrics/latency.js";
import { type SelectiveSample, selectiveMetrics } from "../metrics/selective.js";
import { costReport } from "../pricing/schema.js";

const DEFAULT_THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1];

/** Evaluate rows sequentially so scripted providers and reports remain reproducible. */
export async function evaluateDataset<TExpected>(
  dataset: LoadedDataset<TExpected>,
  evaluator: EvaluationEvaluator<TExpected>,
  options: EvaluationRunOptions<TExpected> = {},
): Promise<EvaluationReport> {
  const expectedLabel = options.expectedLabel ?? defaultExpectedLabel;
  const observations: EvaluationObservation[] = [];

  for (const item of dataset.items) {
    const expected = expectedLabel(item.expected);
    const startedAt = performance.now();
    try {
      const prediction = await evaluator(item);
      validatePrediction(prediction);
      const measuredLatencyMs = performance.now() - startedAt;
      observations.push({
        id: item.id,
        expected,
        status: "success",
        predicted: prediction.predicted,
        ...(prediction.confidence === undefined ? {} : { confidence: prediction.confidence }),
        ...(prediction.probability === undefined ? {} : { probability: prediction.probability }),
        ...(prediction.probabilities === undefined
          ? {}
          : { probabilities: prediction.probabilities }),
        ...(prediction.route === undefined ? {} : { route: prediction.route }),
        ...(prediction.model === undefined ? {} : { model: prediction.model }),
        latencyMs: prediction.latencyMs ?? measuredLatencyMs,
        ...(prediction.usage === undefined ? {} : { usage: prediction.usage }),
        ...(prediction.retries === undefined ? {} : { retries: prediction.retries }),
        ...(prediction.metadata === undefined ? {} : { metadata: prediction.metadata }),
      });
    } catch (error) {
      observations.push({
        id: item.id,
        expected,
        status: "failure",
        latencyMs: performance.now() - startedAt,
        errorCategory: classifyDecisionError(error),
        errorName: errorName(error),
      });
    }
  }

  return reportFromObservations(dataset, observations, options);
}

/** Build a report from already captured observations, used by cascade aggregation. */
export function reportFromObservations<TExpected>(
  dataset: LoadedDataset<TExpected>,
  observations: readonly EvaluationObservation[],
  options: EvaluationRunOptions<TExpected> = {},
): EvaluationReport {
  const generatedAt = (options.clock?.() ?? new Date()).toISOString();
  const metadata: EvaluationMetadata = {
    ...(options.metadata ?? {}),
    ...(options.pricingSnapshot === undefined
      ? {}
      : { pricingSnapshotVersion: options.pricingSnapshot.version }),
  };
  return {
    kind: "evaluation-report",
    generatedAt,
    dataset: {
      hash: dataset.sha256,
      count: dataset.items.length,
      ...(dataset.hashBasis === undefined ? {} : { hashBasis: dataset.hashBasis }),
      ...(dataset.parentHash === undefined ? {} : { parentHash: dataset.parentHash }),
      ...(dataset.selectionIds === undefined ? {} : { selectionIds: dataset.selectionIds }),
    },
    metadata,
    observations,
    metrics: buildMetrics(dataset, observations, options),
  };
}

function buildMetrics<TExpected>(
  dataset: LoadedDataset<TExpected>,
  observations: readonly EvaluationObservation[],
  options: EvaluationRunOptions<TExpected>,
): EvaluationMetrics {
  const successful = observations.filter(
    (observation): observation is EvaluationObservation & { predicted: string } =>
      observation.status === "success" && observation.predicted !== undefined,
  );
  const classificationSamples: ClassificationSample[] = successful.map((observation) => ({
    actual: observation.expected,
    predicted: observation.predicted,
  }));
  const confidenceSamples: CalibrationSample[] = successful.flatMap((observation) =>
    observation.confidence === undefined
      ? []
      : [
          {
            confidence: observation.confidence,
            correct: observation.expected === observation.predicted,
          },
        ],
  );
  const selectiveSamples: SelectiveSample[] = confidenceSamples;
  const expectedById = new Map(dataset.items.map((item) => [item.id, item.expected]));
  const probabilitySamples: BinaryBandSample[] = successful.flatMap((observation) => {
    const expected = expectedById.get(observation.id);
    if (
      observation.probability === undefined ||
      options.binaryActual === undefined ||
      expected === undefined
    ) {
      return [];
    }
    return [{ probability: observation.probability, actual: options.binaryActual(expected) }];
  });
  const binaryBrierSamples: BinaryBrierSample[] = successful.flatMap((observation) => {
    const expected = expectedById.get(observation.id);
    if (
      observation.probability === undefined ||
      options.binaryActual === undefined ||
      expected === undefined
    ) {
      return [];
    }
    return [{ probability: observation.probability, actual: options.binaryActual(expected) }];
  });
  const multiclassBrierSamples: MulticlassBrierSample[] = successful.flatMap((observation) =>
    observation.probabilities === undefined
      ? []
      : [{ probabilities: observation.probabilities, actual: observation.expected }],
  );
  const usageSamples = successful.flatMap(usageSamplesForObservation);
  const retries = observations.some((observation) => observation.retries !== undefined)
    ? observations.reduce((sum, observation) => sum + (observation.retries ?? 0), 0)
    : null;
  const failures = observations.filter((observation) => observation.status === "failure").length;
  const successfulClassification = classificationMetrics(classificationSamples);
  const classification: EvaluationClassificationMetrics = {
    ...successfulClassification,
    totalCount: dataset.items.length,
    failures,
    successfulAccuracy: successfulClassification.accuracy,
    overallAccuracy: safeRatio(successfulClassification.correct, dataset.items.length),
    successRate: safeRatio(successful.length, dataset.items.length),
  };

  return {
    classification,
    ...(confidenceSamples.length === 0
      ? {}
      : { calibration: calibrationMetrics(confidenceSamples, options.bucketCount ?? 10) }),
    ...(selectiveSamples.length === 0
      ? {}
      : {
          selective: selectiveMetrics(selectiveSamples, options.thresholds ?? DEFAULT_THRESHOLDS),
        }),
    ...(probabilitySamples.length === 0 || options.binaryBandThresholds === undefined
      ? {}
      : { binaryBand: binaryBandMetrics(probabilitySamples, options.binaryBandThresholds) }),
    ...(binaryBrierSamples.length === 0 && multiclassBrierSamples.length === 0
      ? {}
      : {
          brier: {
            ...(binaryBrierSamples.length === 0
              ? {}
              : { binary: binaryBrierScore(binaryBrierSamples) }),
            ...(multiclassBrierSamples.length === 0
              ? {}
              : { multiclass: multiclassBrierScore(multiclassBrierSamples) }),
          },
        }),
    latency: latencyMetrics(observations.map((observation) => observation.latencyMs)),
    failures,
    retries,
    usage: {
      requests: usageSamples.length,
      inputTokens: usageSamples.reduce((sum, sample) => sum + sample.usage.inputTokens, 0),
      outputTokens: usageSamples.reduce((sum, sample) => sum + sample.usage.outputTokens, 0),
    },
    cost: costReport(successful.flatMap(costSamplesForObservation), options.pricingSnapshot),
  };
}

function usageSamplesForObservation(
  observation: EvaluationObservation,
): readonly { readonly usage: NonNullable<EvaluationObservation["usage"]> }[] {
  if (observation.cascade !== undefined) {
    return [
      observation.cascade.primary,
      ...(observation.cascade.fallback === undefined ? [] : [observation.cascade.fallback]),
    ]
      .filter(
        (leg): leg is typeof leg & { usage: NonNullable<typeof leg.usage> } =>
          leg.usage !== undefined,
      )
      .map((leg) => ({ usage: leg.usage }));
  }
  return observation.usage === undefined ? [] : [{ usage: observation.usage }];
}

function costSamplesForObservation(observation: EvaluationObservation): readonly {
  readonly model?: string;
  readonly usage?: NonNullable<EvaluationObservation["usage"]>;
}[] {
  if (observation.cascade !== undefined) {
    return [
      observation.cascade.primary,
      ...(observation.cascade.fallback === undefined ? [] : [observation.cascade.fallback]),
    ].map((leg) => ({
      ...(leg.model === undefined ? {} : { model: leg.model }),
      ...(leg.usage === undefined ? {} : { usage: leg.usage }),
    }));
  }
  return [
    {
      ...(observation.model === undefined ? {} : { model: observation.model }),
      ...(observation.usage === undefined ? {} : { usage: observation.usage }),
    },
  ];
}

function validatePrediction(prediction: EvaluationPrediction): void {
  if (typeof prediction !== "object" || prediction === null) {
    throw new TypeError("Evaluation prediction must be an object");
  }
  if (typeof prediction.predicted !== "string" || prediction.predicted.length === 0) {
    throw new TypeError("Evaluation prediction must contain a non-empty predicted label");
  }
  if (prediction.confidence !== undefined) {
    assertProbability(prediction.confidence, "prediction confidence");
  }
  if (prediction.probability !== undefined) {
    assertProbability(prediction.probability, "prediction probability");
  }
  if (prediction.probabilities !== undefined) {
    for (const [label, probability] of Object.entries(prediction.probabilities)) {
      assertProbability(probability, `prediction probability ${label}`);
    }
  }
  if (
    prediction.latencyMs !== undefined &&
    (!Number.isFinite(prediction.latencyMs) || prediction.latencyMs < 0)
  ) {
    throw new RangeError("Prediction latency must be a finite non-negative number");
  }
  if (
    prediction.retries !== undefined &&
    (!Number.isInteger(prediction.retries) || prediction.retries < 0)
  ) {
    throw new RangeError("Prediction retries must be a non-negative integer");
  }
  if (
    prediction.usage !== undefined &&
    (!Number.isInteger(prediction.usage.inputTokens) ||
      prediction.usage.inputTokens < 0 ||
      !Number.isInteger(prediction.usage.outputTokens) ||
      prediction.usage.outputTokens < 0)
  ) {
    throw new RangeError("Prediction usage must contain non-negative integer values");
  }
}

function assertProbability(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function defaultExpectedLabel(expected: unknown): string {
  if (typeof expected !== "string" || expected.length === 0) {
    throw new TypeError(
      "Evaluation expected values must be non-empty strings or use expectedLabel",
    );
  }
  return expected;
}
