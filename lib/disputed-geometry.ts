import type { FeatureCollection, Geometry } from 'geojson';
import disputedAreasSource from '@/public/data/geometry/ne_50m_admin_0_breakaway_disputed_areas.json';
import disputedBoundariesSource from '@/public/data/geometry/ne_50m_admin_0_boundary_lines_disputed_areas.json';
import {
  primaryEntityIdForM49,
  primaryEntityIdsMentionedInText,
} from './map-entities';

type NaturalEarthProperties = Record<string, unknown>;

export type DisputedArea = {
  entityId: string;
  name: string;
  geometry: Geometry;
  associatedPrimaryEntityIds: string[];
  sourceType: string;
};

export type DisputedBoundary = {
  boundaryId: string;
  name: string;
  geometry: Geometry;
};

const disputedAreas = disputedAreasSource as unknown as FeatureCollection<
  Geometry,
  NaturalEarthProperties
>;
const disputedBoundaries =
  disputedBoundariesSource as unknown as FeatureCollection<
    Geometry,
    NaturalEarthProperties
  >;

const explicitAssociations: Record<string, string[]> = {
  Abkhazia: [primaryEntityIdForM49('268')],
  'Falkland Is.': [
    primaryEntityIdForM49('826'),
    primaryEntityIdForM49('032'),
  ],
  'N. Cyprus': [primaryEntityIdForM49('196')],
  Somaliland: [primaryEntityIdForM49('706')],
  'South Ossetia': [primaryEntityIdForM49('268')],
  Transnistria: [primaryEntityIdForM49('498')],
  'W. Sahara': [primaryEntityIdForM49('504')],
};

function stringProperty(
  properties: NaturalEarthProperties,
  key: string,
): string | undefined {
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

function associatedIds(properties: NaturalEarthProperties, name: string) {
  const sourceText = [
    stringProperty(properties, 'SOVEREIGNT'),
    stringProperty(properties, 'ADMIN'),
    stringProperty(properties, 'GEOUNIT'),
    stringProperty(properties, 'NOTE_ADM0'),
    stringProperty(properties, 'NOTE_BRK'),
  ]
    .filter(Boolean)
    .join(' ');

  return [
    ...new Set([
      ...(explicitAssociations[name] ?? []),
      ...primaryEntityIdsMentionedInText(sourceText),
    ]),
  ];
}

export const disputedAreaFeatures: DisputedArea[] = disputedAreas.features.map(
  (feature, index) => {
    const properties = feature.properties ?? {};
    const name =
      stringProperty(properties, 'BRK_NAME') ??
      stringProperty(properties, 'NAME') ??
      `Disputed area ${index + 1}`;

    return {
      entityId: `disputed:${slug(name)}:${index}`,
      name,
      geometry: feature.geometry,
      associatedPrimaryEntityIds: associatedIds(properties, name),
      sourceType:
        stringProperty(properties, 'TYPE') ??
        stringProperty(properties, 'featurecla') ??
        'Disputed',
    };
  },
);

export const disputedBoundaryFeatures: DisputedBoundary[] =
  disputedBoundaries.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const name =
      stringProperty(properties, 'BRK_NAME') ??
      stringProperty(properties, 'NAME') ??
      stringProperty(properties, 'NOTE') ??
      `Disputed boundary ${index + 1}`;

    return {
      boundaryId: `disputed-boundary:${slug(name)}:${index}`,
      name,
      geometry: feature.geometry,
    };
  });
