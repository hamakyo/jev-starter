import { describe, expect, it } from "vitest";
import { diagnoseRag, diagnosisConfidence } from "../../examples/rag-evaluator/src/diagnosis.js";
import { RAG_POLICY_METADATA, RAG_THRESHOLDS } from "../../examples/rag-evaluator/src/policy.js";
import type { RagJudgments } from "../../examples/rag-evaluator/src/types.js";

function judgments(
  overrides: {
    retrieval?: Partial<RagJudgments["retrieval"]>;
    generation?: Partial<RagJudgments["generation"]>;
  } = {},
): RagJudgments {
  return {
    retrieval: {
      chunkRelevance: { c1: 0.9, c2: 0.8 },
      sufficiency: 0.9,
      conflict: 0.05,
      ...overrides.retrieval,
    },
    generation: {
      relevance: 0.9,
      groundedness: 0.9,
      contradiction: 0.05,
      correctness: 0.9,
      ...overrides.generation,
    },
  };
}

describe("RAG diagnosis policy", () => {
  it("keeps the documented failure precedence", () => {
    expect(diagnoseRag(judgments({ retrieval: { conflict: 0.9 } }), RAG_THRESHOLDS)).toBe(
      "CONFLICTING_EVIDENCE",
    );
    expect(
      diagnoseRag(
        judgments({ retrieval: { conflict: 0.05, chunkRelevance: { c1: 0.05, c2: 0.1 } } }),
        RAG_THRESHOLDS,
      ),
    ).toBe("RETRIEVAL_MISS");
    expect(diagnoseRag(judgments({ retrieval: { sufficiency: 0.1 } }), RAG_THRESHOLDS)).toBe(
      "RETRIEVAL_INSUFFICIENT",
    );
    expect(diagnoseRag(judgments({ generation: { groundedness: 0.1 } }), RAG_THRESHOLDS)).toBe(
      "GENERATOR_UNGROUNDED",
    );
    expect(diagnoseRag(judgments({ generation: { correctness: 0.1 } }), RAG_THRESHOLDS)).toBe(
      "ANSWER_INCORRECT",
    );
  });

  it("distinguishes uncertain signals from a passing set", () => {
    expect(
      diagnoseRag(
        judgments({
          retrieval: { sufficiency: 0.5, conflict: 0.3 },
          generation: { groundedness: 0.6, contradiction: 0.3, correctness: 0.6 },
        }),
        RAG_THRESHOLDS,
      ),
    ).toBe("JUDGE_UNCERTAIN");
    expect(diagnoseRag(judgments(), RAG_THRESHOLDS)).toBe("PASS");
  });

  it("diagnoses answer irrelevance below and at the fail threshold", () => {
    const below = judgments({
      generation: { relevance: RAG_THRESHOLDS.failThreshold - 0.01 },
    });
    expect(diagnoseRag(below, RAG_THRESHOLDS)).toBe("ANSWER_IRRELEVANT");
    expect(diagnosisConfidence("ANSWER_IRRELEVANT", below)).toBeCloseTo(
      1 - below.generation.relevance,
    );

    const atBoundary = judgments({
      generation: { relevance: RAG_THRESHOLDS.failThreshold },
    });
    expect(diagnoseRag(atBoundary, RAG_THRESHOLDS)).toBe("ANSWER_IRRELEVANT");
    expect(diagnosisConfidence("ANSWER_IRRELEVANT", atBoundary)).toBeCloseTo(
      1 - RAG_THRESHOLDS.failThreshold,
    );
  });

  it("keeps the relevance uncertainty band open and passes at the pass threshold", () => {
    const middle = (RAG_THRESHOLDS.failThreshold + RAG_THRESHOLDS.passThreshold) / 2;
    expect(diagnoseRag(judgments({ generation: { relevance: middle } }), RAG_THRESHOLDS)).toBe(
      "JUDGE_UNCERTAIN",
    );
    expect(
      diagnoseRag(
        judgments({ generation: { relevance: RAG_THRESHOLDS.passThreshold } }),
        RAG_THRESHOLDS,
      ),
    ).toBe("PASS");
  });

  it("keeps retrieval diagnoses ahead of low answer relevance", () => {
    const lowRelevance = { relevance: RAG_THRESHOLDS.failThreshold };
    expect(
      diagnoseRag(
        judgments({
          retrieval: { conflict: RAG_THRESHOLDS.passThreshold },
          generation: lowRelevance,
        }),
        RAG_THRESHOLDS,
      ),
    ).toBe("CONFLICTING_EVIDENCE");
    expect(
      diagnoseRag(
        judgments({
          retrieval: {
            chunkRelevance: { c1: RAG_THRESHOLDS.failThreshold, c2: 0.1 },
          },
          generation: lowRelevance,
        }),
        RAG_THRESHOLDS,
      ),
    ).toBe("RETRIEVAL_MISS");
    expect(
      diagnoseRag(
        judgments({
          retrieval: { sufficiency: RAG_THRESHOLDS.failThreshold },
          generation: lowRelevance,
        }),
        RAG_THRESHOLDS,
      ),
    ).toBe("RETRIEVAL_INSUFFICIENT");
  });

  it("prioritizes low relevance over later generation diagnoses", () => {
    expect(
      diagnoseRag(
        judgments({
          generation: {
            relevance: RAG_THRESHOLDS.failThreshold,
            groundedness: RAG_THRESHOLDS.failThreshold,
            contradiction: RAG_THRESHOLDS.passThreshold,
            correctness: RAG_THRESHOLDS.failThreshold,
          },
        }),
        RAG_THRESHOLDS,
      ),
    ).toBe("ANSWER_IRRELEVANT");
  });

  it("keeps policy metadata aligned with executable precedence", () => {
    expect(RAG_POLICY_METADATA.diagnosisPrecedence).toEqual([
      "CONFLICTING_EVIDENCE",
      "RETRIEVAL_MISS",
      "RETRIEVAL_INSUFFICIENT",
      "ANSWER_IRRELEVANT",
      "GENERATOR_UNGROUNDED",
      "ANSWER_INCORRECT",
      "JUDGE_UNCERTAIN",
      "PASS",
    ]);
  });

  it("keeps the empty-context retrieval miss confidence finite", () => {
    const emptyContextJudgments = judgments({ retrieval: { chunkRelevance: {} } });
    expect(diagnoseRag(emptyContextJudgments, RAG_THRESHOLDS)).toBe("RETRIEVAL_MISS");
    expect(diagnosisConfidence("RETRIEVAL_MISS", emptyContextJudgments)).toBe(1);
  });
});
