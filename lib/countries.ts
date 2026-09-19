export {
  countryFeatures,
  countryOptions,
  findPrimaryCountry,
  primaryCountryByEntityId,
  primaryCountryByM49,
  primaryEntityIdForM49,
  type MapEntityKind,
  type PrimaryCountryOption,
} from './map-entities';

export const supportedProfiles: Record<string, string> = {
  'state:m49:036': 'AUS',
  'state:m49:554': 'NZL',
  'state:m49:124': 'CAN',
  'state:m49:840': 'USA',
  'state:m49:826': 'GBR',
  'state:m49:250': 'FRA',
  'state:m49:156': 'CHN',
  'state:m49:356': 'IND',
  'state:m49:360': 'IDN',
  'state:m49:392': 'JPN',
};

export const supportedLegislatures: Record<string, string> = {
  'state:m49:364': 'IRN',
  'state:m49:682': 'SAU',
  'state:m49:104': 'MMR',
};
