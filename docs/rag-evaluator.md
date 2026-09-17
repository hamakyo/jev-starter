# RAG Evaluator Showcase

## Why this belongs in jev-starter

RAG evaluation is a strong showcase for Jev because it is naturally decomposed into several small judgment tasks rather than one open-ended generation task. The showcase should demonstrate the core philosophy of this repository:

> Let Jev estimate atomic decisions; let application code compose those estimates into explicit policy and diagnosis.

The showcase is not intended to claim that Jev is a universally superior RAG judge. Its purpose is to make that question measurable on a labeled dataset and to demonstrate selective automation, fallback, and failure diagnosis.

## Target pipeline

```text
Question --------------------+
Retrieved contexts ----------+----> Jev atomic judgments
Generated answer ------------+              |
Reference answer (optional) -+              v
                                    typed probabilities
                                             |
                                             v
                                    diagnosis policy
                                      /      |      \
                                     /       |       \
                               auto pass  fallback  auto fail
                                           judge
```

The first release should keep answer generation and business side effects outside the evaluator.

## Evaluation dimensions

### Retrieval

Evaluate retrieval separately from generation.

- `chunk_relevance[]`: whether each retrieved chunk contains information relevant to the question;
- `context_sufficiency`: whether the retrieved context set contains enough evidence to answer the question;
- `context_conflict`: whether the retrieved evidence contains materially conflicting information relevant to the answer.

`context_sufficiency` is a **set-level** property. It must not be implemented as a simple average of chunk relevance scores.

### Generation

- `answer_relevance`: whether the answer directly addresses the question;
- `groundedness`: whether the answer is supported by the retrieved evidence;
- `contradiction`: whether the answer contradicts retrieved evidence;
- `correctness`: whether the answer is consistent with a reference answer when one is available.

Reference-dependent metrics must remain optional so the evaluator can also operate on datasets without reference answers.

## Basic and advanced groundedness modes

### Basic mode

Evaluate the answer as a whole. This is easy to run and should be the first working implementation.

```text
question + contexts + answer
            |
            v
     groundedness probability
```

The limitation must be documented: one unsupported claim can be hidden inside an otherwise well-supported answer.

### Advanced mode

Allow the host application or an external LLM to extract atomic claims before Jev verifies them.

```text
answer
  |
  v
host / LLM claim extraction
  |
  +-- claim 1 ----> Jev support probability
  +-- claim 2 ----> Jev support probability
  +-- claim 3 ----> Jev support probability
```

Claim extraction is deliberately not part of the Jev decision contract because it is a generation task. The showcase should make this boundary explicit rather than pretending Jev replaces every LLM step.

## Do not collapse everything into one RAG score

The primary output should preserve independent dimensions and expose a diagnosis derived in TypeScript.

Example normalized result:

```json
{
  "retrieval": {
    "chunkRelevance": {
      "c1": 0.97,
      "c2": 0.81
    },
    "sufficiency": 0.43,
    "conflict": 0.04
  },
  "generation": {
    "groundedness": 0.96,
    "relevance": 0.99,
    "correctness": 0.72,
    "contradiction": 0.03
  },
  "diagnosis": "RETRIEVAL_INSUFFICIENT"
}
```

The numeric values above are illustrative only.

## Diagnosis policy

Jev should answer atomic questions. The final failure diagnosis belongs to deterministic application policy.

Initial diagnosis vocabulary:

- `PASS`;
- `RETRIEVAL_MISS`;
- `RETRIEVAL_INSUFFICIENT`;
- `CONFLICTING_EVIDENCE`;
- `GENERATOR_UNGROUNDED`;
- `ANSWER_INCORRECT`;
- `JUDGE_UNCERTAIN`.

Example policy shape:

```ts
if (retrieval.sufficiency <= failThreshold) {
  return "RETRIEVAL_INSUFFICIENT";
}

if (
  retrieval.sufficiency >= passThreshold &&
  generation.groundedness <= failThreshold
) {
  return "GENERATOR_UNGROUNDED";
}
```

The real policy must be selected from eval data, not copied from documentation examples.

## Two-sided confidence policy

For binary/Noul judgments, low `P(true)` should not automatically be treated as uncertainty. A confident negative and an uncertain result are different states.

Use two-sided thresholds:

```text
P(true) <= fail threshold       -> confident negative / auto fail
fail threshold < P(true) < pass threshold -> uncertain / fallback judge
P(true) >= pass threshold       -> confident positive / auto pass
```

For example, with symmetric thresholds, `<= 0.05` may be an auto-fail candidate and `>= 0.95` an auto-pass candidate, while the middle band is escalated. These values are examples only and must be calibrated per dataset and decision.

## Cascade mode

The showcase should support three comparable modes on the same dataset:

1. **Jev-only** — atomic Jev judgments and deterministic policy;
2. **baseline judge** — an existing LLM-as-a-Judge or other evaluator;
3. **Jev -> fallback judge cascade** — Jev accepts only sufficiently confident positive/negative judgments and sends ambiguous cases to the baseline.

This is the core deployment question the showcase should answer:

> How much judge traffic can Jev resolve at an acceptable risk, and what quality/latency/cost trade-off remains after fallback?

## Dataset

Planned fixture shape:

```json
{
  "id": "rag-001",
  "question": "...",
  "contexts": [
    { "id": "c1", "text": "..." },
    { "id": "c2", "text": "..." }
  ],
  "answer": "...",
  "referenceAnswer": "...",
  "labels": {
    "contextSufficient": true,
    "answerGrounded": false
  }
}
```

The exact schema may evolve, but ground-truth labels must be explicit and versioned. Datasets committed to the repository must be non-sensitive.

## Metrics

The showcase should reuse the generic eval harness and add RAG-specific slices.

Minimum metrics:

- accuracy / precision / recall / F1 per judgment where applicable;
- Brier score;
- ECE or another documented calibration metric;
- reliability table/diagram data;
- coverage and risk/error across confidence thresholds;
- risk-coverage curve and AURC where meaningful;
- cascade fallback rate;
- end-to-end quality after fallback;
- latency p50 / p95;
- failure rate;
- estimated cost using a versioned pricing snapshot.

Report metrics separately for retrieval and generation dimensions. A single aggregate score may be provided as a secondary convenience metric only if its formula is explicit and the component metrics remain visible.

## Planned layout

```text
examples/
  rag-evaluator/
    README.md
    src/
      retrieval.ts
      generation.ts
      diagnosis.ts
      policy.ts
    evals/
      dataset.jsonl
      run.ts
    reports/
      .gitkeep
```

Reusable metrics and provider comparison logic belong under the repository-level `evals/` package rather than being duplicated inside the showcase.

## Acceptance principles

The showcase is successful when it can:

- distinguish retrieval failure from generation failure on labeled examples;
- preserve per-dimension probabilities rather than emit only one opaque RAG score;
- show when Jev is confident enough to bypass a more expensive fallback judge;
- measure Jev-only, baseline-only, and cascade modes on identical data;
- demonstrate calibration and risk/coverage rather than rely on raw confidence values;
- run deterministically offline with `MockProvider` in normal CI;
- run live Jev evaluation only when explicitly requested;
- state clearly that type-safe output does not imply semantically infallible judgment.
