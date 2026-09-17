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

For a threshold `t`:

- **coverage@t**: fraction of examples whose confidence is at least `t`;
- **error@t**: error rate among those examples;
- **review@t**: fraction routed below the automation threshold.

This is a primary view for Jev because production automation often cares more about the quality of accepted high-confidence decisions than one global accuracy number.

### Operational metrics

- request latency p50 / p95;
- failures / retries;
- input/output token usage where available;
- estimated cost using a versioned pricing snapshot.

Pricing must be stored with the eval result or snapshot date. Do not bake a mutable web price into historical reports.

## Threshold sweep

The default report should sweep thresholds, for example from `0.50` to `0.99`, and emit a table such as:

```text
threshold | coverage | accepted errors | error rate
----------|----------|-----------------|-----------
0.70      | 0.88     | 14              | 0.032
0.80      | 0.74     | 6               | 0.017
0.90      | 0.53     | 1               | 0.005
```

Values above are illustrative only.

## Baseline comparison

The harness should allow the same fixture set to be evaluated by another provider, such as an existing LLM classifier or deterministic rule system.

Comparison should use identical ground truth and report:

- quality metrics;
- coverage/error trade-off if the baseline emits confidence;
- latency;
- failure rate;
- cost estimate.

The project should not hard-code a claim that Jev always wins. The purpose is to make the migration decision empirical for the user's task.

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
