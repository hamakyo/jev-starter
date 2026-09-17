# Distribution decision

The first release will use both distribution surfaces, with the npm package as the primary reusable dependency and this repository as a GitHub template for application-owned examples and policy customization.

| Surface | Role | Release rule |
| --- | --- | --- |
| npm package | Primary distribution for versioned runtime/types and semver-based upgrades | Publish `jev-starter@0.1.0` only from tag `v0.1.0` after the release checklist passes |
| GitHub template | Secondary distribution for examples, eval fixtures, and application-owned policy | Enable template use from the same tagged repository state; consumers own later synchronization |

The package name remains `jev-starter`; the npm registry returned no existing package for that name when this decision was recorded on 2026-09-18. Availability must be checked again immediately before publication because registry ownership can change. `pnpm package:check` installs the packed tarball into a temporary clean consumer and verifies `import "jev-starter"`.

## Release identity and ownership

- License: MIT, copyright 2026 hamakyo.
- Package/version: `jev-starter@0.1.0`.
- Git tag: `v0.1.0`.
- Release owner: GitHub user `hamakyo`.
- Provenance: npm publication should use GitHub Actions OIDC trusted publishing/provenance rather than a long-lived npm token when the registry account supports it.
- Publication permission: confirm the `hamakyo` npm identity or designated npm owner immediately before enabling the release workflow.

These decisions do not themselves authorize a tag, npm publication, template setting change, or GitHub Release. Those operations still require the checklist and a separate human approval.
