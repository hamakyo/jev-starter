import { diagnoseRag } from "./diagnosis.js";
import type { RagDiagnosis, RagJudgments, RagThresholds } from "./types.js";

/** Fixture-calibrated values used by the showcase; they are not universal defaults. */
export const RAG_THRESHOLDS: RagThresholds = {
  failThreshold: 0.2,
  passThreshold: 0.8,
};

/** JSON-safe policy snapshot for reproducible reports; the callback itself is not serializable. */
export const RAG_POLICY_METADATA = {
  kind: "custom",
  diagnosisPrecedence: [
    "CONFLICTING_EVIDENCE",
    "RETRIEVAL_MISS",
    "RETRIEVAL_INSUFFICIENT",
    "GENERATOR_UNGROUNDED",
    "ANSWER_INCORRECT",
    "JUDGE_UNCERTAIN",
    "PASS",
  ],
  thresholds: RAG_THRESHOLDS,
  uncertainRoute: "fallback",
} as const;

export function applyRagDiagnosis(
  judgments: RagJudgments,
  thresholds: RagThresholds = RAG_THRESHOLDS,
): RagDiagnosis {
  return diagnoseRag(judgments, thresholds);
}

export function shouldFallbackRag(diagnosis: RagDiagnosis): boolean {
  return diagnosis === "JUDGE_UNCERTAIN";
}
