# Architecture

## Goal

`jev-starter` provides the application-layer structure around Jev: define a decision, call the model, normalize the answers, apply an explicit policy, and expose a route that the host application can act on.

The project deliberately sits **above** the official `@typesafe-ai/sdk`. Transport, authentication, retries, and the upstream Jev response schema remain owned by TypeSafe.

## Non-goals

- Reimplementing the TypeSafe SDK or HTTP client.
- Hiding model probabilities behind a single opaque boolean.
- Executing irreversible business side effects inside the decision engine.
- Claiming that one confidence threshold is safe for every domain.
- Treating Jev as a general chat or generation model.

## System boundary

```text
+---------------- host application ----------------+
|                                                   |
| state + questions                                 |
|        |                                          |
|        v                                          |
| +-------------------+                             |
| | Decision Engine   |                             |
| |                   |                             |
| | provider -> policy|                             |
| +----+----------+---+                             |
|      |          |                                 |
|      |          +---- decision event / telemetry |
|      v                                            |
| route: auto | fallback | review                   |
|      |                                            |
|      v                                            |
| host-owned side effect                            |
+---------------------------------------------------+
          |
          v
+---------------- provider boundary ----------------+
| JevProvider -> @typesafe-ai/sdk -> TypeSafe API   |
| MockProvider                                      |
| optional baseline/fallback providers              |
+---------------------------------------------------+
```

## Components

### 1. Decision contract

A decision contract is the stable application-facing definition of a task. It should contain:

- a stable decision id;
- Jev `questions`;
- optional metadata for evaluation/observability;
- a policy describing how a named answer maps to an application route, or a custom policy over the complete answer map.

The contract should preserve the official SDK's inferred answer types rather than flattening them to `unknown`.

Built-in policies make the target question explicit. A `confidence` policy selects a `choice` or `score` question, while a `binary-band` policy selects a `noul` question. This prevents several answers from being silently reduced to one confidence value.

### 2. Provider

A provider converts a decision request into model answers. The first production provider wraps `TypeSafeClient.systemOne()`.

Provider responsibilities:

- model invocation;
- timeout/cancellation forwarding;
- minimal normalization needed by the engine;
- runtime validation that the SDK response matches the requested questions and required metadata;
- surfacing model and usage metadata.

Provider non-responsibilities:

- selecting business thresholds;
- executing downstream actions;
- swallowing model/API failures and pretending a decision succeeded.

`JevProvider` calls `TypeSafeClient.systemOne()` once, forwards `signal`, `timeout`, and an optional model override, measures the complete awaited call, and normalizes only `input_tokens` / `output_tokens` to camelCase.

The provider rejects malformed SDK responses before they reach policy code: every requested answer must be present and match its question type, and choice/score/noul fields plus model and usage must have their required runtime shape.

### 3. Policy

A policy maps model output to a route. The initial policy should support three explicit paths:

```text
confidence >= autoThreshold        -> auto
confidence >= fallbackThreshold    -> fallback
otherwise                          -> review
```

Threshold ordering must be validated (`0 <= fallback <= auto <= 1`). Policies should be replaceable so later versions can support per-label thresholds, cost-sensitive routing, or abstention rules.

The binary-band policy uses a named `noul` answer and two thresholds:

```text
pTrue <= negativeThreshold        -> auto
pTrue >= positiveThreshold        -> auto
otherwise                         -> uncertainRoute
```

The complete answer map still exposes the `noul` probability (`pTrue` in the policy notation), so the host can distinguish a confident negative from a confident positive.

### 4. Decision engine

The engine coordinates provider + policy and returns a value with enough information for the host to decide what to do next.

Target shape:

```ts
type DecisionRoute = "auto" | "fallback" | "review";

interface DecisionOutcome<TAnswers> {
  decisionId: string;
  decisionVersion: string;
  route: DecisionRoute;
  answers: TAnswers;
  model: string;
  latencyMs: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

`DecisionEngine.decide(definition, state, options)` awaits the provider first, applies the definition's policy only after provider success, and returns this outcome. It does not retain state or execute business side effects.

### 5. Observability

Every decision should be representable as a structured event without logging raw sensitive state by default.

Minimum metadata:

- decision id/version;
- provider/model;
- selected route;
- confidence/probabilities where applicable;
- latency;
- usage/cost inputs;
- error category;
- optional ground-truth/outcome id supplied later by the host.

Raw `state` logging must be opt-in.

## Failure semantics

The engine must distinguish **uncertainty** from **operational failure**.

- Low confidence is a valid model result and follows policy.
- Timeout, authentication failure, malformed response, or provider outage is an operational error.
- A provider failure must never be converted into a high-confidence `auto` decision.
- A provider failure, including a malformed SDK response, rejects the engine call; no `DecisionOutcome` is created.
- Applications may configure an operational fallback, but that fallback should be visible in telemetry.

## Side-effect rule

`jev-starter` recommends; the host application acts.

This is intentional. Keeping side effects outside the engine makes decisions replayable in evals, testable with mocks, and safer to integrate into systems with different authorization models.

## Versioning

Decision behavior can change even without a code API change. Each production decision definition should therefore support a logical version so eval results and telemetry can be attributed to the exact contract/policy used.
