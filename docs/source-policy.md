# Source policy

Prefer sources in this order: responsible national authority, intergovernmental institution, established specialist dataset, referenced knowledge graph, then reputable secondary reporting.

Every displayed fact requires at least one source ID, an `asOf` date where applicable, and a retrieval timestamp. Unknown information must remain unknown; it must not be converted into a negative assertion. Changes to leaders, election dates, parliamentary election outcomes, parliament/chamber structure, borders, or diplomatic status require review before publication.

## Country and map identity sources

United Nations membership and observer-state status define two of the primary-entity categories used by the map. Polity Atlas separately includes Kosovo and Taiwan as additional research entities. That additional category is an application decision and must not be represented as a United Nations recognition category.

UN M49 remains authoritative statistical metadata where used. The United Nations Statistics Division notes that M49 geographic groupings are for statistical convenience and do not imply a position on political affiliation. A missing M49 identifier must therefore never be replaced by a guessed code merely to make a map feature selectable.

Natural Earth is the geographic source for country and disputed-area geometry. Polity Atlas preserves source distinctions between ordinary Admin-0 geometry, dependencies/map units, breakaway or disputed areas, and disputed boundary lines. Natural Earth's de facto presentation choices are treated as source metadata, not as an application adjudication.

The pinned disputed overlays in this repository come from the Natural Earth vector v5.1.2 release tag. Any source-version change requires review against `docs/border-policy.md` and map identity regression tests.


## IPU Parline parliamentary data

IPU Parline is the canonical upstream source for the pilot set's national parliament structure, chambers, presiding officers, electoral systems, parliamentary election/renewal records, party-seat election results, and IPU-provided expected dates for the next national parliamentary election or renewal.

Polity Atlas does **not** describe the latest election result as the current composition of a chamber. For a full renewal, the complete election result may be rendered as the post-election composition. For a partial renewal, the full chamber may be rendered only when IPU supplies a full post-renewal composition; otherwise the application renders only the seats contested in that renewal. It must not reconstruct a full chamber by combining earlier results or unrelated current-party sources.

Statutory chamber size and post-election total size are separate fields because an electoral system can produce overhang or other additional seats. Missing party-result data remains missing; appointed or indirectly elected chambers are not forced into a party-seat chart.

The current Parline API is public and read-only and documents no API key or authentication requirement. The adapter therefore sends no credential or authorization header. If this contract changes, acquisition must fail explicitly rather than adding a browser-visible credential.

IPU's current terms require acknowledgement in the form `Inter-Parliamentary Union: dataset_name, month_year`. The pilot snapshot therefore records `Inter-Parliamentary Union: Parline, September 2026`, together with `https://www.ipu.org/terms-use`, in the generated source records and data manifest. IPU-derived datasets exposed by Polity Atlas remain publicly available free of charge. Any future commercial use requires a fresh terms review.

Parline is a national-parliament dataset. It must not be represented as a source for municipal, local, state/provincial, or other subnational elections. The canonical upcoming-election model nevertheless supports national, subnational, local and supranational levels so a later dedicated provider can add those events without country-specific UI or schema changes.
