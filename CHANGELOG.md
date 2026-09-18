# Changelog

All notable changes to Polity Atlas are recorded here.

## Unreleased

### Added

- Validated pilot country profiles for all ten configured pilot countries, with dated government, parliament, election, diplomatic-relation, and source provenance data.
- Synchronized 110m/50m map LOD packages for countries, disputed areas, and disputed boundaries.
- Canonical map-entity identities that distinguish primary countries, dependencies, overseas territories, disputed territories, and non-country map areas.
- Natural Earth 50m disputed-area and disputed-boundary layers.
- Separate map colours for dependencies/overseas territories and disputed territories, including associated-state highlighting.
- Dotted disputed-boundary rendering.
- Hovered map-entity identity in the map key.
- Optional territory associations in the country-profile schema for a future Territories view.
- Border and map-entity policy documentation.

### Changed

- The workspace header now uses the supplied Polity Atlas light/dark logo assets instead of the PA monogram, text name, and subtitle.
- Diplomatic-link highlighting now works consistently across all configured pilot profiles.
- Parliament chamber composition now renders as a thicker semicircle with chamber-scoped grouping indicators and explanatory notes.
- Inline fact citations now show the source title and external-link icon instead of local numeric references.
- The global atlas now switches atomically from 110m overview geometry to 50m detailed geometry with hysteresis; political overlays no longer render at a different detail level from the base country layer.
- The primary searchable country universe is explicitly defined as the 193 United Nations member states, the Holy See and State of Palestine as United Nations non-member observer states, plus Kosovo and Taiwan as additional Polity Atlas research entities.
- Map rendering and selection use canonical entity IDs rather than assuming every geometry has a UN M49 identifier.

### Fixed

- Country clicks remain native click gestures after drag-anywhere support; pointer capture now begins only once movement crosses the drag threshold.
- Natural Earth features with missing numeric country codes, including Norway, now resolve back to the canonical searchable country identity.
- Map panning can begin on country and disputed-area geometry; a movement threshold distinguishes drag gestures from click selection.
- Removed tiny-country circle markers that could create misleading visual emphasis for countries such as Norway; countries that are too small to render remain available through search.
- Northern Cyprus, Somaliland, and Kosovo no longer share a missing/undefined map identity.
- Selecting Kosovo no longer causes unrelated non-M49 geometries to receive the same selected-state treatment.
