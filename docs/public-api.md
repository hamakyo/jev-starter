# Public API review

The package root intentionally exposes the smallest application-facing surface exercised by the examples and tests.

## Runtime exports

- Jev question builders: `choice`, `noul`, `score`;
- contract and engine: `defineDecision`, `validateDecisionDefinition`, `DecisionEngine`;
- providers: `JevProvider`, `MockProvider`, typed mock answer/result builders;
- policy: `applyPolicy`;
- observability: `classifyDecisionError`, `createDecisionSignals`, `errorName`.

## Type exports

The root also exports the decision, provider, policy, mock, and observability types required to configure those runtime APIs. `DecisionOutcome` preserves the complete answer map inferred from the definition's questions.

## Deliberate non-exports

- The response validator is an internal provider-boundary guard, not a second public schema API.
- Evaluation runners and report types live under the repository's `evals/` source tree and are used by offline examples; they are not exported from the published package root in `v0.1.0`.
- No business action executor, HTTP client, authentication wrapper, retry layer, or telemetry transport is exported.

This review records the public surface published in `v0.1.0`. The package remains pre-1.0, so breaking changes may be introduced by a later minor release with explicit changelog and migration guidance.
