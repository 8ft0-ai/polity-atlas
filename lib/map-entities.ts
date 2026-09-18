import { feature } from 'topojson-client';
import topology from 'world-atlas/countries-110m.json';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

export type MapEntityKind =
  | 'primary-state'
  | 'dependency'
  | 'overseas-territory'
  | 'disputed-territory'
  | 'other';

export type RecognitionBasis =
  | 'un-member'
  | 'un-observer-state'
  | 'polity-atlas-additional';

export type PrimaryCountryOption = {
  entityId: string;
  name: string;
  m49?: string;
  recognitionBasis: RecognitionBasis;
  aliases: string[];
};

export type MapFeatureProperties = {
  entityId: string;
  name: string;
  sourceName: string;
  kind: MapEntityKind;
  m49?: string;
  recognitionBasis?: RecognitionBasis;
  parentEntityId?: string;
  associatedPrimaryEntityIds: string[];
};

type AtlasCountryProperties = { name?: string };

const atlas = topology as unknown as Topology<{
  countries: GeometryCollection<AtlasCountryProperties>;
}>;

const converted = feature(atlas, atlas.objects.countries) as FeatureCollection<
  Geometry,
  AtlasCountryProperties
>;

export function primaryEntityIdForM49(m49: string) {
  return `state:m49:${m49}`;
}

const displayNameOverrides: Record<string, string> = {
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Central African Rep.': 'Central African Republic',
  Congo: 'Republic of the Congo',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  eSwatini: 'Eswatini',
  Macedonia: 'North Macedonia',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  Turkey: 'Türkiye',
  'United States of America': 'United States',
};

const specialByM49: Record<
  string,
  Omit<MapFeatureProperties, 'm49' | 'sourceName'>
> = {
  '010': {
    entityId: 'area:antarctica',
    name: 'Antarctica',
    kind: 'other',
    associatedPrimaryEntityIds: [],
  },
  '238': {
    entityId: 'territory:m49:238',
    name: 'Falkland Islands',
    kind: 'disputed-territory',
    associatedPrimaryEntityIds: [
      primaryEntityIdForM49('826'),
      primaryEntityIdForM49('032'),
    ],
  },
  '260': {
    entityId: 'territory:m49:260',
    name: 'French Southern and Antarctic Lands',
    kind: 'overseas-territory',
    parentEntityId: primaryEntityIdForM49('250'),
    associatedPrimaryEntityIds: [primaryEntityIdForM49('250')],
  },
  '304': {
    entityId: 'territory:m49:304',
    name: 'Greenland',
    kind: 'dependency',
    parentEntityId: primaryEntityIdForM49('208'),
    associatedPrimaryEntityIds: [primaryEntityIdForM49('208')],
  },
  '540': {
    entityId: 'territory:m49:540',
    name: 'New Caledonia',
    kind: 'overseas-territory',
    parentEntityId: primaryEntityIdForM49('250'),
    associatedPrimaryEntityIds: [primaryEntityIdForM49('250')],
  },
  '630': {
    entityId: 'territory:m49:630',
    name: 'Puerto Rico',
    kind: 'dependency',
    parentEntityId: primaryEntityIdForM49('840'),
    associatedPrimaryEntityIds: [primaryEntityIdForM49('840')],
  },
  '732': {
    entityId: 'territory:m49:732',
    name: 'Western Sahara',
    kind: 'disputed-territory',
    associatedPrimaryEntityIds: [primaryEntityIdForM49('504')],
  },
};

const missingIdEntities: Record<
  string,
  Omit<MapFeatureProperties, 'sourceName'>
> = {
  Kosovo: {
    entityId: 'state:XKX',
    name: 'Kosovo',
    kind: 'primary-state',
    recognitionBasis: 'polity-atlas-additional',
    associatedPrimaryEntityIds: [],
  },
  'N. Cyprus': {
    entityId: 'territory:NORTHERN_CYPRUS',
    name: 'Northern Cyprus',
    kind: 'disputed-territory',
    parentEntityId: primaryEntityIdForM49('196'),
    associatedPrimaryEntityIds: [primaryEntityIdForM49('196')],
  },
  Somaliland: {
    entityId: 'territory:SOMALILAND',
    name: 'Somaliland',
    kind: 'disputed-territory',
    parentEntityId: primaryEntityIdForM49('706'),
    associatedPrimaryEntityIds: [primaryEntityIdForM49('706')],
  },
};

const supplementalPrimaryCountries: PrimaryCountryOption[] = [
  ['020', 'Andorra'],
  ['028', 'Antigua and Barbuda'],
  ['048', 'Bahrain'],
  ['052', 'Barbados'],
  ['132', 'Cabo Verde'],
  ['174', 'Comoros'],
  ['212', 'Dominica'],
  ['308', 'Grenada'],
  ['296', 'Kiribati'],
  ['438', 'Liechtenstein'],
  ['462', 'Maldives'],
  ['470', 'Malta'],
  ['584', 'Marshall Islands'],
  ['480', 'Mauritius'],
  ['583', 'Micronesia (Federated States of)'],
  ['492', 'Monaco'],
  ['520', 'Nauru'],
  ['585', 'Palau'],
  ['659', 'Saint Kitts and Nevis'],
  ['662', 'Saint Lucia'],
  ['670', 'Saint Vincent and the Grenadines'],
  ['882', 'Samoa'],
  ['674', 'San Marino'],
  ['678', 'Sao Tome and Principe'],
  ['690', 'Seychelles'],
  ['702', 'Singapore'],
  ['776', 'Tonga'],
  ['798', 'Tuvalu'],
  ['336', 'Vatican City'],
].map(([m49, name]) => ({
  entityId: primaryEntityIdForM49(m49),
  name,
  m49,
  recognitionBasis:
    m49 === '336' ? 'un-observer-state' : ('un-member' as RecognitionBasis),
  aliases: m49 === '336' ? ['Holy See'] : [],
}));

function recognitionBasisForM49(m49: string): RecognitionBasis {
  if (m49 === '275') return 'un-observer-state';
  if (m49 === '158') return 'polity-atlas-additional';
  return 'un-member';
}

function propertiesForFeature(
  sourceName: string,
  rawId: string | number | undefined,
): MapFeatureProperties {
  if (rawId === undefined || rawId === null) {
    const special = missingIdEntities[sourceName];
    if (!special) {
      return {
        entityId: `area:unmapped:${sourceName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
        name: sourceName,
        sourceName,
        kind: 'other',
        associatedPrimaryEntityIds: [],
      };
    }

    return { ...special, sourceName };
  }

  const m49 = String(rawId).padStart(3, '0');
  const special = specialByM49[m49];
  if (special) return { ...special, m49, sourceName };

  return {
    entityId: primaryEntityIdForM49(m49),
    name: displayNameOverrides[sourceName] ?? sourceName,
    sourceName,
    kind: 'primary-state',
    m49,
    recognitionBasis: recognitionBasisForM49(m49),
    associatedPrimaryEntityIds: [],
  };
}

export const countryFeatures: FeatureCollection<Geometry, MapFeatureProperties> = {
  ...converted,
  features: converted.features.map((country) => {
    const sourceName = country.properties?.name ?? 'Unknown';
    return {
      ...country,
      id: undefined,
      properties: propertiesForFeature(sourceName, country.id),
    };
  }),
};

const geometryPrimaryOptions: PrimaryCountryOption[] = countryFeatures.features
  .filter((country) => country.properties.kind === 'primary-state')
  .map((country) => ({
    entityId: country.properties.entityId,
    name: country.properties.name,
    m49: country.properties.m49,
    recognitionBasis:
      country.properties.recognitionBasis ?? 'polity-atlas-additional',
    aliases:
      country.properties.sourceName === country.properties.name
        ? []
        : [country.properties.sourceName],
  }));

export const countryOptions = [...geometryPrimaryOptions, ...supplementalPrimaryCountries]
  .sort((left, right) => left.name.localeCompare(right.name));

export const primaryCountryByEntityId = new Map(
  countryOptions.map((country) => [country.entityId, country]),
);

export const primaryCountryByM49 = new Map(
  countryOptions
    .filter((country): country is PrimaryCountryOption & { m49: string } =>
      Boolean(country.m49),
    )
    .map((country) => [country.m49, country]),
);

const normalisedAliases = countryOptions.flatMap((country) => [
  [country.name.toLowerCase(), country.entityId] as const,
  ...country.aliases.map(
    (alias) => [alias.toLowerCase(), country.entityId] as const,
  ),
]);

const primaryEntityIdByName = new Map(normalisedAliases);

export function findPrimaryCountry(token: string) {
  const normalised = token.trim();
  const lower = normalised.toLowerCase();

  return (
    primaryCountryByEntityId.get(normalised) ??
    primaryCountryByM49.get(normalised) ??
    countryOptions.find(
      (country) =>
        country.name.toLowerCase() === lower ||
        country.aliases.some((alias) => alias.toLowerCase() === lower) ||
        country.entityId.split(':').at(-1)?.toLowerCase() === lower,
    )
  );
}

export function primaryEntityIdsMentionedInText(text: string) {
  const lower = text.toLowerCase();
  const ids = new Set<string>();

  for (const [name, entityId] of primaryEntityIdByName) {
    if (name.length >= 4 && lower.includes(name)) ids.add(entityId);
  }

  return [...ids];
}
