import { describe, expect, it } from 'vitest';
import profile from '@/public/data/countries/AUS.json';
import { countryProfileSchema } from './country';

describe('country profile contract', () => {
  it('accepts the reviewed Australia fixture', () => {
    expect(() => countryProfileSchema.parse(profile)).not.toThrow();
  });

  it('keeps every displayed fact attached to a known source', () => {
    const parsed = countryProfileSchema.parse(profile);
    const knownSources = new Set(parsed.sources.map((source) => source.id));
    const usedSources = [
      ...parsed.government.system.sourceIds,
      ...parsed.government.headOfState.flatMap((holder) => holder.sourceIds),
      ...parsed.government.headOfGovernment.flatMap(
        (holder) => holder.sourceIds,
      ),
      ...parsed.parliament.name.sourceIds,
      ...parsed.parliament.chambers.flatMap((chamber) => chamber.sourceIds),
      ...parsed.elections.flatMap((election) => election.sourceIds),
      ...parsed.relations.flatMap((relation) => relation.sourceIds),
    ];

    expect(usedSources.every((sourceId) => knownSources.has(sourceId))).toBe(
      true,
    );
  });

  it('does not over-allocate seats in either chamber', () => {
    const parsed = countryProfileSchema.parse(profile);
    for (const chamber of parsed.parliament.chambers) {
      const allocated = chamber.composition.reduce(
        (sum, group) => sum + group.seats,
        0,
      );
      expect(allocated).toBeLessThanOrEqual(chamber.totalSeats);
    }
  });
});
