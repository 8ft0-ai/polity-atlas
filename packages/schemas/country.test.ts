import { describe, expect, it } from 'vitest';
import aus from '@/public/data/countries/AUS.json';
import can from '@/public/data/countries/CAN.json';
import chn from '@/public/data/countries/CHN.json';
import fra from '@/public/data/countries/FRA.json';
import gbr from '@/public/data/countries/GBR.json';
import idn from '@/public/data/countries/IDN.json';
import ind from '@/public/data/countries/IND.json';
import jpn from '@/public/data/countries/JPN.json';
import nzl from '@/public/data/countries/NZL.json';
import usa from '@/public/data/countries/USA.json';
import { countryProfileSchema } from './country';

const pilotProfiles = [aus, nzl, can, usa, gbr, fra, chn, ind, idn, jpn];

describe('country profile contract', () => {
  it('accepts every pilot profile', () => {
    for (const profile of pilotProfiles) {
      expect(
        () => countryProfileSchema.parse(profile),
        `${profile.identity.iso3} should satisfy the country profile schema`,
      ).not.toThrow();
    }
  });

  it('keeps every displayed fact attached to a known source', () => {
    for (const profile of pilotProfiles) {
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
        ...parsed.parliament.chambers.flatMap((chamber) =>
          (chamber.groupings ?? []).flatMap((grouping) => grouping.sourceIds),
        ),
        ...parsed.elections.flatMap((election) => election.sourceIds),
        ...parsed.relations.flatMap((relation) => relation.sourceIds),
      ];

      expect(
        usedSources.every((sourceId) => knownSources.has(sourceId)),
        `${parsed.identity.iso3} contains an unknown source reference`,
      ).toBe(true);
    }
  });

  it('does not over-allocate seats in any pilot chamber', () => {
    for (const profile of pilotProfiles) {
      const parsed = countryProfileSchema.parse(profile);
      for (const chamber of parsed.parliament.chambers) {
        const allocated = chamber.composition.reduce(
          (sum, group) => sum + group.seats,
          0,
        );

        expect(
          allocated,
          `${parsed.identity.iso3} ${chamber.name} over-allocates seats`,
        ).toBeLessThanOrEqual(chamber.totalSeats);
      }
    }
  });

  it('gives every pilot country resident-mission links to the other nine pilots', () => {
    const pilotM49s = new Set(
      pilotProfiles.map((profile) => profile.identity.m49),
    );

    for (const profile of pilotProfiles) {
      const expected = new Set(
        [...pilotM49s].filter((m49) => m49 !== profile.identity.m49),
      );
      const actual = new Set(
        countryProfileSchema
          .parse(profile)
          .relations.filter(
            (relation) => relation.status === 'resident-mission',
          )
          .map((relation) => relation.m49),
      );

      expect(actual, `${profile.identity.iso3} pilot mission coverage`).toEqual(
        expected,
      );
    }
  });
});
