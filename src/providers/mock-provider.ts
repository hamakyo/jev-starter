import type { EntryType, Questions } from "@typesafe-ai/sdk";
import type { MockProviderResolver, MockProviderStep } from "./mock-scenario.js";
import type { Provider, ProviderRequest, ProviderResult } from "./types.js";
import { validateProviderResult } from "./validate-response.js";

/** A recorded request made to a MockProvider. */
export interface MockProviderCall<Q extends Questions = Questions> {
  readonly index: number;
  readonly request: ProviderRequest<Q>;
}

/** Configuration for deterministic canned, scenario, resolver, or scripted responses. */
export interface MockProviderOptions<Q extends Questions = Questions> {
  /** The response returned for every call when no other source is configured. */
  readonly result?: ProviderResult<Q>;
  /** Resolve a response from the request and zero-based call index. */
  readonly resolver?: MockProviderResolver<Q>;
  /** Resolve responses by an explicit scenario key or the state's fixture id/id. */
  readonly scenarios?: Readonly<Record<string, MockProviderStep<Q>>>;
  /** Select a scenario key from each request. */
  readonly scenarioKey?: (request: ProviderRequest<Q>) => string;
  /** Return one response or error per call, then reject when exhausted. */
  readonly script?: readonly MockProviderStep<Q>[];
  /** Alias for script for callers that prefer response-oriented naming. */
  readonly responses?: readonly MockProviderStep<Q>[];
  /** Add a deterministic delay to each response unless a step overrides it. */
  readonly delayMs?: number;
}

/** Error raised when a scripted mock has no remaining step. */
export class MockProviderScriptExhaustedError extends Error {
  public constructor() {
    super("MockProvider script has no remaining response");
    this.name = "MockProviderScriptExhaustedError";
  }
}

/** Error raised when a configured scenario cannot be found. */
export class MockProviderScenarioNotFoundError extends Error {
  public readonly key: string;

  public constructor(key: string) {
    super(`MockProvider scenario "${key}" was not found`);
    this.name = "MockProviderScenarioNotFoundError";
    this.key = key;
  }
}

/** Error raised when a mock request's configured delay exceeds its request timeout. */
export class MockProviderTimeoutError extends Error {
  public readonly timeoutMs: number;

  public constructor(timeoutMs: number) {
    super(`MockProvider timed out after ${timeoutMs}ms`);
    this.name = "MockProviderTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Deterministic provider for tests, offline evals, and examples. */
export class MockProvider<Q extends Questions = Questions> implements Provider {
  private readonly options: MockProviderOptions<Q>;
  private readonly callsInternal: MockProviderCall<Q>[] = [];
  private scriptIndex = 0;

  public constructor(options: MockProviderOptions<Q> = {}) {
    if (options.script !== undefined && options.responses !== undefined) {
      throw new TypeError("MockProvider accepts either script or responses, not both");
    }
    if (options.delayMs !== undefined) {
      assertDelay(options.delayMs);
    }
    this.options = options;
  }

  /** Calls in order; requests are retained only because the test explicitly asks for history. */
  public get calls(): readonly MockProviderCall<Q>[] {
    return this.callsInternal;
  }

  /** Read the same call history through a method for ergonomic test assertions. */
  public getCallHistory(): readonly MockProviderCall<Q>[] {
    return this.calls;
  }

  /** Clear call history and restart the scripted sequence. */
  public reset(): void {
    this.callsInternal.length = 0;
    this.scriptIndex = 0;
  }

  public async provide<const R extends Questions>(
    request: ProviderRequest<R>,
  ): Promise<ProviderResult<R>> {
    const typedRequest = request as unknown as ProviderRequest<Q>;
    const callIndex = this.callsInternal.length;
    this.callsInternal.push({ index: callIndex, request: typedRequest });

    const step = await this.resolve(typedRequest, callIndex);
    const normalized = normalizeStep(step);
    const delayMs = normalized.delayMs ?? this.options.delayMs ?? 0;
    assertDelay(delayMs);
    await waitForMockResponse(delayMs, request.signal, request.timeout);

    if (normalized.error !== undefined) {
      throw normalized.error;
    }
    if (normalized.result === undefined) {
      throw new TypeError("MockProvider response step must contain a result or error");
    }

    validateProviderResult(request.questions, normalized.result);
    return normalized.result as unknown as ProviderResult<R>;
  }

  private async resolve(
    request: ProviderRequest<Q>,
    callIndex: number,
  ): Promise<MockProviderStep<Q>> {
    const script = this.options.script ?? this.options.responses;
    if (script !== undefined) {
      const step = script[this.scriptIndex];
      if (step === undefined) {
        throw new MockProviderScriptExhaustedError();
      }
      this.scriptIndex += 1;
      return step;
    }

    if (this.options.resolver !== undefined) {
      return this.options.resolver(request, callIndex);
    }

    if (this.options.scenarios !== undefined) {
      const key = this.options.scenarioKey?.(request) ?? scenarioKeyFromState(request.state);
      const step = this.options.scenarios[key];
      if (step === undefined) {
        throw new MockProviderScenarioNotFoundError(key);
      }
      return step;
    }

    if (this.options.result !== undefined) {
      return this.options.result;
    }

    throw new TypeError(
      "MockProvider needs result, resolver, scenarios, script, or responses configuration",
    );
  }
}

interface NormalizedStep<Q extends Questions> {
  readonly result?: ProviderResult<Q>;
  readonly error?: unknown;
  readonly delayMs?: number;
}

function normalizeStep<Q extends Questions>(step: MockProviderStep<Q>): NormalizedStep<Q> {
  if (isResultStep(step)) {
    return step;
  }
  if (isErrorStep(step)) {
    return step;
  }
  return { result: step };
}

function isResultStep<Q extends Questions>(
  value: MockProviderStep<Q>,
): value is Extract<MockProviderStep<Q>, { result: ProviderResult<Q> }> {
  return isRecord(value) && "result" in value;
}

function isErrorStep<Q extends Questions>(
  value: MockProviderStep<Q>,
): value is Extract<MockProviderStep<Q>, { error: unknown }> {
  return isRecord(value) && "error" in value;
}

function scenarioKeyFromState(state: EntryType): string {
  if (isRecord(state)) {
    const fixtureId = state.fixtureId;
    if (typeof fixtureId === "string") {
      return fixtureId;
    }
    const id = state.id;
    if (typeof id === "string") {
      return id;
    }
  }
  return JSON.stringify(state);
}

function waitForMockResponse(
  delayMs: number,
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): Promise<void> {
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
    throw new RangeError("MockProvider timeout must be a finite non-negative number");
  }
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  if (delayMs === 0 && timeoutMs === undefined) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const delayTimer = setTimeout(() => finish(), delayMs);
    const timeoutTimer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => finish(new MockProviderTimeoutError(timeoutMs)), timeoutMs);

    const onAbort = (): void => finish(createAbortError());
    signal?.addEventListener("abort", onAbort, { once: true });

    function finish(error?: unknown): void {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(delayTimer);
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
      }
      signal?.removeEventListener("abort", onAbort);
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    }
  });
}

function assertDelay(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("MockProvider delay must be a finite non-negative number");
  }
}

function createAbortError(): Error {
  const error = new Error("MockProvider request aborted");
  error.name = "AbortError";
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
