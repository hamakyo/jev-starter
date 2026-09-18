# Issue #10 implementation plan

Issue: [Handle low answer relevance in RAG diagnosis](https://github.com/hamakyo/jev-starter/issues/10)

Referent table: [`referent-table-issue-10-plan.md`](referent-tables/referent-table-issue-10-plan.md)  
Referent table SHA-256: `49111dbb585d04efaf42a4385acd5bd51303d293719ecac783db84c873c5c2bf`

## Intended result

`diagnoseRag()` must return `ANSWER_IRRELEVANT` when `generation.relevance <= failThreshold`, unless an earlier retrieval diagnosis already applies. A low answer-relevance probability must never fall through to `PASS`.

The deterministic precedence will be:

```text
CONFLICTING_EVIDENCE
RETRIEVAL_MISS
RETRIEVAL_INSUFFICIENT
ANSWER_IRRELEVANT
GENERATOR_UNGROUNDED
ANSWER_INCORRECT
JUDGE_UNCERTAIN
PASS
```

`ANSWER_IRRELEVANT` is an automatic failure diagnosis, not a fallback diagnosis. Only `JUDGE_UNCERTAIN` continues to use the fallback route.

## Diagnosis type, branch, and confidence

Change these files together:

- `examples/rag-evaluator/src/types.ts`
  - Add `ANSWER_IRRELEVANT` to `RAG_DIAGNOSES`, which also updates `RagDiagnosis`, fixture validation, and baseline validation.
- `examples/rag-evaluator/src/diagnosis.ts`
  - Insert the relevance failure branch after all retrieval failures and before groundedness/contradiction.
  - Add `ANSWER_IRRELEVANT` to `diagnosisConfidence()` with `1 - judgments.generation.relevance`.
  - Keep the existing open uncertainty band: values strictly between the two thresholds remain `JUDGE_UNCERTAIN` when no earlier diagnosis applies.
- `examples/rag-evaluator/src/policy.ts`
  - Add `ANSWER_IRRELEVANT` to `RAG_POLICY_METADATA.diagnosisPrecedence` at the same position as the executable branch.
  - Keep `shouldFallbackRag()` unchanged so irrelevant answers remain an `auto` result.

No generic `DecisionEngine`, provider, or evaluation-runner behavior needs to change. The defect is confined to the RAG showcase's deterministic composition policy.

## Regression coverage for thresholds and precedence

Extend `tests/rag/diagnosis.test.ts` with focused cases:

1. Relevance below the fail threshold returns `ANSWER_IRRELEVANT` and confidence equals `1 - relevance`.
2. Relevance exactly equal to the fail threshold returns `ANSWER_IRRELEVANT`.
3. Relevance strictly between fail and pass thresholds returns `JUDGE_UNCERTAIN` when every other signal passes.
4. Relevance at or above the pass threshold returns `PASS` when every other signal passes.
5. Low relevance combined with each earlier retrieval condition still returns the retrieval diagnosis, proving retrieval-before-generation precedence.
6. Low relevance combined with low groundedness or low correctness returns `ANSWER_IRRELEVANT`, proving the documented ordering among generation diagnoses.

Tests should use `RAG_THRESHOLDS` rather than duplicating numeric threshold values except where testing an exact boundary.

## Offline fixture and report contract

Add one committed dataset row, tentatively `rag-009`, to `examples/rag-evaluator/evals/dataset.jsonl`:

- healthy chunk relevance, context sufficiency, and conflict;
- clearly low `answerRelevance`;
- otherwise healthy groundedness, contradiction, and correctness;
- Jev and baseline diagnosis `ANSWER_IRRELEVANT`;
- explicit component ground truth with `answerRelevance: false`.

This row ensures the new diagnosis is exercised by Jev-only, baseline, comparison, and cascade reports rather than only by a unit test. Update:

- `examples/rag-evaluator/reports/expected-report.json` for the new row count, fallback rate, and correctness count;
- `tests/rag/evaluator.test.ts` for dataset counts, component counts, aggregate usage/cost, and a direct assertion that `rag-009` is `ANSWER_IRRELEVANT` with route `auto`;
- any dataset hash and aggregate values produced by the existing runners. Values must be copied from deterministic runner output, not estimated manually.

The new row must not become a cascade fallback row. The existing uncertain row remains the only fallback selection, so the fallback count stays constant while its rate changes with the dataset size.

## Decision identity and documentation

The diagnosis meaning changes for both reference-aware and reference-free inputs. Increment both decision versions in `examples/rag-evaluator/src/modes.ts` from `1` to `2`, while retaining their existing IDs. Update decision-version assertions in `tests/rag/evaluator.test.ts`.

Document the exact new vocabulary and precedence in:

- `examples/rag-evaluator/README.md`;
- `docs/rag-evaluator.md`;
- `CHANGELOG.md` under `[Unreleased]`.

The documentation must state that low relevance is a confident automatic failure, mid-band relevance is uncertain, and retrieval failures retain precedence. It must not present the fixture thresholds as universal defaults.

## Verification and completion conditions

Run the following without an API key:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm rag:offline
pnpm examples:offline
pnpm build
pnpm pack:check
git diff --check
```

Issue #10 is complete when:

- low relevance cannot produce `PASS`;
- boundary, confidence, and precedence tests pass;
- the new diagnosis appears consistently in type validation, policy metadata, fixture data, and offline reports;
- both RAG decision variants report decision version `2`;
- offline reports remain deterministic and internally consistent;
- no live API call or secret is required.

After implementation review, treat the change as a `v0.1.1` candidate. Updating the package version, creating a tag, publishing npm, and creating a GitHub Release remain separate approval-gated release operations.
