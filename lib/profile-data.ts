import {
  countryProfileSchema,
  type CountryProfile,
} from '@/packages/schemas/country';

export async function loadCountryProfile(
  iso3: string,
): Promise<CountryProfile> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const response = await fetch(`${basePath}/data/countries/${iso3}.json`);

  if (!response.ok) {
    throw new Error(`Profile request failed with status ${response.status}`);
  }

  return countryProfileSchema.parse(await response.json());
}
