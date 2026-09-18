# Contributing

`jev-starter` is published but remains pre-1.0. The public API is intentionally small and may change while the decision contract and the upstream Jev SDK evolve.

## Development environment

- Node.js 20 or a newer supported LTS release;
- pnpm 9.15.4, as pinned by `packageManager`;
- no API key is needed for the normal test and evaluation workflow.

Install and run the complete offline quality gate:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm eval:offline
pnpm examples:offline
pnpm rag:offline
```

`pnpm build` and `pnpm package:check` verify the generated declarations, package exports, tarball contents, and a clean consumer install. `pnpm pack:check` is a non-publishing package preview.

## Live commands

Live commands are opt-in and are not part of normal CI:

```sh
TYPESAFE_API_KEY=... pnpm eval:live
TYPESAFE_API_KEY=... pnpm examples:live
TYPESAFE_API_KEY=... pnpm rag:live
```

Do not put API keys in fixtures, source files, reports, logs, or pull requests. The live commands fail before making a request when `TYPESAFE_API_KEY` is missing.

## Change boundaries

- Keep transport, authentication, retry, and HTTP behavior in the official SDK.
- Keep business side effects in the host application; examples return recommendations only.
- Preserve the complete typed answer map and its probabilities in outcomes and offline reports.
- Do not add raw state to observability events by default.
- Add or update deterministic tests for contract, provider, policy, and report changes.
- Use the repository's existing pnpm and Biome configuration.

Please explain any intentional contract or upstream compatibility change in the pull request and update the relevant documentation and changelog entry.
