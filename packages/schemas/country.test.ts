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

const pilots = [aus, nzl, can, usa, gbr, fra, chn, ind, idn, jpn];

describe('country profile contract', () => {
  it('accepts every schema-v2 pilot profile', () => {
    for (const profile of pilots) {
      expect(() => countryProfileSchema.parse(profile)).not.toThrow();
    }
  });

  it('uses IPU Parline for every pilot parliament and carries the required attribution', () => {
    for (const raw of pilots) {
      const profile = countryProfileSchema.parse(raw);
      const ipu = profile.sources.find((source) => source.id === 'ipu-parline');
      expect(ipu?.attribution).toBe(
        'Inter-Parliamentary Union: Parline, September 2026',
      );
      expect(ipu?.termsUrl).toBe('https://www.ipu.org/terms-use');
      expect(profile.parliament.name.sourceIds).toContain('ipu-parline');
      for (const chamber of profile.parliament.chambers) {
        expect(chamber.sourceIds).toContain('ipu-parline');
      }
    }
  });

  it('contains no legacy current-composition fields', () => {
    for (const profile of pilots) {
      const text = JSON.stringify(profile);
      expect(text).not.toContain('"compositionAsOf"');
      expect(text).not.toContain('"composition":');
      expect(text).not.toContain('"totalSeats"');
    }
  });

  it('keeps partial-renewal arithmetic explicit', () => {
    for (const raw of pilots) {
      const profile = countryProfileSchema.parse(raw);
      for (const chamber of profile.parliament.chambers) {
        const election = chamber.latestElection;
        if (!election) continue;
        const resultTotal =
          election.resultSeats?.reduce((sum, row) => sum + row.seats, 0) ?? 0;
        if (election.seatsAtStake) {
          expect(resultTotal).toBeLessThanOrEqual(election.seatsAtStake);
        }
      }
    }
  });

  it('preserves all nine pilot diplomatic links per pilot', () => {
    const pilotM49s = new Set(pilots.map((profile) => profile.identity.m49));
    for (const raw of pilots) {
      const profile = countryProfileSchema.parse(raw);
      const expected = new Set([...pilotM49s].filter((m49) => m49 !== profile.identity.m49));
      const actual = new Set(
        profile.relations
          .filter((relation) => relation.status === 'resident-mission')
          .map((relation) => relation.m49),
      );
      expect(actual).toEqual(expected);
    }
  });
});
