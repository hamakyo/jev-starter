import { createHash } from "node:crypto";
import type {
  CascadeReport,
  EvaluationCascadeDetails,
  EvaluationCase,
  EvaluationEvaluator,
  EvaluationLeg,
  EvaluationObservation,
  EvaluationPrediction,
  EvaluationRunOptions,
} from "../core/types.js";
import type { LoadedDataset } from "../fixtures/jsonl.js";
import type { PricingSnapshot } from "../pricing/schema.js";
import { evaluateDataset, reportFromObservations } from "./evaluate.js";

export interface CascadeOptions<TExpected> {
  readonly primary?: EvaluationRunOptions<TExpected>;
  readonly fallback?: EvaluationRunOptions<TExpected>;
  readonly shouldFallback?: (prediction: EvaluationPrediction) => boolean;
  readonly clock?: () => Date;
}

/** Evaluate primary decisions once and send only the configured uncertain cases to fallback. */
export async function evaluateCascade<TExpected>(
  dataset: LoadedDataset<TExpected>,
  primary: EvaluationEvaluator<TExpected>,
  fallback: EvaluationEvaluator<TExpected>,
  options: CascadeOptions<TExpected> = {},
): Promise<CascadeReport> {
  const primaryPredictions = new Map<string, EvaluationPrediction>();
  const primaryCached: EvaluationEvaluator<TExpected> = async (item) => {
    const prediction = await primary(item);
    primaryPredictions.set(item.id, prediction);
    return prediction;
  };
  const primaryReport = await evaluateDataset(dataset, primaryCached, options.primary);
  const primaryObservations = new Map(
    primaryReport.observations.map((observation) => [observation.id, observation]),
  );
  const shouldFallback =
    options.shouldFallback ?? ((prediction) => prediction.route === "fallback");
  const fallbackItems = dataset.items.filter((item) => {
    const observation = primaryObservations.get(item.id);
    const prediction = primaryPredictions.get(item.id);
    return (
      observation?.status === "success" && prediction !== undefined && shouldFallback(prediction)
    );
  });
  const selectionIds = fallbackItems.map((item) => item.id);
  const selection = selectionHash(selectionIds);
  const fallbackDataset: LoadedDataset<TExpected> = {
    items: fallbackItems,
    sha256: selection.hash,
    byteLength: selection.byteLength,
    hashBasis: "selection-ids",
    parentHash: dataset.sha256,
    selectionIds,
  };
  const fallbackCached: EvaluationEvaluator<TExpected> = async (item) => {
    return fallback(item);
  };
  const fallbackReport = await evaluateDataset(fallbackDataset, fallbackCached, options.fallback);
  const fallbackObservations = new Map(
    fallbackReport.observations.map((observation) => [observation.id, observation]),
  );
  const fallbackIdSet = new Set(selectionIds);
  const primaryResolvedCount = dataset.items.filter((item) => {
    const observation = primaryObservations.get(item.id);
    return (
      observation?.status === "success" &&
      primaryPredictions.has(item.id) &&
      !fallbackIdSet.has(item.id)
    );
  }).length;

  const endToEndObservations = dataset.items.map((item) => {
    const primaryObservation = primaryObservations.get(item.id);
    if (primaryObservation === undefined) {
      throw new Error(`Cascade primary observation missing for ${item.id}`);
    }
    const fallbackObservation = fallbackObservations.get(item.id);
    return combineCascadeObservation(
      primaryObservation,
      fallbackObservation,
      shouldFallback,
      item.id,
    );
  });
  const endToEndReport = reportFromObservations(
    dataset,
    endToEndObservations,
    cascadeEndToEndOptions(options.primary, options.fallback),
  );
  const fallbackCount = fallbackItems.length;

  return {
    kind: "cascade-report",
    generatedAt: (options.clock?.() ?? new Date()).toISOString(),
    dataset: primaryReport.dataset,
    primary: primaryReport,
    fallback: fallbackReport,
    endToEnd: endToEndReport,
    primaryResolvedRate: safeRatio(primaryResolvedCount, dataset.items.length),
    primaryFailureRate: safeRatio(primaryReport.metrics.failures, dataset.items.length),
    fallbackRate: safeRatio(fallbackCount, dataset.items.length),
    fallbackSelection: {
      parentDatasetHash: dataset.sha256,
      subsetHash: selection.hash,
      ids: selectionIds,
    },
  };
}

function combineCascadeObservation(
  primary: EvaluationObservation,
  fallback: EvaluationObservation | undefined,
  shouldFallback: (prediction: EvaluationPrediction) => boolean,
  itemId: string,
): EvaluationObservation {
  const primaryLeg = toEvaluationLeg(primary);
  if (primary.status === "failure") {
    return {
      id: primary.id,
      expected: primary.expected,
      status: "failure",
      latencyMs: primary.latencyMs,
      cascade: { primary: primaryLeg },
      ...(primary.errorCategory === undefined ? {} : { errorCategory: primary.errorCategory }),
      ...(primary.errorName === undefined ? {} : { errorName: primary.errorName }),
    };
  }

  const primaryPrediction = predictionFromObservation(primary);
  if (!shouldFallback(primaryPrediction)) {
    return { ...primary, cascade: { primary: primaryLeg } };
  }
  if (fallback === undefined) {
    throw new Error(`Cascade fallback observation missing for ${itemId}`);
  }

  const fallbackLeg = toEvaluationLeg(fallback);
  const cascade: EvaluationCascadeDetails = { primary: primaryLeg, fallback: fallbackLeg };
  if (fallback.status === "failure") {
    return {
      id: primary.id,
      expected: primary.expected,
      status: "failure",
      latencyMs: primary.latencyMs + fallback.latencyMs,
      cascade,
      ...(fallback.errorCategory === undefined ? {} : { errorCategory: fallback.errorCategory }),
      ...(fallback.errorName === undefined ? {} : { errorName: fallback.errorName }),
    };
  }

  const usage = combinedUsage(primary, fallback);
  const retries = combinedRetries(primary, fallback);
  return {
    ...fallback,
    id: primary.id,
    expected: primary.expected,
    latencyMs: primary.latencyMs + fallback.latencyMs,
    ...(usage === undefined ? {} : { usage }),
    ...(retries === undefined ? {} : { retries }),
    metadata: {
      ...(fallback.metadata ?? {}),
      cascadeSource: "fallback",
    },
    cascade,
  };
}

function predictionFromObservation(observation: EvaluationObservation): EvaluationPrediction {
  if (observation.predicted === undefined) {
    throw new Error(`Cascade primary prediction missing for ${observation.id}`);
  }
  return {
    predicted: observation.predicted,
    ...(observation.confidence === undefined ? {} : { confidence: observation.confidence }),
    ...(observation.probability === undefined ? {} : { probability: observation.probability }),
    ...(observation.probabilities === undefined
      ? {}
      : { probabilities: observation.probabilities }),
    ...(observation.route === undefined ? {} : { route: observation.route }),
    ...(observation.model === undefined ? {} : { model: observation.model }),
    ...(observation.latencyMs === undefined ? {} : { latencyMs: observation.latencyMs }),
    ...(observation.usage === undefined ? {} : { usage: observation.usage }),
    ...(observation.retries === undefined ? {} : { retries: observation.retries }),
    ...(observation.metadata === undefined ? {} : { metadata: observation.metadata }),
  };
}

function toEvaluationLeg(observation: EvaluationObservation): EvaluationLeg {
  return {
    status: observation.status,
    ...(observation.predicted === undefined ? {} : { predicted: observation.predicted }),
    ...(observation.confidence === undefined ? {} : { confidence: observation.confidence }),
    ...(observation.probability === undefined ? {} : { probability: observation.probability }),
    ...(observation.probabilities === undefined
      ? {}
      : { probabilities: observation.probabilities }),
    ...(observation.route === undefined ? {} : { route: observation.route }),
    ...(observation.model === undefined ? {} : { model: observation.model }),
    latencyMs: observation.latencyMs,
    ...(observation.usage === undefined ? {} : { usage: observation.usage }),
    ...(observation.retries === undefined ? {} : { retries: observation.retries }),
    ...(observation.metadata === undefined ? {} : { metadata: observation.metadata }),
    ...(observation.errorCategory === undefined
      ? {}
      : { errorCategory: observation.errorCategory }),
    ...(observation.errorName === undefined ? {} : { errorName: observation.errorName }),
  };
}

function combinedUsage(
  primary: EvaluationObservation,
  fallback: EvaluationObservation,
): EvaluationObservation["usage"] | undefined {
  if (primary.usage === undefined || fallback.usage === undefined) {
    return undefined;
  }
  return {
    inputTokens: primary.usage.inputTokens + fallback.usage.inputTokens,
    outputTokens: primary.usage.outputTokens + fallback.usage.outputTokens,
  };
}

function combinedRetries(
  primary: EvaluationObservation,
  fallback: EvaluationObservation,
): number | undefined {
  if (primary.retries === undefined && fallback.retries === undefined) {
    return undefined;
  }
  return (primary.retries ?? 0) + (fallback.retries ?? 0);
}

function cascadeEndToEndOptions<TExpected>(
  primary: EvaluationRunOptions<TExpected> | undefined,
  fallback: EvaluationRunOptions<TExpected> | undefined,
): EvaluationRunOptions<TExpected> {
  const base = primary ?? fallback ?? {};
  const pricingSnapshot = mergePricingSnapshots(
    primary?.pricingSnapshot,
    fallback?.pricingSnapshot,
  );
  return pricingSnapshot === undefined ? base : { ...base, pricingSnapshot };
}

function mergePricingSnapshots(
  primary: PricingSnapshot | undefined,
  fallback: PricingSnapshot | undefined,
): PricingSnapshot | undefined {
  if (primary === undefined) {
    return fallback;
  }
  if (fallback === undefined) {
    return primary;
  }
  const models: Record<string, PricingSnapshot["models"][string]> = { ...primary.models };
  for (const [model, pricing] of Object.entries(fallback.models)) {
    const existing = models[model];
    if (
      existing !== undefined &&
      (existing.inputUsdPerMillionTokens !== pricing.inputUsdPerMillionTokens ||
        existing.outputUsdPerMillionTokens !== pricing.outputUsdPerMillionTokens)
    ) {
      throw new RangeError(`Conflicting pricing snapshots define model "${model}" differently`);
    }
    models[model] = pricing;
  }
  return {
    version: `${primary.version}+${fallback.version}`,
    currency: "USD",
    models,
  };
}

function selectionHash(ids: readonly string[]): {
  readonly hash: string;
  readonly byteLength: number;
} {
  const serialized = JSON.stringify(ids);
  return {
    hash: createHash("sha256").update(serialized).digest("hex"),
    byteLength: Buffer.byteLength(serialized),
  };
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export type { EvaluationCase };
