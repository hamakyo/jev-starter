# Release checklist

This checklist separates decisions already recorded from the remaining approval-gated public operations.

## Completed preparation

- [x] Package metadata, ESM `exports`, declarations, and build output are configured.
- [x] Public runtime/type exports are reviewed and documented.
- [x] `pnpm pack:check` creates and inspects the package archive without publishing it.
- [x] A clean temporary consumer can install the packed tarball and import `jev-starter`.
- [x] Node/pnpm and upstream SDK compatibility guidance is documented.
- [x] Contributor and security guidance is present.
- [x] Changelog has an `[Unreleased]` entry.
- [x] CI runs typecheck, lint, tests, and all offline commands without a Jev API key.
- [x] Live commands are explicit and separated from CI.
- [x] Live smoke commands completed successfully against the Jev API.

## Recorded release decisions

- [x] Use the MIT License with copyright held by hamakyo.
- [x] Use both npm package and GitHub template distribution; npm is primary.
- [x] Keep `jev-starter` as the package name and confirm the repository metadata and public API surface.
- [x] Use package version `0.1.0` and Git tag `v0.1.0`.
- [x] Assign release ownership to `hamakyo` and prefer GitHub Actions OIDC provenance.

## Required gate before public operation

- [ ] Recheck that the npm name `jev-starter` is still available.
- [ ] Confirm that `hamakyo` or the designated npm owner has publication permission.
- [ ] Configure and review trusted publishing/provenance for the selected npm owner.
- [ ] Obtain explicit approval to create `v0.1.0`, enable the GitHub template setting, publish npm, and create the GitHub Release.

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

Only after the remaining gate and a separate human approval should the release owner create the tag, enable the template setting, publish the package, or publish a GitHub Release.
