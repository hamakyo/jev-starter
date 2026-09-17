import type { DecisionRoute } from "../policies/types.js";
import type { Provider, ProviderUsage } from "../providers/types.js";
import type { DecisionErrorCategory } from "./error-category.js";

export interface DecisionAnswerSignal {
  readonly question: string;
  readonly type: "noul" | "choice" | "score";
  readonly probability?: number;
  readonly confidence?: number;
  readonly probabilities?: Readonly<Record<string, number>>;
}

export interface DecisionEventBase {
  readonly occurredAt: string;
  readonly decisionId: string;
  readonly decisionVersion: string;
  readonly provider: string;
  readonly latencyMs: number;
}

export interface DecisionSuccessEvent extends DecisionEventBase {
  readonly type: "success";
  readonly model: string;
  readonly route: DecisionRoute;
  readonly signals: readonly DecisionAnswerSignal[];
  readonly usage?: ProviderUsage;
}

export interface DecisionProviderFailureEvent extends DecisionEventBase {
  readonly type: "provider-failure";
  readonly errorCategory: DecisionErrorCategory;
  readonly errorName: string;
}

export interface DecisionOperationalFallbackEvent extends DecisionEventBase {
  readonly type: "operational-fallback";
  readonly status: "succeeded" | "failed";
  readonly primaryProvider: string;
  readonly fallbackProvider: string;
  readonly primaryErrorCategory: DecisionErrorCategory;
  readonly primaryErrorName: string;
  readonly fallbackErrorCategory?: DecisionErrorCategory;
  readonly fallbackErrorName?: string;
  readonly model?: string;
  readonly route?: DecisionRoute;
  readonly signals?: readonly DecisionAnswerSignal[];
  readonly usage?: ProviderUsage;
}

/** Structured events intentionally contain no raw decision state. */
export type DecisionEvent =
  | DecisionSuccessEvent
  | DecisionProviderFailureEvent
  | DecisionOperationalFallbackEvent;

export type DecisionObserver = (event: DecisionEvent) => void | Promise<void>;

export interface OperationalFallbackOptions {
  readonly provider: Provider;
  readonly providerName?: string;
  /** Return false to rethrow the primary provider error without fallback. */
  readonly when?: (error: unknown, category: DecisionErrorCategory) => boolean;
}

export interface DecisionEngineOptions {
  readonly observer?: DecisionObserver;
  readonly clock?: () => Date;
  readonly providerName?: string;
  /** Observer errors are ignored by default so telemetry cannot change a decision result. */
  readonly observerError?: "ignore" | "throw";
  readonly operationalFallback?: OperationalFallbackOptions;
}
