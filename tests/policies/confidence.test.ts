import { choice, score } from "@typesafe-ai/sdk";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineDecision } from "../../src/core/define-decision.js";
import { applyPolicy } from "../../src/policies/apply-policy.js";
import type { AnswersFor } from "../../src/providers/types.js";

const questions = {
  category: choice("What is this?", { billing: null, technical: null }),
  quality: score("How good is this?", ["low", "high"] as const),
} as const;

type DecisionAnswers = AnswersFor<typeof questions>;

function choiceAnswers(confidence: number, qualityConfidence = 0.1): DecisionAnswers {
  return {
    category: {
      type: "choice",
      choice: "billing",
      confidence,
      probabilities: { billing: confidence, technical: 1 - confidence },
    },
    quality: {
      type: "score",
      score: confidence,
      confidence: qualityConfidence,
      legend: { 0: "low", 1: "high" },
      probabilities: { 0: 0.9, 1: 0.1 },
    },
  };
}

const definition = defineDecision({
  id: "support.category",
  version: "1",
  questions,
  policy: {
    kind: "confidence",
    question: "category",
    autoThreshold: 0.9,
    fallbackThreshold: 0.65,
  },
});

describe("confidence policy", () => {
  it("routes exact auto threshold to auto", () => {
    expect(applyPolicy(definition.policy, choiceAnswers(0.9))).toBe("auto");
  });

  it("routes exact fallback threshold to fallback", () => {
    expect(applyPolicy(definition.policy, choiceAnswers(0.65))).toBe("fallback");
  });

  it("routes values immediately below each boundary correctly", () => {
    expect(applyPolicy(definition.policy, choiceAnswers(0.899999))).toBe("fallback");
    expect(applyPolicy(definition.policy, choiceAnswers(0.649999))).toBe("review");
  });

  it("can target a score answer explicitly", () => {
    const scoreDefinition = defineDecision({
      id: "support.quality",
      version: "1",
      questions,
      policy: {
        kind: "confidence",
        question: "quality",
        autoThreshold: 0.8,
        fallbackThreshold: 0.5,
      },
    });

    expect(applyPolicy(scoreDefinition.policy, choiceAnswers(0.1, 0.6))).toBe("fallback");
  });

  it("rejects invalid thresholds, NaN, and Infinity", () => {
    expect(() =>
      defineDecision({
        id: "invalid.order",
        version: "1",
        questions,
        policy: {
          kind: "confidence",
          question: "category",
          autoThreshold: 0.5,
          fallbackThreshold: 0.6,
        },
      }),
    ).toThrow(/fallbackThreshold/);
    expect(() =>
      defineDecision({
        id: "invalid.nan",
        version: "1",
        questions,
        policy: {
          kind: "confidence",
          question: "category",
          autoThreshold: Number.NaN,
          fallbackThreshold: 0.5,
        },
      }),
    ).toThrow(/autoThreshold.*finite/);
    expect(() =>
      defineDecision({
        id: "invalid.infinity",
        version: "1",
        questions,
        policy: {
          kind: "confidence",
          question: "category",
          autoThreshold: Number.POSITIVE_INFINITY,
          fallbackThreshold: 0.5,
        },
      }),
    ).toThrow(/autoThreshold.*finite/);
  });

  it("rejects non-finite or out-of-range provider confidence", () => {
    for (const confidence of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01]) {
      expect(() => applyPolicy(definition.policy, choiceAnswers(confidence))).toThrow(/finite/);
    }
  });

  it("keeps label and score rubric types", () => {
    expectTypeOf(definition.questions.category.criteria).toEqualTypeOf<{
      readonly billing: null;
      readonly technical: null;
    }>();
    expectTypeOf(definition.questions.quality.criteria[1]).toEqualTypeOf<"high">();
    expectTypeOf(definition.policy.kind).toEqualTypeOf<"confidence">();
    expectTypeOf(definition.policy.question).toEqualTypeOf<"category">();
  });
});
