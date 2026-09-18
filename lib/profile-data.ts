import {
  countryProfileSchema,
  type CountryProfile,
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
