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

## Minimum metrics

### Predictive quality

- accuracy;
- per-label precision / recall / F1 for classification tasks;
- confusion matrix.

### Probability quality

- Brier score;
- expected calibration error (ECE) or an equivalent clearly documented calibration metric;
- reliability buckets / calibration table.

### Selective automation

For a confidence threshold `t`:

- **coverage@t**: fraction of examples accepted for automatic handling;
- **risk@t / error@t**: error rate among automatically handled examples;
- **review@t**: fraction routed to fallback or review.

The default report should also expose the risk-coverage curve and **AURC (Area Under the Risk-Coverage Curve)** where the task/output semantics make that metric meaningful.

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

For binary two-sided policies, the report should sweep pass/fail threshold pairs and include auto-positive coverage, auto-negative coverage, fallback coverage, and error within each accepted region.

## Baseline comparison

The harness should allow the same fixture set to be evaluated by another provider, such as an existing LLM classifier, LLM-as-a-Judge, or deterministic rule system.

Comparison should use identical ground truth and report:

- quality metrics;
- calibration metrics when probabilities/confidence are available;
- coverage/risk trade-off;
- latency;
- failure rate;
- cost estimate.

The project should not hard-code a claim that Jev always wins. The purpose is to make the migration decision empirical for the user's task.

## Cascade evaluation

The harness should support cascades in which Jev handles confident cases and forwards uncertain cases to a secondary judge/provider.

A cascade report should include:

- fraction resolved by Jev;
- fraction sent to fallback;
- Jev accepted-region error;
- end-to-end quality after fallback;
- combined latency distribution;
- estimated combined cost.

This allows evaluation of a practical deployment pattern rather than comparing providers only in isolation.

## RAG-specific evaluation

The RAG showcase reuses this generic harness but preserves separate retrieval and generation judgments rather than collapsing them into a single score.

See [RAG evaluator showcase](rag-evaluator.md) for the planned dimensions, failure diagnosis, claim-level extension, and Jev -> LLM judge cascade.

## Reproducibility

Each eval result should record:

- timestamp;
- decision id/version;
- provider/model identifier;
- dataset hash or version;
- threshold/policy configuration;
- pricing snapshot version if cost is calculated;
- package versions relevant to the run.

## CI strategy

Offline unit tests should use `MockProvider` and never require `TYPESAFE_API_KEY`.

Live Jev evals should be opt-in, for example:

```bash
pnpm eval:live
```

A later CI workflow may run live evals only when explicitly dispatched and when repository secrets are available.
