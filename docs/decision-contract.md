# Decision contract

## Purpose

A decision contract describes one stable decision task independently from where its input came from or what side effect follows it. It is the unit that should be testable, versionable, and evaluable.

## Upstream Jev primitives

The official TypeSafe JavaScript SDK currently accepts a `state` plus named `questions`. Question types include `noul`, `choice`, and `score`. `choice` and `score` responses expose confidence and per-outcome probabilities; `noul` exposes the probability of a yes answer.

`jev-starter` should preserve those upstream semantics instead of inventing a competing question language.

## Application contract

```ts
interface DecisionDefinition<TQuestions extends Questions> {
  id: string;
  version: string;
  questions: TQuestions;
  policy: DecisionPolicy<TQuestions>;
}

type ConfidenceQuestionKey<TQuestions extends Questions> = {
  [K in keyof TQuestions]-?: TQuestions[K] extends ChoiceQuestion | ScoreQuestion ? K : never;
}[keyof TQuestions];

type NoulQuestionKey<TQuestions extends Questions> = {
  [K in keyof TQuestions]-?: TQuestions[K] extends NoulQuestion ? K : never;
}[keyof TQuestions];

type DecisionPolicy<TQuestions extends Questions> =
  | {
      kind: "confidence";
      question: ConfidenceQuestionKey<TQuestions>;
      autoThreshold: number;
      fallbackThreshold: number;
    }
  | {
      kind: "binary-band";
      question: NoulQuestionKey<TQuestions>;
      negativeThreshold: number;
      positiveThreshold: number;
      uncertainRoute: "fallback" | "review";
    }
  | {
      kind: "custom";
      decide(answers: AnswersFor<TQuestions>): "auto" | "fallback" | "review";
    };
```

A host invokes the definition with runtime state:

```ts
const outcome = await engine.decide(ticketRouting, {
  ticket: {
    subject,
    body,
  },
});
```

The engine combines the runtime state with the contract's questions, calls the configured provider, and applies the policy. The built-in selector is checked against the question kind when `defineDecision()` runs: confidence policies accept only `choice` or `score`, and binary-band policies accept only `noul`.

The implementation exposes `defineDecision()`, `DecisionEngine.decide()`, and the provider/policy types described above. The important invariant is that policy semantics are explicit and versioned with the decision.

`DecisionEngine` also accepts optional observability and operational-fallback settings. Observability is a callback over `success`, `provider-failure`, and `operational-fallback` events. Operational fallback is an explicit provider wrapper at the engine boundary; it is never inferred from a policy route and it never performs a business side effect.

## Why questions live in the contract

Questions and criteria define task semantics. If they change, historical metrics may no longer be comparable. Keeping them in a versioned definition allows:

- replaying the same dataset against a known contract;
- comparing contract versions;
- attributing production outcomes to the correct behavior;
- testing thresholds without rewriting model instructions.

## Policy behavior

### Confidence policy

For responses with a directly reported confidence, the default one-sided policy is:

```ts
if (confidence >= autoThreshold) return "auto";
if (confidence >= fallbackThreshold) return "fallback";
return "review";
```

This is appropriate when the selected outcome already represents the model's best class and the application mainly cares about confidence in that selection.

### Binary-band policy

For a `noul` response, low `P(true)` is not the same as uncertainty. A low probability can be a confident negative decision.

```ts
if (pTrue <= negativeThreshold) return "auto";
if (pTrue >= positiveThreshold) return "auto";
return uncertainRoute;
```

The answer map preserves the `noul` probability, so the host can distinguish the confident negative from the confident positive. The policy only decides whether the judgment is safe enough to automate.

Required invariant:

```text
0 <= negativeThreshold < positiveThreshold <= 1
```

A symmetric pair such as `0.05 / 0.95` may be useful during evaluation but is not a universal default.

## Multiple questions

A single Jev call can contain multiple named questions. The starter should not silently reduce several answers into one confidence value.

Initial implementation options should be explicit, for example:

- route based on one named primary answer;
- require every configured answer to satisfy its policy;
- provide a custom policy function that consumes the complete typed answer map.

The RAG evaluator showcase intentionally uses the last pattern for deterministic failure diagnosis: Jev answers atomic questions, while TypeScript composes the full answer map into application policy.

The first release implements named-question built-ins and a custom policy callback. The callback receives the complete typed answer map, so multi-question composition remains explicit.

## Output contract

The application-facing result should expose both the policy route and the underlying answer rather than discarding probabilities.

```ts
interface DecisionOutcome<TAnswers> {
  decisionId: string;
  decisionVersion: string;
  route: "auto" | "fallback" | "review";
  answers: TAnswers;
  model: string;
  latencyMs: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

## Invariants

1. `id` and `version` are required for decisions used in production or evals.
2. Confidence-policy thresholds satisfy `0 <= fallbackThreshold <= autoThreshold <= 1`.
3. Binary-band thresholds satisfy `0 <= negativeThreshold < positiveThreshold <= 1`.
4. No provider/API failure or malformed SDK response can produce `route: "auto"`; such failures reject and produce no outcome.
5. Multiple answers are never silently collapsed into one confidence value.
6. Raw state is not retained by the core engine after the call unless the host explicitly adds persistence.
7. Provider-specific metadata may be attached, but core policy code should depend only on documented normalized fields.
8. Observability events contain decision metadata and numeric answer signals, not raw state or raw answer objects.
9. Observer failures are ignored by default; `observerError: "throw"` is an explicit opt-in.
10. A configured operational fallback is attempted only according to its explicit `when` predicate (when supplied), and a failed fallback still rejects.

## Example: support routing

```ts
const ticketRouting = defineDecision({
  id: "support.ticket-routing",
  version: "1",
  questions: {
    category: choice("What is this ticket about?", {
      billing: null,
      technical: null,
      sales: null,
      other: null,
    }),
  },
  policy: {
    kind: "confidence",
    question: "category",
    autoThreshold: 0.9,
    fallbackThreshold: 0.65,
  },
});
```

## Example: binary verification

```ts
const groundedness = defineDecision({
  id: "rag.answer-grounded",
  version: "1",
  questions: {
    grounded: noul("Is the answer fully supported by the retrieved evidence?"),
  },
  policy: {
    kind: "binary-band",
    question: "grounded",
    negativeThreshold: 0.05,
    positiveThreshold: 0.95,
    uncertainRoute: "fallback",
  },
});
```

All thresholds above are illustrative only. Real thresholds must be chosen from evaluation data for the specific task and data distribution.
