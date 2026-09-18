# Border and map-entity policy

Political maps encode source and presentation choices. Polity Atlas therefore treats country identity, territorial association, administrative control, claims, and geometry as separate data concerns. A colour, boundary, selectable profile, or territory association in the application does not constitute a determination of sovereignty or recognition.

## Primary selectable country set

The main country search and country-profile selection surface contains 197 primary research entities:

- the 193 United Nations Member States;
- the Holy See and the State of Palestine, which have United Nations non-member observer State status; and
- Kosovo and Taiwan as additional Polity Atlas research entities.

The labels `un-member`, `un-observer-state`, and `polity-atlas-additional` describe why an entity is included in the application's primary research set. The last category is an application classification only and must not be presented as a United Nations or ISO designation.

The map may contain many other areas, including dependencies, overseas territories, disputed areas, and non-country geographic areas. Those are not automatically peers of the 197 primary entities in search or country-profile navigation.

## Stable identity

Rendered geometry uses a Polity Atlas `entityId`. UN M49 remains useful metadata where available, but it is not assumed to exist for every rendered polygon.

Examples:

- `state:m49:036` — Australia;
- `state:XKX` — Kosovo, using an internal compatibility identifier;
- `territory:NORTHERN_CYPRUS` — Northern Cyprus;
- `territory:SOMALILAND` — Somaliland.

Internal identifiers are application identifiers and must never be represented as official ISO or United Nations assignments.

## Boundary and disputed-area sources

The global atlas uses generated, pinned Natural Earth v5.1.2 geometry packages at 110m and 50m. Each active package contains country geometry, disputed-area geometry, and disputed-boundary geometry. The 110m disputed layers are reproducibly simplified from the pinned 50m disputed source so the overview has a matched coarser representation; the 50m tier uses the source geometry directly. Very small countries that are not legible at world scale remain available through the canonical country search rather than synthetic point markers.

Natural Earth v5.1.2 supplies the breakaway/disputed-area polygons at 50m, so Polity Atlas does not label any global disputed polygon as 10m geometry. The 50m tier is the highest approved political LOD for the global atlas.

Natural Earth documents its default Admin-0 presentation as oriented to de facto control and provides separate breakaway/disputed areas and disputed boundary lines so applications can display claims and disputes explicitly. Polity Atlas does not reinterpret these layers as an adjudication of a claim.

The generated LOD pipeline preserves canonical Polity Atlas entity IDs across levels and keeps political semantics independent from geometry resolution.

## Rendering rules

- Primary countries use the normal country fill.
- The selected primary country uses the selected-country fill.
- Dependencies and overseas territories use a separate dependency fill.
- When their associated primary state is selected, dependencies use a stronger dependency-associated fill.
- Disputed/breakaway areas use a separate disputed-area fill.
- When a disputed area is associated with the selected primary state, it uses a separate disputed-associated fill rather than the selected-country colour.
- Disputed boundary lines use a dotted/dashed treatment.
- Diplomatic relation highlighting remains a separate semantic colour.
- Hover/focus identity is shown in the map key instead of as a pointer tooltip.

Where an area has multiple associations or claims, the application should retain those associations as data instead of forcing one exclusive parent merely for rendering convenience.

## Territory-profile groundwork

Country profiles may carry an optional `territories` collection describing dependency, overseas-territory, or disputed-territory associations. This is groundwork for a future conditional Territories view in the country briefing.

The current release does not claim that every disputed or dependent area has a complete country-style profile. The map entity and the profile availability decision are deliberately separate.

## Review requirements

Changes to any of the following require substantive review:

- the 197-primary-entity policy;
- country or territory names used for identity matching;
- parent/association relationships;
- recognition-basis metadata;
- disputed-area geometry or boundary sources;
- rendering precedence between primary, dependency, disputed, and relation states.

Source updates must record their source version and should add regression fixtures for politically sensitive identity collisions or association changes.

## Source references

The current policy and geometry decisions should be reviewed against these upstream references:

- United Nations Member States: https://www.un.org/en/about-us/member-states
- United Nations non-member observer States: https://www.un.org/en/about-us/non-member-states
- United Nations Statistics Division M49 methodology: https://unstats.un.org/unsd/methodology/m49/
- Natural Earth disputed-boundaries policy: https://www.naturalearthdata.com/about/disputed-boundaries-policy/
- Natural Earth 50m breakaway/disputed areas: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-breakaway-disputed-areas/
- Pinned Natural Earth vector release: https://github.com/nvkelso/natural-earth-vector/releases/tag/v5.1.2
