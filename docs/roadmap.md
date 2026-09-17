# Roadmap

This roadmap is organized by capability rather than dates. Issue scope may change as the upstream Jev SDK evolves.

## M0 — Project contract

**Goal:** make the intended boundaries obvious before implementation begins.

- [x] Define architecture and side-effect boundary.
- [x] Define draft decision contract.
- [x] Define evaluation strategy.
- [x] Document implementation milestones.
- [ ] Select license.
- [ ] Add contribution and security guidance before wider external contribution.

## M1 — Runnable core

**Goal:** one typed Jev decision can run end-to-end from TypeScript.

- [ ] Bootstrap Node.js 20+ TypeScript workspace.
- [ ] Add `@typesafe-ai/sdk` integration.
- [ ] Implement `JevProvider`.
- [ ] Implement `defineDecision()` and typed `DecisionEngine`.
- [ ] Implement default three-route threshold policy: `auto | fallback | review`.
- [ ] Add `MockProvider` for deterministic tests.
- [ ] Validate threshold and contract invariants.
- [ ] Unit tests for provider, policy, and failure semantics.

**Exit criterion:** a local example can make a Jev call, obtain typed answers, and route the result without business side effects inside the engine.

## M2 — Evaluation harness

**Goal:** thresholds can be selected from evidence instead of intuition.

- [ ] JSONL fixture loader.
- [ ] Classification metrics and confusion matrix.
- [ ] Brier score and calibration report.
- [ ] Threshold sweep with coverage/error metrics.
- [ ] Latency and failure-rate reporting.
- [ ] Versioned pricing snapshot + estimated cost calculation.
- [ ] Provider/baseline comparison runner.
- [ ] Machine-readable JSON result plus human-readable console/Markdown summary.

**Exit criterion:** one command can compare Jev with a baseline on the same labeled dataset and show the automation trade-off across thresholds.

## M3 — Reference patterns

**Goal:** demonstrate where the abstraction is useful without turning the repository into a demo collection.

- [ ] `support-routing`: multi-class ticket routing.
- [ ] `agent-decision-gate`: choose continue/tool/fallback/review/stop behavior from agent state.
- [ ] `llm-judge`: use Jev as a guard/judge signal around generated output.

Each example must include:

- a decision definition;
- a small non-sensitive eval fixture;
- threshold rationale based on the fixture;
- a mock/offline path;
- a live Jev path;
- explicit host-owned side effect handling.

## M4 — Production ergonomics

**Goal:** make the starter safe to embed in real services.

- [ ] Structured decision events / observability hooks.
- [ ] Redaction-safe logging guidance.
- [ ] Abort/timeout propagation tests.
- [ ] Operational fallback semantics.
- [ ] Per-label or custom policies.
- [ ] Decision version comparison in evals.
- [ ] CI for lint, typecheck, unit tests, and offline evals.

## M5 — First public release

**Goal:** freeze the smallest useful API only after examples and evals exercise it.

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
- generalized agent framework functionality.

The project should stay narrow: **turn Jev decisions into explicit, testable, measurable application policy.**
