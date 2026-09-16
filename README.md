# Polity Atlas

A source-led geopolitical GIS workspace for researching governments, parliaments, elections, political parties, and diplomatic relations.

## Current foundation

- Interactive MapLibre world map using Natural Earth-derived geometry from `world-atlas`.
- Global country selection and search.
- Citation-bearing Australia demonstration profile.
- Parliament, election, relation, and source views.
- Light/dark themes and responsive country panel.
- Shared Zod schemas and automated data-quality tests.
- Static export and GitHub Pages workflows.

## Local development

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Verification:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The static export is written to `dist/client`.

## Data and secrets

Public, reviewed data lives in `public/data`. Private source credentials belong in GitHub Actions secrets and must never be exposed through browser-prefixed environment variables.

See `docs/architecture.md` and `docs/source-policy.md` before adding a source adapter.
