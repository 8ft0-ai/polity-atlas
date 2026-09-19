# Source policy

Prefer sources in this order: responsible national authority, intergovernmental institution, established specialist dataset, referenced knowledge graph, then reputable secondary reporting.

Every displayed fact requires at least one source ID, an `asOf` date where applicable, and a retrieval timestamp. Unknown information must remain unknown; it must not be converted into a negative assertion. Changes to leaders, election dates or outcomes, parliamentary structure, borders, or diplomatic status require review before publication.

## Country and map identity sources

United Nations membership and observer-state status define two of the primary-entity categories used by the map. Polity Atlas separately includes Kosovo and Taiwan as additional research entities. That additional category is an application decision and must not be represented as a United Nations recognition category.

UN M49 remains authoritative statistical metadata where used. The United Nations Statistics Division notes that M49 geographic groupings are for statistical convenience and do not imply a position on political affiliation. A missing M49 identifier must therefore never be replaced by a guessed code merely to make a map feature selectable.

Natural Earth is the geographic source for country and disputed-area geometry. Polity Atlas preserves source distinctions between ordinary Admin-0 geometry, dependencies/map units, breakaway or disputed areas, and disputed boundary lines. Natural Earth's de facto presentation choices are treated as source metadata, not as an application adjudication.

The pinned disputed overlays in this repository come from the Natural Earth vector v5.1.2 release tag. Any source-version change requires review against `docs/border-policy.md` and map identity regression tests.

## IPU Parline

IPU Parline is the canonical source for parliament names and structures,
registered chambers, source-reported chamber operational status, Speakers,
electoral systems, latest national parliamentary election outcomes, and expected
national parliamentary elections across the ten full-profile pilots and three
standalone legislature pilots. When Wikipedia identifies a national chamber
that IPU does not register, the separate Wikipedia adapter may add that missing
chamber without replacing or modifying any IPU chamber. It does not replace
sources for heads of state/government, diplomatic relations, territories, or
Natural Earth geometry.

The Parline API is public, read-only, and currently documents no authentication
or API-key requirement. The adapter therefore sends no credentials. A 401 or
403 response fails explicitly as `IPU_AUTHENTICATION_REQUIRED` so a future
access-policy change cannot silently remove data.

The [IPU Terms of Use](https://www.ipu.org/terms-use) permit API access for a
separate website or software application, require datasets to remain publicly
available free of charge, and require attribution in the form
“Inter-Parliamentary Union: dataset_name, month_year.” Each generated profile
therefore includes the attribution:

> Inter-Parliamentary Union: Parline, month year

It also carries the terms URL and the API-reported Creative Commons
Attribution-NonCommercial-ShareAlike 4.0 International licence. The current
terms restrict commercial reuse; review them again before any commercial use or
change in distribution model.

IPU expected-election dates describe when a national chamber election or
renewal should normally occur under law or practice. They must remain labelled
`expected`, never `confirmed`. Parline is not a source for local, municipal,
state, or provincial elections.

Election results are historical outcomes. They are not a claim about current
party composition after vacancies, defections, replacements, or by-elections.
For partial renewals, show a full post-election chamber only when IPU explicitly
provides that breakdown. Otherwise show the contested seats with both the seats
at stake and the statutory chamber size. Never combine prior results to invent
a current or post-election full composition.

## Global source identity

Public source metadata is stored once in `public/data/sources.json`. Country profiles contain stable source IDs only. A source ID must not be reused for materially different publisher, title, URL, terms, licence, or source-kind metadata. Retrieval timestamps and time-bound attribution strings may advance when the same source is refreshed.

## Wikipedia parliamentary fallback

Wikipedia is a reference-source fallback for missing national parliamentary
chambers and missing full chamber composition, not a co-equal source with IPU. The adapter starts from
`Parliament of {country}` and uses Wikimedia's MediaWiki REST API for page
retrieval and bounded page-search fallback. It parses the rendered HTML returned
by REST and follows linked chamber pages through the same API.

A Wikipedia chamber is added only when it cannot be matched to an IPU chamber.
For a matched IPU chamber, Wikipedia may provide a separate source-reported
party-seat composition only when IPU does not supply a full post-election
composition. The adapter must not convert current political-group listings into
historical election outcomes or use the fallback to overwrite an IPU full
composition. A source-reported split may sum to fewer seats than the statutory
chamber size; the remainder stays unexplained unless the source explicitly
labels it. Missing detail stays missing.

Wikipedia source records use the stable English Wikipedia page ID. A page move
may therefore update its title and canonical URL without changing source
identity. Every added chamber retains both the parliament-page and chamber-page
source IDs where they are distinct.

The current read-only MediaWiki REST workflow requires no API key. Requests are
unauthenticated and carry the Polity Atlas User-Agent. REST snapshots preserve
the page/revision/licence metadata supplied by Wikimedia in the ignored local
cache. Wikidata is not used as a substitute for Wikipedia article infobox
content or for IPU political facts. It may supply visual metadata only through
an exact English-Wikipedia sitelink binding. Schema v5 models Wikipedia
party-seat data as a separate `source-reported` chamber composition with inline
provenance and an explicit UI disclosure that it is not an IPU election result.

## Party and parliamentary display colours

A colour shown beside a parliamentary party/group is contextual display
metadata, not a political classification. When a Wikipedia legislature/chamber
entry exposes a usable colour swatch, Polity Atlas may attach that colour to the
matching seat entry and cite the Wikipedia chamber page as the visual source.
If that exact entry has no swatch but links to an English Wikipedia party
article, Polity Atlas may resolve that exact sitelink to Wikidata and use a
single unambiguous P465 colour, cited to the Wikidata item. For IPU-backed
results this enrichment must never alter IPU party names, IDs,
seat totals, election dates, chamber sizes, or outcome semantics.

Matching must fail closed when aliases are ambiguous. IPU-provided local and
full chamber names are retained as source-reconciliation aliases. A
statutory-capacity match may be used only when that capacity identifies exactly
one still-unmatched authoritative chamber. Party colours never participate in
identity matching. When no source colour resolves safely, the application uses
a deterministic presentation fallback that carries no source claim.

Do not infer ideology, political family, government/opposition status, vacancy
status, or party identity from a colour.

## Legislature operational status

Operational status is published only when a source reports it explicitly. In
particular, a historical election record must not be interpreted as evidence
that a legislature is currently functioning. When IPU marks a chamber as
suspended, Polity Atlas preserves the reported status, effective date, note, and
IPU source ID alongside the chamber. No functioning/suspended status is inferred
from election age, political events, or secondary-source composition alone.
