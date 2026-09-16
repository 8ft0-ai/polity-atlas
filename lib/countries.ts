import { feature } from 'topojson-client';
import topology from 'world-atlas/countries-110m.json';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

type CountryProperties = { name?: string };
type CountryFeature = Feature<Geometry, CountryProperties>;

const atlas = topology as unknown as Topology<{
  countries: GeometryCollection<CountryProperties>;
}>;
const converted = feature(atlas, atlas.objects.countries) as FeatureCollection<
  Geometry,
  CountryProperties
>;

export const countryFeatures: FeatureCollection<Geometry, CountryProperties> = {
  ...converted,
  features: converted.features.map((country) => ({
    ...country,
    id: String(country.id).padStart(3, '0'),
  })),
};

export const countryOptions = (countryFeatures.features as CountryFeature[])
  .map((country) => ({
    m49: String(country.id).padStart(3, '0'),
    name: country.properties?.name ?? 'Unknown',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const supportedProfiles: Record<string, string> = {
  '036': 'AUS',
};
