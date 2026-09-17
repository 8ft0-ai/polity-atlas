# Polity Atlas

A source-led geopolitical GIS workspace for researching governments, parliaments, elections, political parties, and diplomatic relations.

## Current foundation

- npm with a committed lockfile and Node.js 22 or later.
- Vinext's Next-style `app` conventions, built by Vite and statically exported for GitHub Pages.
- Tailwind CSS, shadcn primitives, and semantic CSS custom-property theme tokens.
- Interactive MapLibre world map using Natural Earth-derived geometry from `world-atlas`.
- Global country selection and search.
- Citation-bearing Australia demonstration profile.
- Parliament, election, relation, and source views.
- Light/dark themes and responsive country panel.
- Shared Zod schemas and automated data-quality tests.
- CI, CodeQL, Dependabot, and GitHub Pages workflows.

These choices are the authoritative Phase 1 architecture. They intentionally supersede the initial proposal's pnpm workspace, plain React/Vite shell, hash router, and CSS Modules. See `docs/architecture.md` and `docs/implementation-plan.md` for the decision and its delivery implications. Self-hosted fonts remain deferred.

## Local development

Requires Node.js 22 or later. npm and `package-lock.json` are authoritative.

```sh
npm ci
npm run dev
```

Verification:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

The static export is written to `dist/client`. In GitHub Actions, `next.config.ts` derives the repository asset prefix from `GITHUB_REPOSITORY`; the Pages workflow then publishes the export. Routing uses the framework's static App Router output, not a client-side hash router, so every new public route must remain compatible with static export and GitHub Pages.

Pull requests and pushes to `main` run the `verify` CI job. Repository settings must require that check before merging to satisfy the Phase 1 merge gate.

## Data and secrets

Public, reviewed data lives in `public/data`. Private source credentials belong in GitHub Actions secrets and must never be exposed through browser-prefixed environment variables.

See `docs/architecture.md` and `docs/source-policy.md` before adding a source adapter.
