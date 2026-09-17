# Compatibility

## Supported toolchain

| Component | Supported baseline | Verification |
| --- | --- | --- |
| Node.js | `>=20` | CI runs Node 20 and the current LTS matrix entry |
| pnpm | `9.15.4` | pinned by `packageManager` and CI setup |
| TypeScript | 5.7 or compatible strict compiler | typecheck and declaration build |
| `@typesafe-ai/sdk` | `0.6.0` | exact runtime dependency pin |

The package is ESM and is compiled with `module: NodeNext`. Consumers should use a Node.js release that supports package `exports`, ESM, and `AbortSignal`.

## Upstream SDK boundary

`JevProvider` delegates transport, authentication, HTTP errors, retry, and request cancellation to `@typesafe-ai/sdk`. It calls `TypeSafeClient.systemOne()` once and forwards the request's `signal`, `timeout`, and optional `model` override.

The adapter normalizes only `usage.input_tokens` and `usage.output_tokens` to `inputTokens` and `outputTokens`. It validates the runtime response against the requested questions before policy application. In particular, model, usage, and every answer's required fields must be present; score legends must match their declared criteria.

An upstream SDK change to question or answer shapes is therefore a compatibility event even if this package's TypeScript API still compiles. Upgrade procedure:

1. inspect the upstream release notes and type definitions;
2. update the exact dependency and lockfile together;
3. extend the provider validator and fake-client tests;
4. rerun the offline quality gate and package check;
5. record the migration in the changelog before release.

No compatibility claim is made for unverified live API behavior in this repository.
