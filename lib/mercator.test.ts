import { describe, expect, it } from 'vitest';
import type { Polygon } from 'geojson';
import { countryFeatures } from './countries';
import {
  clipRingAtAntimeridian,
  geometryToMercatorPath,
  initialMercatorY,
  MERCATOR_MAX_LATITUDE,
  MERCATOR_VIEWBOX_HEIGHT,
  MERCATOR_WORLD_SIZE,
  projectMercator,
} from './mercator';

describe('Mercator world map geometry', () => {
  it('projects the equator and prime meridian to the world centre', () => {
    expect(projectMercator(0, 0)).toEqual([
      MERCATOR_WORLD_SIZE / 2,
      MERCATOR_WORLD_SIZE / 2,
    ]);
  });

  it('clamps polar coordinates to the Web Mercator latitude limit', () => {
    const north = projectMercator(0, 90);
    const clampedNorth = projectMercator(0, MERCATOR_MAX_LATITUDE);
    const south = projectMercator(0, -90);

    expect(north).toEqual(clampedNorth);
    expect(north[1]).toBeCloseTo(0, 6);
    expect(south[1]).toBeCloseTo(MERCATOR_WORLD_SIZE, 6);
  });

  it('splits antimeridian polygons into bounded rings', () => {
    const ring = [
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
      [170, -10],
    ];

    const clipped = clipRingAtAntimeridian(ring);

    expect(clipped).toHaveLength(2);
    for (const part of clipped) {
      for (const [longitude] of part) {
        expect(longitude).toBeGreaterThanOrEqual(-180);
        expect(longitude).toBeLessThanOrEqual(180);
      }
    }
  });

  it('produces separate path pieces for an antimeridian polygon', () => {
    const geometry: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [170, -10],
          [-170, -10],
          [-170, 10],
          [170, 10],
          [170, -10],
        ],
      ],
    };

    const path = geometryToMercatorPath(geometry);

    expect(path.match(/M/g)?.length).toBe(2);
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('Infinity');
  });

  it('produces finite SVG paths for every bundled country', () => {
    for (const country of countryFeatures.features) {
      const path = geometryToMercatorPath(country.geometry);
      expect(path.length).toBeGreaterThan(0);
      expect(path).not.toContain('NaN');
      expect(path).not.toContain('Infinity');
    }
  });

  it('centres the full Mercator world vertically in the viewport', () => {
    expect(initialMercatorY()).toBe(
      (MERCATOR_VIEWBOX_HEIGHT - MERCATOR_WORLD_SIZE) / 2,
    );
  });
});
