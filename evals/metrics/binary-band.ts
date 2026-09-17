/** A noul probability paired with the ground-truth boolean outcome. */
export interface BinaryBandSample {
  readonly probability: number;
  readonly actual: boolean;
}

export interface BinaryBandThresholdPair {
  readonly negativeThreshold: number;
  readonly positiveThreshold: number;
}

export interface BinaryBandPoint extends BinaryBandThresholdPair {
  readonly autoNegative: number;
  readonly autoPositive: number;
  readonly fallback: number;
  readonly autoNegativeCoverage: number;
  readonly autoPositiveCoverage: number;
  readonly fallbackCoverage: number;
  readonly acceptedCoverage: number;
  readonly acceptedErrors: number;
  readonly acceptedErrorRate: number;
}

export interface BinaryBandMetrics {
  readonly count: number;
  readonly thresholdSweep: readonly BinaryBandPoint[];
}

/** Sweep two-sided noul thresholds without treating confident negatives as uncertainty. */
export function binaryBandThresholdSweep(
  samples: readonly BinaryBandSample[],
  pairs: readonly BinaryBandThresholdPair[],
): readonly BinaryBandPoint[] {
  return pairs.map((pair) => {
    assertProbability(pair.negativeThreshold, "negative threshold");
    assertProbability(pair.positiveThreshold, "positive threshold");
    if (pair.negativeThreshold >= pair.positiveThreshold) {
      throw new RangeError("Binary-band thresholds must satisfy negative < positive");
    }

    let autoNegative = 0;
    let autoPositive = 0;
    let fallback = 0;
    let acceptedErrors = 0;
    for (const sample of samples) {
      assertProbability(sample.probability, "binary probability");
      if (sample.probability <= pair.negativeThreshold) {
        autoNegative += 1;
        if (sample.actual) {
          acceptedErrors += 1;
        }
      } else if (sample.probability >= pair.positiveThreshold) {
        autoPositive += 1;
        if (!sample.actual) {
          acceptedErrors += 1;
        }
      } else {
        fallback += 1;
      }
    }
    const accepted = autoNegative + autoPositive;
    return {
      ...pair,
      autoNegative,
      autoPositive,
      fallback,
      autoNegativeCoverage: safeRatio(autoNegative, samples.length),
      autoPositiveCoverage: safeRatio(autoPositive, samples.length),
      fallbackCoverage: safeRatio(fallback, samples.length),
      acceptedCoverage: safeRatio(accepted, samples.length),
      acceptedErrors,
      acceptedErrorRate: safeRatio(acceptedErrors, accepted),
    };
  });
}

/** Return the binary sweep in the same shape used by evaluation reports. */
export function binaryBandMetrics(
  samples: readonly BinaryBandSample[],
  pairs: readonly BinaryBandThresholdPair[],
): BinaryBandMetrics {
  return { count: samples.length, thresholdSweep: binaryBandThresholdSweep(samples, pairs) };
}

function assertProbability(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
