import type {
  ChoiceCriteria,
  ChoiceResponse,
  NoulResponse,
  Questions,
  ScoreCriteria,
  ScoreLegend,
  ScoreOf,
  ScoreResponse,
} from "@typesafe-ai/sdk";
import type { AnswersFor, ProviderRequest, ProviderResult, ProviderUsage } from "./types.js";

/** Build a typed noul answer for a deterministic provider scenario. */
export function createNoulAnswer(noul: number): NoulResponse {
  return { type: "noul", noul };
}

/** Build a typed choice answer while preserving the criteria label literals. */
export function createChoiceAnswer<const T extends ChoiceCriteria>(
  options: ChoiceAnswerOptions<T>,
): ChoiceResponse<T> {
  return { type: "choice", ...options };
}

/** Build a typed score answer while preserving the rubric literals. */
export function createScoreAnswer<const T extends ScoreCriteria>(
  options: ScoreAnswerOptions<T>,
): ScoreResponse<T> {
  return { type: "score", ...options };
}

export interface ChoiceAnswerOptions<T extends ChoiceCriteria> {
  readonly choice: keyof T & string;
  readonly confidence: number;
  readonly probabilities: { readonly [K in keyof T]: number };
}

export interface ScoreAnswerOptions<T extends ScoreCriteria> {
  readonly score: number;
  readonly confidence: number;
  readonly legend: ScoreLegend<T>;
  readonly probabilities: { readonly [K in ScoreOf<T>]: number };
}

/** Build a normalized provider result for a canned or scripted response. */
export function createProviderResult<const Q extends Questions>(
  answers: AnswersFor<Q>,
  options: CreateProviderResultOptions = {},
): ProviderResult<Q> {
  return {
    answers,
    model: options.model ?? "mock-model",
    latencyMs: options.latencyMs ?? 0,
    ...(options.usage === undefined ? {} : { usage: options.usage }),
  };
}

export interface CreateProviderResultOptions {
  readonly model?: string;
  readonly latencyMs?: number;
  readonly usage?: ProviderUsage;
}

/** A scripted mock step that returns a normalized provider result. */
export interface MockResultStep<Q extends Questions> {
  readonly result: ProviderResult<Q>;
  readonly delayMs?: number;
}

/** A scripted mock step that rejects with an injected operational error. */
export interface MockErrorStep {
  readonly error: unknown;
  readonly delayMs?: number;
}

export type MockProviderStep<Q extends Questions> =
  | ProviderResult<Q>
  | MockResultStep<Q>
  | MockErrorStep;

/** A deterministic function that selects a mock step from a request. */
export type MockProviderResolver<Q extends Questions = Questions> = (
  request: ProviderRequest<Q>,
  callIndex: number,
) => MockProviderStep<Q> | Promise<MockProviderStep<Q>>;
