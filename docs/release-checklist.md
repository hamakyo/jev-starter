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
- [x] A manual release workflow verifies the approved tag and commit before publishing with npm trusted publishing.

## Recorded release decisions

- [x] Use the MIT License with copyright held by hamakyo.
- [x] Use both npm package and GitHub template distribution; npm is primary.
- [x] Keep `jev-starter` as the package name and confirm the repository metadata and public API surface.
- [x] Use package version `0.1.0` and Git tag `v0.1.0`.
- [x] Assign release ownership to `hamakyo` and prefer GitHub Actions OIDC provenance.

## Required gate before public operation

- [ ] Recheck that the npm name `jev-starter` is still available.
- [x] Confirm that the release owner can authenticate to npm as `hamakyo` with two-factor authentication enabled.
- [ ] Bootstrap the unclaimed package name with a temporary public `0.0.0` release and deprecate that version.
- [ ] Configure npm trusted publishing for GitHub user `hamakyo`, repository `jev-starter`, workflow `release.yml`, with direct `npm publish` allowed.
- [ ] Obtain explicit approval for the `0.0.0` bootstrap/deprecation, approved commit, `v0.1.0` tag, npm `0.1.0` publication, GitHub template setting, and GitHub Release.

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

## First-package bootstrap

npm trusted publishing can be configured only after the package exists. Publish `0.0.0` once with the authenticated `hamakyo` account, deprecate it as a trusted-publishing bootstrap version, and then configure the trusted publisher. The tracked package version remains `0.1.0`; prepare the bootstrap artifact in a temporary directory so the repository and release tag are not changed.

The trusted publisher must match these values exactly:

- Provider: GitHub Actions
- Organization or user: `hamakyo`
- Repository: `jev-starter`
- Workflow filename: `release.yml`
- Environment: none
- Allowed action: direct `npm publish`

After `v0.1.0` points at the separately approved commit, manually run the release workflow with the tag and full commit SHA. Do not configure `NPM_TOKEN`; the workflow obtains a short-lived OIDC credential and npm generates provenance automatically.
