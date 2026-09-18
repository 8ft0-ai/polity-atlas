# Changelog

All notable changes to Polity Atlas are recorded here.

## Unreleased

### Added

- Synchronized 110m/50m map LOD packages for countries, disputed areas, disputed boundaries, and tiny-country markers.
- Tiny-country markers keep microstates and small island states discoverable and selectable when polygon geometry is too small at world scale.
- Canonical map-entity identities that distinguish primary countries, dependencies, overseas territories, disputed territories, and non-country map areas.
- Natural Earth 50m disputed-area and disputed-boundary layers.
- Separate map colours for dependencies/overseas territories and disputed territories, including associated-state highlighting.
- Dotted disputed-boundary rendering.
- Hovered map-entity identity in the map key.
- Optional territory associations in the country-profile schema for a future Territories view.
- Border and map-entity policy documentation.

### Changed

- The global atlas now switches atomically from 110m overview geometry to 50m detailed geometry with hysteresis; political overlays no longer render at a different detail level from the base country layer.
- The primary searchable country universe is explicitly defined as the 193 United Nations member states, the Holy See and State of Palestine as United Nations non-member observer states, plus Kosovo and Taiwan as additional Polity Atlas research entities.
- Map rendering and selection use canonical entity IDs rather than assuming every geometry has a UN M49 identifier.

### Fixed

- Northern Cyprus, Somaliland, and Kosovo no longer share a missing/undefined map identity.
- Selecting Kosovo no longer causes unrelated non-M49 geometries to receive the same selected-state treatment.
