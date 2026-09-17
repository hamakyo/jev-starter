# Agent decision gate

This example asks Jev for a typed recommendation such as `continue`, `tool`, `fallback`, `review`, or `stop`. The host application then interprets that recommendation.

The `tool` branch returns a `tool-recommendation` value only. Actual tool authorization and execution remain outside the decision engine and outside the example's switch.

The thresholds are selected for the small fixture and are not universal safety values.

```sh
pnpm examples:offline
```

The opt-in live path is:

```sh
pnpm examples:live
```
