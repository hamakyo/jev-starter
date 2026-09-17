import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { classifyDecisionError, createDecisionSignals, errorName } from "../observability/index.js";
import type {
  DecisionEngineOptions,
  DecisionEvent,
  DecisionOperationalFallbackEvent,
  DecisionProviderFailureEvent,
  DecisionSuccessEvent,
} from "../observability/types.js";
import { applyPolicy } from "../policies/apply-policy.js";
import type { AnswersFor, Provider, ProviderRequest, ProviderResult } from "../providers/types.js";
import type { DecisionDefinition, DecisionOptions, DecisionOutcome } from "./types.js";

/** Coordinates one provider call and one pure policy application. */
export class DecisionEngine {
  private readonly provider: Provider;
  private readonly options: DecisionEngineOptions;

  public constructor(provider: Provider, options: DecisionEngineOptions = {}) {
    this.provider = provider;
    this.options = options;
  }

  public async decide<const Q extends Questions>(
    definition: DecisionDefinition<Q>,
    state: EntryType,
    options: DecisionOptions = {},
  ): Promise<DecisionOutcome<AnswersFor<Q>>> {
    const startedAt = performance.now();
    const request: ProviderRequest<Q> = {
      state,
      questions: definition.questions,
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    };
    const primaryProviderName = this.options.providerName ?? providerName(this.provider);

    let providerResult: ProviderResult<Q>;
    try {
      providerResult = await this.provider.provide(request);
    } catch (error) {
      const primaryErrorCategory = classifyDecisionError(error);
      await this.emitProviderFailure(
        definition,
        primaryProviderName,
        startedAt,
        primaryErrorCategory,
        errorName(error),
      );

      const fallback = this.options.operationalFallback;
      if (
        fallback === undefined ||
        (fallback.when !== undefined && !fallback.when(error, primaryErrorCategory))
      ) {
        throw error;
      }

      const fallbackProviderName = fallback.providerName ?? providerName(fallback.provider);
      let fallbackResult: ProviderResult<Q>;
      try {
        fallbackResult = await fallback.provider.provide(request);
      } catch (fallbackError) {
        await this.emitOperationalFallback({
          type: "operational-fallback",
          status: "failed",
          occurredAt: this.timestamp(),
          decisionId: definition.id,
          decisionVersion: definition.version,
          provider: primaryProviderName,
          latencyMs: performance.now() - startedAt,
          primaryProvider: primaryProviderName,
          fallbackProvider: fallbackProviderName,
          primaryErrorCategory,
          primaryErrorName: errorName(error),
          fallbackErrorCategory: classifyDecisionError(fallbackError),
          fallbackErrorName: errorName(fallbackError),
        });
        throw fallbackError;
      }

      const route = applyPolicy(definition.policy, fallbackResult.answers);
      const outcome = createOutcome(definition, route, fallbackResult);
      await this.emitOperationalFallback({
        type: "operational-fallback",
        status: "succeeded",
        occurredAt: this.timestamp(),
        decisionId: definition.id,
        decisionVersion: definition.version,
        provider: primaryProviderName,
        latencyMs: performance.now() - startedAt,
        primaryProvider: primaryProviderName,
        fallbackProvider: fallbackProviderName,
        primaryErrorCategory,
        primaryErrorName: errorName(error),
        model: fallbackResult.model,
        route,
        signals: createDecisionSignals(fallbackResult.answers),
        ...(fallbackResult.usage === undefined ? {} : { usage: fallbackResult.usage }),
      });
      return outcome;
    }

    const route = applyPolicy(definition.policy, providerResult.answers);
    const outcome = createOutcome(definition, route, providerResult);
    const successEvent: DecisionSuccessEvent = {
      type: "success",
      occurredAt: this.timestamp(),
      decisionId: definition.id,
      decisionVersion: definition.version,
      provider: primaryProviderName,
      model: providerResult.model,
      route,
      signals: createDecisionSignals(providerResult.answers),
      latencyMs: performance.now() - startedAt,
      ...(providerResult.usage === undefined ? {} : { usage: providerResult.usage }),
    };
    await this.emit(successEvent);
    return outcome;
  }

  private async emitProviderFailure<Q extends Questions>(
    definition: DecisionDefinition<Q>,
    provider: string,
    startedAt: number,
    errorCategory: ReturnType<typeof classifyDecisionError>,
    failedErrorName: string,
  ): Promise<void> {
    const event: DecisionProviderFailureEvent = {
      type: "provider-failure",
      occurredAt: this.timestamp(),
      decisionId: definition.id,
      decisionVersion: definition.version,
      provider,
      latencyMs: performance.now() - startedAt,
      errorCategory,
      errorName: failedErrorName,
    };
    await this.emit(event);
  }

  private async emitOperationalFallback(event: DecisionOperationalFallbackEvent): Promise<void> {
    await this.emit(event);
  }

  private async emit(event: DecisionEvent): Promise<void> {
    if (this.options.observer === undefined) {
      return;
    }
    try {
      await this.options.observer(event);
    } catch (error) {
      if (this.options.observerError === "throw") {
        throw error;
      }
    }
  }

  private timestamp(): string {
    return (this.options.clock?.() ?? new Date()).toISOString();
  }
}

function createOutcome<Q extends Questions>(
  definition: DecisionDefinition<Q>,
  route: DecisionOutcome<AnswersFor<Q>>["route"],
  providerResult: ProviderResult<Q>,
): DecisionOutcome<AnswersFor<Q>> {
  return {
    decisionId: definition.id,
    decisionVersion: definition.version,
    route,
    answers: providerResult.answers,
    model: providerResult.model,
    latencyMs: providerResult.latencyMs,
    ...(providerResult.usage === undefined ? {} : { usage: providerResult.usage }),
  };
}

function providerName(provider: Provider): string {
  return provider.constructor.name || "Provider";
}
