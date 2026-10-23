import {
  countryProfileSchema,
  legislatureProfileSchema,
  sourceRegistrySchema,
  type CountryProfile,
  type LegislatureProfile,
  type SourceRegistry,
} from '@/packages/schemas/country';
import {
  partyProfileSchema,
  type PartyProfile,
} from '@/packages/schemas/party';

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

export async function loadPartyProfile(
  entityId: string,
): Promise<PartyProfile> {
  const pageId = entityId.match(/^party:wikipedia:([1-9]\d*)$/)?.[1];
  if (!pageId) throw new Error('Invalid party entity ID');

  const response = await fetch(`/data/parties/wikipedia-en-${pageId}.json`);
  if (!response.ok) {
    throw new Error(`Party request failed with status ${response.status}`);
  }

  const profile = partyProfileSchema.parse(await response.json());
  if (profile.entityId !== entityId) {
    throw new Error('Party profile identity does not match the request');
  }
  return profile;
}
