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

The current runtime keeps the established 110m base country geometry while consuming pinned Natural Earth 50m disputed overlays. This directory is the boundary for moving that transitional runtime normalization into a reproducible build step.
