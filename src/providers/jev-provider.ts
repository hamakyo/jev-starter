import {
  type Questions,
  type RequestOptions,
  type SystemOneRequest,
  TypeSafeClient,
} from "@typesafe-ai/sdk";
import type { Provider, ProviderRequest, ProviderResult, TypeSafeClientLike } from "./types.js";
import { validateSystemOneResult } from "./validate-response.js";

/**
 * Thin adapter around the official TypeSafe SDK.
 *
 * The SDK owns authentication, HTTP, retries, and error classification. This
 * adapter only forwards request controls, measures the full call, and converts
 * token usage to the core naming convention.
 */
export class JevProvider implements Provider {
  private readonly client: TypeSafeClientLike;

  public constructor(client: TypeSafeClientLike = new TypeSafeClient()) {
    this.client = client;
  }

  public async provide<const Q extends Questions>(
    request: ProviderRequest<Q>,
  ): Promise<ProviderResult<Q>> {
    const startedAt = performance.now();
    const sdkRequest: SystemOneRequest<Q> = {
      state: request.state,
      questions: request.questions,
      ...(request.model === undefined ? {} : { model: request.model }),
    };
    const sdkOptions: RequestOptions | undefined =
      request.signal === undefined && request.timeout === undefined
        ? undefined
        : {
            ...(request.signal === undefined ? {} : { signal: request.signal }),
            ...(request.timeout === undefined ? {} : { timeout: request.timeout }),
          };

    const result =
      sdkOptions === undefined
        ? await this.client.systemOne(sdkRequest)
        : await this.client.systemOne(sdkRequest, sdkOptions);
    validateSystemOneResult(request.questions, result);
    const usage = result.usage;

    return {
      answers: result.answers,
      model: result.model,
      latencyMs: performance.now() - startedAt,
      ...(usage === undefined
        ? {}
        : {
            usage: {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
            },
          }),
    };
  }
}
