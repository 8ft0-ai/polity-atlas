# Architecture

Polity Atlas separates the public research interface from its source-ingestion process.

- `app` and `components` contain the Vinext/React interface using Next-style App Router conventions.
- `packages/schemas` is the shared, versioned data contract.
- `packages/data-pipeline` is reserved for build-time source adapters and normalizers.
- `public/data` contains reviewed, citation-bearing JSON safe for public deployment.
- GitHub Actions validates every profile and exports the site to `dist/client` for GitHub Pages.

Private API tokens must remain in GitHub Actions secrets. They must never use a `NEXT_PUBLIC_` or `VITE_` prefix, enter a URL, or be written to generated data.

## Phase 1 architecture decision

The working repository is the authority for the Phase 1 foundation. The decisions below intentionally supersede the corresponding stack prescriptions in the initial implementation proposal; they are not migration debt.

| Concern               | Authoritative choice                                        | Delivery consequence                                                                                                         |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Package management    | npm with `package-lock.json`                                | Local development and Actions use `npm ci`; pnpm workspace files must not be introduced without a new architecture decision. |
| Application framework | Vinext with Next-style `app` conventions on Vite            | `vinext build` produces the static export while retaining the existing application structure.                                |
| Routing               | Static App Router output without a hash router              | New public routes must be statically exportable and verified under the GitHub Pages repository path.                         |
| Styling               | Tailwind CSS, shadcn primitives, and semantic CSS variables | Theme behavior stays centralized in tokens while component composition uses the existing utility/primitives model.           |
| Typography            | System font stacks for now                                  | Self-hosted fonts are explicitly deferred and are not part of the current Phase 1 exit gate.                                 |

## Build and deployment model

`next.config.ts` enables static export, trailing slashes, and unoptimized images. During GitHub Actions, it derives `/<repository>` from `GITHUB_REPOSITORY` and exposes that value as `NEXT_PUBLIC_BASE_PATH`. This keeps generated assets and data requests repository-aware without hash routing.

The Pages workflow installs from the npm lockfile, type-checks, tests, builds, prepares the generated `_next` asset directory, uploads `dist/client`, and deploys through GitHub Pages. Changes to routing, export layout, `assetPrefix`, or the Pages artifact step must be tested together.

## Repository controls

- `.github/workflows/ci.yml` runs the stable `verify` job on pull requests and pushes to `main`.
- `.github/workflows/codeql.yml` analyzes JavaScript and TypeScript on pull requests, pushes to `main`, and a weekly schedule. It has only `contents: read` and `security-events: write` permissions.
- `.github/dependabot.yml` owns weekly npm and GitHub Actions dependency updates.
- GitHub repository settings must require the `verify` status check on `main`; this setting is deliberately external to the repository files and must be verified in GitHub after workflow changes.
