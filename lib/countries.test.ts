import { describe, expect, it } from 'vitest';
import { countryFeatures, countryOptions } from './countries';

describe('map country identity', () => {
  it('stores M49 as a stable feature property for map filtering', () => {
    const australia = countryFeatures.features.find(
      (country) => country.properties.m49 === '036',
    );

    expect(australia?.properties.name).toBe('Australia');
    expect(australia?.properties.m49).toBe('036');
  });

  it('uses the same M49 values for search options and map features', () => {
    const featureM49 = new Set(
      countryFeatures.features.map((country) => country.properties.m49),
    );

    expect(countryOptions.every((country) => featureM49.has(country.m49))).toBe(
      true,
    );
  });
});
