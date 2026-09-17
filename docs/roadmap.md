# Roadmap

This roadmap is organized by capability rather than dates. Issue scope may change as the upstream Jev SDK evolves.

## Implementation issues

The current execution order is intentionally dependency-driven:

1. [#1 Bootstrap the TypeScript workspace and quality checks](https://github.com/hamakyo/jev-starter/issues/1)
2. [#2 Implement the Jev provider on top of @typesafe-ai/sdk](https://github.com/hamakyo/jev-starter/issues/2)
3. [#3 Define the typed decision contract and three-route policy engine](https://github.com/hamakyo/jev-starter/issues/3)
4. [#4 Add MockProvider and deterministic offline test support](https://github.com/hamakyo/jev-starter/issues/4)
5. [#5 Build the evaluation harness for calibration and selective automation](https://github.com/hamakyo/jev-starter/issues/5)
6. [#6 Add the minimal reference decision patterns](https://github.com/hamakyo/jev-starter/issues/6)
7. [#9 Build the RAG evaluator showcase and Jev-to-LLM judge cascade](https://github.com/hamakyo/jev-starter/issues/9)
8. [#7 Add production observability and operational fallback semantics](https://github.com/hamakyo/jev-starter/issues/7)
9. [#8 Prepare the first public release and contributor surface](https://github.com/hamakyo/jev-starter/issues/8)

## M0 — Project contract

**Goal:** make the intended boundaries obvious before implementation begins.

- [x] Define architecture and side-effect boundary.
- [x] Define draft decision contract.
- [x] Define evaluation strategy.
- [x] Define RAG evaluator showcase design.
- [x] Document implementation milestones.
- [ ] Select license.
- [ ] Add contribution and security guidance before wider external contribution.

## M1 — Runnable core

**Goal:** one typed Jev decision can run end-to-end from TypeScript.

- [ ] Bootstrap Node.js 20+ TypeScript workspace.
- [ ] Add `@typesafe-ai/sdk` integration.
- [ ] Implement `JevProvider`.
- [ ] Implement `defineDecision()` and typed `DecisionEngine`.
- [ ] Implement one-sided confidence policy.
- [ ] Implement two-sided binary-band policy for `noul` judgments.
- [ ] Add `MockProvider` for deterministic tests.
- [ ] Validate policy and contract invariants.
- [ ] Unit tests for provider, policy, and failure semantics.

**Exit criterion:** a local example can make a Jev call, obtain typed answers, and route the result without business side effects inside the engine. Binary judgments can distinguish confident negative, uncertain, and confident positive regions.

## M2 — Evaluation harness

**Goal:** thresholds can be selected from evidence instead of intuition.

- [ ] JSONL fixture loader.
- [ ] Classification metrics and confusion matrix.
- [ ] Brier score and calibration report.
- [ ] One-sided threshold sweep with coverage/risk metrics.
- [ ] Two-sided binary threshold sweep with positive/negative/fallback coverage.
- [ ] Risk-coverage curve and AURC where meaningful.
- [ ] Latency and failure-rate reporting.
- [ ] Versioned pricing snapshot + estimated cost calculation.
- [ ] Provider/baseline comparison runner.
- [ ] Jev -> fallback-provider cascade evaluation.
- [ ] Machine-readable JSON result plus human-readable console/Markdown summary.

**Exit criterion:** one command can compare Jev with a baseline on the same labeled dataset and show the automation trade-off across thresholds, including cascade behavior.

## M3 — Minimal reference patterns

**Goal:** teach the primitives with small examples before introducing a larger showcase.

- [ ] `support-routing`: multi-class ticket routing.
- [ ] `agent-decision-gate`: choose continue/tool/fallback/review/stop behavior from agent state.
- [ ] `llm-judge`: use Jev as a guard/judge signal around generated output and demonstrate binary-band policy.

Each example must include:

- a versioned decision definition;
- a small non-sensitive eval fixture;
- threshold rationale based on the fixture;
- a mock/offline path;
- a live Jev path;
- explicit host-owned side effect handling.

## M4 — RAG evaluator showcase

**Goal:** demonstrate Jev's atomic-judgment, calibration, multi-question composition, and cascade patterns in one substantial use case.

See [RAG evaluator showcase](rag-evaluator.md) and [#9](https://github.com/hamakyo/jev-starter/issues/9).

### Retrieval evaluation

- [ ] Per-chunk relevance.
- [ ] Context-set sufficiency.
- [ ] Evidence conflict detection.

### Generation evaluation

- [ ] Answer relevance.
- [ ] Answer-level groundedness.
- [ ] Contradiction detection.
- [ ] Optional reference-based correctness.

### Diagnosis and cascade

- [ ] Deterministic TypeScript diagnosis from component probabilities.
- [ ] Keep component scores visible instead of collapsing everything into one opaque RAG score.
- [ ] Compare Jev-only vs baseline judge vs Jev -> fallback judge cascade.
- [ ] Report calibration, coverage/risk, AURC, latency, and cost.
- [ ] Add optional host/LLM claim extraction -> Jev claim verification extension after basic mode works.

**Exit criterion:** the same labeled dataset can distinguish retrieval failures from generation failures and quantify when a Jev-first cascade can avoid fallback judging at an acceptable measured risk.

## M5 — Production ergonomics

**Goal:** make the starter safe to embed in real services.

- [ ] Structured decision events / observability hooks.
- [ ] Redaction-safe logging guidance.
- [ ] Abort/timeout propagation tests.
- [ ] Operational fallback semantics.
- [ ] Per-label or custom policies.
- [ ] Decision version comparison in evals.
- [ ] CI for lint, typecheck, unit tests, and offline evals.

## M6 — First public release

**Goal:** freeze the smallest useful API only after examples, evals, and the RAG showcase exercise it.

- [ ] Review public API surface for unnecessary abstraction.
- [ ] Add `CONTRIBUTING.md`, `SECURITY.md`, changelog, and release process.
- [ ] Add package metadata and chosen license.
- [ ] Publish `v0.1.0` or mark the repository as a template, depending on which distribution model proves more useful.
- [ ] Document migration notes for breaking upstream SDK changes.

## Deliberately deferred

These ideas should not block the first useful release:

- UI/dashboard for evals;
- hosted telemetry service;
- a large provider abstraction ecosystem;
- automatic business action execution;
- framework-specific React/Next.js integrations;
- generalized agent framework functionality;
- treating claim extraction as a Jev-native generation task.

The project should stay narrow: **turn Jev decisions into explicit, testable, measurable application policy.**
