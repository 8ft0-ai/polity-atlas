export {
  countryFeatures,
  countryOptions,
  findPrimaryCountry,
  primaryCountryByEntityId,
  primaryCountryByM49,
  primaryEntityIdForM49,
  type MapEntityKind,
  type MapFeatureProperties,
  type PrimaryCountryOption,
  type RecognitionBasis,
} from './map-entities';

export const supportedProfiles: Record<string, string> = {
  'state:m49:036': 'AUS',
};
