import type { RagDiagnosis, RagJudgments, RagThresholds } from "./types.js";

/** Apply the documented retrieval-before-generation diagnosis precedence. */
export function diagnoseRag(judgments: RagJudgments, thresholds: RagThresholds): RagDiagnosis {
  assertThresholds(thresholds);
  if (judgments.retrieval.conflict >= thresholds.passThreshold) {
    return "CONFLICTING_EVIDENCE";
  }

  const chunkValues = Object.values(judgments.retrieval.chunkRelevance);
  if (chunkValues.length === 0 || Math.max(...chunkValues) <= thresholds.failThreshold) {
    return "RETRIEVAL_MISS";
  }
  if (judgments.retrieval.sufficiency <= thresholds.failThreshold) {
    return "RETRIEVAL_INSUFFICIENT";
  }
  if (judgments.generation.relevance <= thresholds.failThreshold) {
    return "ANSWER_IRRELEVANT";
  }
  if (
    judgments.generation.groundedness <= thresholds.failThreshold ||
    judgments.generation.contradiction >= thresholds.passThreshold
  ) {
    return "GENERATOR_UNGROUNDED";
  }
  if (
    judgments.generation.correctness !== undefined &&
    judgments.generation.correctness <= thresholds.failThreshold
  ) {
    return "ANSWER_INCORRECT";
  }
  if (hasUncertainSignal(judgments, thresholds)) {
    return "JUDGE_UNCERTAIN";
  }
  return "PASS";
}

/** Confidence in the selected diagnosis, retaining the component probabilities separately. */
export function diagnosisConfidence(diagnosis: RagDiagnosis, judgments: RagJudgments): number {
  switch (diagnosis) {
    case "CONFLICTING_EVIDENCE":
      return judgments.retrieval.conflict;
    case "RETRIEVAL_MISS": {
      const chunkValues = Object.values(judgments.retrieval.chunkRelevance);
      return chunkValues.length === 0 ? 1 : 1 - Math.max(...chunkValues);
    }
    case "RETRIEVAL_INSUFFICIENT":
      return 1 - judgments.retrieval.sufficiency;
    case "GENERATOR_UNGROUNDED":
      return Math.max(1 - judgments.generation.groundedness, judgments.generation.contradiction);
    case "ANSWER_IRRELEVANT":
      return 1 - judgments.generation.relevance;
    case "ANSWER_INCORRECT":
      return 1 - (judgments.generation.correctness ?? 0.5);
    case "JUDGE_UNCERTAIN":
      return 0.5;
    case "PASS": {
      const signals = [
        judgments.retrieval.sufficiency,
        1 - judgments.retrieval.conflict,
        judgments.generation.relevance,
        judgments.generation.groundedness,
        1 - judgments.generation.contradiction,
      ];
      if (judgments.generation.correctness !== undefined) {
        signals.push(judgments.generation.correctness);
      }
      return Math.min(...signals);
    }
  }
}

function hasUncertainSignal(judgments: RagJudgments, thresholds: RagThresholds): boolean {
  const signals = [
    judgments.retrieval.sufficiency,
    judgments.retrieval.conflict,
    judgments.generation.relevance,
    judgments.generation.groundedness,
    judgments.generation.contradiction,
    ...(judgments.generation.correctness === undefined ? [] : [judgments.generation.correctness]),
    ...Object.values(judgments.retrieval.chunkRelevance),
  ];
  return signals.some(
    (value) => value > thresholds.failThreshold && value < thresholds.passThreshold,
  );
}

function assertThresholds(thresholds: RagThresholds): void {
  if (
    !Number.isFinite(thresholds.failThreshold) ||
    !Number.isFinite(thresholds.passThreshold) ||
    thresholds.failThreshold < 0 ||
    thresholds.failThreshold >= thresholds.passThreshold ||
    thresholds.passThreshold > 1
  ) {
    throw new RangeError("RAG thresholds must satisfy 0 <= fail < pass <= 1");
  }
}
