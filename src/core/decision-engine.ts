import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { applyPolicy } from "../policies/apply-policy.js";
import type { AnswersFor, Provider } from "../providers/types.js";
import type { DecisionDefinition, DecisionOptions, DecisionOutcome } from "./types.js";

/** Coordinates one provider call and one pure policy application. */
export class DecisionEngine {
  private readonly provider: Provider;

  public constructor(provider: Provider) {
    this.provider = provider;
  }

  public async decide<const Q extends Questions>(
    definition: DecisionDefinition<Q>,
    state: EntryType,
    options: DecisionOptions = {},
  ): Promise<DecisionOutcome<AnswersFor<Q>>> {
    const providerResult = await this.provider.provide({
      state,
      questions: definition.questions,
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    });
    const route = applyPolicy(definition.policy, providerResult.answers);

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
}
