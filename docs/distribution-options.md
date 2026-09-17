# Distribution options

The repository is prepared for either a package release or a template-oriented distribution, but no final choice has been made.

| Option | Strength | Cost / open question |
| --- | --- | --- |
| npm package | versioned dependency, `exports`, declarations, and semver-based upgrades | requires a license, release ownership, package naming/version policy, and publication process |
| GitHub template | easy starting point for examples and application-owned policy | upgrades are less centralized and consumers must manage dependency/build conventions |
| Both | reusable package plus a discoverable example repository | requires two release surfaces and clear source/package boundaries |

The current package metadata and `dist` build make the npm path technically testable. `pnpm package:check` installs the packed tarball into a temporary clean consumer and verifies `import "jev-starter"`. This is a dry-run validation only.

Before any public operation, maintainers must decide:

- the license and copyright policy;
- npm, template, or both;
- the first release version and tag;
- whether the package name and repository metadata are final;
- the publication and GitHub Release owners.

Until those decisions are recorded, this repository must not publish or create a public release.
