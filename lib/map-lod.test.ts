import { describe, expect, it } from 'vitest';
import {
  LOD_ENTER_50M_SCALE,
  LOD_LEAVE_50M_SCALE,
  mapGeometryByLod,
  nextMapLod,
} from './map-lod';

describe('synchronized map LOD', () => {
  it('uses hysteresis when switching between overview and detailed geometry', () => {
    expect(nextMapLod('110m', LOD_ENTER_50M_SCALE - 0.01)).toBe('110m');
    expect(nextMapLod('110m', LOD_ENTER_50M_SCALE)).toBe('50m');
    expect(nextMapLod('50m', LOD_LEAVE_50M_SCALE)).toBe('50m');
    expect(nextMapLod('50m', LOD_LEAVE_50M_SCALE - 0.01)).toBe('110m');
  });

  it('keeps all semantic polygon layers on the same explicit LOD package', () => {
    for (const lod of ['110m', '50m'] as const) {
      const geometry = mapGeometryByLod[lod];

      expect(geometry.lod).toBe(lod);
      expect(geometry.countries.length).toBeGreaterThan(150);
      expect(geometry.disputedAreas.length).toBeGreaterThan(20);
      expect(geometry.disputedBoundaries.length).toBeGreaterThan(10);
    }
  });

  it('keeps canonical country identities stable where entities exist in both LODs', () => {
    const bySourceName110 = new Map(
      mapGeometryByLod['110m'].countries.map((feature) => [
        feature.properties.sourceName,
        feature.properties.entityId,
      ]),
    );
    const bySourceName50 = new Map(
      mapGeometryByLod['50m'].countries.map((feature) => [
        feature.properties.sourceName,
        feature.properties.entityId,
      ]),
    );

    for (const [sourceName, entityId] of bySourceName110) {
      const detailedEntityId = bySourceName50.get(sourceName);
      if (detailedEntityId) expect(detailedEntityId).toBe(entityId);
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
