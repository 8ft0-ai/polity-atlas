import type { FeatureCollection, Geometry, Point, Position } from 'geojson';
import countries110Source from '@/public/data/geometry/lod/110m/countries.json';
import disputed110Source from '@/public/data/geometry/lod/110m/disputed-areas.json';
import boundaries110Source from '@/public/data/geometry/lod/110m/disputed-boundaries.json';
import tiny110Source from '@/public/data/geometry/lod/110m/tiny-countries.json';
import countries50Source from '@/public/data/geometry/lod/50m/countries.json';
import disputed50Source from '@/public/data/geometry/lod/50m/disputed-areas.json';
import boundaries50Source from '@/public/data/geometry/lod/50m/disputed-boundaries.json';
import tiny50Source from '@/public/data/geometry/lod/50m/tiny-countries.json';
import {
  countryOptions,
  primaryCountryByM49,
  primaryEntityIdForM49,
  primaryEntityIdsMentionedInText,
  propertiesForSourceFeature,
  type MapFeatureProperties,
  type PrimaryCountryOption,
} from './map-entities';

export type MapLod = '110m' | '50m';

export type LodCountryFeature = {
  properties: MapFeatureProperties;
  geometry: Geometry;
};

export type LodDisputedArea = {
  entityId: string;
  name: string;
  geometry: Geometry;
  associatedPrimaryEntityIds: string[];
  sourceType: string;
};

export type LodDisputedBoundary = {
  boundaryId: string;
  name: string;
  geometry: Geometry;
};

export type TinyCountryMarker = {
  entityId: string;
  name: string;
  m49?: string;
  coordinates: Position;
};

export type MapGeometryPackage = {
  lod: MapLod;
  countries: LodCountryFeature[];
  disputedAreas: LodDisputedArea[];
  disputedBoundaries: LodDisputedBoundary[];
  tinyCountries: TinyCountryMarker[];
};

type Properties = Record<string, unknown>;

type CountrySourceProperties = {
  name?: string;
  sovereign?: string | null;
  isoN3?: string | null;
  unA3?: string | null;
  type?: string | null;
};

const displayNameOverrides: Record<string, string> = {
  'N. Cyprus': 'Northern Cyprus',
  'W. Sahara': 'Western Sahara',
  Transdniestria: 'Transnistria',
};

const explicitAssociations: Record<string, string[]> = {
  Abkhazia: [primaryEntityIdForM49('268')],
  'Falkland Is.': [primaryEntityIdForM49('826'), primaryEntityIdForM49('032')],
  'N. Cyprus': [primaryEntityIdForM49('196')],
  Somaliland: [primaryEntityIdForM49('706')],
  'South Ossetia': [primaryEntityIdForM49('268')],
  Transnistria: [primaryEntityIdForM49('498')],
  'W. Sahara': [primaryEntityIdForM49('504')],
};

function stringProperty(properties: Properties, key: string) {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function slug(value: string) {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
}

function countryFeatures(source: unknown): LodCountryFeature[] {
  const collection = source as FeatureCollection<
    Geometry,
    CountrySourceProperties
  >;

  return collection.features.map((feature) => {
    const sourceName = feature.properties?.name ?? 'Unknown';
    return {
      properties: propertiesForSourceFeature({
        name: sourceName,
        isoN3: feature.properties?.isoN3,
        unA3: feature.properties?.unA3,
        type: feature.properties?.type,
        sovereign: feature.properties?.sovereign,
      }),
      geometry: feature.geometry,
    };
  });
}

function associatedIds(properties: Properties, sourceName: string) {
  const sourceText = [
    stringProperty(properties, 'sovereign'),
    stringProperty(properties, 'admin'),
    stringProperty(properties, 'geounit'),
    stringProperty(properties, 'note'),
  ]
    .filter(Boolean)
    .join(' ');

  return [
    ...new Set([
      ...(explicitAssociations[sourceName] ?? []),
      ...primaryEntityIdsMentionedInText(sourceText),
    ]),
  ];
}

function disputedAreas(source: unknown): LodDisputedArea[] {
  const collection = source as FeatureCollection<Geometry, Properties>;

  return collection.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const sourceName =
      stringProperty(properties, 'name') ?? `Disputed area ${index + 1}`;

    return {
      entityId: `disputed:${slug(sourceName)}:${index}`,
      name: displayNameOverrides[sourceName] ?? sourceName,
      geometry: feature.geometry,
      associatedPrimaryEntityIds: associatedIds(properties, sourceName),
      sourceType: stringProperty(properties, 'type') ?? 'Disputed',
    };
  });
}

function disputedBoundaries(source: unknown): LodDisputedBoundary[] {
  const collection = source as FeatureCollection<Geometry, Properties>;

  return collection.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const sourceName =
      stringProperty(properties, 'name') ??
      stringProperty(properties, 'note') ??
      `Disputed boundary ${index + 1}`;

    return {
      boundaryId: `disputed-boundary:${slug(sourceName)}:${index}`,
      name: displayNameOverrides[sourceName] ?? sourceName,
      geometry: feature.geometry,
    };
  });
}

function numericM49(value: unknown) {
  return typeof value === 'string' && /^\d{3}$/.test(value) ? value : undefined;
}

function countryByTinyProperties(
  properties: Properties,
): PrimaryCountryOption | undefined {
  const m49 = numericM49(properties.unA3) ?? numericM49(properties.isoN3);
  if (m49) {
    const byM49 = primaryCountryByM49.get(m49);
    if (byM49) return byM49;
  }

  const sourceName =
    stringProperty(properties, 'name') ?? stringProperty(properties, 'admin');
  if (!sourceName) return undefined;
  const lower = sourceName.toLowerCase();

  return countryOptions.find(
    (country) =>
      country.name.toLowerCase() === lower ||
      country.aliases.some((alias) => alias.toLowerCase() === lower),
  );
}

function tinyCountries(source: unknown): TinyCountryMarker[] {
  const collection = source as FeatureCollection<Point, Properties>;
  const seen = new Set<string>();
  const markers: TinyCountryMarker[] = [];

  for (const feature of collection.features) {
    const country = countryByTinyProperties(feature.properties ?? {});
    if (!country || seen.has(country.entityId)) continue;

    seen.add(country.entityId);
    markers.push({
      entityId: country.entityId,
      name: country.name,
      m49: country.m49,
      coordinates: feature.geometry.coordinates,
    });
  }

  return markers;
}

export const mapGeometryByLod: Record<MapLod, MapGeometryPackage> = {
  '110m': {
    lod: '110m',
    countries: countryFeatures(countries110Source),
    disputedAreas: disputedAreas(disputed110Source),
    disputedBoundaries: disputedBoundaries(boundaries110Source),
    tinyCountries: tinyCountries(tiny110Source),
  },
  '50m': {
    lod: '50m',
    countries: countryFeatures(countries50Source),
    disputedAreas: disputedAreas(disputed50Source),
    disputedBoundaries: disputedBoundaries(boundaries50Source),
    tinyCountries: tinyCountries(tiny50Source),
  },
};

export const LOD_ENTER_50M_SCALE = 1.8;
export const LOD_LEAVE_50M_SCALE = 1.5;

export function nextMapLod(current: MapLod, scale: number): MapLod {
  if (current === '110m' && scale >= LOD_ENTER_50M_SCALE) return '50m';
  if (current === '50m' && scale < LOD_LEAVE_50M_SCALE) return '110m';
  return current;
}

export function primaryCoverageForLod(lod: MapLod) {
  const packageForLod = mapGeometryByLod[lod];
  const covered = new Set(
    packageForLod.countries
      .filter((feature) => feature.properties.kind === 'primary-state')
      .map((feature) => feature.properties.entityId),
  );

  for (const marker of packageForLod.tinyCountries) {
    covered.add(marker.entityId);
  }

  return covered;
}
