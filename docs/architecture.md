# Architecture

Polity Atlas runs on a developer's machine. GitHub stores reviewed code and data; it is not an application host.

- `app` and `components` contain the Vinext/React interface using Next-style App Router conventions.
- `packages/schemas` holds the shared, versioned data contract.
- `packages/data-pipeline` is reserved for explicit local source adapters and normalisers.
- `public/data` contains reviewed, citation-bearing JSON loaded by the browser.
- `npm run dev` serves the application on localhost; `npm run build` creates a local export in `dist/client`.

Private source API tokens belong in ignored local environment files or an approved credential store. Never use a `NEXT_PUBLIC_` or `VITE_` prefix for a private token, write it to generated data, or commit it.

## Accepted Phase 1 decisions

| Concern               | Authoritative choice                                    | Consequence                                                                                  |
| --------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Package management    | npm with `package-lock.json`                            | Use `npm ci` locally and in CI.                                                              |
| Application framework | Vinext with Next-style `app` conventions on Vite        | Keep the existing application structure.                                                     |
| Routing               | Static App Router output                                | Localhost routes and refreshes use the root path; no repository asset prefix or hash router. |
| Styling               | Tailwind CSS, shadcn primitives, semantic CSS variables | Centralise theme behaviour in tokens.                                                        |
| Typography            | System font stacks for now                              | Self-hosted fonts are deferred.                                                              |

`next.config.ts` retains static export, trailing slashes, and unoptimised images for local builds. The Pages-specific asset prefix and `NEXT_PUBLIC_BASE_PATH` have been removed. Local profile fetches use `/data/...`.

## Map rendering boundary

The global political atlas is rendered as SVG from bundled Natural Earth-derived geometry. Country rings are clipped at the antimeridian and projected with a deterministic Mercator projection. Three adjacent world copies provide seamless horizontal wrapping while vertical pan remains bounded.

Rendered geography uses canonical Polity Atlas `entityId` values rather than assuming every polygon has an M49 code. Primary countries, dependencies, overseas territories, disputed territories, and non-country areas are distinct entity kinds. The main search contains the 197 primary research entities defined in `docs/border-policy.md`; map geometry may contain additional areas without promoting them into that primary set.

The current base country layer remains the established 110m `world-atlas` geometry. Pinned Natural Earth 50m breakaway/disputed polygons and disputed boundary lines are layered above it. This is a transitional runtime arrangement: `packages/data-pipeline/map/` defines the boundary for moving all geometry normalization and future levels of detail into reproducible generated assets.

Country links own click/tap selection; map drag capture deliberately does not begin on a country link. Disputed areas and dependencies have independent semantic styling and hover identity. MapLibre remains an installed GIS dependency for future detailed regional or local views where conventional slippy-map behaviour, dense layers, or tiled data are appropriate. It is not the renderer for the global world atlas.

## Repository controls

- `.github/workflows/ci.yml` runs the `verify` job on pull requests and pushes to `main`.
- `.github/workflows/codeql.yml` analyses JavaScript and TypeScript.
- `.github/dependabot.yml` proposes dependency updates.
- The repository setting should require `verify` on `main`; confirm the effective rule after workflow changes.
- Source ingestion is manual pending approved source access and adapters. There is no scheduled placeholder validation or deployment workflow.
