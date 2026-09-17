# Implementation plan status

This document records repository-approved changes to the original geopolitical GIS implementation plan. The product direction and later phases remain valid unless another architecture decision changes them. For Phase 1, this file and `docs/architecture.md` are authoritative.

## Phase 1 — Repository and delivery foundation

### Accepted architecture supersessions

- npm with a committed `package-lock.json` replaces the proposed pnpm workspace.
- Vinext's Next-style application conventions on Vite replace a plain React/Vite shell.
- Static App Router output with a repository-aware asset prefix replaces hash routing.
- Tailwind CSS and shadcn primitives, backed by semantic CSS variables, replace CSS Modules.
- Self-hosted fonts are deferred by product decision; the existing system stacks remain in scope.

These are intentional decisions around the working application, not gaps to be mechanically reverted.

### Repository deliverables

- Strict TypeScript plus npm scripts for type-checking, linting, formatting, tests, and production builds.
- A `verify` CI job on pull requests and pushes to `main`.
- A least-privilege CodeQL workflow for JavaScript and TypeScript.
- Repository-owned Dependabot schedules for npm and GitHub Actions.
- A repository-aware static export and GitHub Pages deployment from `main`.
- Semantic light/dark theme tokens. Self-hosted fonts are not currently required.

### Exit criteria

Phase 1 is complete when both conditions are true:

1. The current `main` revision deploys successfully to GitHub Pages.
2. The `main` branch requires the `verify` status check before a pull request can merge.

The second condition is a GitHub repository setting, not a workflow file. After changing CI or protection settings, verify the effective rule in **Settings → Rules → Rulesets** or **Settings → Branches** and confirm a pull request cannot merge while `verify` is pending or failing.
