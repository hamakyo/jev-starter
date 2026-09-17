# Release checklist

This checklist describes preparation only. The current work stops before the final policy decisions and any public operation.

## Completed preparation

- [x] Package metadata, ESM `exports`, declarations, and build output are configured.
- [x] Public runtime/type exports are reviewed and documented.
- [x] `pnpm pack --dry-run` is available.
- [x] A clean temporary consumer can install the packed tarball and import `jev-starter`.
- [x] Node/pnpm and upstream SDK compatibility guidance is documented.
- [x] Contributor and security guidance is present.
- [x] Changelog has an `[Unreleased]` entry.
- [x] CI runs typecheck, lint, tests, and all offline commands without a Jev API key.
- [x] Live commands are explicit and separated from CI.

## Required decision gate before release

- [ ] Select and add the project license.
- [ ] Select npm package, GitHub template, or both.
- [ ] Confirm package name, repository metadata, and public API surface.
- [ ] Select the release version and Git tag.
- [ ] Confirm release owner, provenance, and publication permissions.

## Commands to run after the decisions

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm eval:offline
pnpm examples:offline
pnpm rag:offline
pnpm build
pnpm package:check
```

Only after the decision gate and a separate human approval should a maintainer create a tag, publish a package, or publish a GitHub Release. Those actions are intentionally not performed by the secretless implementation workflow.
