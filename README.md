# Polity Atlas

A source-led geopolitical GIS workspace for researching governments, parliaments, elections, political parties, and diplomatic relations.

## Current foundation

- npm with a committed lockfile and Node.js 22 or later.
- Vinext's Next-style `app` conventions, built by Vite and run locally.
- Tailwind CSS, shadcn primitives, and semantic CSS custom-property theme tokens.
- Interactive horizontally wrapping Mercator SVG world atlas with canonical country/territory identities, Natural Earth disputed-area overlays, and separate disputed/dependency styling; MapLibre is retained for future detailed/local GIS views.
- Global country selection and search.
- Ten citation-bearing pilot profiles with IPU Parline-backed parliament and national parliamentary-election data.
- Parliament, election, relation, and source views.
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
`http://localhost:3000`). The map and bundled Australia profile load without
source API credentials. To stop the server, press Ctrl+C. Local source data
changes should be reviewed before committing.

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
`NEXT_PUBLIC_` variables or commit them. There is no scheduled data ingestion. IPU Parline's public API currently requires no API key or authentication.

See `docs/architecture.md`, `docs/source-policy.md`, and `docs/border-policy.md` before adding a source adapter or changing political map geometry.


## IPU Parline pilot data

IPU Parline is the parliamentary-data backbone for the ten pilot profiles. It supplies the national parliament/chamber structure, presiding-officer records, electoral-system metadata, parliamentary election/renewal records, and expected next parliamentary-election dates used by the pilot slice.

Seat graphics describe the latest election or renewal, **not current parliamentary composition**. A full post-election chamber is shown for a partial renewal only when IPU explicitly supplies full-composition values. Otherwise Polity Atlas shows only the seats contested in that renewal and labels them accordingly. Statutory chamber size is stored separately from the post-election total so systems with overhang or additional seats can be represented without forcing false equality.

The Parline API is public, read-only and currently documents no API key requirement. Fetch one pilot into the ignored local evidence cache with:

```sh
npm run data:ipu:fetch -- --country AU
```

Omit `--country` to fetch all configured pilots. Public IPU-derived data retains the dataset acknowledgement `Inter-Parliamentary Union: Parline, September 2026` and the IPU terms-of-use link. See `docs/source-policy.md` and `packages/data-pipeline/README.md`.
