# RAG evaluator showcase

This showcase evaluates retrieval and generation as separate atomic judgments. It keeps chunk relevance, context sufficiency, conflict, answer relevance, groundedness, contradiction, and optional reference-based correctness visible in the report. The report includes accuracy, Brier, and weighted ECE for each available component. Rows without a reference answer omit the correctness question and metric.

The basic mode evaluates an answer as a whole. Claim extraction is intentionally outside this decision contract and is left as a future host/LLM extension; the source tree reserves a `ClaimExtractor` interface but provides no implementation.

The deterministic diagnosis precedence is:

```text
conflict
-> retrieval miss / insufficient
-> generator ungrounded
-> answer incorrect
-> uncertain
-> pass
```

Offline mode compares Jev-only, a deterministic baseline, and a Jev-to-baseline cascade on the same fixture:

```sh
pnpm rag:offline
```

The live command is explicit and requires `TYPESAFE_API_KEY`:

```sh
pnpm rag:live
```

No live request runs in normal CI. Fixture thresholds are demonstration values selected for this dataset, not universal safety defaults.

The fixture stores both final diagnosis labels and component ground truth under
`expected`. Component metrics are emitted for Jev-only output. The deterministic
baseline currently returns only final diagnosis/confidence, so baseline and
mixed cascade reports omit component metrics rather than reusing Jev
probabilities. The cascade report retains both provider legs and combines their
latency, usage, and model-specific fixture cost for fallback rows.
