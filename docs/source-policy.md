# Source policy

Prefer sources in this order: responsible national authority, intergovernmental institution, established specialist dataset, referenced knowledge graph, then reputable secondary reporting.

Every displayed fact requires at least one source ID, an `asOf` date where applicable, and a retrieval timestamp. Unknown information must remain unknown; it must not be converted into a negative assertion. Changes to leaders, election dates, parliamentary composition, borders, or diplomatic status require review before publication.

## Country and map identity sources

United Nations membership and observer-state status define two of the primary-entity categories used by the map. Polity Atlas separately includes Kosovo and Taiwan as additional research entities. That additional category is an application decision and must not be represented as a United Nations recognition category.

UN M49 remains authoritative statistical metadata where used. The United Nations Statistics Division notes that M49 geographic groupings are for statistical convenience and do not imply a position on political affiliation. A missing M49 identifier must therefore never be replaced by a guessed code merely to make a map feature selectable.

Natural Earth is the geographic source for country and disputed-area geometry. Polity Atlas preserves source distinctions between ordinary Admin-0 geometry, dependencies/map units, breakaway or disputed areas, and disputed boundary lines. Natural Earth's de facto presentation choices are treated as source metadata, not as an application adjudication.

The pinned disputed overlays in this repository come from the Natural Earth vector v5.1.2 release tag. Any source-version change requires review against `docs/border-policy.md` and map identity regression tests.
