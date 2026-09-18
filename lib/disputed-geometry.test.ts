import { describe, expect, it } from 'vitest';
import {
  disputedAreaFeatures,
  disputedBoundaryFeatures,
} from './disputed-geometry';
import { primaryEntityIdForM49 } from './map-entities';

describe('disputed-area groundwork', () => {
  it('loads the Natural Earth disputed-area and disputed-boundary layers', () => {
    expect(disputedAreaFeatures.length).toBeGreaterThan(20);
    expect(disputedBoundaryFeatures.length).toBeGreaterThan(10);
  });

  it('includes key breakaway and disputed areas with parent-country associations', () => {
    const byName = new Map(
      disputedAreaFeatures.map((area) => [area.name, area]),
    );

    expect(byName.get('Northern Cyprus')?.associatedPrimaryEntityIds).toContain(
      primaryEntityIdForM49('196'),
    );
    expect(byName.get('Somaliland')?.associatedPrimaryEntityIds).toContain(
      primaryEntityIdForM49('706'),
    );
    expect(byName.get('Abkhazia')?.associatedPrimaryEntityIds).toContain(
      primaryEntityIdForM49('268'),
    );
    expect(byName.get('South Ossetia')?.associatedPrimaryEntityIds).toContain(
      primaryEntityIdForM49('268'),
    );
  });

  it('assigns a unique stable identity to every disputed feature', () => {
    const ids = disputedAreaFeatures.map((area) => area.entityId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('disputed:'))).toBe(true);
  });

  it('retains disputed-boundary names for rendering and future inspection', () => {
    const names = disputedBoundaryFeatures.map((boundary) => boundary.name);

    expect(names).toContain('Abkhazia');
    expect(names).toContain('South Ossetia');
  });
});
