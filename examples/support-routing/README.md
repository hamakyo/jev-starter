# Support routing

This example routes a support ticket to `billing`, `technical`, or `other` with a named confidence policy. The engine returns a route and typed answers; the host application owns the actual ticket operation.

The threshold pair is selected only for this tiny fixture to exercise `auto`, `fallback`, and `review`. It is not a universal safety value.

Run the deterministic path with:

```sh
pnpm examples:offline
```

The live path is explicit and requires `TYPESAFE_API_KEY`:

```sh
pnpm examples:live
```

No live request is made by normal CI.
