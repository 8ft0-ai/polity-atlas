# Architecture

Polity Atlas runs on a developer's machine. GitHub stores reviewed code and data; it is not an application host.

- `app` and `components` contain the Vinext/React interface using Next-style App Router conventions.
- `packages/schemas` holds the shared, versioned data contract.
- `packages/data-pipeline` contains explicit local source adapters and normalisers. The bounded Phase 3 IPU path is implemented under `packages/data-pipeline/ipu`; reusable Wikipedia acquisition and chamber fallback live under `packages/data-pipeline/wikipedia`. Wikipedia article acquisition uses Wikimedia's MediaWiki REST API rather than the legacy Action API.
- `public/data` contains reviewed, citation-bearing JSON loaded by the browser.
- `npm run dev` serves the application on localhost; `npm run build` creates a local export in `dist/client`.

Private source API tokens belong in ignored local environment files or an approved credential store. Never use a `NEXT_PUBLIC_` or `VITE_` prefix for a private token, write it to generated data, or commit it. IPU Parline currently requires no key and the adapter sends no authorization header.

## IPU normalization boundary

The ten pilot profiles use one country-neutral flow:

```text
pilot ISO identity
  -> unauthenticated IPU JSON:API adapter
  -> ignored raw snapshot cache
  -> canonical normalizer
  -> schema validation
  -> public country JSON + hash-backed manifest
```

The configuration supplies only canonical identity joins. It does not select country-specific transformations or editorial prose. IPU party and person identifiers are resolved through the API when supplied, note-only composition labels receive deterministic election-scoped identifiers, and taxonomy values are resolved through IPU metadata with a deterministic fallback label.

Parliamentary election results are not treated as current composition. A chamber's `latestElection` preserves seats at stake and scope. For a partial renewal, the normalizer publishes `postElectionComposition` only when IPU explicitly supplies a full-composition breakdown, either as structured data or as its standardized election-note list. A note-derived list is accepted only when its seat total exactly matches the chamber size. Otherwise the normalizer publishes `seatsWonInElection` as `contested-seats-only`. It never reconstructs a whole chamber from prior elections.

`nextExpectedElections` is a collection because bicameral systems and separate renewal cycles can yield multiple entries. The IPU adapter emits only national parliamentary events. It does not infer local or subnational elections.

Heads of state/government, diplomatic relations, territory associations, and Natural Earth geometry are preserved from their existing non-IPU sources when the parliamentary slice is regenerated.

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

The global atlas consumes generated Natural Earth v5.1.2 LOD packages from `public/data/geometry/lod/`. At world scale it uses a 110m package; after the detailed-zoom threshold it switches atomically to a 50m package. Each package contains countries, disputed areas, and disputed boundaries, so semantic overlays cannot drift to a different cartographic resolution from the base map. The switch uses hysteresis to avoid threshold flicker. Natural Earth's disputed-area polygons are available at 50m rather than 10m, so 50m is the highest approved global political LOD. Countries too small to render reliably at world scale remain accessible through the 197-entity search index rather than synthetic point markers; higher-detail regional GIS remains a MapLibre concern.

Country links own click/tap selection; map drag capture deliberately does not begin on a country link. Disputed areas and dependencies have independent semantic styling and hover identity. MapLibre remains an installed GIS dependency for future detailed regional or local views where conventional slippy-map behaviour, dense layers, or tiled data are appropriate. It is not the renderer for the global world atlas.

## Repository controls

- `.github/workflows/ci.yml` runs the `verify` job on pull requests and pushes to `main`.
- `.github/workflows/codeql.yml` analyses JavaScript and TypeScript.
- `.github/dependabot.yml` proposes dependency updates.
- The repository setting should require `verify` on `main`; confirm the effective rule after workflow changes.
- Source ingestion is manual. The approved IPU pilot adapter is explicit and unauthenticated; remaining adapters still require source review. There is no scheduled ingestion, placeholder validation, or deployment workflow.

## Global source registry

Country profiles do not embed source metadata. They refer to stable source IDs, resolved against `public/data/sources.json`. The source registry is generated deterministically, rejects conflicting reuse of a source ID, and is independently hash-bound in the public data manifest.

## Wikipedia chamber-completion boundary

Wikipedia acquisition is deliberately separate from the IPU refresh. It is a
fallback completion path, not an override layer.

```text
Parliament of {country}
  -> MediaWiki REST page/{title}/with_html
  -> REST search/page fallback when needed
  -> canonical Wikipedia page + revision metadata
  -> infobox house links
  -> chamber-page infoboxes
  -> compare against normalized IPU chambers
  -> add unmatched chambers
  -> enrich matched chambers with source-reported composition only when IPU
     lacks a full split
  -> global source registry + schema-v4 profiles + manifest
```

The comparison happens at chamber granularity. A country can therefore retain
one or more IPU chambers while receiving an additional Wikipedia-backed chamber
that IPU does not register. A matched IPU chamber may also receive an optional
schema-v4 `composition` object when IPU lacks a full party-seat split. That
object has `basis: source-reported`, its own retrieval timestamp, terminal
party/group seat entries, and Wikipedia source IDs.

The composition object is deliberately separate from `latestElection`.
Wikipedia political-group data therefore cannot silently become a historical
election outcome. A later IPU refresh preserves the fallback while IPU still
lacks a full composition and removes it once IPU supplies one. Fallback
chambers may remain structurally partial; unavailable Speaker, electoral-system,
and election fields remain absent.

House kind is taken from explicit source labeling first, then inferred from the
opposite kind of an existing IPU chamber. Seat-count classification is only a
last resort for two unlabeled Wikipedia chambers: larger is treated as lower,
with the United Kingdom as the explicit larger-upper-house exception.

### Wikimedia REST acquisition

The Wikipedia adapter uses unauthenticated Wikimedia REST reads only. Article
identity and rendered HTML come from the MediaWiki REST v1 page resource; title
fallback uses the REST page-search resource. The adapter does not use
`w/api.php` or `action=parse` in its normal path. New raw snapshots record
page ID, canonical title/key, latest revision ID and timestamp, and licence
metadata before normalization. These acquisition details remain in the ignored
cache and do not change the country schema in this phase.

Wikidata REST is not used to obtain parliamentary infobox HTML: the seat and
political-group structures needed by later phases are Wikipedia article
content. Wikidata may be added later as an entity-identity supplement without
replacing MediaWiki REST for article rendering.
