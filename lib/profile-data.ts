import {
  countryProfileSchema,
  legislatureProfileSchema,
  sourceRegistrySchema,
  type CountryProfile,
  type LegislatureProfile,
  type SourceRegistry,
} from '@/packages/schemas/country';

export async function loadCountryProfile(
  iso3: string,
): Promise<CountryProfile> {
  const response = await fetch(`/data/countries/${iso3}.json`);

  if (!response.ok) {
    throw new Error(`Profile request failed with status ${response.status}`);
  }

  return countryProfileSchema.parse(await response.json());
}

export async function loadLegislatureProfile(
  iso3: string,
): Promise<LegislatureProfile> {
  const response = await fetch(`/data/legislatures/${iso3}.json`);

  if (!response.ok) {
    throw new Error(
      `Legislature request failed with status ${response.status}`,
    );
  }

  return legislatureProfileSchema.parse(await response.json());
}

export async function loadSourceRegistry(): Promise<SourceRegistry> {
  const response = await fetch('/data/sources.json');

  if (!response.ok) {
    throw new Error(
      `Source registry request failed with status ${response.status}`,
    );
  }

  return sourceRegistrySchema.parse(await response.json());
}
