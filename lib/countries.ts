import { feature } from 'topojson-client';
import topology from 'world-atlas/countries-50m.json';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import {
  classifyBaseMapFeature,
  primaryCountryOptions,
  primaryEntityById,
  primaryM49ToEntity,
  type MapEntityKind,
} from '@/lib/map-entity-policy';

type AtlasCountryProperties = { name?: string };

export type CountryProperties = AtlasCountryProperties & {
  m49?: string;
  entityId: string;
  displayName: string;
  kind: MapEntityKind;
  selectionKey?: string;
  parentEntityId?: string;
  associatedPrimaryEntityIds?: string[];
};

const atlas = topology as unknown as Topology<{
  countries: GeometryCollection<AtlasCountryProperties>;
}>;
const converted = feature(atlas, atlas.objects.countries) as FeatureCollection<
  Geometry,
  AtlasCountryProperties
>;

export const countryFeatures: FeatureCollection<Geometry, CountryProperties> = {
  ...converted,
  features: converted.features.map((country) => {
    const sourceName = country.properties?.name ?? 'Unknown';
    const m49 =
      country.id === undefined || country.id === null
        ? undefined
        : String(country.id).padStart(3, '0');
    const entity = classifyBaseMapFeature(m49, sourceName);
    const primary = entity.m49 ? primaryM49ToEntity.get(entity.m49) : undefined;
    const selectionKey =
      entity.id === 'state:XKX'
        ? 'XKX'
        : primary?.m49 ??
          (entity.parentEntityId
            ? primaryEntityById.get(entity.parentEntityId)?.m49
            : undefined);

    return {
      ...country,
      id: entity.id,
      properties: {
        ...country.properties,
        m49,
        entityId: entity.id,
        displayName: entity.name,
        kind: entity.kind,
        selectionKey,
        parentEntityId: entity.parentEntityId,
        associatedPrimaryEntityIds: entity.associatedPrimaryEntityIds,
      },
    };
  }),
};

export const countryOptions = primaryCountryOptions.map((country) => ({
  m49: country.m49,
  name: country.name,
}));

export const supportedProfiles: Record<string, string> = {
  '036': 'AUS',
};
