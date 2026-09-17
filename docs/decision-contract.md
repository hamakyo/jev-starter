# Decision contract

## Purpose

A decision contract describes one stable decision task independently from where its input came from or what side effect follows it. It is the unit that should be testable, versionable, and evaluable.

## Upstream Jev primitives

The official TypeSafe JavaScript SDK currently accepts a `state` plus named `questions`. Question types include `noul`, `choice`, and `score`. `choice` and `score` responses expose confidence and per-outcome probabilities; `noul` exposes the probability of a yes answer.

`jev-starter` should preserve those upstream semantics instead of inventing a competing question language.

## Proposed application contract

```ts
interface DecisionDefinition<TQuestions> {
  id: string;
  version: string;
  questions: TQuestions;
  policy: DecisionPolicy;
}

interface DecisionPolicy {
  autoThreshold: number;
  fallbackThreshold: number;
}
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

The engine combines the runtime state with the contract's questions, calls the configured provider, and applies the policy.

## Why questions live in the contract

Questions and criteria define task semantics. If they change, historical metrics may no longer be comparable. Keeping them in a versioned definition allows:

- replaying the same dataset against a known contract;
- comparing contract versions;
- attributing production outcomes to the correct behavior;
- testing thresholds without rewriting model instructions.

## Policy behavior

For responses with a directly reported confidence, the default policy is:

```ts
if (confidence >= autoThreshold) return "auto";
if (confidence >= fallbackThreshold) return "fallback";
return "review";
```

For `noul`, policy code should explicitly define how the yes probability is converted into the confidence of the selected boolean outcome. This must be covered by tests rather than implied.

## Multiple questions

A single Jev call can contain multiple named questions. The starter should not silently reduce several answers into one confidence value.

Initial implementation options should be explicit, for example:

- route based on one named primary answer;
- require every configured answer to satisfy its threshold;
- provide a custom policy function that consumes the complete typed answer map.

The first release should implement the simplest safe option and leave aggregation extensible.

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
2. `fallbackThreshold <= autoThreshold`.
3. Thresholds are within `[0, 1]`.
4. No provider/API failure can produce `route: "auto"`.
5. Raw state is not retained by the core engine after the call unless the host explicitly adds persistence.
6. Provider-specific metadata may be attached, but core policy code should depend only on documented normalized fields.

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
    autoThreshold: 0.9,
    fallbackThreshold: 0.65,
  },
});
```

The thresholds above are illustrative only. Real thresholds must be chosen from evaluation data for the specific task.
