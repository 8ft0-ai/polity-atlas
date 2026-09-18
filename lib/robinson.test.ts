import { describe, expect, it } from 'vitest';
import type { Polygon } from 'geojson';
import { countryFeatures } from './countries';
import {
  clipRingAtAntimeridian,
  geometryToRobinsonPath,
  projectRobinson,
  ROBINSON_SPHERE_PATH,
  ROBINSON_VIEWBOX_HEIGHT,
  ROBINSON_VIEWBOX_WIDTH,
} from './robinson';

describe('Robinson world map geometry', () => {
  it('projects the origin to the centre of the world view', () => {
    expect(projectRobinson(0, 0)).toEqual([
      ROBINSON_VIEWBOX_WIDTH / 2,
      ROBINSON_VIEWBOX_HEIGHT / 2,
    ]);
  });

  it('keeps projection coordinates finite at world extremes', () => {
    for (const [longitude, latitude] of [
      [-180, -90],
      [-180, 90],
      [180, -90],
      [180, 90],
      [180, 0],
      [0, 90],
    ]) {
      const [x, y] = projectRobinson(longitude, latitude);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it('splits polygons crossing the antimeridian into bounded rings', () => {
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
      expect(part.length).toBeGreaterThanOrEqual(3);
      for (const [longitude] of part) {
        expect(longitude).toBeGreaterThanOrEqual(-180);
        expect(longitude).toBeLessThanOrEqual(180);
      }
    }
  });

  it('produces separate Robinson path pieces for an antimeridian polygon', () => {
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

    const path = geometryToRobinsonPath(geometry);

    expect(path.match(/M/g)?.length).toBe(2);
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('Infinity');
  });

  it('produces finite SVG paths for every bundled country', () => {
    for (const country of countryFeatures.features) {
      const path = geometryToRobinsonPath(country.geometry);
      expect(path.length).toBeGreaterThan(0);
      expect(path).not.toContain('NaN');
      expect(path).not.toContain('Infinity');
    }

    expect(ROBINSON_SPHERE_PATH.length).toBeGreaterThan(0);
  });
});
