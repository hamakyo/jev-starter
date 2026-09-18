# Distribution status

The project uses both distribution surfaces, with the npm package as the primary reusable dependency and this repository as a GitHub template for application-owned examples and policy customization.

| Surface | Role | Current status |
| --- | --- | --- |
| npm package | Primary distribution for versioned runtime/types and semver-based upgrades | `jev-starter@0.1.1` was published from tag `v0.1.1` through GitHub Actions trusted publishing with provenance |
| GitHub template | Secondary distribution for examples, eval fixtures, and application-owned policy | Template use is enabled; consumers own later synchronization |

The published package name is `jev-starter`, and npm's `latest` dist-tag points to `0.1.1`. Install it with `pnpm add jev-starter`. `pnpm package:check` installs the packed tarball into a temporary clean consumer and verifies `import "jev-starter"`.

## Release identity and ownership

- License: MIT, copyright 2026 hamakyo.
- Package/version: `jev-starter@0.1.1`.
- Git tag: `v0.1.1`.
- Release owner: GitHub user `hamakyo`.
- Provenance: npm publication uses GitHub Actions OIDC trusted publishing rather than a long-lived npm token.
- Publication permission: the npm owner and release owner are `hamakyo`.

The `v0.1.1` publication, tag, and GitHub Release are complete, and the repository remains enabled as a template. Every future version still requires the checklist, an approved commit and version, and separate human approval before public operations run.
