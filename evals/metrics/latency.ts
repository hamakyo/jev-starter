export interface LatencyMetrics {
  readonly count: number;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly meanMs: number | null;
}

/** Calculate p50/p95 using linear interpolation over sorted observed latencies. */
export function latencyMetrics(latenciesMs: readonly number[]): LatencyMetrics {
  const ordered = latenciesMs
    .map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new RangeError("Latency must be a finite non-negative number");
      }
      return value;
    })
    .sort((left, right) => left - right);
  if (ordered.length === 0) {
    return { count: 0, p50Ms: null, p95Ms: null, minMs: null, maxMs: null, meanMs: null };
  }
  return {
    count: ordered.length,
    p50Ms: percentile(ordered, 0.5),
    p95Ms: percentile(ordered, 0.95),
    minMs: ordered[0] ?? null,
    maxMs: ordered[ordered.length - 1] ?? null,
    meanMs: ordered.reduce((sum, value) => sum + value, 0) / ordered.length,
  };
}

function percentile(ordered: readonly number[], quantile: number): number {
  const index = (ordered.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue = ordered[lower] ?? 0;
  const upperValue = ordered[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}
