import type { Questions } from "@typesafe-ai/sdk";
import {
  assertBinaryBandThresholds,
  assertConfidenceThresholds,
} from "../policies/apply-policy.js";
import type { DecisionPolicy } from "../policies/types.js";
import type { DecisionDefinition, DecisionDefinitionInput } from "./types.js";

/** Define and validate a versioned typed decision contract. */
export function defineDecision<
  const Q extends Questions,
  const P extends DecisionPolicy<Q> = DecisionPolicy<Q>,
>(definition: DecisionDefinitionInput<Q, P>): DecisionDefinition<Q, P> {
  validateDecisionDefinition(definition);
  return definition;
}

/** Validate a decision contract's identity, policy thresholds, and selector. */
export function validateDecisionDefinition<Q extends Questions>(
  definition: DecisionDefinitionInput<Q>,
): void {
  if (typeof definition.id !== "string" || definition.id.trim().length === 0) {
    throw new TypeError("Decision id must be a non-empty string");
  }
  if (typeof definition.version !== "string" || definition.version.trim().length === 0) {
    throw new TypeError("Decision version must be a non-empty string");
  }
  if (typeof definition.questions !== "object" || definition.questions === null) {
    throw new TypeError("Decision questions must be an object");
  }
  if (typeof definition.policy !== "object" || definition.policy === null) {
    throw new TypeError("Decision policy must be an object");
  }

  switch (definition.policy.kind) {
    case "confidence": {
      assertConfidenceThresholds(definition.policy);
      const question = getQuestion(definition.questions, definition.policy.question);
      if (question === undefined) {
        throw new TypeError(
          `Policy question "${String(definition.policy.question)}" does not exist`,
        );
      }
      if (question.type !== "choice" && question.type !== "score") {
        throw new TypeError(
          `Confidence policy question "${String(definition.policy.question)}" must be a choice or score question`,
        );
      }
      break;
    }
    case "binary-band": {
      assertBinaryBandThresholds(definition.policy);
      const question = getQuestion(definition.questions, definition.policy.question);
      if (question === undefined) {
        throw new TypeError(
          `Policy question "${String(definition.policy.question)}" does not exist`,
        );
      }
      if (question.type !== "noul") {
        throw new TypeError(
          `Binary-band policy question "${String(definition.policy.question)}" must be a noul question`,
        );
      }
      if (
        definition.policy.uncertainRoute !== "fallback" &&
        definition.policy.uncertainRoute !== "review"
      ) {
        throw new TypeError('Binary-band uncertainRoute must be "fallback" or "review"');
      }
      break;
    }
    case "custom":
      if (typeof definition.policy.decide !== "function") {
        throw new TypeError("Custom policy decide must be a function");
      }
      break;
    default:
      throw new TypeError("Unknown decision policy kind");
  }
}

function getQuestion<Q extends Questions>(questions: Q, name: string) {
  return questions[name];
}
