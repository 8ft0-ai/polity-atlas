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
chambers, Speakers, electoral systems, latest national parliamentary election
outcomes, and expected national parliamentary elections in the ten-country
pilot. It does not replace sources for heads of state/government, diplomatic
relations, territories, or Natural Earth geometry.

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

Public source metadata is stored once in `public/data/sources.json`. Country profiles contain stable source IDs only. A source ID must not be reused for materially different publisher, title, URL, attribution, terms, licence, or source-kind metadata. Retrieval timestamps may advance when the same source is refreshed.
