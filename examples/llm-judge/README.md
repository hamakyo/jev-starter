# LLM judge guard

This example uses a `noul` judgment as a guard around generated output. A low probability is a confident negative (`fail`), while a middle-band probability is uncertain and follows the configured fallback route.

The `0.1 / 0.9` thresholds are selected only for this fixture. They are not universal safety values and should be chosen from task-specific calibration data.

```sh
pnpm examples:offline
```

The explicit live path is:

```sh
pnpm examples:live
```
