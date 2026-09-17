import { noul } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { defineDecision } from "../../src/core/define-decision.js";
import { applyPolicy } from "../../src/policies/apply-policy.js";
import type { AnswersFor } from "../../src/providers/types.js";

const questions = {
  grounded: noul("Is the answer grounded?"),
} as const;

const definition = defineDecision({
  id: "rag.grounded",
  version: "1",
  questions,
  policy: {
    kind: "binary-band",
    question: "grounded",
    negativeThreshold: 0.05,
    positiveThreshold: 0.95,
    uncertainRoute: "fallback",
  },
});

function answers(pTrue: number): AnswersFor<typeof questions> {
  return { grounded: { type: "noul", noul: pTrue } };
}

describe("binary-band policy", () => {
  it("routes the exact negative boundary to auto", () => {
    expect(applyPolicy(definition.policy, answers(0.05))).toBe("auto");
  });

  it("routes the exact positive boundary to auto", () => {
    expect(applyPolicy(definition.policy, answers(0.95))).toBe("auto");
  });

  it("routes the middle band to the configured fallback", () => {
    expect(applyPolicy(definition.policy, answers(0.5))).toBe("fallback");
  });

  it("supports review as the uncertain route", () => {
    const reviewDefinition = defineDecision({
      id: "rag.grounded.review",
      version: "1",
      questions,
      policy: {
        kind: "binary-band",
        question: "grounded",
        negativeThreshold: 0.05,
        positiveThreshold: 0.95,
        uncertainRoute: "review",
      },
    });
    expect(applyPolicy(reviewDefinition.policy, answers(0.5))).toBe("review");
  });

  it("rejects invalid ordering, non-finite thresholds, and probabilities", () => {
    expect(() =>
      defineDecision({
        id: "invalid.order",
        version: "1",
        questions,
        policy: {
          kind: "binary-band",
          question: "grounded",
          negativeThreshold: 0.5,
          positiveThreshold: 0.5,
          uncertainRoute: "fallback",
        },
      }),
    ).toThrow(/negativeThreshold/);
    expect(() =>
      defineDecision({
        id: "invalid.nan",
        version: "1",
        questions,
        policy: {
          kind: "binary-band",
          question: "grounded",
          negativeThreshold: Number.NaN,
          positiveThreshold: 0.95,
          uncertainRoute: "fallback",
        },
      }),
    ).toThrow(/negativeThreshold.*finite/);
    expect(() => applyPolicy(definition.policy, answers(Number.NaN))).toThrow(/finite/);
    expect(() => applyPolicy(definition.policy, answers(Number.POSITIVE_INFINITY))).toThrow(
      /finite/,
    );
    expect(() => applyPolicy(definition.policy, answers(-0.1))).toThrow(/finite/);
    expect(() => applyPolicy(definition.policy, answers(1.1))).toThrow(/finite/);
  });
});
