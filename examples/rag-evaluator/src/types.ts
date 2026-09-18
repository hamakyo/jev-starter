import type { EntryType } from "@typesafe-ai/sdk";

export const RAG_DIAGNOSES = [
  "PASS",
  "RETRIEVAL_MISS",
  "RETRIEVAL_INSUFFICIENT",
  "CONFLICTING_EVIDENCE",
  "GENERATOR_UNGROUNDED",
  "ANSWER_IRRELEVANT",
  "ANSWER_INCORRECT",
  "JUDGE_UNCERTAIN",
] as const;

export type RagDiagnosis = (typeof RAG_DIAGNOSES)[number];

export interface RagContext {
  readonly id: string;
  readonly text: string;
}

export interface RagMockScores {
  readonly chunkRelevanceC1: number;
  readonly chunkRelevanceC2: number;
  readonly contextSufficiency: number;
  readonly contextConflict: number;
  readonly answerRelevance: number;
  readonly groundedness: number;
  readonly contradiction: number;
  readonly correctness?: number;
}

export interface RagBaselineScore {
  readonly diagnosis: RagDiagnosis;
  readonly confidence: number;
}

/** Explicit component ground truth shared by Jev, baseline, and cascade runs. */
export interface RagExpected {
  readonly diagnosis: RagDiagnosis;
  readonly retrieval: {
    readonly chunkRelevance: Readonly<Record<string, boolean>>;
    readonly contextSufficiency: boolean;
    readonly contextConflict: boolean;
  };
  readonly generation: {
    readonly answerRelevance: boolean;
    readonly groundedness: boolean;
    readonly contradiction: boolean;
    readonly correctness?: boolean;
  };
}

export interface RagState {
  readonly fixtureId: string;
  readonly question: string;
  readonly contexts: readonly RagContext[];
  readonly answer: string;
  readonly referenceAnswer?: string;
  readonly mock: RagMockScores;
  readonly baseline: RagBaselineScore;
}

/** Host/LLM output reserved for the deferred claim-level groundedness mode. */
export interface RagClaim {
  readonly id: string;
  readonly text: string;
}

/**
 * Extension point for claim extraction. Basic mode deliberately does not
 * implement this generation step or make it part of the Jev contract.
 */
export interface ClaimExtractor {
  extract(input: {
    readonly question: string;
    readonly answer: string;
    readonly contexts: readonly RagContext[];
  }): readonly RagClaim[] | Promise<readonly RagClaim[]>;
}

export interface RetrievalJudgments {
  readonly chunkRelevance: Readonly<Record<string, number>>;
  readonly sufficiency: number;
  readonly conflict: number;
}

export interface GenerationJudgments {
  readonly relevance: number;
  readonly groundedness: number;
  readonly contradiction: number;
  readonly correctness?: number;
}

export interface RagJudgments {
  readonly retrieval: RetrievalJudgments;
  readonly generation: GenerationJudgments;
}

export interface RagThresholds {
  readonly failThreshold: number;
  readonly passThreshold: number;
}

export function isRagDiagnosis(value: unknown): value is RagDiagnosis {
  return typeof value === "string" && (RAG_DIAGNOSES as readonly string[]).includes(value);
}

export function asRagExpected(value: unknown): RagExpected {
  if (!isRecord(value)) {
    throw new TypeError("RAG expected value must be an object");
  }
  const retrieval = value.retrieval;
  const generation = value.generation;
  if (
    !isRagDiagnosis(value.diagnosis) ||
    !isRecord(retrieval) ||
    !isBooleanRecord(retrieval.chunkRelevance) ||
    typeof retrieval.contextSufficiency !== "boolean" ||
    typeof retrieval.contextConflict !== "boolean" ||
    !isRecord(generation) ||
    typeof generation.answerRelevance !== "boolean" ||
    typeof generation.groundedness !== "boolean" ||
    typeof generation.contradiction !== "boolean" ||
    (generation.correctness !== undefined && typeof generation.correctness !== "boolean")
  ) {
    throw new TypeError("RAG expected value has an invalid component shape");
  }
  return {
    diagnosis: value.diagnosis,
    retrieval: {
      chunkRelevance: retrieval.chunkRelevance,
      contextSufficiency: retrieval.contextSufficiency,
      contextConflict: retrieval.contextConflict,
    },
    generation: {
      answerRelevance: generation.answerRelevance,
      groundedness: generation.groundedness,
      contradiction: generation.contradiction,
      ...(generation.correctness === undefined ? {} : { correctness: generation.correctness }),
    },
  };
}

export function asRagState(state: EntryType): RagState {
  if (!isRecord(state)) {
    throw new TypeError("RAG fixture state must be an object");
  }
  const contexts = state.contexts;
  const mock = state.mock;
  const baseline = state.baseline;
  if (
    typeof state.fixtureId !== "string" ||
    typeof state.question !== "string" ||
    typeof state.answer !== "string" ||
    !Array.isArray(contexts) ||
    !contexts.every(isContext) ||
    !isMockScores(mock) ||
    !isBaseline(baseline)
  ) {
    throw new TypeError("RAG fixture state has an invalid shape");
  }
  const referenceAnswer = state.referenceAnswer;
  if (referenceAnswer !== undefined && typeof referenceAnswer !== "string") {
    throw new TypeError("RAG referenceAnswer must be a string when present");
  }
  return {
    fixtureId: state.fixtureId,
    question: state.question,
    contexts: contexts as unknown as RagContext[],
    answer: state.answer,
    ...(referenceAnswer === undefined ? {} : { referenceAnswer }),
    mock,
    baseline,
  };
}

function isMockScores(value: unknown): value is RagMockScores {
  if (!isRecord(value)) {
    return false;
  }
  const required = [
    "chunkRelevanceC1",
    "chunkRelevanceC2",
    "contextSufficiency",
    "contextConflict",
    "answerRelevance",
    "groundedness",
    "contradiction",
  ];
  if (!required.every((key) => isProbability(value[key]))) {
    return false;
  }
  return value.correctness === undefined || isProbability(value.correctness);
}

function isBaseline(value: unknown): value is RagBaselineScore {
  return isRecord(value) && isRagDiagnosis(value.diagnosis) && isProbability(value.confidence);
}

function isBooleanRecord(value: unknown): value is Readonly<Record<string, boolean>> {
  return isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every(isBoolean);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isContext(value: unknown): value is RagContext {
  return isRecord(value) && typeof value.id === "string" && typeof value.text === "string";
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
