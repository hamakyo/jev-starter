import { choice, noul, score } from "@typesafe-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  MockProvider,
  MockProviderScenarioNotFoundError,
  MockProviderScriptExhaustedError,
  MockProviderTimeoutError,
  createChoiceAnswer,
  createNoulAnswer,
  createProviderResult,
  createScoreAnswer,
} from "../../src/index.js";
import type { AnswersFor } from "../../src/providers/types.js";

const questions = {
  category: choice("Category?", { billing: null, technical: null }),
  quality: score("Quality?", ["low", "high"] as const),
  grounded: noul("Grounded?"),
} as const;

const answers: AnswersFor<typeof questions> = {
  category: createChoiceAnswer<typeof questions.category.criteria>({
    choice: "billing",
    confidence: 0.95,
    probabilities: { billing: 0.95, technical: 0.05 },
  }),
  quality: createScoreAnswer<typeof questions.quality.criteria>({
    score: 0.8,
    confidence: 0.9,
    legend: { 0: "low", 1: "high" },
    probabilities: { 0: 0.8, 1: 0.2 },
  }),
  grounded: createNoulAnswer(0.9),
};

function result(latencyMs = 3) {
  return createProviderResult<typeof questions>(answers, {
    model: "mock-test",
    latencyMs,
    usage: { inputTokens: 4, outputTokens: 2 },
  });
}

describe("MockProvider", () => {
  it("returns a typed canned result and records its calls", async () => {
    const canned = result();
    const provider = new MockProvider<typeof questions>({ result: canned });

    await expect(provider.provide({ state: "fixture", questions })).resolves.toBe(canned);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.request.state).toBe("fixture");
    expect(provider.getCallHistory()).toBe(provider.calls);
  });

  it("resolves scenarios by fixture id and supports a scripted sequence", async () => {
    const scenarioResult = result(5);
    const scenarioProvider = new MockProvider<typeof questions>({
      scenarios: { "fixture-1": scenarioResult },
    });
    await expect(
      scenarioProvider.provide({ state: { fixtureId: "fixture-1" }, questions }),
    ).resolves.toBe(scenarioResult);

    const first = result(1);
    const second = result(2);
    const scripted = new MockProvider<typeof questions>({ script: [first, second] });
    await expect(scripted.provide({ state: "one", questions })).resolves.toBe(first);
    await expect(scripted.provide({ state: "two", questions })).resolves.toBe(second);
    await expect(scripted.provide({ state: "three", questions })).rejects.toBeInstanceOf(
      MockProviderScriptExhaustedError,
    );
  });

  it("injects provider errors, timeout, and abort without changing them into results", async () => {
    const injected = new Error("injected outage");
    const errorProvider = new MockProvider<typeof questions>({ script: [{ error: injected }] });
    await expect(errorProvider.provide({ state: "fixture", questions })).rejects.toBe(injected);

    vi.useFakeTimers();
    try {
      const timeoutProvider = new MockProvider<typeof questions>({ result: result(), delayMs: 20 });
      const timedOut = timeoutProvider.provide({ state: "fixture", questions, timeout: 5 });
      const timedOutExpectation = expect(timedOut).rejects.toBeInstanceOf(MockProviderTimeoutError);
      await vi.advanceTimersByTimeAsync(5);
      await timedOutExpectation;

      const controller = new AbortController();
      const aborted = timeoutProvider.provide({
        state: "fixture",
        questions,
        signal: controller.signal,
      });
      const abortedExpectation = expect(aborted).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      await abortedExpectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("validates mock answers against the requested questions", async () => {
    const malformed = createProviderResult<typeof questions>({
      ...answers,
      quality: {
        type: "score",
        score: 1,
        confidence: 1,
        legend: { 0: "wrong", 1: "high" },
        probabilities: { 0: 1, 1: 0 },
      },
    } as unknown as AnswersFor<typeof questions>);
    const provider = new MockProvider<typeof questions>({ result: malformed });

    await expect(provider.provide({ state: "fixture", questions })).rejects.toThrow(
      /providerResult\.answers\.quality\.legend\.0/,
    );
  });

  it("reports missing scenarios clearly", async () => {
    const provider = new MockProvider<typeof questions>({ scenarios: { known: result() } });
    await expect(
      provider.provide({ state: { fixtureId: "unknown" }, questions }),
    ).rejects.toBeInstanceOf(MockProviderScenarioNotFoundError);
  });
});
