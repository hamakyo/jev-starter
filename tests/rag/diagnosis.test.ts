import { describe, expect, it } from "vitest";
import { diagnoseRag, diagnosisConfidence } from "../../examples/rag-evaluator/src/diagnosis.js";
import { RAG_THRESHOLDS } from "../../examples/rag-evaluator/src/policy.js";
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

  it("keeps the empty-context retrieval miss confidence finite", () => {
    const emptyContextJudgments = judgments({ retrieval: { chunkRelevance: {} } });
    expect(diagnoseRag(emptyContextJudgments, RAG_THRESHOLDS)).toBe("RETRIEVAL_MISS");
    expect(diagnosisConfidence("RETRIEVAL_MISS", emptyContextJudgments)).toBe(1);
  });
});
