# Data pipeline

The application reads only reviewed, schema-valid files in `public/data`; it never calls a source API in the browser. IPU Parline now covers ten full-profile pilots plus three standalone legislature pilots (IRN, SAU, MMR).

## IPU pilot refresh

```sh
npm run data:refresh:ipu
npm run data:validate
```

The refresh command:

1. Reads canonical ISO alpha-2, alpha-3, and M49 identities from
   `config/pilot-countries.json`.
2. Calls the public, unauthenticated Parline API with timeouts, bounded retries,
   a descriptive user agent, pagination, and an explicit authentication error.
3. Fetches countries, parliaments, chambers, elections, political parties,
   people referenced as Speakers, and taxonomy metadata.
4. Saves raw snapshots to ignored `.cache/ipu` files for local review and
   repeatable generation.
5. Validates each IPU country join against all three configured identifiers.
6. Runs every pilot through the same normalizer. There are no country switches,
   party-name overrides, or country-specific editorial strings in the adapter.
7. Replaces the parliamentary and expected-election slice of each profile while
   preserving government, relation, territory, and map sourcing.
8. Applies the shared reviewed curated-override registry. The committed registry
   is currently empty, so this step is a no-op.
9. Updates the global deduplicated `public/data/sources.json` registry and writes a sorted manifest with SHA-256 hashes for all ten full profiles, all three legislature modules, and the registry.

To reproduce output from the retained raw inputs without making network calls:

```sh
npm run data:refresh:ipu -- --from-cache
```

For a stable review timestamp and build ID:

```sh
npm run data:refresh:ipu -- \
  --from-cache \
  --retrieved-at=2026-09-19T00:00:00.000Z \
  --build-id=2026-09-19
```

Raw caches are deliberately not committed. The normalized public data includes
IPU attribution, licence, retrieval time, and terms URL.

## Canonical election rules

- `latestElection` is distinct from current chamber composition.
- Full renewals use the reported result as the post-election composition.
- Partial renewals use IPU's explicit “Full composition” breakdown when present,
  including IPU's standardized election-note list when its seat total matches the
  chamber size exactly.
- A partial renewal without that breakdown is marked `contested-seats-only` and
  never expanded from previous results.
- `nextExpectedElections` may contain one entry per national parliamentary
  chamber or renewal cycle. The IPU adapter emits no local or subnational events.
- Speaker and electoral-system fields are optional, structured, and rendered
  only when returned by IPU.
- A latest IPU election/renewal event more than six calendar years before the
  profile `buildId` is flagged in the Legislature UI with a warning triangle
  and orange text. Exactly six years is not flagged. The event date, not the
  source retrieval timestamp, controls this warning.

The remaining planned adapter order is:

1. UN M49 country identity mappings.
2. Referenced leader records with official-site overrides.
3. Official electoral-commission calendars for confirmed dates that complement
   rather than overwrite IPU's expected national renewals.
4. Foreign-ministry mission directories.

Review generated JSON and the manifest diff before opening a pull request. A
failed fetch must leave the last committed public data available.

## Global source registry

`public/data/sources.json` is the sole public source-metadata registry. Country profiles contain only stable `sourceIds`. Generation fails if an incoming source reuses an existing ID with materially different metadata. The registry and every profile are hash-bound by `public/data/manifest.json`.

## Curated overrides

`packages/data-pipeline/config/curated-overrides.json` is the single explicit
path for future reviewed factual corrections that cannot be represented by the
generic source adapters. It is intentionally empty at Phase 3 completion.

Both IPU and Wikimedia refreshes apply the registry after normalisation and
source enrichment and before staged public output and manifest hashing. Entries
are replacement-only and must target an existing path in one ISO3 full profile
or legislature module. Every entry requires supporting source IDs, a reason,
author, reviewer, and review date. Unknown sources, missing/unsafe paths,
duplicate IDs, unsupported operations, and incomplete review metadata fail
closed. An empty registry returns the source-derived object unchanged.

After any future override is added, the normal `npm run data:validate` gate
still determines whether the resulting generated profile satisfies the public
schema. Do not implement a correction as a country branch in an adapter merely
to avoid using this registry.

## Wikipedia chamber fallback

Wikipedia acquisition is a separate explicit process:

```sh
npm run data:refresh:wikipedia
npm run data:refresh:wikipedia -- --from-cache
npm run data:refresh:wikipedia -- --country=GBR
```

For each configured country the adapter resolves `Parliament of {country}`
through Wikimedia's MediaWiki REST API. It first requests the page through the
REST `page/{title}/with_html` resource and falls back to the REST `search/page`
resource when the conventional title is absent. The returned rendered HTML is
parsed for the parliament infobox; linked house or chamber pages are retrieved
through the same REST page resource and compared with already-normalized IPU
chambers.

IPU remains authoritative for every chamber it supplies. Wikipedia can add a
chamber that does not match an IPU chamber and can enrich a matched chamber with
a separate source-reported party-seat composition only when IPU does not provide
a full post-election composition. The fallback composition never becomes
`latestElection.outcome`: it is a distinct chamber field with its own retrieval
time and Wikipedia source IDs.

Chamber matching prefers strong normalized-name evidence across the IPU primary
name plus IPU-provided local/full chamber aliases, then compatible chamber
identity. When source names differ but exactly one still-unmatched IPU chamber
has the same explicit lower/upper/unicameral kind, that unique kind can resolve
the alias. A statutory-capacity match is used only when it identifies exactly
one still-unmatched authoritative chamber; capacity is never treated as a
globally unique chamber identity. Previously generated
Wikipedia fallback chambers are reconciled on every refresh and are removed
when IPU later supplies the chamber. Added chambers may be partial records:
unknown Speaker, electoral-system, or election fields remain unknown rather
than being invented.

For composition precedence:

1. if IPU supplies a full post-election composition, use IPU and do not publish
   a Wikipedia composition fallback;
2. if IPU supplies an election record but no full party-seat split, retain that
   IPU election record and separately publish a safely parsed Wikipedia
   source-reported composition;
3. if a Wikipedia composition sums to more than the chamber's statutory seat
   count, reject it;
4. if the source breakdown sums to fewer than the statutory seats, display the
   reported total without inferring that the remainder are vacancies;
5. never convert Wikipedia's current political-group listing into a historical
   election result.

Chamber kind is resolved in this order:

1. explicit Wikipedia lower/upper/unicameral labeling;
2. the opposite kind of a matching IPU chamber when exactly one side is
   missing;
3. unicameral when Wikipedia exposes exactly one chamber and IPU exposes none;
4. as a final two-chamber heuristic, the larger chamber is treated as the lower
   house, except for the United Kingdom where the larger chamber is treated as
   the upper house.

Raw Wikipedia snapshots are retained only under ignored
`.cache/wikipedia`. New REST snapshots retain the stable page ID plus the latest
revision ID/timestamp and licence metadata returned by Wikimedia, so a cached
run can be tied to an exact page revision. Wikipedia page IDs remain the public
source identity so renames and redirects do not create duplicate source
records.

The read-only Wikimedia REST endpoints used by this adapter require **no API
key**. Requests send the project's descriptive User-Agent and no Authorization
header. If authenticated Wikimedia access is introduced later it must be a
separate reviewed credential change, not an implicit requirement of this
pipeline.

## Standalone legislature pilots

`packages/data-pipeline/config/pilot-countries.json` defines the ten countries
with complete reviewed profiles. `legislature-pilots.json` independently
defines Iran, Saudi Arabia, and Myanmar. Both IPU and Wikimedia refresh commands
process the combined 13-country legislature set. A legislature-only country is
written to `public/data/legislatures/{ISO3}.json` using the same chamber and
renewal contracts embedded in a full country profile.

The manifest hashes both collections separately. Adding a legislature pilot
therefore does not widen the unrelated government, leader, territory, or
diplomatic-relations completeness contract. IPU local/full chamber names are
retained as reconciliation aliases, not as additional chambers. When IPU
explicitly reports a chamber as suspended, that operational status, effective
date, note, and IPU provenance are preserved and rendered rather than inferred.

### Seat display colours

Wikimedia rendered infobox entries may contain an adjacent colour swatch. The
parser canonicalizes safe `#RGB`, `#RRGGBB`, and `rgb(...)` values to
uppercase `#RRGGBB`. Every rendered entry that links to an English Wikipedia
party article is resolved through Wikidata. Its unambiguous P465 sRGB value is
the canonical entity colour and overrides chamber-local swatches; a rendered
swatch remains the fallback when P465 is absent or ambiguous. There is no fuzzy
party-name lookup or country-specific colour table.

For a safely matched IPU party, only this display colour is copied; the IPU
party identity and seat count are unchanged. Exact article links retained on an
aggregate political-group heading may identify a coalition even when the
source lists its member parties as separate leaf entries. Across chambers, a
colour is propagated only through a shared IPU party ID or exact Wikipedia
article identity. Generic labels such as independent or vacant are not treated
as cross-chamber entities, and conflicting source colours are not propagated or
overwritten unless one exact Wikidata P465 identity colour disambiguates them.
Ambiguous or multi-valued Wikidata colours are left unresolved. The UI hashes
the stable party/entry ID to select a repeatable fallback colour, so reordering
rows cannot change unresolved colours.

Colour is visual metadata, not evidence of ideology or party identity.

## Phase 4A party data core — first implementation increment

The source-backed party-data foundation is being introduced in bounded increments.
The first increment adds the reusable, offline normalisers and validators:

- `packages/data-pipeline/wikipedia/party-position.mjs` recognises only
  explicit Wikipedia infobox political-position values on the seven-point
  spectrum and ranges between them. Source classifications such as
  "Big tent" remain textual. Missing values do not become classifications.
- `packages/data-pipeline/wikipedia/party.mjs` extracts an allow-listed
  set of cleaned infobox facts from an **already verified exact** English
  Wikipedia article, using the stable page ID as party identity.
  Contradictory position rows suppress classification rather than selecting
  one arbitrarily.
- `packages/schemas/party.ts` defines party summary, detailed profile and
  political-position contracts with source provenance, URL safety and stable
  page-ID identity validation.

These are pure preparation functions and contracts: they do not fetch pages,
resolve ambiguous identities, update the public source registry or write
`public/data`. They are not yet invoked by the Wikimedia refresh.
The subsequent data-pipeline increment will add conservative article identity
resolution, cache replay, cross-reference validation, regenerated pilot data,
manifest schema evolution and atomic publication. The seven-point UI and
secondary detail surface follow in a separate implementation PR.

Do not call the extraction function on a fuzzy search result or treat the mere
presence of an infobox as proof of party identity. No position is inferred from
ideology, colour or a party name.

### Exact linked-party acquisition (Phase 4A, increment 2)

The existing Wikipedia refresh still owns country and chamber data. The
following **explicit developer command** uses its ignored country snapshot to
acquire linked political-party articles:

```sh
npm run data:prepare:parties -- --country=GBR
npm run data:prepare:parties -- --country=GBR --from-cache
```

Run `npm run data:refresh:wikipedia -- --country=GBR` first if
`.cache/wikipedia/GBR.json` does not exist.

The command discovers exact Wikipedia article links inside the party dimension
of existing parliament and chamber infobox composition. It excludes generic
membership labels and unrelated faction/coalition views. It does **not** infer
identity from approximate names or use a Wikipedia search result as proof.

Only linked articles with party-specific infobox evidence are normalised using
the Phase 4A party schemas. Articles lacking evidence are omitted with an
explicit diagnostic. Requests are sequential and capped at 100 distinct
candidate titles per country. A failed source request aborts preparation
without replacing an earlier prepared file.

The ignored files are:

- `.cache/wikipedia/parties/GBR.json`: raw exact article observations,
  requested titles, candidate provenance and original retrieval timestamp;
- `.cache/wikipedia/parties/prepared/GBR.json`: normalised local
  party summaries, infobox details, sources and diagnostics.

`--from-cache` never requests external source data. It validates the
country ID, retrieval timestamp, candidate list and cached article identities
before replay. With the same snapshots it produces identical prepared JSON.

**This is a preparation slice, not public publication.** No generated
`public/data` profiles, schemas, source registry or manifest are
updated, and the UI is not yet connected. Wikidata exact sitelinks, safe
IPU-only candidate resolution, party cross-reference validation and atomic
manifest-backed publication remain required before approval of the full
Phase 4A data foundation. Live source retrieval still requires compliance
with the documented source policy.

### Verified party associations — review preview (Phase 4A, increment 3)

The explicit `data:prepare:parties` command now checks the prepared party
articles against the existing reviewed country/legislature profile and the
global source registry. It emits a **non-public review preview** at:

```text
.cache/wikipedia/parties/review/<ISO3>.json
```

The preview includes an annotated candidate profile, the referenced party
details and the additional party source records. It deliberately does not
alter the schema version of the public profile or update `public/data`.
The preview must **not** be copied straight into a published profile. Full
profile/manifest v6 transitions, validation and staged publication remain a
separate delivery increment.

Association is restricted to existing source-reported **party** composition
entries with an exact label and exact Wikipedia chamber source-page match to a
previously verified linked article. An unverified IPU election party is not
linked merely because its name resembles a Wikipedia title or another party.
Entries such as Independents and Vacant never receive party identities.
Multiple plausible entities for one exact label fail closed with an ambiguity
diagnostic.

Before emitting a preview, validation checks party summary/detail identities,
complete source provenance, source party-ID ownership, referenced detail
existence, orphan details, the Wikipedia HTTPS boundary and the absence of
generic membership links. Missing source metadata or a conflicting party
entity aborts preparation rather than producing a misleading review file.

The command still supports `--from-cache` without a network request.
Replay additionally reads the reviewed public profile and source registry,
which must remain the same inputs for identical preview output.

### Published party data (Phase 4A, increment 4)

The normal `data:refresh:wikipedia` command now performs linked-party
acquisition, conservative association, validation and publication in the same
run as chamber enrichment. `--country=ISO3` and `--from-cache` retain their
existing meanings. Cache replay never requests party pages. If a party cache is
absent, replay emits `PARTY_CACHE_UNAVAILABLE:<ISO3>` and preserves any existing
verified party data; a fresh checkout therefore safely publishes zero party
profiles rather than inventing facts.

Full profiles use schema v6, legislature-only profiles use schema v2, and the
manifest uses schema v6. Every profile has a `parties` summary collection.
Verified detail records are written as
`public/data/parties/wikipedia-en-<pageId>.json` and independently hashed in the
manifest. Composition and election entries may reference a summary with
`partyEntityId`, but exact chamber-link provenance remains required; IPU party
name similarity alone is not sufficient.

All country, legislature, party, source-registry and manifest output is built
in a temporary staging tree. Party cross-references, source IDs, page identity,
position ranges and HTTPS URLs are validated before public files are replaced.
Partial refreshes preserve unrelated profiles and details, while details no
longer referenced by any profile are removed after the new manifest is in
place. The IPU refresh also carries existing verified party data through its
own staged manifest rebuild.
