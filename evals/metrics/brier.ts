export interface BinaryBrierSample {
  readonly probability: number;
  readonly actual: boolean;
}

export interface MulticlassBrierSample {
  readonly probabilities: Readonly<Record<string, number>>;
  readonly actual: string;
}

export interface BrierScore {
  readonly count: number;
  readonly score: number;
}

/** Calculate the mean squared error for a binary probability. */
export function binaryBrierScore(samples: readonly BinaryBrierSample[]): BrierScore {
  const total = samples.reduce((sum, sample) => {
    assertProbability(sample.probability, "binary Brier probability");
    const target = sample.actual ? 1 : 0;
    return sum + (sample.probability - target) ** 2;
  }, 0);
  return { count: samples.length, score: safeRatio(total, samples.length) };
}

/** Calculate the multiclass one-hot Brier score over the union of observed labels. */
export function multiclassBrierScore(samples: readonly MulticlassBrierSample[]): BrierScore {
  const labels = new Set<string>();
  for (const sample of samples) {
    if (sample.actual.length === 0) {
      throw new TypeError("Multiclass Brier actual labels must be non-empty strings");
    }
    labels.add(sample.actual);
    for (const [label, probability] of Object.entries(sample.probabilities)) {
      if (label.length === 0) {
        throw new TypeError("Multiclass Brier labels must be non-empty strings");
      }
      assertProbability(probability, `multiclass Brier probability ${label}`);
      labels.add(label);
    }
  }

  const total = samples.reduce((sum, sample) => {
    let row = 0;
    for (const label of labels) {
      const probability = sample.probabilities[label] ?? 0;
      row += (probability - (label === sample.actual ? 1 : 0)) ** 2;
    }
    return sum + row;
  }, 0);
  return { count: samples.length, score: safeRatio(total, samples.length) };
}

function assertProbability(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
