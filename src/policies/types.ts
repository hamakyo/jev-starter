import type {
  ChoiceQuestion,
  NoulQuestion,
  Question,
  Questions,
  ScoreQuestion,
} from "@typesafe-ai/sdk";
import type { AnswersFor } from "../providers/types.js";

/** The route returned by a policy. The host application owns what happens next. */
export type DecisionRoute = "auto" | "fallback" | "review";

/** Names in Q whose questions have one of the requested upstream types. */
export type QuestionKeyOf<Q extends Questions, T extends Question> = {
  [K in keyof Q]-?: Q[K] extends T ? K : never;
}[keyof Q] extends infer Key
  ? string extends keyof Q
    ? string
    : Key & string
  : never;

/** Questions with a directly reported selected-outcome confidence. */
export type ConfidenceQuestionKey<Q extends Questions = Questions> = QuestionKeyOf<
  Q,
  ChoiceQuestion | ScoreQuestion
>;

/** Questions that report the probability of a true answer. */
export type NoulQuestionKey<Q extends Questions = Questions> = QuestionKeyOf<Q, NoulQuestion>;

/** One-sided confidence routing for choice and score answers. */
export interface ConfidencePolicy<Q extends Questions = Questions> {
  readonly kind: "confidence";
  readonly question: ConfidenceQuestionKey<Q>;
  readonly autoThreshold: number;
  readonly fallbackThreshold: number;
}

/** Two-sided routing for a noul answer. */
export interface BinaryBandPolicy<Q extends Questions = Questions> {
  readonly kind: "binary-band";
  readonly question: NoulQuestionKey<Q>;
  readonly negativeThreshold: number;
  readonly positiveThreshold: number;
  readonly uncertainRoute: "fallback" | "review";
}

/** Explicit extension point for policies that inspect every typed answer. */
export interface CustomPolicy<Q extends Questions = Questions> {
  readonly kind: "custom";
  readonly decide: (answers: AnswersFor<Q>) => DecisionRoute;
}

/** Built-in and custom policies available to a decision definition. */
export type DecisionPolicy<Q extends Questions = Questions> =
  | ConfidencePolicy<Q>
  | BinaryBandPolicy<Q>
  | CustomPolicy<Q>;
