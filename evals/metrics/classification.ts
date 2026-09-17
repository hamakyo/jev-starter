/** A labeled classification prediction used by the quality metrics. */
export interface ClassificationSample {
  readonly actual: string;
  readonly predicted: string;
}

export interface LabelMetrics {
  readonly support: number;
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface ClassificationMetrics {
  readonly count: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly labels: readonly string[];
  readonly confusionMatrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly perLabel: Readonly<Record<string, LabelMetrics>>;
}

/** Calculate accuracy, a deterministic confusion matrix, and per-label metrics. */
export function classificationMetrics(
  samples: readonly ClassificationSample[],
  labels?: readonly string[],
): ClassificationMetrics {
  const orderedLabels = uniqueLabels(labels ?? [], samples);
  const matrix: Record<string, Record<string, number>> = Object.fromEntries(
    orderedLabels.map((actual) => [
      actual,
      Object.fromEntries(orderedLabels.map((predicted) => [predicted, 0])),
    ]),
  );

  let correct = 0;
  for (const sample of samples) {
    assertLabel(sample.actual, "actual");
    assertLabel(sample.predicted, "predicted");
    const row =
      matrix[sample.actual] ?? Object.fromEntries(orderedLabels.map((label) => [label, 0]));
    row[sample.predicted] = (row[sample.predicted] ?? 0) + 1;
    matrix[sample.actual] = row;
    if (sample.actual === sample.predicted) {
      correct += 1;
    }
  }

  const perLabel: Record<string, LabelMetrics> = {};
  for (const label of orderedLabels) {
    let truePositive = matrix[label]?.[label] ?? 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;

    for (const actual of orderedLabels) {
      const count = matrix[actual]?.[label] ?? 0;
      if (actual !== label) {
        falsePositive += count;
      }
      if (actual === label) {
        support += Object.values(matrix[actual] ?? {}).reduce((sum, value) => sum + value, 0);
      }
    }
    for (const predicted of orderedLabels) {
      if (predicted !== label) {
        falseNegative += matrix[label]?.[predicted] ?? 0;
      }
    }

    truePositive = Number.isFinite(truePositive) ? truePositive : 0;
    const precision = safeRatio(truePositive, truePositive + falsePositive);
    const recall = safeRatio(truePositive, truePositive + falseNegative);
    const f1 = safeRatio(2 * precision * recall, precision + recall);
    perLabel[label] = {
      support,
      truePositive,
      falsePositive,
      falseNegative,
      precision,
      recall,
      f1,
    };
  }

  return {
    count: samples.length,
    correct,
    accuracy: safeRatio(correct, samples.length),
    labels: orderedLabels,
    confusionMatrix: matrix,
    perLabel,
  };
}

function uniqueLabels(
  configured: readonly string[],
  samples: readonly ClassificationSample[],
): string[] {
  const labels: string[] = [];
  for (const label of [
    ...configured,
    ...samples.flatMap((sample) => [sample.actual, sample.predicted]),
  ]) {
    if (typeof label !== "string" || label.length === 0) {
      throw new TypeError("Classification labels must be non-empty strings");
    }
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

function assertLabel(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Classification ${field} must be a non-empty string`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
