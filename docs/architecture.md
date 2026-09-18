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

The global political atlas is rendered as SVG from the bundled Natural Earth-derived country geometry. Country rings are clipped at the antimeridian, projected with a deterministic Mercator projection, and rendered as interactive SVG paths keyed by M49. Three adjacent world copies provide seamless horizontal wrapping while vertical pan remains bounded. Country links own click/tap selection; map drag capture deliberately does not begin on a country link, keeping selection independent of pan gesture handling. This keeps global country shape, selection, relation highlighting, and world-scale navigation independent of MapLibre's tiled polygon pipeline.

MapLibre remains an installed GIS dependency for future detailed regional or local views where conventional slippy-map behaviour, dense layers, or tiled data are appropriate. It is not the renderer for the global world atlas.

## Repository controls

- `.github/workflows/ci.yml` runs the `verify` job on pull requests and pushes to `main`.
- `.github/workflows/codeql.yml` analyses JavaScript and TypeScript.
- `.github/dependabot.yml` proposes dependency updates.
- The repository setting should require `verify` on `main`; confirm the effective rule after workflow changes.
- Source ingestion is manual pending approved source access and adapters. There is no scheduled placeholder validation or deployment workflow.
