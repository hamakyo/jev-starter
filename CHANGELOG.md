# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

- Added `ANSWER_IRRELEVANT` to the RAG diagnosis contract. Low answer relevance
  is now a confident automatic failure with retrieval-first precedence, while
  mid-band relevance remains an uncertain fallback case. The reference-aware
  and reference-free RAG decision contracts are now version `2`.
## [0.1.0] - 2026-09-18

- Added a deterministic `MockProvider` with canned, scenario, resolver, scripted, timeout, abort, and error paths.
- Added shared runtime validation for Jev and mock responses, including complete choice/score/noul answers and required model/usage metadata.
- Added offline evaluation metrics, threshold sweeps, comparison/cascade runners, JSON/Markdown reports, and explicit pricing-snapshot handling.
- Added support-routing, agent-decision-gate, llm-judge, and basic RAG evaluator examples with opt-in live command stubs.
- Added structured decision events, error classification, observer behavior, and operational fallback semantics.
- Added package build/export checks and contributor, security, compatibility, distribution, and release guidance.
- Selected the MIT License, npm package plus GitHub template distribution, and the initial `0.1.0` / `v0.1.0` release identity.
- Verified all opt-in live commands against the Jev API without adding credentials to the repository.
