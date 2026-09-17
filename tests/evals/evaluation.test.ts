import { describe, expect, it } from "vitest";
import { loadJsonl } from "../../evals/fixtures/jsonl.js";
import type { LoadedDataset } from "../../evals/fixtures/jsonl.js";
import { binaryBandThresholdSweep } from "../../evals/metrics/binary-band.js";
import { binaryBrierScore, multiclassBrierScore } from "../../evals/metrics/brier.js";
import { calibrationMetrics } from "../../evals/metrics/calibration.js";
import { classificationMetrics } from "../../evals/metrics/classification.js";
import { latencyMetrics } from "../../evals/metrics/latency.js";
import { confidenceThresholdSweep, riskCoverageCurve } from "../../evals/metrics/selective.js";
import { costForUsage, costReport } from "../../evals/pricing/schema.js";
import { evaluateCascade } from "../../evals/runners/cascade.js";
import { compareEvaluations } from "../../evals/runners/compare.js";
import { evaluateDataset } from "../../evals/runners/evaluate.js";

const dataset: LoadedDataset<string> = loadJsonl(
  '{"id":"one","state":"one","expected":"yes"}\n\n{"id":"two","state":"two","expected":"no"}\n',
);

describe("offline evaluation harness", () => {
  it("loads blank-line JSONL, rejects duplicate ids, and hashes source bytes", () => {
    expect(dataset.items).toHaveLength(2);
    expect(dataset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(() =>
      loadJsonl('{"id":"x","state":"x","expected":"yes"}\n{"id":"x","state":"x","expected":"no"}'),
    ).toThrow(/Duplicate/);
    expect(() => loadJsonl('{"id":"x","state":true,"expected":"yes"}')).toThrow(/Invalid state/);
    expect(() => loadJsonl('{"id":"x","state":"x"}')).toThrow(/Missing expected/);
  });

  it("calculates classification, calibration, selective, binary, latency, and cost metrics", () => {
    const classification = classificationMetrics([
      { actual: "yes", predicted: "yes" },
      { actual: "yes", predicted: "no" },
      { actual: "no", predicted: "no" },
    ]);
    expect(classification.accuracy).toBeCloseTo(2 / 3);
    expect(classification.perLabel.yes?.recall).toBeCloseTo(0.5);
    expect(classification.confusionMatrix.yes?.no).toBe(1);

    const calibration = calibrationMetrics(
      [
        { confidence: 0, correct: false },
        { confidence: 1, correct: true },
      ],
      2,
    );
    expect(calibration.buckets[0]?.count).toBe(1);
    expect(calibration.buckets[1]?.count).toBe(1);
    expect(calibration.ece).toBe(0);

    const selective = confidenceThresholdSweep(
      [
        { confidence: 0.9, correct: true },
        { confidence: 0.6, correct: false },
      ],
      [0.9, 0.7],
    );
    expect(selective[0]).toMatchObject({ accepted: 1, coverage: 0.5, risk: 0 });
    expect(selective[1]).toMatchObject({ accepted: 1, reviewRate: 0.5 });
    expect(
      riskCoverageCurve([
        { confidence: 0.9, correct: true },
        { confidence: 0.2, correct: false },
      ]).aurc,
    ).toBe(0.25);

    const binary = binaryBandThresholdSweep(
      [
        { probability: 0.02, actual: false },
        { probability: 0.5, actual: true },
        { probability: 0.98, actual: true },
      ],
      [{ negativeThreshold: 0.05, positiveThreshold: 0.95 }],
    );
    expect(binary[0]).toMatchObject({
      autoNegative: 1,
      autoPositive: 1,
      fallback: 1,
      acceptedErrorRate: 0,
    });
    expect(
      binaryBrierScore([
        { probability: 0, actual: false },
        { probability: 1, actual: true },
      ]).score,
    ).toBe(0);
    expect(
      multiclassBrierScore([
        { probabilities: { yes: 1, no: 0 }, actual: "yes" },
        { probabilities: { yes: 0, no: 1 }, actual: "no" },
      ]).score,
    ).toBe(0);

    expect(latencyMetrics([10, 20, 30, 40]).p50Ms).toBe(25);
    expect(latencyMetrics([]).p95Ms).toBeNull();
    expect(
      costForUsage(
        "model",
        { inputTokens: 1_000_000, outputTokens: 500_000 },
        {
          version: "fixture",
          currency: "USD",
          models: { model: { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 4 } },
        },
      ),
    ).toBe(4);
    expect(costReport([{ model: "model" }], undefined).status).toBe("unavailable");
  });

  it("creates a deterministic report, comparison, and uncertain-only cascade", async () => {
    const calls: string[] = [];
    const primary = async (item: (typeof dataset.items)[number]) => {
      calls.push(`primary:${item.id}`);
      return {
        predicted: item.id === "one" ? "yes" : "no",
        confidence: item.id === "one" ? 0.95 : 0.5,
        route: item.id === "one" ? ("auto" as const) : ("fallback" as const),
        model: "primary",
        latencyMs: 3,
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    };
    const fallback = async (item: (typeof dataset.items)[number]) => {
      calls.push(`fallback:${item.id}`);
      return {
        predicted: "yes",
        confidence: 0.99,
        model: "fallback",
        latencyMs: 8,
        usage: { inputTokens: 2, outputTokens: 3 },
      };
    };
    const options = {
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
      thresholds: [0.5, 0.9],
      pricingSnapshot: {
        version: "primary-fixture",
        currency: "USD" as const,
        models: {
          primary: { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
        },
      },
    };
    const report = await evaluateDataset(dataset, primary, options);
    expect(report.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(report.metrics.classification.accuracy).toBe(1);
    expect(report.metrics.retries).toBeNull();
    expect(JSON.stringify(report)).not.toContain("state");

    const comparison = await compareEvaluations(dataset, primary, fallback, {
      primary: options,
      baseline: options,
      clock: options.clock,
    });
    expect(comparison.dataset.hash).toBe(dataset.sha256);

    calls.length = 0;
    const cascade = await evaluateCascade(dataset, primary, fallback, {
      primary: options,
      fallback: {
        ...options,
        pricingSnapshot: {
          version: "fallback-fixture",
          currency: "USD",
          models: {
            fallback: { inputUsdPerMillionTokens: 10, outputUsdPerMillionTokens: 20 },
          },
        },
      },
      clock: options.clock,
    });
    expect(cascade.fallbackRate).toBe(0.5);
    expect(cascade.primaryResolvedRate).toBe(0.5);
    expect(cascade.primaryFailureRate).toBe(0);
    expect(cascade.endToEnd.metrics.classification.accuracy).toBe(0.5);
    expect(cascade.fallbackSelection.parentDatasetHash).toBe(dataset.sha256);
    expect(cascade.fallbackSelection.ids).toEqual(["two"]);
    expect(cascade.fallbackSelection.subsetHash).not.toBe(dataset.sha256);
    expect(cascade.fallback.dataset.hash).toBe(cascade.fallbackSelection.subsetHash);
    expect(cascade.fallback.dataset.hashBasis).toBe("selection-ids");
    expect(cascade.fallback.dataset.parentHash).toBe(dataset.sha256);

    const endToEndTwo = cascade.endToEnd.observations.find(
      (observation) => observation.id === "two",
    );
    expect(endToEndTwo).toMatchObject({
      status: "success",
      latencyMs: 11,
      usage: { inputTokens: 3, outputTokens: 4 },
      cascade: {
        primary: { model: "primary", latencyMs: 3, usage: { inputTokens: 1, outputTokens: 1 } },
        fallback: { model: "fallback", latencyMs: 8, usage: { inputTokens: 2, outputTokens: 3 } },
      },
    });
    expect(cascade.endToEnd.metrics.latency.p50Ms).toBe(7);
    expect(cascade.endToEnd.metrics.latency.p95Ms).toBeCloseTo(10.6);
    expect(cascade.endToEnd.metrics.usage).toEqual({
      requests: 3,
      inputTokens: 4,
      outputTokens: 5,
    });
    expect(cascade.endToEnd.metrics.cost).toMatchObject({
      status: "available",
      snapshotVersion: "primary-fixture+fallback-fixture",
    });
    if (cascade.endToEnd.metrics.cost.status === "available") {
      expect(cascade.endToEnd.metrics.cost.totalUsd).toBeCloseTo(0.000083);
    }
    expect(calls.filter((call) => call === "fallback:two")).toHaveLength(1);
  });

  it("does not count primary failures as resolved cascade rows", async () => {
    const fallbackCalls: string[] = [];
    const cascade = await evaluateCascade(
      dataset,
      async (item) => {
        if (item.id === "one") {
          throw new Error("primary outage");
        }
        return {
          predicted: "no",
          confidence: 0.99,
          route: "auto" as const,
          model: "primary",
          latencyMs: 3,
        };
      },
      async (item) => {
        fallbackCalls.push(item.id);
        return { predicted: "yes", model: "fallback", latencyMs: 8 };
      },
    );

    expect(cascade.primaryResolvedRate).toBe(0.5);
    expect(cascade.primaryFailureRate).toBe(0.5);
    expect(cascade.fallbackRate).toBe(0);
    expect(cascade.endToEnd.metrics.failures).toBe(1);
    expect(fallbackCalls).toEqual([]);
  });

  it("reports successful-only and all-row classification denominators", async () => {
    const report = await evaluateDataset(dataset, async (item) => {
      if (item.id === "two") {
        throw new Error("provider outage");
      }
      return { predicted: "yes", model: "fixture" };
    });

    expect(report.metrics.classification).toMatchObject({
      count: 1,
      correct: 1,
      accuracy: 1,
      totalCount: 2,
      failures: 1,
      successfulAccuracy: 1,
      overallAccuracy: 0.5,
      successRate: 0.5,
    });
  });
});
