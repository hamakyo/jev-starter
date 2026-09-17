# jev-starter

Production-ready patterns for building probabilistic decision workflows with [TypeSafe AI Jev](https://typesafe.ai/).

> **Status:** pre-alpha. The typed provider, decision contract, and three-route policy engine are available; evaluation, observability, and business fallbacks remain future work.

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

## Repository layout

```text
src/
  core/           decision contracts and engine
  policies/       reusable threshold / routing policies
  providers/      Jev provider (mock/fallback adapters follow in later issues)
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

## Core flow (source-tree example)

```ts
import { choice } from "@typesafe-ai/sdk";
import { DecisionEngine, JevProvider, defineDecision } from "./src/index.js";

const questions = {
  category: choice("What is this ticket about?", {
    billing: null,
    technical: null,
    other: null,
  }),
};

const ticketRouting = defineDecision({
  id: "support.ticket-routing",
  version: "1",
  questions,
  policy: {
    kind: "confidence",
    question: "category",
    autoThreshold: 0.9,
    fallbackThreshold: 0.65,
  },
});

const state = { ticket: { subject: "Duplicate charge", body: "I was charged twice." } };
const signal = new AbortController().signal;
const engine = new DecisionEngine(new JevProvider());
const result = await engine.decide(ticketRouting, state, {
  signal,
  timeout: 10_000,
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

The example uses a source-tree import because package exports and the build artifact are intentionally deferred to the first public release. `result.answers` contains the complete typed answer map, including choice/score confidence and probabilities or a noul probability. The engine only returns the route; the host application owns every side effect. Provider/API failures and malformed SDK responses reject and do not produce a `DecisionOutcome`.

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
