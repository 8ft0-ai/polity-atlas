# Polity Atlas

A source-led geopolitical GIS workspace for researching governments, parliaments, elections, political parties, and diplomatic relations.

## Current foundation

- npm with a committed lockfile and Node.js 22 or later.
- Vinext's Next-style `app` conventions, built by Vite and run locally.
- Tailwind CSS, shadcn primitives, and semantic CSS custom-property theme tokens.
- Interactive horizontally wrapping Mercator SVG world atlas with canonical country/territory identities, Natural Earth disputed-area overlays, and separate disputed/dependency styling; MapLibre is retained for future detailed/local GIS views.
- Global country selection and search.
- Ten citation-bearing pilot profiles generated through a shared IPU Parline
  normalization path for parliament, chamber, Speaker, electoral-system, and
  parliamentary-election data.
- Parliament, multi-entry expected-election, relation, and source views.
- Light/dark themes and responsive country panel.
- Shared Zod schemas and automated data-quality tests.
- CI, CodeQL, and Dependabot for repository assurance.

These choices are the authoritative Phase 1 architecture. They intentionally supersede the initial proposal's pnpm workspace, plain React/Vite shell, hash router, and CSS Modules. See `docs/architecture.md` and `docs/implementation-plan.md` for the decision and its delivery implications. Self-hosted fonts remain deferred.

## Local development

Requires Node.js 22.13 or later. npm and `package-lock.json` are authoritative.

```sh
npm ci
npm run dev
```

Open the localhost address printed by the development server (usually
`http://localhost:3000`). The map and all ten bundled pilot profiles load
without source API credentials. To stop the server, press Ctrl+C. Local source
data changes should be reviewed before committing.

Verification:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

The build writes a local static export to `dist/client`. It is not deployed.
Routing uses the framework's static App Router output without a repository
subpath; verify new routes by navigating and refreshing on localhost.

Pull requests and pushes to `main` run the `verify` CI job. Repository settings must require that check before merging to satisfy the Phase 1 merge gate.

## Data and secrets

Reviewed data lives in `public/data`. Keep private source credentials in ignored
local environment files or an approved credential store, and use them only in
explicit ingestion commands. Never expose them through `VITE_` or
`NEXT_PUBLIC_` variables or commit them. There is no scheduled data ingestion.

The IPU Parline adapter is public and unauthenticated; it needs no API key. Run
the explicit pilot refresh with:

```sh
npm run data:refresh:ipu
```

Raw responses are retained only in the ignored `.cache/ipu` directory. The
command validates ISO joins, updates all ten normalized profiles, and rebuilds
the hash-backed manifest. A cached rerun is available for deterministic review:

```sh
npm run data:refresh:ipu -- --from-cache
```

IPU supplies national parliament and parliamentary-renewal data only. Heads of
state/government, diplomatic relations, and Natural Earth map geometry remain
outside the IPU adapter.

See `docs/architecture.md`, `docs/source-policy.md`, and `docs/border-policy.md` before adding a source adapter or changing political map geometry.
