# Polity Atlas

A source-led geopolitical GIS workspace for researching governments, parliaments, elections, political parties, and diplomatic relations.

## Current foundation

- npm with a committed lockfile and Node.js 22 or later.
- Vinext's Next-style `app` conventions, built by Vite and run locally.
- Tailwind CSS, shadcn primitives, and semantic CSS custom-property theme tokens.
- Interactive horizontally wrapping Mercator SVG world atlas with canonical country/territory identities, Natural Earth disputed-area overlays, and separate disputed/dependency styling; MapLibre is retained for future detailed/local GIS views.
- Global country selection and search.
- Ten full citation-bearing pilot profiles plus three legislature-only pilots generated through shared IPU Parline
  normalization path for parliament, chamber, Speaker, electoral-system, and
  parliamentary-election data.
- Legislature, multi-entry expected-election, relation, and source views. Iran, Saudi Arabia, and Myanmar can expose the generated legislature module before a full country profile exists.
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
`http://localhost:3000`). The map, all ten bundled full profiles, and the three
legislature-only modules load without source API credentials. To stop the
server, press Ctrl+C. Local source data changes should be reviewed before
committing.

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

Reviewed data lives in `public/data`. Source metadata is deduplicated in `public/data/sources.json`; country profiles contain only stable `sourceIds`. Keep private source credentials in ignored
local environment files or an approved credential store, and use them only in
explicit ingestion commands. Never expose them through `VITE_` or
`NEXT_PUBLIC_` variables or commit them. There is no scheduled data ingestion.

The IPU Parline adapter is public and unauthenticated; it needs no API key. The refresh covers the ten full-profile pilots plus legislature-only Iran, Saudi Arabia, and Myanmar. Run the explicit refresh with:

```sh
npm run data:refresh:ipu
```

Raw responses are retained only in the ignored `.cache/ipu` directory. The
command validates ISO joins, updates the ten full profiles plus three
legislature modules, and rebuilds the hash-backed manifest. A cached rerun is
available for deterministic review:

```sh
npm run data:refresh:ipu -- --from-cache
```

IPU supplies national parliament and parliamentary-renewal data only. A separate
Wikipedia fallback can inspect national parliament and chamber pages, add a
chamber that IPU does not register, and provide a source-reported party-seat
composition when IPU does not provide a full chamber split:

```sh
npm run data:refresh:wikipedia
npm run data:refresh:wikipedia -- --from-cache
npm run data:refresh:wikipedia -- --country=AUS
```

The Wikipedia process never replaces an IPU chamber or an IPU full
post-election composition. It resolves a `Parliament of X` page through
Wikimedia's MediaWiki REST API, follows chamber links, and uses the rendered
infobox structure for two bounded fallbacks: unmatched national chambers and a
separate `source-reported` chamber composition when a matched IPU chamber has
no full party-seat split. The UI labels that composition as Wikipedia-sourced
and keeps it distinct from the historical election outcome. Read-only Wikimedia
access requires no API key or bearer token. Heads of state/government, diplomatic relations, and
Natural Earth map geometry remain outside these parliament adapters.

See `docs/architecture.md`, `docs/source-policy.md`, and `docs/border-policy.md` before adding a source adapter or changing political map geometry.

## Legislature modules and colours

The user-facing country tab is **Legislature**. The internal workspace key remains
`parliament` so existing saved state does not need a migration.

The original ten pilots remain full country profiles under
`public/data/countries`. Iran, Saudi Arabia, and Myanmar are the first
legislature-only pilots under `public/data/legislatures`; they are generated
from canonical identity plus IPU/Wikimedia data and do not require fabricated
government or diplomatic-relations fields.

Seat totals and election/renewal facts remain IPU facts when IPU supplies them.
The Wikimedia adapter may add only visual colour metadata to a matched IPU party
result. It first uses the corresponding rendered Wikipedia legislature entry;
when that exact entry links to an English Wikipedia party article but has no
swatch, it may use one unambiguous Wikidata P465 value from the exact sitelink
identity. A missing or ambiguous colour never changes a party identity or seat
count: the UI uses a stable deterministic fallback colour instead.
Wikipedia-backed composition fallbacks retain their own Wikipedia provenance.

IPU-provided local/full chamber names are retained as reconciliation aliases so
different source naming does not create duplicate chambers. Source-reported
operational status is also preserved: a chamber explicitly marked suspended by
IPU is displayed as suspended with its effective date and source note rather
than being inferred from election history.
