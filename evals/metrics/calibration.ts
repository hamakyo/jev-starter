/** A confidence value paired with whether the prediction was correct. */
export interface CalibrationSample {
  readonly confidence: number;
  readonly correct: boolean;
}

export interface CalibrationBucket {
  readonly index: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly count: number;
  readonly meanConfidence: number;
  readonly accuracy: number;
  readonly gap: number;
}

export interface CalibrationMetrics {
  readonly bucketCount: number;
  readonly ece: number;
  readonly buckets: readonly CalibrationBucket[];
}

/** Calculate weighted expected calibration error with explicit bucket boundaries. */
export function calibrationMetrics(
  samples: readonly CalibrationSample[],
  bucketCount = 10,
): CalibrationMetrics {
  if (!Number.isInteger(bucketCount) || bucketCount < 1) {
    throw new RangeError("Calibration bucketCount must be a positive integer");
  }

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    confidenceTotal: 0,
    correctTotal: 0,
    count: 0,
  }));

  for (const sample of samples) {
    assertProbability(sample.confidence, "calibration confidence");
    const index =
      sample.confidence === 1 ? bucketCount - 1 : Math.floor(sample.confidence * bucketCount);
    const bucket = buckets[index];
    if (bucket === undefined) {
      throw new RangeError("Calibration confidence fell outside the configured buckets");
    }
    bucket.confidenceTotal += sample.confidence;
    bucket.correctTotal += sample.correct ? 1 : 0;
    bucket.count += 1;
  }

  const result = buckets.map((bucket) => {
    const meanConfidence = safeRatio(bucket.confidenceTotal, bucket.count);
    const accuracy = safeRatio(bucket.correctTotal, bucket.count);
    return {
      index: bucket.index,
      lowerBound: bucket.index / bucketCount,
      upperBound: (bucket.index + 1) / bucketCount,
      count: bucket.count,
      meanConfidence,
      accuracy,
      gap: Math.abs(meanConfidence - accuracy),
    };
  });
  const ece = result.reduce(
    (sum, bucket) =>
      sum + (samples.length === 0 ? 0 : (bucket.count / samples.length) * bucket.gap),
    0,
  );

  return { bucketCount, ece, buckets: result };
}

function assertProbability(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
