# jev-starter

Production-ready patterns for building probabilistic decision workflows with [TypeSafe AI Jev](https://typesafe.ai/).

> **Status:** pre-release. Issues #1–#7 and #9 are implemented and verified in offline CI. The opt-in live commands have also completed a smoke run. The first release is planned as `jev-starter@0.1.0` / `v0.1.0`; publication remains a separate approval-gated operation.

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
  providers/      Jev and deterministic mock providers
  observability/  decision events and metrics hooks

evals/
  fixtures/       labeled JSONL datasets
  metrics/        accuracy, calibration, risk/coverage, latency, cost
  runners/        Jev, baseline, comparison, and cascade runners

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

## Core flow

```ts
import { choice } from "@typesafe-ai/sdk";
import { DecisionEngine, JevProvider, defineDecision } from "jev-starter";

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

For a checkout, run `pnpm build` before using the package-name import; the clean-install package check exercises the same `exports` entry. A source-tree example can instead import from `./src/index.js`. `result.answers` contains the complete typed answer map, including choice/score confidence and probabilities or a noul probability. The engine only returns the route; the host application owns every side effect. Provider/API failures and malformed SDK responses reject and do not produce a `DecisionOutcome`.

## Reference examples

- [Support routing](examples/support-routing/README.md)
- [Agent decision gate](examples/agent-decision-gate/README.md)
- [LLM judge guard](examples/llm-judge/README.md)
- [RAG evaluator showcase](examples/rag-evaluator/README.md)

## Evaluation target

The starter should make it easy to answer a practical migration question:

> For this classification or decision task, how much traffic can Jev automate at an acceptable error rate compared with the current baseline?

The offline harness implements accuracy, confusion matrices, per-label precision/recall/F1, Brier score, weighted ECE, coverage/risk threshold sweeps, binary-band sweeps, risk-coverage/AURC, latency, failures, usage, comparison, and cascade reports. Reports distinguish successful-only accuracy from all-row accuracy and retain combined cascade legs for latency, usage, and model-specific cost. Cost is calculated only from an explicitly supplied versioned pricing snapshot; otherwise it is reported as `unavailable`.

```sh
pnpm eval:offline
pnpm eval:live      # requires TYPESAFE_API_KEY; opt-in only
```

## Showcase: RAG evaluator

RAG evaluation is the repository's first full showcase rather than a minimal classification demo. The basic answer-level mode is runnable offline and keeps retrieval and generation judgments separate.

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

The evaluator keeps retrieval and generation failures separate and reports accuracy, Brier score, and weighted ECE for each available Jev component:

- chunk relevance;
- context sufficiency;
- evidence conflict;
- answer relevance;
- groundedness;
- contradiction;
- reference-based correctness when available.

The final diagnosis is composed in TypeScript instead of asking Jev one large opaque question. The comparison modes are **Jev-only**, **baseline judge**, and **Jev -> fallback judge cascade** on the same labeled dataset. The fixture baseline currently exposes only its final diagnosis/confidence, so its component metrics are omitted rather than copied from Jev. Claim extraction remains a host/LLM extension point and is not implemented in basic mode.

See [RAG evaluator showcase](docs/rag-evaluator.md) for the detailed design.

## Documentation

- [Architecture](docs/architecture.md)
- [Decision contract](docs/decision-contract.md)
- [Evaluation](docs/evaluation.md)
- [RAG evaluator showcase](docs/rag-evaluator.md)
- [Upstream compatibility](docs/compatibility.md)
- [Public API review](docs/public-api.md)
- [Release checklist](docs/release-checklist.md)
- [Distribution options](docs/distribution-options.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Roadmap](docs/roadmap.md)

## Upstream

The official JavaScript/TypeScript SDK is [`@typesafe-ai/sdk`](https://github.com/typesafe-ai/typesafe-sdk-js). It currently exposes typed `systemOne()` requests and `noul`, `choice`, and `score` question/response shapes.

## License

[MIT](LICENSE) © 2026 hamakyo.
