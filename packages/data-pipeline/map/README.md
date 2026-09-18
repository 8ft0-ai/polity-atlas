# Map data pipeline groundwork

The runtime map now separates political entity identity from source geometry.

Future map-data generation should produce reviewed, versioned outputs from pinned Natural Earth inputs rather than making the UI infer political status from feature names or missing IDs.

The intended pipeline is:

1. acquire pinned Natural Earth Admin-0 country/map-unit, breakaway/disputed-area, and disputed-boundary sources;
2. normalize every source feature to a stable Polity Atlas `entityId`;
3. attach reviewed primary-state, dependency, overseas-territory, and disputed-territory metadata;
4. preserve source claim/administration metadata without converting it into an application judgment;
5. validate that the 197 primary searchable entities remain unique;
6. project/clip or simplify geometry for each approved map level of detail;
7. emit reviewable generated assets and a manifest with source versions and file hashes.

`build-lod.mjs` now generates source-consistent global map packages from pinned Natural Earth v5.1.2 inputs. The runtime has two approved global levels: 110m for the world overview and 50m for detailed global zoom. Countries, disputed areas, and disputed boundaries switch as one package. Natural Earth publishes the breakaway/disputed-area polygons at 50m rather than 10m, so the global atlas deliberately stops at 50m instead of inventing higher-detail dispute polygons. Very small countries that are not legible at world scale are accessed through the canonical country search rather than synthetic circle markers. More detailed local/regional GIS remains the MapLibre boundary.
