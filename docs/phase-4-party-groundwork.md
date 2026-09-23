# Phase 4A: Party identity, political position, and detail inspection

## Decision

Phase 4 begins with a bounded groundwork slice for political-party identity, source-backed political position, and a reusable secondary detail slide-over.

This document is the implementation contract for that slice. It refines the broader Phase 4 section in [the overall implementation plan](./implementation-plan.md) without changing the source-precedence or citation-first rules completed in Phase 3.

The immediate product requirements are:

1. Beside each safely identified party in a Legislature composition, show seven ordered positions: **Far Left, Left, Centre Left, Centre, Centre Right, Right, Far-Right**.
2. Read political position from the party's English Wikipedia infobox, using only the explicit `Position` or `Political position` field.
3. If the source uses a non-linear classification such as `Big tent`, show that text instead of forcing it onto the seven-point scale.
4. Make safely identified parties interactive.
5. Clicking a party opens a secondary slide-over containing a concise structured summary of its Wikipedia infobox and a direct source link.
6. Keep the data and slide-over architecture reusable for richer party pages and other entity types later.

The rest of the original Phase 4 UI remains deferred until this foundation is stable.

## Existing baseline

Phase 3 already supplies the important prerequisites:

- IPU election/composition entries carry stable source-facing `partyId` values and party names.
- Wikipedia legislature/chamber parsing already retains exact linked article titles for political entries.
- The Phase 3 colour pipeline already reconciles safely matched IPU entries with exact English Wikipedia article identities and exact Wikidata sitelinks.
- Wikidata P465 colour enrichment is explicitly presentation metadata and must not be treated as evidence of ideology.
- The Wikipedia client already fetches rendered pages through Wikimedia REST, follows bounded same-origin redirects, retains stable page IDs/revision metadata, and supports bounded page search.
- `parse-infobox.mjs` already converts rendered Wikipedia infobox HTML into cleaned labels, text, and links instead of exposing arbitrary HTML to the browser.
- Raw Wikimedia snapshots remain in ignored local cache storage and can be replayed deterministically.
- The application reads only reviewed JSON from `public/data`; it makes no source-network call when a country is opened.
- Public source metadata is deduplicated in `public/data/sources.json` and generated output is hash-bound by `public/data/manifest.json`.
- Curated corrections have one generic, reviewed override pathway and no embedded country-specific branches.

The principal missing boundary is a first-class party entity model. At present, parties are primarily represented as strings/IDs inside election and composition entries.

## Source and editorial policy

Political position is an independently sourced fact. It must not be derived from any other party metadata.

The following relationships are explicitly invalid:

```text
party colour -> political position
party name -> political position
Wikipedia ideology -> political position
government/opposition status -> political position
coalition membership -> political position
another party's position -> political position
```

For the seven-point indicator, Phase 4A uses only the English Wikipedia infobox field labelled `Position` or `Political position`.

If Wikipedia publishes both:

```text
Political position: Centre
Ideology: Big tent
```

the position indicator shows **Centre**. `Big tent` may appear separately in the detail panel as ideology.

If Wikipedia publishes only:

```text
Ideology: Big tent
```

and no position field, the position indicator is **Not listed**. Ideology must never be promoted into the position field.

The UI should describe the fact as a source report, for example “Wikipedia infobox position: Centre-left”, rather than presenting Polity Atlas as having independently classified the party.

## Stable party identity

Do not replace the existing source party ID. Introduce a separate Polity Atlas party entity ID.

Composition/election entries become conceptually:

```ts
{
  partyId: 'au-australian_labor_party_alp',
  partyEntityId: 'party:wikipedia:216082',
  party: 'Australian Labor Party (ALP)',
  seats: 94
}
```

Use the stable English Wikipedia page ID for an exact Wikipedia-backed entity:

```text
party:wikipedia:<page-id>
```

Do not use the mutable article title as the canonical entity ID. A Wikipedia page move may update title/URL while preserving the party entity.

Multiple source party IDs may reference one party entity only when exact identity reconciliation proves they refer to the same entity.

Generic political labels remain non-entities unless separately proven:

- Independent / Independents
- Vacant / Vacancy
- Other / Others
- Crossbench / Crossbenchers
- Non-partisan
- Unaffiliated
- Speaker
- generic membership-role labels

These values must not trigger a Wikipedia search merely because they occupy seats.

## Party data model

Phase 4A should separate lightweight country/legislature party summaries from lazily loaded detail data.

### Party summary

Add a party summary collection to both full country profiles and standalone legislature profiles:

```ts
type PoliticalPartySummary = {
  entityId: string;
  displayName: string;
  sourcePartyIds: string[];

  wikipedia: {
    pageId: number;
    title: string;
  };

  position?: PoliticalPosition;
  sourceIds: string[];
};
```

Seat/composition entries may carry `partyEntityId?: string` to reference this collection.

The summary contains enough information for the Legislature position indicator without loading another file.

### Party detail

Generate standalone party detail records, for example:

```text
public/data/parties/wikipedia-en-216082.json
```

Conceptual schema:

```ts
type PoliticalPartyProfile = {
  schemaVersion: 1;
  entityId: string;

  identity: {
    displayName: string;
    abbreviation?: string;
    wikipediaPageId: number;
    wikipediaTitle: string;
    wikipediaUrl: string;
    wikidataId?: string;
  };

  position?: PoliticalPosition;
  facts: PartyFact[];
  sourceIds: string[];
};
```

The detail file is fetched only after the party detail panel opens. This keeps country/legislature files compact and gives future sources room to enrich party records without bloating every country profile.

## Political-position contract

Do not store political position as only a number from 1 to 7 because the source may publish a range or a non-linear label.

Use a discriminated representation:

```ts
type PositionPoint =
  | 'far-left'
  | 'left'
  | 'centre-left'
  | 'centre'
  | 'centre-right'
  | 'right'
  | 'far-right';

type PoliticalPosition =
  | {
      kind: 'scale';
      from: PositionPoint;
      to: PositionPoint;
      raw: string;
      sourceIds: string[];
    }
  | {
      kind: 'label';
      label: string;
      raw: string;
      sourceIds: string[];
    };
```

Examples:

```json
{
  "kind": "scale",
  "from": "centre-left",
  "to": "centre-left",
  "raw": "Centre-left",
  "sourceIds": ["wikipedia-en-page-..."]
}
```

```json
{
  "kind": "scale",
  "from": "centre-right",
  "to": "right",
  "raw": "Centre-right to right-wing",
  "sourceIds": ["wikipedia-en-page-..."]
}
```

```json
{
  "kind": "label",
  "label": "Big tent",
  "raw": "Big tent",
  "sourceIds": ["wikipedia-en-page-..."]
}
```

Always retain the source string in `raw`.

## Position normalisation

Create a deterministic parser, preferably isolated in:

```text
packages/data-pipeline/wikipedia/party-position.mjs
```

Recognise explicit spelling variants only:

- Far left / Far-left
- Left / Left-wing
- Centre left / Centre-left / Center left / Center-left
- Centre / Center
- Centre right / Centre-right / Center right / Center-right
- Right / Right-wing
- Far right / Far-right

Normalise American `center` spelling to the Polity Atlas `centre` vocabulary.

Recognise ranges only when both endpoints are explicit, such as:

- Centre-left to centre
- Centre-right to right-wing
- Left–centre-left

Do not maintain an expanding editorial taxonomy of ideological labels.

Values that cannot be safely mapped to the seven positions remain `kind: 'label'`. Examples include `Big tent`, `Syncretic`, `Catch-all`, or any other source wording that would require interpretation.

If the source field is absent, publish no position object and let the UI show `Not listed`.

## Party identity resolution

Identity resolution is the highest-risk part of this phase and must remain conservative.

Use this precedence:

### 1. Existing exact Wikipedia article identity

Reuse exact article links already retained by Phase 3 legislature/chamber composition parsing. If an IPU party has been safely reconciled with an exact article, use it directly.

### 2. Exact Wikidata to English-Wikipedia sitelink

Where exact Wikidata identity already exists, resolve its exact `enwiki` sitelink. Wikidata label similarity alone is not sufficient.

### 3. Bounded Wikipedia search fallback

Only when no exact identity is available, search with country context, using inputs such as:

```text
<party name> <country name>
<party abbreviation> <country name>
```

Search is discovery, not identity proof.

Fetch candidate articles and require strong evidence before accepting a result. Useful evidence may include close name/title agreement, expected country context, a political-party infobox, abbreviation agreement, and party-specific infobox fields such as Founded, Leader, Ideology, or Political position.

If more than one credible candidate remains, resolve none. Record a diagnostic such as:

```text
PARTY_WIKIPEDIA_IDENTITY_AMBIGUOUS
```

Do not select the first search result simply because it ranks first.

## Wikipedia party acquisition

Add a dedicated party module rather than continuing to enlarge parliament parsing:

```text
packages/data-pipeline/wikipedia/party.mjs
```

Its flow should be:

```text
source party identity
  -> resolve exact Wikipedia article
  -> fetch with existing WikipediaClient
  -> parse existing structured infobox rows
  -> extract allow-listed party facts
  -> normalise political position
  -> emit party summary + detail profile
```

Continue using Wikimedia REST and the existing descriptive User-Agent. No browser-side Wikipedia request is introduced.

## Infobox facts

Party detail should summarise structured infobox fields rather than article prose.

Initial allow-list:

- Abbreviation
- Leader
- President
- Chairperson
- Founded
- Headquarters
- Ideology
- Political position
- National affiliation
- International affiliation
- European affiliation
- Colours
- Website

Normalise known label variants into stable keys, but render facts generically:

```ts
type PartyFact = {
  key: string;
  label: string;
  values: string[];
  links?: PartyFactLink[];
  sourceIds: string[];
};
```

The UI should map over `party.facts` instead of hard-coding a bespoke component for every possible field.

Never expose arbitrary Wikipedia HTML in generated public data or inject source HTML into the browser. Store cleaned text and validated links only.

## Caching and deterministic replay

Extend the existing ignored Wikimedia cache so party snapshots are distinct from country/chamber snapshots, for example:

```text
.cache/wikipedia/
  countries/
  parties/
```

Once known, party cache records should be keyed by stable page ID.

Retain:

- page ID
- title
- revision ID
- revision timestamp
- retrieved timestamp
- licence metadata
- rendered HTML snapshot

Deduplicate party identities before fetching so a party present in multiple chambers is requested only once.

The existing command:

```sh
npm run data:refresh:wikipedia -- --from-cache
```

must reproduce the same normalised party output from the retained snapshot inputs when supplied the same build/retrieval timestamps.

## Refresh integration

Do not introduce a separate hand-maintained party workflow.

Extend the existing Wikipedia refresh path conceptually:

```text
parliament/chamber enrichment
  -> party identity consolidation
  -> party-page acquisition
  -> position + infobox extraction
  -> party profile generation
  -> curated overrides
  -> schema validation
  -> source reconciliation
  -> manifest hashing
```

Preserve `--country=ISO3` and `--from-cache` behaviour.

## Curated overrides

The existing curated-override registry remains the sole path for reviewed factual corrections.

Do not add country- or party-specific branches such as:

```js
if (party === '...') {
  position = '...';
}
```

If required by the implementation, extend override targeting so a reviewed replacement can address a party summary or detail profile while retaining the existing fail-closed requirements:

- existing target path
- replacement-only operation
- supporting source IDs
- reason
- author
- reviewer
- review date

The committed registry may remain empty.

## Schema and manifest evolution

Recommended schema transition:

```text
CountryProfile:      v5 -> v6
LegislatureProfile:  v1 -> v2
PartyProfile:        new v1
Manifest:            v5 -> v6
```

Add `parties: PoliticalPartySummary[]` to full and legislature-only profiles.

Add `partyEntityId?: string` to eligible seat/composition entries.

Extend the manifest with party detail files:

```json
{
  "parties": [
    {
      "entityId": "party:wikipedia:216082",
      "path": "parties/wikipedia-en-216082.json",
      "sha256": "..."
    }
  ]
}
```

Continue using `public/data/sources.json` as the global source registry.

Generation should stage country, legislature, party, source-registry, and manifest output atomically before replacing public data.

## Cross-reference validation

Fail validation when:

- a composition `partyEntityId` references no party summary;
- duplicate party summaries use the same entity ID inconsistently;
- one source party ID resolves to conflicting party entities;
- a party summary expects a missing detail profile;
- a detail profile lacks source provenance;
- a position source ID is absent from `sources.json`;
- a scale endpoint is invalid;
- a scale range is reversed;
- a published external URL violates the HTTPS policy;
- an invalid Wikipedia page ID is published;
- a generic political label receives a party entity ID without exact evidence;
- generated output does not match the active schema version.

Ambiguous identity resolution should produce a diagnostic and omit party enrichment rather than failing every other valid record for the country.

## Seven-point UI

Create a reusable component, for example:

```text
components/legislature/party-position.tsx
```

The fixed order is:

```text
1 Far Left
2 Left
3 Centre Left
4 Centre
5 Centre Right
6 Right
7 Far-Right
```

For a point position, select one dot.

For a range, select all included positions.

For a non-linear label, replace the dot strip with the source label.

For an absent source position, render `Not listed`.

Do not encode the ideological axis with political colours. In particular, do not automatically make left positions red and right positions blue. Use neutral semantic UI tokens. Party colour remains a separate sourced/presentation value.

The visible dots are not sufficient accessibility text. Each scale must expose an accessible description such as:

```text
Wikipedia infobox position: Centre-left
```

## First UI integration point

The existing Legislature composition row is the first integration surface. Do not wait for the future dedicated Parties tab.

Conceptually:

```text
■ Party name      ○ ○ ● ○ ○ ○ ○      94
```

This should work with safely identified party entries in:

- IPU full post-election composition
- Wikipedia source-reported party composition
- partial-renewal chambers when a valid full composition is available

Generic membership/group labels remain non-interactive and do not receive a synthetic position.

The same component can later be reused by the Parties tab.

## Secondary detail slide-over

Do not implement party detail as a one-off nested block inside `country-panel.tsx`.

Create a reusable detail surface, for example:

```text
components/details/entity-detail-panel.tsx
components/details/party-detail-panel.tsx
```

The generic shell owns:

- positioning
- transition
- heading/header
- back/close behaviour
- focus management
- loading/error boundary
- scrolling

The party component owns party-specific content.

This is the deliberate extension point for future person, chamber, election, organisation, or territory inspection.

## Workspace state

Avoid a single-purpose `isPartyPanelOpen` boolean.

Extend workspace state with a discriminated detail selection:

```ts
type DetailSelection =
  | {
      kind: 'party';
      entityId: string;
    }
  | null;
```

Expose actions such as `openParty(entityId)` and `clearDetail()`.

Future entity kinds can extend this union without replacing the state model.

## Panel behaviour

### Desktop

Keep the country panel mounted and open the secondary detail surface above it. Closing the party detail should return to the same country, active Legislature tab, composition selection, and practical scroll context.

The party view should not navigate to a separate page.

### Mobile

Use the same logical detail state, but let the secondary view occupy the available panel content rather than displaying two unusably narrow horizontal panels.

Provide a visible Back action.

## Party row interaction

Only a safely identified entity becomes interactive.

Use a real button or equivalent semantic control, not click behaviour on an inert `div`.

The political-position indicator itself does not require a separate click target.

Unresolved/generic entries remain ordinary text.

## Party detail content

Initial content can be:

```text
Political party

Party name
Abbreviation

[position]

Founded
...

Leader
...

Ideology
...

Headquarters
...

Affiliations
...

Source
English Wikipedia

View on Wikipedia
```

Only render fields that exist. Do not fill the panel with repeated “Unknown” rows.

State clearly that the summary derives from the cited English Wikipedia infobox.

External links must retain `target="_blank"` and `rel="noopener noreferrer"`.

## Runtime loading

Add a loader such as:

```ts
loadPartyProfile(entityId)
```

to `lib/profile-data.ts`.

Party details are fetched from reviewed local JSON via TanStack Query. The already-loaded summary supplies an immediate panel title while the detail file loads.

A party-detail load/schema failure must not fail the parent country profile. Render a bounded detail error and leave the country panel usable.

## Source presentation

Party summary and position source IDs must feed the country/legislature Sources tab so visible party information is represented there.

The detail panel independently provides its direct Wikipedia link and provenance.

## Accessibility

Required behaviour:

- identified party rows are keyboard operable;
- Enter/Space opens the detail;
- focus moves into the detail surface;
- Escape closes party detail before the country panel;
- closing restores focus to the invoking party control;
- the seven-point indicator has explicit accessible text;
- dots are not the sole carrier of meaning;
- textual labels such as `Big tent` remain text;
- no position is communicated by colour alone;
- reduced-motion preferences disable non-essential slide transitions;
- mobile Back behaviour returns to the parent country context.

## Refactoring boundary

`components/country-panel.tsx` is already large. Phase 4A should extract only boundaries directly needed for this work rather than performing a broad UI rewrite.

A suitable target is:

```text
components/
  country-panel.tsx
  legislature/
    legislature-tab.tsx
    seat-composition.tsx
    party-position.tsx
  details/
    entity-detail-panel.tsx
    party-detail-panel.tsx
```

## Automated tests

### Data pipeline

Cover:

- all seven canonical positions;
- Center/Centre spelling variants;
- Left-wing/Right-wing equivalents;
- explicit ranges;
- non-linear labels such as Big tent;
- absent position;
- ideology present without position;
- exact legislature article identity;
- exact Wikidata sitelink;
- bounded search with one verified result;
- ambiguous search;
- no result;
- redirects and page renames preserving page ID;
- the same party in multiple chambers;
- generic Independents/Vacant/Crossbench entries;
- deterministic cache replay.

### Schema/validation

Cover:

- point and range positions;
- textual labels;
- invalid/reversed ranges;
- dangling `partyEntityId`;
- duplicate/conflicting party identity;
- invalid/missing source IDs;
- missing party detail;
- invalid external URL;
- missing provenance.

### UI

Cover:

- one selected dot;
- position range;
- Big tent/text label;
- Not listed;
- unresolved party remains non-interactive;
- identified party opens detail;
- loading and detail-error states;
- Back and Escape;
- focus restoration;
- source link;
- legislature-only pilots;
- light/dark themes;
- mobile detail behaviour.

## Performance and resilience

Source calls occur only during explicit ingestion.

Deduplicate exact article identities, bound source concurrency, retain current timeouts/User-Agent, and preserve ignored caches.

Country/legislature files contain only party summaries. Detail records load lazily and are cached by TanStack Query after first use.

A failed source request must not remove the last committed reviewed public data.

## Implementation sequence

### Implementation PR 1 — party data foundation

Implement:

- schemas and version transitions;
- stable party entity identity;
- reuse of existing exact article reconciliation;
- Wikidata exact sitelink identity aid;
- bounded Wikipedia fallback search;
- party infobox acquisition/extraction;
- political-position normalisation;
- party summaries/detail files;
- source-registry and manifest integration;
- cache replay;
- validation and data-pipeline tests;
- regenerated pilot data;
- necessary source-policy/data-pipeline documentation.

Stop for review before wiring the new political classifications into presentation.

### Implementation PR 2 — position UI and reusable detail slide-over

Implement:

- `PartyPositionIndicator`;
- party-row interaction;
- discriminated detail selection in workspace state;
- reusable entity detail shell;
- party detail panel;
- lazy profile loader;
- source integration;
- loading/error states;
- keyboard/focus/mobile behaviour;
- component tests;
- final Phase 4A documentation reconciliation.

## Phase 4A acceptance criteria

Phase 4A is complete only when:

- every published political position is tied to an exact source article;
- only the Wikipedia Position/Political position infobox field drives the seven-point indicator;
- colour never determines political position;
- ideology never substitutes for political position;
- non-linear source classifications remain textual;
- missing position is represented explicitly;
- exact party identities have stable entity IDs;
- ambiguous identity resolution fails closed;
- generic political labels are not falsely turned into parties;
- party summary/detail provenance resolves through the global source registry;
- party detail files are manifest-hashed;
- network access remains outside browser runtime;
- cached refresh is deterministic;
- identified party rows open the secondary detail surface;
- party detail uses structured infobox data rather than arbitrary article prose/HTML;
- the source article is directly linked;
- Back/Escape and focus restoration behave correctly;
- desktop/mobile and light/dark presentation remain usable;
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run data:validate`, and `npm run build` pass for the implementation PRs.

## Explicitly deferred

Do not expand Phase 4A to include:

- a complete Parties tab;
- an internally authored ideological taxonomy;
- political-family scoring;
- manifesto analysis;
- government/opposition inference;
- party logos;
- historical political-position timelines;
- official party-site ingestion;
- interactive ideological filtering/ranking;
- relationship graphs;
- leader detail views;
- a broad country-panel redesign.

Those features may build on the Phase 4A identity/detail foundation later.
