import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import aus from '@/public/data/countries/AUS.json';
import can from '@/public/data/countries/CAN.json';
import chn from '@/public/data/countries/CHN.json';
import fra from '@/public/data/countries/FRA.json';
import gbr from '@/public/data/countries/GBR.json';
import idn from '@/public/data/countries/IDN.json';
import ind from '@/public/data/countries/IND.json';
import jpn from '@/public/data/countries/JPN.json';
import manifest from '@/public/data/manifest.json';
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
          chamber.speakers.flatMap((speaker) => speaker.sourceIds),
        ),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.electoralSystem.sourceIds,
        ),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.latestElection?.sourceIds ?? [],
        ),
        ...parsed.nextExpectedElections.flatMap(
          (election) => election.sourceIds,
        ),
        ...parsed.relations.flatMap((relation) => relation.sourceIds),
      ];

      expect(
        usedSources.every((sourceId) => knownSources.has(sourceId)),
        `${parsed.identity.iso3} contains an unknown source reference`,
      ).toBe(true);
    }
  });

  it('never presents a partial contested-seat result as a full chamber', () => {
    for (const profile of pilotProfiles) {
      const parsed = countryProfileSchema.parse(profile);
      for (const chamber of parsed.parliament.chambers) {
        const election = chamber.latestElection;
        if (election?.scope !== 'partial-renewal' || !election.outcome) {
          continue;
        }

        if (election.outcome.postElectionComposition) {
          expect(election.outcome.display).toBe(
            'post-election-full-composition',
          );
        } else {
          expect(election.outcome.display).toBe('contested-seats-only');
          expect(election.seatsAtStake).toBeLessThan(election.chamberSize);
        }
      }
    }
  });

  it('uses IPU rather than Wikipedia for parliamentary and election facts', () => {
    for (const profile of pilotProfiles) {
      const parsed = countryProfileSchema.parse(profile);
      const parliamentarySourceIds = new Set([
        ...parsed.parliament.name.sourceIds,
        ...parsed.parliament.chambers.flatMap((chamber) => chamber.sourceIds),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.latestElection?.sourceIds ?? [],
        ),
        ...parsed.nextExpectedElections.flatMap(
          (election) => election.sourceIds,
        ),
      ]);
      const parliamentarySources = parsed.sources.filter((source) =>
        parliamentarySourceIds.has(source.id),
      );
      expect(parliamentarySources).not.toHaveLength(0);
      expect(
        parliamentarySources.every(
          (source) =>
            source.publisher === 'Inter-Parliamentary Union' &&
            source.attribution?.startsWith('Inter-Parliamentary Union:'),
        ),
      ).toBe(true);
    }
  });

  it('limits IPU expected-election entries to national parliamentary events', () => {
    for (const profile of pilotProfiles) {
      const parsed = countryProfileSchema.parse(profile);
      expect(
        parsed.nextExpectedElections.every(
          (election) =>
            election.level === 'national' &&
            parsed.parliament.chambers.some(
              (chamber) => chamber.id === election.chamberId,
            ),
        ),
      ).toBe(true);
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

  it('publishes all ten pilots in a deterministic, hash-backed manifest', () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.profiles).toHaveLength(10);
    expect(manifest.profiles.map((profile) => profile.iso3)).toEqual(
      [...pilotProfiles]
        .map((profile) => profile.identity.iso3)
        .sort((left, right) => left.localeCompare(right)),
    );

    for (const entry of manifest.profiles) {
      const content = readFileSync(
        resolve(process.cwd(), 'public/data', entry.path),
      );
      expect(createHash('sha256').update(content).digest('hex')).toBe(
        entry.sha256,
      );
    }
  });
});
