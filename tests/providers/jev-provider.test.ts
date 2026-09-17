import { type Questions, choice, noul, score } from "@typesafe-ai/sdk";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { JevProvider } from "../../src/providers/jev-provider.js";
import type { AnswersFor, TypeSafeClientLike } from "../../src/providers/types.js";

const questions = {
  category: choice("What is this ticket about?", {
    billing: null,
    technical: null,
    other: null,
  }),
  quality: score("How clear is the ticket?", ["unclear", "clear", "excellent"] as const),
  grounded: noul("Is the ticket supported by the evidence?"),
} as const;

const answers = {
  category: {
    type: "choice",
    choice: "billing",
    confidence: 0.96,
    probabilities: {
      billing: 0.96,
      technical: 0.03,
      other: 0.01,
    },
  },
  quality: {
    type: "score",
    score: 1.8,
    confidence: 0.88,
    legend: {
      0: "unclear",
      1: "clear",
      2: "excellent",
    },
    probabilities: {
      0: 0.05,
      1: 0.8,
      2: 0.15,
    },
  },
  grounded: {
    type: "noul",
    noul: 0.12,
  },
} satisfies AnswersFor<typeof questions>;

function createClient() {
  const systemOne = vi.fn().mockResolvedValue({
    model: "jev-test",
    answers,
    usage: {
      input_tokens: 21,
      output_tokens: 7,
    },
  });
  return { client: { systemOne } as unknown as TypeSafeClientLike, systemOne };
}

describe("JevProvider", () => {
  it("preserves noul, choice, and score answers with normalized metadata", async () => {
    const { client } = createClient();
    const provider = new JevProvider(client);

    const result = await provider.provide({ state: { ticket: "example" }, questions });

    expect(result.answers).toBe(answers);
    expect(result.answers.category.choice).toBe("billing");
    expect(result.answers.category.confidence).toBe(0.96);
    expect(result.answers.category.probabilities).toEqual({
      billing: 0.96,
      technical: 0.03,
      other: 0.01,
    });
    expect(result.answers.quality.score).toBe(1.8);
    expect(result.answers.quality.legend).toEqual({
      0: "unclear",
      1: "clear",
      2: "excellent",
    });
    expect(result.answers.grounded.noul).toBe(0.12);
    expect(result.model).toBe("jev-test");
    expect(result.usage).toEqual({ inputTokens: 21, outputTokens: 7 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("forwards state, questions, model, signal, and timeout to the SDK", async () => {
    const { client, systemOne } = createClient();
    const provider = new JevProvider(client);
    const signal = new AbortController().signal;
    const state = { ticket: { subject: "Duplicate charge" } };

    await provider.provide({
      state,
      questions,
      model: "jev-custom",
      signal,
      timeout: 10_000,
    });

    expect(systemOne).toHaveBeenCalledTimes(1);
    expect(systemOne).toHaveBeenCalledWith(
      {
        state,
        questions,
        model: "jev-custom",
      },
      { signal, timeout: 10_000 },
    );
  });

  it("forwards no undefined request controls", async () => {
    const { client, systemOne } = createClient();
    const provider = new JevProvider(client);

    await provider.provide({ state: "ticket", questions });

    expect(systemOne).toHaveBeenCalledWith({ state: "ticket", questions });
  });

  it("rejects with the same SDK error", async () => {
    const error = new Error("upstream failure");
    const systemOne = vi.fn().mockRejectedValue(error);
    const provider = new JevProvider({ systemOne } as unknown as TypeSafeClientLike);

    await expect(provider.provide({ state: "ticket", questions })).rejects.toBe(error);
  });

  it.each([
    ["choice", { ...answers, category: { type: "choice", confidence: 1 } }, "choice"],
    ["score", { ...answers, quality: { type: "score", confidence: 1 } }, "score"],
    ["noul", { ...answers, grounded: { type: "noul" } }, "noul"],
  ])("rejects an incomplete %s answer", async (answerType, malformedAnswers, missingField) => {
    const { client, systemOne } = createClient();
    systemOne.mockResolvedValueOnce({
      model: "jev-test",
      answers: malformedAnswers,
      usage: { input_tokens: 21, output_tokens: 7 },
    });
    const provider = new JevProvider(client);

    await expect(provider.provide({ state: "ticket", questions })).rejects.toThrow(missingField);
    expect(answerType).toBe(missingField);
  });

  it("rejects a score legend that disagrees with the question criteria", async () => {
    const { client, systemOne } = createClient();
    systemOne.mockResolvedValueOnce({
      model: "jev-test",
      answers: {
        ...answers,
        quality: {
          ...answers.quality,
          legend: {
            0: "incorrect",
            1: "clear",
            2: "excellent",
          },
        },
      },
      usage: { input_tokens: 21, output_tokens: 7 },
    });
    const provider = new JevProvider(client);

    await expect(provider.provide({ state: "ticket", questions })).rejects.toThrow(
      /response\.answers\.quality\.legend\.0/,
    );
  });

  it("rejects incomplete model and usage metadata", async () => {
    const { client, systemOne } = createClient();
    const provider = new JevProvider(client);

    systemOne.mockResolvedValueOnce({ answers, usage: { input_tokens: 21 } });
    await expect(provider.provide({ state: "ticket", questions })).rejects.toThrow(/model/);

    systemOne.mockResolvedValueOnce({
      model: "jev-test",
      answers,
      usage: { input_tokens: 21 },
    });
    await expect(provider.provide({ state: "ticket", questions })).rejects.toThrow(/output_tokens/);

    systemOne.mockResolvedValueOnce({ model: "jev-test", answers });
    await expect(provider.provide({ state: "ticket", questions })).rejects.toThrow(/usage/);
  });

  it("keeps the answer map typed by the original questions", () => {
    expectTypeOf(answers.category.choice).toEqualTypeOf<"billing">();
    expectTypeOf(answers.quality.legend[2]).toEqualTypeOf<"excellent">();
    expectTypeOf(answers.grounded.noul).toBeNumber();
    expectTypeOf(questions).toExtend<Questions>();
  });
});
