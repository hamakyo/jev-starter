# Evaluation

## Goal

The eval harness should answer a deployment question, not just produce an accuracy score:

> At each confidence threshold, how much traffic can be automated, what error rate remains, and how does Jev compare with the current baseline on quality, latency, and cost?

## Dataset format

Use line-delimited JSON so datasets are easy to diff, stream, and generate.

Example:

```json
{"id":"ticket-001","state":{"document":"I was charged twice"},"expected":{"category":"billing"}}
{"id":"ticket-002","state":{"document":"The app crashes on launch"},"expected":{"category":"technical"}}
```

Fixtures must not contain production secrets or personal data unless the repository and handling process explicitly permit it.

## Implemented metrics

### Predictive quality

- accuracy;
- per-label precision / recall / F1 for classification tasks;
- confusion matrix.

The report makes classification denominators explicit. `successfulAccuracy` is
accuracy over rows where the evaluator returned a prediction, while
`overallAccuracy` uses every dataset row and counts provider failures as
non-successes. `successRate` is the successful-row coverage. The legacy
`classification.accuracy` field remains the successful-row value for callers
that already consume it. Calibration and selective metrics also use successful
predictions only, so they should be read together with `successRate` and the
failure count.

### Probability quality

- Brier score;
- expected calibration error (ECE) or an equivalent clearly documented calibration metric;
- reliability buckets / calibration table.

### Selective automation

For a confidence threshold `t`, the harness reports:

- **coverage@t**: fraction of examples accepted for automatic handling;
- **risk@t / error@t**: error rate among automatically handled examples;
- **review@t**: fraction routed to fallback or review.

The report also exposes the risk-coverage curve and **AURC (Area Under the Risk-Coverage Curve)**. AURC is the discrete mean prefix risk after sorting samples by descending confidence; empty input produces an empty curve and zero AURC.

This is a primary view for Jev because production automation often cares more about the quality of accepted high-confidence decisions than one global accuracy number.

### Two-sided binary decisions

For a binary/Noul judgment, `P(true)` and uncertainty are not the same thing. A very low `P(true)` can represent a confident negative rather than an ambiguous prediction.

The eval harness should therefore support two-sided policies:

```text
P(true) <= fail threshold                  -> auto negative / auto fail
fail threshold < P(true) < pass threshold -> fallback / review
P(true) >= pass threshold                  -> auto positive / auto pass
```

Symmetric thresholds such as `0.05 / 0.95` may be useful for exploration but must never be presented as universal defaults. Thresholds must be selected from task-specific calibration and risk requirements.

For multi-class `choice` outputs, selective automation may use the selected class confidence or a custom policy defined by the decision contract.

### Operational metrics

- request latency p50 / p95;
- failures / retries;
- input/output token usage where available;
- estimated cost using a versioned pricing snapshot.

Pricing must be stored with the eval result or snapshot date. Do not bake a mutable web price into historical reports.

## Threshold sweep

The default report should sweep thresholds and make the coverage/risk trade-off visible.

Example for a one-sided confidence policy:

```text
threshold | coverage | accepted errors | error rate
----------|----------|-----------------|-----------
0.70      | 0.88     | 14              | 0.032
0.80      | 0.74     | 6               | 0.017
0.90      | 0.53     | 1               | 0.005
```

Values above are illustrative only.

For binary two-sided policies, the report sweeps pass/fail threshold pairs and includes auto-positive coverage, auto-negative coverage, fallback coverage, and error within each accepted region. Bucket intervals are `[lower, upper)`, except confidence `1` belongs to the final bucket; empty buckets contribute zero to weighted ECE. Classification precision/recall/F1 uses zero for a zero denominator.

## Implemented runners

The harness allows the same fixture set to be evaluated by another provider, such as an existing LLM classifier, LLM-as-a-Judge, or deterministic rule system.

Comparison should use identical ground truth and report:

- quality metrics;
- calibration metrics when probabilities/confidence are available;
- coverage/risk trade-off;
- latency;
- failure rate;
- cost estimate.

The project should not hard-code a claim that Jev always wins. The purpose is to make the migration decision empirical for the user's task.

## Cascade evaluation

The harness supports cascades in which Jev handles confident cases and forwards uncertain (`route: "fallback"` by default) cases to a secondary judge/provider.

A cascade report should include:

- fraction resolved by Jev;
- primary provider failure rate;
- fraction sent to fallback;
- Jev accepted-region error;
- end-to-end quality after fallback;
- combined latency distribution;
- combined usage and estimated combined cost.

Each end-to-end observation retains its `primary` and optional `fallback` leg.
Latency and usage are summed across the legs, and cost is priced per model from
the union of the explicitly supplied pricing snapshots. The fallback report
also records a selection-id hash separately from the parent dataset hash.

This allows evaluation of a practical deployment pattern rather than comparing providers only in isolation.

## RAG-specific evaluation

The RAG showcase reuses this generic harness but preserves separate retrieval and generation judgments rather than collapsing them into a single score.

See [RAG evaluator showcase](rag-evaluator.md) for the implemented basic dimensions, failure diagnosis, deferred claim-level extension, and Jev -> LLM judge cascade.

## Reproducibility

Each eval result records when supplied by the runner:

- timestamp;
- decision id/version;
- provider/model identifier;
- dataset hash or version;
- threshold/policy configuration;
- pricing snapshot version if cost is calculated;
- package versions relevant to the run.

Retry counts are not inferred from latency or errors. They are recorded only when an evaluator/provider explicitly supplies retry metadata. Cost remains `unavailable` when no pricing snapshot or matching model price is supplied; the repository's fixture prices are not production price claims.

## Commands and CI strategy

Offline unit tests should use `MockProvider` and never require `TYPESAFE_API_KEY`.

Live Jev evals should be opt-in, for example:

```bash
pnpm eval:live
```

The normal CI workflow runs only offline commands and never calls the Jev API:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm eval:offline
pnpm examples:offline
pnpm rag:offline
```

`pnpm eval:live` performs the `TYPESAFE_API_KEY` preflight before constructing a live provider request. It is intentionally separate from CI and has not been run as part of the secretless verification.
