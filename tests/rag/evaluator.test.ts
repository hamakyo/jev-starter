import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadJsonl, loadJsonlFile } from "../../evals/fixtures/jsonl.js";
import {
  createRagProvider,
  evaluateRagOffline,
  ragDecisionWithReference,
  ragDecisionWithoutReference,
} from "../../examples/rag-evaluator/src/modes.js";
import { asRagState } from "../../examples/rag-evaluator/src/types.js";
import type { RagExpected } from "../../examples/rag-evaluator/src/types.js";
import { DecisionEngine } from "../../src/index.js";

const dataset = loadJsonlFile<RagExpected>(
  resolve(
    fileURLToPath(new URL("../../examples/rag-evaluator/evals/dataset.jsonl", import.meta.url)),
  ),
);

describe("RAG evaluator showcase", () => {
  it("omits reference-dependent correctness for reference-free rows", async () => {
    const provider = createRagProvider();
    const engine = new DecisionEngine(provider);
    const noReference = dataset.items.find((item) => item.id === "rag-008");
    const withReference = dataset.items.find((item) => item.id === "rag-001");

    if (noReference === undefined || withReference === undefined) {
      throw new Error("RAG fixture rows used by the test are missing");
    }

    const noReferenceOutcome = await engine.decide(ragDecisionWithoutReference, noReference.state);
    const referenceOutcome = await engine.decide(ragDecisionWithReference, withReference.state);
    const calls = provider.getCallHistory();

    expect(ragDecisionWithReference.id).not.toBe(ragDecisionWithoutReference.id);
    expect(Object.keys(calls[0]?.request.questions ?? {})).not.toContain("correctness");
    expect(Object.keys(calls[1]?.request.questions ?? {})).toContain("correctness");
    expect(Object.keys(noReferenceOutcome.answers)).not.toContain("correctness");
    expect(Object.keys(referenceOutcome.answers)).toContain("correctness");
  });

  it("reports final diagnosis and every available retrieval/generation component metric", async () => {
    const reports = await evaluateRagOffline(dataset);
    const jev = reports.jevOnly;
    const retrieval = jev.componentMetrics.retrieval;
    const generation = jev.componentMetrics.generation;

    expect(jev.dataset.count).toBe(8);
    expect(jev.metadata.decisionVariant).toBe("mixed");
    expect(jev.metrics.classification.overallAccuracy).toBe(1);
    expect(jev.metrics.classification.successfulAccuracy).toBe(1);
    expect(retrieval).toEqual(
      expect.objectContaining({
        "chunkRelevance.c1": expect.any(Object),
        "chunkRelevance.c2": expect.any(Object),
        contextSufficiency: expect.any(Object),
        contextConflict: expect.any(Object),
      }),
    );
    expect(generation).toEqual(
      expect.objectContaining({
        answerRelevance: expect.any(Object),
        groundedness: expect.any(Object),
        contradiction: expect.any(Object),
        correctness: expect.any(Object),
      }),
    );
    expect(generation.correctness?.count).toBe(7);

    for (const metric of [...Object.values(retrieval), ...Object.values(generation)]) {
      expect(metric.count).toBeGreaterThan(0);
      expect(metric.accuracy).toBe(1);
      expect(Number.isFinite(metric.brier.score)).toBe(true);
      expect(Number.isFinite(metric.calibration.ece)).toBe(true);
    }

    const noReferenceObservation = jev.observations.find(
      (observation) => observation.id === "rag-008",
    );
    expect(noReferenceObservation?.route).toBe("auto");
    expect(noReferenceObservation?.metadata?.judgments).toMatchObject({
      generation: {
        relevance: 0.95,
        groundedness: 0.94,
        contradiction: 0.02,
      },
    });
    expect(
      (
        noReferenceObservation?.metadata?.judgments as {
          generation?: { correctness?: unknown };
        }
      )?.generation?.correctness,
    ).toBeUndefined();
    expect(noReferenceObservation?.metadata).toMatchObject({
      decisionId: "example.rag-evaluator.without-reference",
      decisionVersion: "1",
      decisionVariant: "without-reference",
    });
    expect(
      jev.observations.find((observation) => observation.id === "rag-001")?.metadata,
    ).toMatchObject({
      decisionId: "example.rag-evaluator.with-reference",
      decisionVersion: "1",
      decisionVariant: "with-reference",
    });
  });

  it("retains combined cascade legs and prices both models", async () => {
    const reports = await evaluateRagOffline(dataset);
    const fallbackObservation = reports.cascade.endToEnd.observations.find(
      (observation) => observation.id === "rag-006",
    );

    expect(reports.cascade.fallbackSelection.ids).toEqual(["rag-006"]);
    expect(reports.cascade.fallbackSelection.subsetHash).not.toBe(dataset.sha256);
    expect(fallbackObservation).toMatchObject({
      status: "success",
      latencyMs: 39,
      usage: { inputTokens: 96, outputTokens: 18 },
      cascade: {
        primary: { model: "mock-rag", latencyMs: 15 },
        fallback: { model: "deterministic-baseline", latencyMs: 24 },
      },
    });
    expect(reports.cascade.endToEnd.metrics.usage).toEqual({
      requests: 9,
      inputTokens: 404,
      outputTokens: 74,
    });
    expect(reports.cascade.endToEnd.metrics.cost).toMatchObject({ status: "available" });
    if (reports.cascade.endToEnd.metrics.cost.status === "available") {
      expect(reports.cascade.endToEnd.metrics.cost.totalUsd).toBeCloseTo(0.000552);
    }
    expect(reports.baseline.componentMetrics).toBeUndefined();
    expect(reports.cascade.fallback.componentMetrics).toBeUndefined();
    expect(reports.cascade.endToEnd.componentMetrics).toBeUndefined();
  });

  it("derives report-level variant and contract identity from dataset contents", async () => {
    const withReference = await evaluateRagOffline(
      selectDataset((item) => asRagState(item.state).referenceAnswer !== undefined),
    );
    const withoutReference = await evaluateRagOffline(
      selectDataset((item) => asRagState(item.state).referenceAnswer === undefined),
    );
    const mixed = await evaluateRagOffline(dataset);

    expect(withReference.jevOnly.metadata).toMatchObject({
      decisionVariant: "with-reference",
      decisionId: "example.rag-evaluator.with-reference",
      decisionVersion: "1",
    });
    expect(withoutReference.jevOnly.metadata).toMatchObject({
      decisionVariant: "without-reference",
      decisionId: "example.rag-evaluator.without-reference",
      decisionVersion: "1",
    });
    expect(mixed.jevOnly.metadata).toEqual(expect.objectContaining({ decisionVariant: "mixed" }));
    expect(mixed.jevOnly.metadata.decisionId).toBeUndefined();
    expect(mixed.jevOnly.metadata.decisionVersion).toBeUndefined();
  });
});

function selectDataset(
  predicate: (item: (typeof dataset.items)[number]) => boolean,
): typeof dataset {
  return loadJsonl<RagExpected>(
    dataset.items
      .filter(predicate)
      .map((item) => JSON.stringify({ id: item.id, state: item.state, expected: item.expected }))
      .join("\n"),
  );
}
