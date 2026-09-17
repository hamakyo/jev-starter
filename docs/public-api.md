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
- Evaluation runners and report types live under the repository's `evals/` source tree and are used by offline examples; they are not added to the package root in this pre-alpha release.
- No business action executor, HTTP client, authentication wrapper, retry layer, or telemetry transport is exported.

This review is a pre-release snapshot, not a semver stability promise. Any final release should repeat it after the license and distribution model are selected.
