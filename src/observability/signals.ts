import type { DecisionAnswerSignal } from "./types.js";

/** Extract numeric answer signals without retaining the raw answer or input state. */
export function createDecisionSignals(answers: unknown): readonly DecisionAnswerSignal[] {
  if (!isRecord(answers)) {
    return [];
  }
  return Object.entries(answers).flatMap(([question, value]) => {
    if (!isRecord(value) || !isAnswerType(value.type)) {
      return [];
    }
    const normalizedProbabilities = numericProbabilities(value.probabilities);
    return [
      {
        question,
        type: value.type,
        ...(typeof value.confidence === "number" ? { confidence: value.confidence } : {}),
        ...(typeof value.noul === "number" ? { probability: value.noul } : {}),
        ...(normalizedProbabilities === undefined
          ? {}
          : { probabilities: normalizedProbabilities }),
      },
    ];
  });
}

function numericProbabilities(value: unknown): Readonly<Record<string, number>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const normalized: Record<string, number> = {};
  for (const [label, probability] of Object.entries(value)) {
    if (typeof probability === "number") {
      normalized[label] = probability;
    }
  }
  return Object.keys(normalized).length === 0 ? undefined : normalized;
}

function isAnswerType(value: unknown): value is DecisionAnswerSignal["type"] {
  return value === "noul" || value === "choice" || value === "score";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
