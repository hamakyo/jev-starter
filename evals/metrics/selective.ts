/** A prediction confidence paired with correctness for selective automation. */
export interface SelectiveSample {
  readonly confidence: number;
  readonly correct: boolean;
}

export interface ConfidenceThresholdPoint {
  readonly threshold: number;
  readonly accepted: number;
  readonly coverage: number;
  readonly acceptedErrors: number;
  readonly risk: number;
  readonly reviewRate: number;
}

export interface RiskCoveragePoint {
  readonly accepted: number;
  readonly coverage: number;
  readonly errors: number;
  readonly risk: number;
  readonly threshold: number;
}

export interface SelectiveMetrics {
  readonly count: number;
  readonly thresholdSweep: readonly ConfidenceThresholdPoint[];
  readonly riskCoverageCurve: readonly RiskCoveragePoint[];
  /** Discrete AURC: sum(prefix risk) / total sample count, in descending confidence order. */
  readonly aurc: number;
}

/** Calculate coverage/risk at each one-sided confidence threshold. */
export function confidenceThresholdSweep(
  samples: readonly SelectiveSample[],
  thresholds: readonly number[],
): readonly ConfidenceThresholdPoint[] {
  const checkedThresholds = thresholds.map((threshold) => {
    assertProbability(threshold, "confidence threshold");
    return threshold;
  });
  return checkedThresholds.map((threshold) => {
    let accepted = 0;
    let acceptedErrors = 0;
    for (const sample of samples) {
      assertProbability(sample.confidence, "selective confidence");
      if (sample.confidence >= threshold) {
        accepted += 1;
        if (!sample.correct) {
          acceptedErrors += 1;
        }
      }
    }
    return {
      threshold,
      accepted,
      coverage: safeRatio(accepted, samples.length),
      acceptedErrors,
      risk: safeRatio(acceptedErrors, accepted),
      reviewRate: safeRatio(samples.length - accepted, samples.length),
    };
  });
}

/** Build a descending-confidence risk/coverage curve and its discrete AURC. */
export function riskCoverageCurve(samples: readonly SelectiveSample[]): {
  readonly curve: readonly RiskCoveragePoint[];
  readonly aurc: number;
} {
  const ordered = samples
    .map((sample, index) => ({ sample, index }))
    .sort(
      (left, right) => right.sample.confidence - left.sample.confidence || left.index - right.index,
    );
  let errors = 0;
  const curve = ordered.map(({ sample }, index) => {
    assertProbability(sample.confidence, "selective confidence");
    const accepted = index + 1;
    if (!sample.correct) {
      errors += 1;
    }
    return {
      accepted,
      coverage: safeRatio(accepted, samples.length),
      errors,
      risk: safeRatio(errors, accepted),
      threshold: sample.confidence,
    };
  });
  const aurc = curve.reduce((sum, point) => sum + safeRatio(point.risk, samples.length), 0);
  return { curve, aurc };
}

/** Combine the threshold sweep and risk/coverage curve into one metric object. */
export function selectiveMetrics(
  samples: readonly SelectiveSample[],
  thresholds: readonly number[],
): SelectiveMetrics {
  const { curve, aurc } = riskCoverageCurve(samples);
  return {
    count: samples.length,
    thresholdSweep: confidenceThresholdSweep(samples, thresholds),
    riskCoverageCurve: curve,
    aurc,
  };
}

function assertProbability(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
