import type { FeatureCollection, Geometry } from 'geojson';
import countries110Source from '@/public/data/geometry/lod/110m/countries.json';
import disputed110Source from '@/public/data/geometry/lod/110m/disputed-areas.json';
import boundaries110Source from '@/public/data/geometry/lod/110m/disputed-boundaries.json';
import countries50Source from '@/public/data/geometry/lod/50m/countries.json';
import disputed50Source from '@/public/data/geometry/lod/50m/disputed-areas.json';
import boundaries50Source from '@/public/data/geometry/lod/50m/disputed-boundaries.json';
import {
  primaryEntityIdForM49,
  primaryEntityIdsMentionedInText,
  propertiesForSourceFeature,
  type MapFeatureProperties,
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


export type MapGeometryPackage = {
  lod: MapLod;
  countries: LodCountryFeature[];
  disputedAreas: LodDisputedArea[];
  disputedBoundaries: LodDisputedBoundary[];
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


function createMapGeometryPackage(
  lod: MapLod,
  countriesSource: unknown,
  disputedSource: unknown,
  boundariesSource: unknown,
): MapGeometryPackage {
  const countries = countryFeatures(countriesSource);
  return {
    lod,
    countries,
    disputedAreas: disputedAreas(disputedSource),
    disputedBoundaries: disputedBoundaries(boundariesSource),
  };
}

export const mapGeometryByLod: Record<MapLod, MapGeometryPackage> = {
  '110m': createMapGeometryPackage(
    '110m',
    countries110Source,
    disputed110Source,
    boundaries110Source,
  ),
  '50m': createMapGeometryPackage(
    '50m',
    countries50Source,
    disputed50Source,
    boundaries50Source,
  ),
};

export const LOD_ENTER_50M_SCALE = 1.8;
export const LOD_LEAVE_50M_SCALE = 1.5;

export function nextMapLod(current: MapLod, scale: number): MapLod {
  if (current === '110m' && scale >= LOD_ENTER_50M_SCALE) return '50m';
  if (current === '50m' && scale < LOD_LEAVE_50M_SCALE) return '110m';
  return current;
}

