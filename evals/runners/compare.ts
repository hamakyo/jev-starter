import type {
  ComparisonReport,
  EvaluationCase,
  EvaluationEvaluator,
  EvaluationReport,
  EvaluationRunOptions,
} from "../core/types.js";
import type { LoadedDataset } from "../fixtures/jsonl.js";
import { evaluateDataset } from "./evaluate.js";

export interface CompareOptions<TExpected> {
  readonly primary?: EvaluationRunOptions<TExpected>;
  readonly baseline?: EvaluationRunOptions<TExpected>;
  readonly clock?: () => Date;
}

/** Run two evaluators over the same loaded dataset and report the measurable deltas. */
export async function compareEvaluations<TExpected>(
  dataset: LoadedDataset<TExpected>,
  primary: EvaluationEvaluator<TExpected>,
  baseline: EvaluationEvaluator<TExpected>,
  options: CompareOptions<TExpected> = {},
): Promise<ComparisonReport> {
  const primaryReport = await evaluateDataset(dataset, primary, options.primary);
  const baselineReport = await evaluateDataset(dataset, baseline, options.baseline);
  return {
    kind: "comparison-report",
    generatedAt: (options.clock?.() ?? new Date()).toISOString(),
    dataset: { hash: dataset.sha256, count: dataset.items.length },
    primary: primaryReport,
    baseline: baselineReport,
    deltas: {
      accuracy:
        primaryReport.metrics.classification.overallAccuracy -
        baselineReport.metrics.classification.overallAccuracy,
      failureCount: primaryReport.metrics.failures - baselineReport.metrics.failures,
      p50LatencyMs: subtractNullable(
        primaryReport.metrics.latency.p50Ms,
        baselineReport.metrics.latency.p50Ms,
      ),
      p95LatencyMs: subtractNullable(
        primaryReport.metrics.latency.p95Ms,
        baselineReport.metrics.latency.p95Ms,
      ),
    },
  };
}

function subtractNullable(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

export type { EvaluationCase, EvaluationEvaluator, EvaluationReport };
