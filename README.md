# jev-starter

Production-ready patterns for building probabilistic decision workflows with [TypeSafe AI Jev](https://typesafe.ai/).

> **Status:** design / pre-alpha. The repository currently defines the architecture and implementation roadmap before the first runnable release.

`jev-starter` is not another Jev SDK wrapper. The official `@typesafe-ai/sdk` already provides a typed client. This project focuses on the layer applications still need around the model: **decision contracts, policy thresholds, fallbacks, evaluation, and production examples**.

## What this project is for

Jev returns structured answers that software can act on. A production application usually needs more than a model call:

```text
application state
      |
      v
  Jev decision
      |
      v
 typed probabilities
      |
      v
 decision policy
   /      |       \
  /       |        \
auto   fallback   human review
```

The goal of this repository is to make that pattern reusable and measurable.

## Design principles

- **Official SDK underneath.** Use `@typesafe-ai/sdk` rather than duplicating TypeSafe transport or response types.
- **Separate inference from policy.** Jev estimates; application code decides what confidence is sufficient for an action.
- **Side effects stay with the host application.** The starter returns an action recommendation; it does not silently execute business operations.
- **Uncertainty is a first-class path.** Low-confidence decisions must have an explicit fallback or review route.
- **Confident negatives are not uncertainty.** Binary judgments should support two-sided thresholds so a low `P(true)` can be treated differently from an ambiguous result.
- **Evaluate before automating.** Thresholds should be selected from task-specific data, not copied from examples.
- **Observable by default.** Model, latency, confidence/probabilities, selected policy path, and outcome should be measurable.

## Planned repository layout

```text
src/
  core/           decision contracts and engine
  policies/       reusable threshold / routing policies
  providers/      Jev, mock, and fallback provider adapters
  observability/  decision events and metrics hooks

evals/
  fixtures/       labeled JSONL datasets
  metrics/        accuracy, calibration, risk/coverage, latency, cost
  runners/        Jev and baseline evaluation runners

examples/
  support-routing/
  agent-decision-gate/
  llm-judge/
  rag-evaluator/  showcase: RAG diagnosis + Jev/LLM cascade evaluation

docs/
  architecture.md
  decision-contract.md
  evaluation.md
  rag-evaluator.md
  roadmap.md
```

## Intended core flow

```ts
const result = await engine.decide({
  state,
  questions,
  policy: {
    auto: 0.9,
    fallback: 0.65,
  },
});

switch (result.route) {
  case "auto":
    // host application performs the approved side effect
    break;
  case "fallback":
    // optional LLM / secondary classifier path
    break;
  case "review":
    // human review or queue
    break;
}
```

The API above is a **design target**, not yet a published API.

## Evaluation target

The starter should make it easy to answer a practical migration question:

> For this classification or decision task, how much traffic can Jev automate at an acceptable error rate compared with the current baseline?

Planned metrics include accuracy, precision/recall where applicable, Brier score, calibration error, coverage/risk across confidence thresholds, AURC where meaningful, latency, and estimated cost.

## Showcase: RAG evaluator

RAG evaluation is planned as the repository's first full showcase rather than a minimal classification demo.

```text
Question --------------------+
Retrieved contexts ----------+----> Jev atomic judgments
Generated answer ------------+              |
Reference answer (optional) -+              v
                                    typed probabilities
                                             |
                                             v
                                    deterministic diagnosis
```

The evaluator will keep retrieval and generation failures separate:

- chunk relevance;
- context sufficiency;
- evidence conflict;
- answer relevance;
- groundedness;
- contradiction;
- reference-based correctness when available.

The final diagnosis is composed in TypeScript instead of asking Jev one large opaque question. Planned comparison modes are **Jev-only**, **baseline judge**, and **Jev -> fallback judge cascade** on the same labeled dataset.

See [RAG evaluator showcase](docs/rag-evaluator.md) for the detailed design.

## Documentation

- [Architecture](docs/architecture.md)
- [Decision contract](docs/decision-contract.md)
- [Evaluation](docs/evaluation.md)
- [RAG evaluator showcase](docs/rag-evaluator.md)
- [Roadmap](docs/roadmap.md)

## Upstream

The official JavaScript/TypeScript SDK is [`@typesafe-ai/sdk`](https://github.com/typesafe-ai/typesafe-sdk-js). It currently exposes typed `systemOne()` requests and `noul`, `choice`, and `score` question/response shapes.

## License

A license will be selected before the first public package release.
