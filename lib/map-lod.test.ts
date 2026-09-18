import { describe, expect, it } from 'vitest';
import { countryOptions } from './map-entities';
import {
  LOD_ENTER_50M_SCALE,
  LOD_LEAVE_50M_SCALE,
  mapGeometryByLod,
  nextMapLod,
  primaryCoverageForLod,
} from './map-lod';

describe('synchronized map LOD', () => {
  it('uses hysteresis when switching between overview and detailed geometry', () => {
    expect(nextMapLod('110m', LOD_ENTER_50M_SCALE - 0.01)).toBe('110m');
    expect(nextMapLod('110m', LOD_ENTER_50M_SCALE)).toBe('50m');
    expect(nextMapLod('50m', LOD_LEAVE_50M_SCALE)).toBe('50m');
    expect(nextMapLod('50m', LOD_LEAVE_50M_SCALE - 0.01)).toBe('110m');
  });

  it('keeps all semantic layers on the same explicit LOD package', () => {
    for (const lod of ['110m', '50m'] as const) {
      const geometry = mapGeometryByLod[lod];

      expect(geometry.lod).toBe(lod);
      expect(geometry.countries.length).toBeGreaterThan(150);
      expect(geometry.disputedAreas.length).toBeGreaterThan(20);
      expect(geometry.disputedBoundaries.length).toBeGreaterThan(10);
      expect(geometry.tinyCountries.length).toBeGreaterThan(0);
    }
  });

  it('provides polygon or tiny-country coverage for every primary entity', () => {
    for (const lod of ['110m', '50m'] as const) {
      const coverage = primaryCoverageForLod(lod);
      const missing = countryOptions
        .filter((country) => !coverage.has(country.entityId))
        .map((country) => country.name);

      expect(missing).toEqual([]);
    }
  });

  it('keeps canonical country identities stable across LODs', () => {
    const ids110 = new Set(
      mapGeometryByLod['110m'].countries
        .filter((feature) => feature.properties.kind === 'primary-state')
        .map((feature) => feature.properties.entityId),
    );
    const ids50 = new Set(
      mapGeometryByLod['50m'].countries
        .filter((feature) => feature.properties.kind === 'primary-state')
        .map((feature) => feature.properties.entityId),
    );

    for (const entityId of ids110) {
      expect(
        ids50.has(entityId) || primaryCoverageForLod('50m').has(entityId),
      ).toBe(true);
    }
  });

  it('keeps disputed feature identities stable across both LODs', () => {
    const names110 = new Set(
      mapGeometryByLod['110m'].disputedAreas.map((area) => area.name),
    );
    const names50 = new Set(
      mapGeometryByLod['50m'].disputedAreas.map((area) => area.name),
    );

    expect(names110).toEqual(names50);
  });
});
