import type { EntryType, Questions } from "@typesafe-ai/sdk";
import type { DecisionPolicy, DecisionRoute } from "../policies/types.js";
import type { AnswersFor, Provider } from "../providers/types.js";

/** A versioned, runtime-state-independent decision definition. */
export interface DecisionDefinition<
  Q extends Questions,
  P extends DecisionPolicy<Q> = DecisionPolicy<Q>,
> {
  readonly id: string;
  readonly version: string;
  readonly questions: Q;
  readonly policy: P;
}

/** Input shape accepted by defineDecision. */
export type DecisionDefinitionInput<
  Q extends Questions,
  P extends DecisionPolicy<Q> = DecisionPolicy<Q>,
> = DecisionDefinition<Q, P>;

/** Runtime controls forwarded to the configured provider. */
export interface DecisionOptions {
  model?: string;
  signal?: AbortSignal;
  timeout?: number;
}

/** The application-facing result after provider success and policy routing. */
export interface DecisionOutcome<TAnswers> {
  readonly decisionId: string;
  readonly decisionVersion: string;
  readonly route: DecisionRoute;
  readonly answers: TAnswers;
  readonly model: string;
  readonly latencyMs: number;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

/** The provider type accepted by DecisionEngine. */
export type DecisionProvider = Provider;

/** The typed answer map for a decision's questions. */
export type { AnswersFor };

/** Core-facing aliases for the policy route and policy definitions. */
export type { DecisionPolicy, DecisionRoute };
