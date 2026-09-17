import type { Questions } from "@typesafe-ai/sdk";
import type { AnswersFor } from "../providers/types.js";
import type { BinaryBandPolicy, ConfidencePolicy, DecisionPolicy, DecisionRoute } from "./types.js";

/** Validate and apply a policy to a successful, typed answer map. */
export function applyPolicy<Q extends Questions>(
  policy: DecisionPolicy<Q>,
  answers: AnswersFor<Q>,
): DecisionRoute {
  switch (policy.kind) {
    case "confidence": {
      assertConfidenceThresholds(policy);
      const answer = answers[policy.question];
      if (!isConfidenceAnswer(answer)) {
        throw new TypeError(
          `Policy question "${policy.question}" must produce a choice or score answer with confidence`,
        );
      }
      assertProbability(answer.confidence, `confidence for question "${policy.question}"`);
      return applyConfidencePolicy(policy, answer.confidence);
    }
    case "binary-band": {
      assertBinaryBandThresholds(policy);
      if (policy.uncertainRoute !== "fallback" && policy.uncertainRoute !== "review") {
        throw new TypeError('Binary-band uncertainRoute must be "fallback" or "review"');
      }
      const answer = answers[policy.question];
      if (!isNoulAnswer(answer)) {
        throw new TypeError(`Policy question "${policy.question}" must produce a noul answer`);
      }
      assertProbability(answer.noul, `noul probability for question "${policy.question}"`);
      return applyBinaryBandPolicy(policy, answer.noul);
    }
    case "custom": {
      const route = policy.decide(answers);
      if (!isDecisionRoute(route)) {
        throw new TypeError('Custom policy must return "auto", "fallback", or "review"');
      }
      return route;
    }
    default:
      throw new TypeError("Unknown decision policy kind");
  }
}

/** Validate one-sided threshold invariants. */
export function assertConfidenceThresholds<Q extends Questions>(policy: ConfidencePolicy<Q>): void {
  assertFiniteNumber(policy.autoThreshold, "policy.autoThreshold");
  assertFiniteNumber(policy.fallbackThreshold, "policy.fallbackThreshold");
  if (
    policy.fallbackThreshold < 0 ||
    policy.fallbackThreshold > policy.autoThreshold ||
    policy.autoThreshold > 1
  ) {
    throw new RangeError(
      "Confidence policy thresholds must satisfy 0 <= fallbackThreshold <= autoThreshold <= 1",
    );
  }
}

/** Validate two-sided threshold invariants. */
export function assertBinaryBandThresholds<Q extends Questions>(policy: BinaryBandPolicy<Q>): void {
  assertFiniteNumber(policy.negativeThreshold, "policy.negativeThreshold");
  assertFiniteNumber(policy.positiveThreshold, "policy.positiveThreshold");
  if (
    policy.negativeThreshold < 0 ||
    policy.negativeThreshold >= policy.positiveThreshold ||
    policy.positiveThreshold > 1
  ) {
    throw new RangeError(
      "Binary-band thresholds must satisfy 0 <= negativeThreshold < positiveThreshold <= 1",
    );
  }
}

/** Validate a confidence/probability value before routing it. */
export function assertProbability(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function applyConfidencePolicy<Q extends Questions>(
  policy: ConfidencePolicy<Q>,
  confidence: number,
): DecisionRoute {
  if (confidence >= policy.autoThreshold) {
    return "auto";
  }
  if (confidence >= policy.fallbackThreshold) {
    return "fallback";
  }
  return "review";
}

function applyBinaryBandPolicy<Q extends Questions>(
  policy: BinaryBandPolicy<Q>,
  pTrue: number,
): DecisionRoute {
  if (pTrue <= policy.negativeThreshold || pTrue >= policy.positiveThreshold) {
    return "auto";
  }
  return policy.uncertainRoute;
}

function isConfidenceAnswer(
  value: unknown,
): value is { type: "choice" | "score"; confidence: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const answer = value as { type?: unknown; confidence?: unknown };
  return (
    (answer.type === "choice" || answer.type === "score") && typeof answer.confidence === "number"
  );
}

function isNoulAnswer(value: unknown): value is { type: "noul"; noul: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const answer = value as { type?: unknown; noul?: unknown };
  return answer.type === "noul" && typeof answer.noul === "number";
}

function isDecisionRoute(value: unknown): value is DecisionRoute {
  return value === "auto" || value === "fallback" || value === "review";
}
