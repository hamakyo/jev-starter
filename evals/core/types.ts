import type { EntryType } from "@typesafe-ai/sdk";
import type { DecisionRoute } from "../../src/policies/types.js";
import type { ProviderUsage } from "../../src/providers/types.js";
import type { BinaryBandMetrics } from "../metrics/binary-band.js";
import type { BrierScore } from "../metrics/brier.js";
import type { CalibrationMetrics } from "../metrics/calibration.js";
import type { ClassificationMetrics } from "../metrics/classification.js";
import type { LatencyMetrics } from "../metrics/latency.js";
import type { SelectiveMetrics } from "../metrics/selective.js";
import type { CostReport, PricingSnapshot } from "../pricing/schema.js";

/** One non-sensitive labeled row in an evaluation dataset. */
export interface EvaluationCase<TExpected = string> {
  readonly id: string;
  readonly state: EntryType;
  readonly expected: TExpected;
  readonly tags?: readonly string[];
}

/** The normalized prediction returned by an evaluation adapter. */
export interface EvaluationPrediction {
  readonly predicted: string;
  readonly confidence?: number;
  readonly probability?: number;
  readonly probabilities?: Readonly<Record<string, number>>;
  readonly route?: DecisionRoute;
  readonly model?: string;
  readonly latencyMs?: number;
  readonly usage?: ProviderUsage;
  /** Retry count is recorded only when the provider explicitly supplies it. */
  readonly retries?: number;
  /** Additional JSON-safe fields, such as RAG component judgments. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Adapter from one fixture row to one normalized prediction. */
export type EvaluationEvaluator<TExpected> = (
  item: EvaluationCase<TExpected>,
) => EvaluationPrediction | Promise<EvaluationPrediction>;

/** Stable metadata recorded with every evaluation report. */
export interface EvaluationMetadata {
  readonly decisionId?: string;
  readonly decisionVersion?: string;
  /** Contract variant when one report contains more than one question set. */
  readonly decisionVariant?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly policy?: Readonly<Record<string, unknown>>;
  readonly packageVersion?: string;
  readonly pricingSnapshotVersion?: string;
}

/** Metrics for one binary component judgment, such as groundedness. */
export interface EvaluationComponentMetric {
  readonly count: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly brier: BrierScore;
  readonly calibration: CalibrationMetrics;
}

/** Optional grouped metrics for evaluators with independently labeled components. */
export interface EvaluationComponentMetrics {
  readonly retrieval?: Readonly<Record<string, EvaluationComponentMetric>>;
  readonly generation?: Readonly<Record<string, EvaluationComponentMetric>>;
}

/** Classification metrics with explicit success-only and all-row denominators. */
export interface EvaluationClassificationMetrics extends ClassificationMetrics {
  readonly totalCount: number;
  readonly failures: number;
  readonly successfulAccuracy: number;
  readonly overallAccuracy: number;
  readonly successRate: number;
}

/** A provider leg retained inside a cascade end-to-end observation. */
export interface EvaluationLeg {
  readonly status: "success" | "failure";
  readonly predicted?: string;
  readonly confidence?: number;
  readonly probability?: number;
  readonly probabilities?: Readonly<Record<string, number>>;
  readonly route?: DecisionRoute;
  readonly model?: string;
  readonly latencyMs: number;
  readonly usage?: ProviderUsage;
  readonly retries?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly errorCategory?: string;
  readonly errorName?: string;
}

/** Primary and optional fallback provider legs for one fixture row. */
export interface EvaluationCascadeDetails {
  readonly primary: EvaluationLeg;
  readonly fallback?: EvaluationLeg;
}

/** Dataset identity; selection-based hashes are distinct from source-byte hashes. */
export interface EvaluationDatasetIdentity {
  readonly hash: string;
  readonly count: number;
  readonly hashBasis?: "source-bytes" | "selection-ids";
  readonly parentHash?: string;
  readonly selectionIds?: readonly string[];
}

/** One successful or failed evaluation observation. */
export interface EvaluationObservation {
  readonly id: string;
  readonly expected: string;
  readonly status: "success" | "failure";
  readonly predicted?: string;
  readonly confidence?: number;
  readonly probability?: number;
  readonly probabilities?: Readonly<Record<string, number>>;
  readonly route?: DecisionRoute;
  readonly model?: string;
  readonly latencyMs: number;
  readonly usage?: ProviderUsage;
  readonly retries?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly cascade?: EvaluationCascadeDetails;
  readonly errorCategory?: string;
  readonly errorName?: string;
}

/** Metrics produced for one evaluation run. */
export interface EvaluationMetrics {
  readonly classification: EvaluationClassificationMetrics;
  readonly calibration?: CalibrationMetrics;
  readonly selective?: SelectiveMetrics;
  readonly binaryBand?: BinaryBandMetrics;
  readonly brier?: {
    readonly binary?: BrierScore;
    readonly multiclass?: BrierScore;
  };
  readonly latency: LatencyMetrics;
  readonly failures: number;
  readonly retries: number | null;
  readonly usage: {
    readonly requests: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly cost: CostReport;
}

/** Machine-readable output from one evaluator over one dataset. */
export interface EvaluationReport {
  readonly kind: "evaluation-report";
  readonly generatedAt: string;
  readonly dataset: EvaluationDatasetIdentity;
  readonly metadata: EvaluationMetadata;
  readonly observations: readonly EvaluationObservation[];
  readonly metrics: EvaluationMetrics;
  readonly componentMetrics?: EvaluationComponentMetrics;
}

/** Side-by-side reports for two evaluators on the same dataset. */
export interface ComparisonReport {
  readonly kind: "comparison-report";
  readonly generatedAt: string;
  readonly dataset: EvaluationDatasetIdentity;
  readonly primary: EvaluationReport;
  readonly baseline: EvaluationReport;
  readonly deltas: {
    readonly accuracy: number;
    readonly failureCount: number;
    readonly p50LatencyMs: number | null;
    readonly p95LatencyMs: number | null;
  };
}

/** Reports for a primary evaluator with uncertain cases sent to a fallback. */
export interface CascadeReport {
  readonly kind: "cascade-report";
  readonly generatedAt: string;
  readonly dataset: EvaluationDatasetIdentity;
  readonly primary: EvaluationReport;
  readonly fallback: EvaluationReport;
  readonly endToEnd: EvaluationReport;
  readonly primaryResolvedRate: number;
  readonly primaryFailureRate: number;
  readonly fallbackRate: number;
  readonly fallbackSelection: {
    readonly parentDatasetHash: string;
    readonly subsetHash: string;
    readonly ids: readonly string[];
  };
}

/** Options shared by evaluation runners. */
export interface EvaluationRunOptions<TExpected> {
  readonly expectedLabel?: (expected: TExpected) => string;
  readonly clock?: () => Date;
  readonly metadata?: EvaluationMetadata;
  readonly pricingSnapshot?: PricingSnapshot;
  readonly bucketCount?: number;
  readonly thresholds?: readonly number[];
  readonly binaryBandThresholds?: readonly {
    readonly negativeThreshold: number;
    readonly positiveThreshold: number;
  }[];
  readonly binaryActual?: (expected: TExpected) => boolean;
}
