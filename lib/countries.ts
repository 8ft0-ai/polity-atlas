import { feature } from 'topojson-client';
import topology from 'world-atlas/countries-110m.json';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

type AtlasCountryProperties = { name?: string };
export type CountryProperties = AtlasCountryProperties & { m49: string };

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
    const m49 = String(country.id).padStart(3, '0');

    return {
      ...country,
      properties: {
        ...country.properties,
        m49,
      },
    };
  }),
};

export const countryOptions = countryFeatures.features
  .map((country) => ({
    m49: country.properties.m49,
    name: country.properties.name ?? 'Unknown',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const supportedProfiles: Record<string, string> = {
  '036': 'AUS',
};
