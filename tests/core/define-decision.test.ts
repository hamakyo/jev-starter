import { choice, noul } from "@typesafe-ai/sdk";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineDecision } from "../../src/core/define-decision.js";
import type { ConfidenceQuestionKey, NoulQuestionKey } from "../../src/policies/types.js";

const choiceQuestions = {
  category: choice("What is this?", { billing: null, technical: null }),
} as const;
const noulQuestions = {
  grounded: noul("Is this grounded?"),
} as const;
const mixedQuestions = {
  category: choice("What is this?", { billing: null, technical: null }),
  grounded: noul("Is this grounded?"),
} as const;

describe("defineDecision", () => {
  it("returns a versioned definition without runtime state", () => {
    const definition = defineDecision({
      id: "support.category",
      version: "1",
      questions: choiceQuestions,
      policy: {
        kind: "confidence",
        question: "category",
        autoThreshold: 0.9,
        fallbackThreshold: 0.65,
      },
    });

    expect(definition).toMatchObject({
      id: "support.category",
      version: "1",
      questions: choiceQuestions,
    });
    expect(definition).not.toHaveProperty("state");
  });

  it("fails fast for empty identity fields", () => {
    const validPolicy = {
      kind: "confidence" as const,
      question: "category" as const,
      autoThreshold: 0.9,
      fallbackThreshold: 0.65,
    };

    expect(() =>
      defineDecision({ id: "", version: "1", questions: choiceQuestions, policy: validPolicy }),
    ).toThrow(/id/);
    expect(() =>
      defineDecision({ id: "   ", version: "1", questions: choiceQuestions, policy: validPolicy }),
    ).toThrow(/id/);
    expect(() =>
      defineDecision({
        id: "support.category",
        version: "",
        questions: choiceQuestions,
        policy: validPolicy,
      }),
    ).toThrow(/version/);
  });

  it("fails fast when a built-in policy selects a missing or mismatched question", () => {
    expect(() =>
      defineDecision({
        id: "missing.question",
        version: "1",
        questions: choiceQuestions,
        policy: {
          kind: "confidence",
          question: "missing" as "category",
          autoThreshold: 0.9,
          fallbackThreshold: 0.65,
        },
      }),
    ).toThrow(/does not exist/);

    expect(() =>
      defineDecision({
        id: "wrong.kind",
        version: "1",
        questions: noulQuestions,
        policy: {
          kind: "confidence",
          question: "grounded" as never,
          autoThreshold: 0.9,
          fallbackThreshold: 0.65,
        },
      }),
    ).toThrow(/choice or score/);

    expect(() =>
      defineDecision({
        id: "wrong.kind",
        version: "1",
        questions: choiceQuestions,
        policy: {
          kind: "binary-band",
          question: "category" as never,
          negativeThreshold: 0.05,
          positiveThreshold: 0.95,
          uncertainRoute: "fallback",
        },
      }),
    ).toThrow(/noul/);
  });

  it("restricts built-in selectors by question kind and types custom answers", () => {
    expectTypeOf<ConfidenceQuestionKey<typeof mixedQuestions>>().toEqualTypeOf<"category">();
    expectTypeOf<NoulQuestionKey<typeof mixedQuestions>>().toEqualTypeOf<"grounded">();

    const definition = defineDecision({
      id: "support.combined",
      version: "1",
      questions: mixedQuestions,
      policy: {
        kind: "custom",
        decide(answers) {
          const category: "billing" | "technical" = answers.category.choice;
          const probability: number = answers.grounded.noul;
          return category === "billing" && probability > 0.5 ? "auto" : "review";
        },
      },
    });

    expect(definition.policy.kind).toBe("custom");
  });

  it("rejects mismatched built-in selectors at compile time", () => {
    const compileTimeAssertions = (): void => {
      defineDecision({
        id: "invalid.confidence-selector",
        version: "1",
        questions: noulQuestions,
        policy: {
          kind: "confidence",
          // @ts-expect-error A confidence policy cannot select a noul question.
          question: "grounded",
          autoThreshold: 0.9,
          fallbackThreshold: 0.65,
        },
      });
      defineDecision({
        id: "invalid.binary-selector",
        version: "1",
        questions: choiceQuestions,
        policy: {
          kind: "binary-band",
          // @ts-expect-error A binary-band policy cannot select a choice question.
          question: "category",
          negativeThreshold: 0.05,
          positiveThreshold: 0.95,
          uncertainRoute: "fallback",
        },
      });
    };

    expect(compileTimeAssertions).toBeTypeOf("function");
  });
});
