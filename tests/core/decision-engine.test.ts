import { choice, noul } from "@typesafe-ai/sdk";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { DecisionEngine } from "../../src/core/decision-engine.js";
import { defineDecision } from "../../src/core/define-decision.js";
import { JevProvider } from "../../src/providers/jev-provider.js";
import type { AnswersFor, Provider, TypeSafeClientLike } from "../../src/providers/types.js";

const questions = {
  category: choice("What is this?", { billing: null, technical: null }),
  grounded: noul("Is this grounded?"),
} as const;

const answers = {
  category: {
    type: "choice",
    choice: "billing",
    confidence: 0.95,
    probabilities: { billing: 0.95, technical: 0.05 },
  },
  grounded: { type: "noul", noul: 0.2 },
} satisfies AnswersFor<typeof questions>;

function providerFor(result = answers): { provider: Provider; provide: ReturnType<typeof vi.fn> } {
  const provide = vi.fn().mockResolvedValue({
    answers: result,
    model: "jev-test",
    latencyMs: 14,
    usage: { inputTokens: 10, outputTokens: 4 },
  });
  return { provider: { provide } as unknown as Provider, provide };
}

describe("DecisionEngine", () => {
  it("returns route, complete answers, and provider metadata", async () => {
    const { provider, provide } = providerFor();
    const engine = new DecisionEngine(provider);
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
    const state = { ticket: { subject: "Duplicate charge" } };
    const signal = new AbortController().signal;

    const outcome = await engine.decide(definition, state, {
      model: "jev-custom",
      signal,
      timeout: 10_000,
    });

    expect(outcome).toEqual({
      decisionId: "support.category",
      decisionVersion: "1",
      route: "auto",
      answers,
      model: "jev-test",
      latencyMs: 14,
      usage: { inputTokens: 10, outputTokens: 4 },
    });
    expect(provide).toHaveBeenCalledWith({
      state,
      questions,
      model: "jev-custom",
      signal,
      timeout: 10_000,
    });
    expectTypeOf(outcome.answers.category.choice).toEqualTypeOf<"billing" | "technical">();
    expectTypeOf(outcome.answers.grounded.noul).toBeNumber();
  });

  it("lets a built-in policy inspect only its named question", async () => {
    const { provider } = providerFor();
    const engine = new DecisionEngine(provider);
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

    await expect(engine.decide(definition, "ticket")).resolves.toMatchObject({ route: "auto" });
  });

  it("passes all answers to a custom policy", async () => {
    const { provider } = providerFor();
    const decide = vi.fn((received: AnswersFor<typeof questions>) => {
      expect(received).toBe(answers);
      return received.grounded.noul < 0.5 ? "fallback" : "auto";
    });
    const definition = defineDecision({
      id: "support.combined",
      version: "1",
      questions,
      policy: { kind: "custom", decide },
    });

    await expect(new DecisionEngine(provider).decide(definition, "ticket")).resolves.toMatchObject({
      route: "fallback",
    });
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("rejects provider failures without creating an outcome or applying policy", async () => {
    const error = new Error("provider unavailable");
    const provide = vi.fn().mockRejectedValue(error);
    const policy = vi.fn(() => "auto" as const);
    const definition = defineDecision({
      id: "support.failure",
      version: "1",
      questions,
      policy: { kind: "custom", decide: policy },
    });

    await expect(
      new DecisionEngine({ provide } as unknown as Provider).decide(definition, "ticket"),
    ).rejects.toBe(error);
    expect(policy).not.toHaveBeenCalled();
  });

  it("rejects a malformed SDK answer before running policy", async () => {
    const policy = vi.fn(() => "auto" as const);
    const systemOne = vi.fn().mockResolvedValue({
      model: "jev-test",
      answers: {
        category: { type: "choice", confidence: 1 },
        grounded: answers.grounded,
      },
      usage: { input_tokens: 10, output_tokens: 4 },
    });
    const definition = defineDecision({
      id: "support.malformed",
      version: "1",
      questions,
      policy: { kind: "custom", decide: policy },
    });

    await expect(
      new DecisionEngine(new JevProvider({ systemOne } as unknown as TypeSafeClientLike)).decide(
        definition,
        "ticket",
      ),
    ).rejects.toThrow(/response.answers.category/);
    expect(policy).not.toHaveBeenCalled();
  });
});
