# Release checklist

This checklist records the completed `v0.1.0` release and the approval-gated process retained for future releases.

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

## Completed release gate

- [x] Recheck that the npm name `jev-starter` is still available.
- [x] Confirm that the release owner can authenticate to npm as `hamakyo` with two-factor authentication enabled.
- [x] Bootstrap the unclaimed package name with a temporary public `0.0.0` release and deprecate that version.
- [x] Configure npm trusted publishing for GitHub user `hamakyo`, repository `jev-starter`, workflow `release.yml`, with direct `npm publish` allowed.
- [x] Obtain explicit approval for the `0.0.0` bootstrap/deprecation, approved commit, `v0.1.0` tag, npm `0.1.0` publication, GitHub template setting, and GitHub Release.

## Release verification commands

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

The release owner completed the approved public operations on 2026-09-18.

## Completed first-package bootstrap

npm trusted publishing could be configured only after the package existed. The release owner published `0.0.0` once with the authenticated `hamakyo` account, deprecated it as a trusted-publishing bootstrap version, and then configured the trusted publisher. The tracked package version remained `0.1.0`; the bootstrap artifact was prepared in a temporary directory so the repository and release tag were not changed.

The trusted publisher must match these values exactly:

- Provider: GitHub Actions
- Organization or user: `hamakyo`
- Repository: `jev-starter`
- Workflow filename: `release.yml`
- Environment: none
- Allowed action: direct `npm publish`

For `v0.1.0`, the release owner manually ran the release workflow with the approved tag and full commit SHA. No `NPM_TOKEN` was configured; the workflow obtained a short-lived OIDC credential and npm generated provenance automatically. Future releases follow the same approval gate with their own version, tag, and commit.

## v0.1.0 result

- Approved package commit: `a420a7431cbf70a2fc1290c052827dae1889c241`
- npm package: `jev-starter@0.1.0`, published with trusted-publishing provenance
- npm dist-tag: `latest` points to `0.1.0`
- Registry clean-install and ESM import: passed
- Git tag and GitHub Release: `v0.1.0`
- GitHub repository template setting: enabled
