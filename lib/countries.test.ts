import { describe, expect, it } from 'vitest';
import {
  countryFeatures,
  countryOptions,
  primaryEntityIdForM49,
} from './countries';
import { propertiesForSourceFeature } from './map-entities';

describe('canonical map entity identity', () => {
  it('defines exactly 197 primary selectable countries', () => {
    expect(countryOptions).toHaveLength(197);
    expect(
      new Set(countryOptions.map((country) => country.entityId)).size,
    ).toBe(197);
  });

  it('encodes the primary research set as 193 members, two observers and two additional entities', () => {
    const counts = countryOptions.reduce<Record<string, number>>(
      (result, country) => ({
        ...result,
        [country.recognitionBasis]: (result[country.recognitionBasis] ?? 0) + 1,
      }),
      {},
    );

    expect(counts).toEqual({
      'un-member': 193,
      'un-observer-state': 2,
      'polity-atlas-additional': 2,
    });
  });

  it('includes the two UN observer states and the two additional research entities', () => {
    expect(
      countryOptions.find((country) => country.name === 'Palestine'),
    ).toMatchObject({
      m49: '275',
      recognitionBasis: 'un-observer-state',
    });
    expect(
      countryOptions.find((country) => country.name === 'Vatican City'),
    ).toMatchObject({
      m49: '336',
      recognitionBasis: 'un-observer-state',
    });
    expect(
      countryOptions.find((country) => country.name === 'Taiwan'),
    ).toMatchObject({
      m49: '158',
      recognitionBasis: 'polity-atlas-additional',
    });
    expect(
      countryOptions.find((country) => country.name === 'Kosovo'),
    ).toMatchObject({
      entityId: 'state:XKX',
      recognitionBasis: 'polity-atlas-additional',
    });
  });

  it('gives every bundled geometry a stable non-empty entity identity', () => {
    for (const country of countryFeatures.features) {
      expect(country.properties.entityId).toBeTruthy();
      expect(country.properties.entityId).not.toContain('undefined');
    }
  });

  it('does not collapse Northern Cyprus, Somaliland and Kosovo onto one identity', () => {
    const byName = new Map(
      countryFeatures.features.map((country) => [
        country.properties.name,
        country.properties,
      ]),
    );

    expect(byName.get('Northern Cyprus')?.entityId).toBe(
      'territory:NORTHERN_CYPRUS',
    );
    expect(byName.get('Somaliland')?.entityId).toBe('territory:SOMALILAND');
    expect(byName.get('Kosovo')?.entityId).toBe('state:XKX');
  });

  it('associates visible dependencies with their primary state', () => {
    const greenland = countryFeatures.features.find(
      (country) => country.properties.name === 'Greenland',
    );

    expect(greenland?.properties.kind).toBe('dependency');
    expect(greenland?.properties.parentEntityId).toBe(
      primaryEntityIdForM49('208'),
    );
  });

  it('keeps disputed areas out of the primary country search list', () => {
    expect(
      countryOptions.some((country) => country.name === 'Northern Cyprus'),
    ).toBe(false);
    expect(
      countryOptions.some((country) => country.name === 'Somaliland'),
    ).toBe(false);
    expect(
      countryOptions.some((country) => country.name === 'Western Sahara'),
    ).toBe(false);
  });

  it('resolves Norway to its canonical entity when Natural Earth numeric IDs are unavailable', () => {
    expect(
      propertiesForSourceFeature({
        name: 'Norway',
        isoN3: '-99',
        unA3: '-99',
        type: 'Sovereign country',
        sovereign: 'Norway',
      }),
    ).toMatchObject({
      entityId: 'state:m49:578',
      name: 'Norway',
      kind: 'primary-state',
      m49: '578',
    });
  });

});
