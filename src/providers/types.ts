import type {
  EntryType,
  Questions,
  RequestOptions,
  SystemOneResult,
  TypeSafeClient,
} from "@typesafe-ai/sdk";

/** The answer map inferred from a set of Jev questions. */
export type AnswersFor<Q extends Questions> = SystemOneResult<Q>["answers"];

/** Input accepted by a decision provider. */
export interface ProviderRequest<Q extends Questions> {
  state: EntryType;
  questions: Q;
  model?: string;
  signal?: AbortSignal;
  timeout?: number;
}

/** Token usage normalized to the core's camelCase naming. */
export interface ProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Successful provider output consumed by the decision engine. */
export interface ProviderResult<Q extends Questions> {
  readonly answers: AnswersFor<Q>;
  readonly model: string;
  readonly latencyMs: number;
  readonly usage?: ProviderUsage;
}

/** The minimal provider boundary used by the decision engine. */
export interface Provider {
  provide<const Q extends Questions>(request: ProviderRequest<Q>): Promise<ProviderResult<Q>>;
}

/** Structural client type that permits an injected fake in offline tests. */
export type TypeSafeClientLike = Pick<TypeSafeClient, "systemOne">;

/** The SDK request options forwarded by the Jev provider. */
export type ProviderRequestOptions = Pick<RequestOptions, "signal" | "timeout">;
