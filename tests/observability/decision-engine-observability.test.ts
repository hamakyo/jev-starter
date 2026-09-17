import { choice } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  DecisionEngine,
  MockProvider,
  createChoiceAnswer,
  createProviderResult,
  defineDecision,
} from "../../src/index.js";
import type { DecisionEvent } from "../../src/index.js";
import type { AnswersFor } from "../../src/providers/types.js";

const questions = {
  category: choice("Category?", { billing: null, technical: null }),
} as const;

const answers: AnswersFor<typeof questions> = {
  category: createChoiceAnswer<typeof questions.category.criteria>({
    choice: "billing",
    confidence: 0.96,
    probabilities: { billing: 0.96, technical: 0.04 },
  }),
};

const definition = defineDecision({
  id: "test.observability",
  version: "1",
  questions,
  policy: {
    kind: "confidence",
    question: "category",
    autoThreshold: 0.9,
    fallbackThreshold: 0.6,
  },
});

function providerWithAnswers() {
  return new MockProvider<typeof questions>({
    result: createProviderResult<typeof questions>(answers, {
      model: "mock-observe",
      latencyMs: 4,
      usage: { inputTokens: 5, outputTokens: 2 },
    }),
  });
}

describe("DecisionEngine observability", () => {
  it("emits a success event with probabilities but no raw state", async () => {
    const events: DecisionEvent[] = [];
    const secret = "do-not-log-this-state";
    const outcome = await new DecisionEngine(providerWithAnswers(), {
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
      observer: (event) => {
        events.push(event);
      },
    }).decide(definition, { secret });

    expect(outcome.route).toBe("auto");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "success",
      decisionId: definition.id,
      decisionVersion: definition.version,
      provider: "MockProvider",
      model: "mock-observe",
      route: "auto",
      signals: [
        {
          question: "category",
          type: "choice",
          confidence: 0.96,
          probabilities: { billing: 0.96, technical: 0.04 },
        },
      ],
    });
    expect(JSON.stringify(events)).not.toContain(secret);
  });

  it("classifies primary failure and records a successful operational fallback", async () => {
    const outage = new Error("upstream outage");
    outage.name = "APIConnectionError";
    const events: DecisionEvent[] = [];
    const engine = new DecisionEngine(
      new MockProvider<typeof questions>({ script: [{ error: outage }] }),
      {
        observer: (event) => {
          events.push(event);
        },
        operationalFallback: {
          provider: providerWithAnswers(),
          providerName: "fallback-fixture",
        },
      },
    );

    const outcome = await engine.decide(definition, "state");

    expect(outcome.model).toBe("mock-observe");
    expect(events.map((event) => event.type)).toEqual(["provider-failure", "operational-fallback"]);
    expect(events[0]).toMatchObject({
      type: "provider-failure",
      errorCategory: "provider-outage",
      errorName: "APIConnectionError",
    });
    expect(events[1]).toMatchObject({
      type: "operational-fallback",
      status: "succeeded",
      primaryErrorCategory: "provider-outage",
      fallbackProvider: "fallback-fixture",
      route: "auto",
    });
  });

  it("emits a failed operational fallback and rejects when the fallback fails", async () => {
    const primaryError = new Error("primary unavailable");
    primaryError.name = "APIConnectionError";
    const fallbackError = new Error("fallback unavailable");
    fallbackError.name = "APIConnectionError";
    const events: DecisionEvent[] = [];
    const engine = new DecisionEngine(
      new MockProvider<typeof questions>({ script: [{ error: primaryError }] }),
      {
        observer: (event) => {
          events.push(event);
        },
        operationalFallback: {
          provider: new MockProvider<typeof questions>({ script: [{ error: fallbackError }] }),
        },
      },
    );

    await expect(engine.decide(definition, "state")).rejects.toBe(fallbackError);
    expect(events[1]).toMatchObject({
      type: "operational-fallback",
      status: "failed",
      fallbackErrorCategory: "provider-outage",
    });
  });

  it("ignores observer failures by default and can opt into throwing them", async () => {
    const ignored = await new DecisionEngine(providerWithAnswers(), {
      observer: () => {
        throw new Error("telemetry failed");
      },
    }).decide(definition, "state");
    expect(ignored.route).toBe("auto");

    await expect(
      new DecisionEngine(providerWithAnswers(), {
        observerError: "throw",
        observer: () => {
          throw new Error("telemetry failed");
        },
      }).decide(definition, "state"),
    ).rejects.toThrow("telemetry failed");
  });
});
