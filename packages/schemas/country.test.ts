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
import irn from '@/public/data/legislatures/IRN.json';
import mmr from '@/public/data/legislatures/MMR.json';
import sau from '@/public/data/legislatures/SAU.json';
import manifest from '@/public/data/manifest.json';
import sourceRegistry from '@/public/data/sources.json';
import nzl from '@/public/data/countries/NZL.json';
import usa from '@/public/data/countries/USA.json';
import {
  chamberSchema,
  countryProfileSchema,
  legislatureProfileSchema,
  sourceRegistrySchema,
} from './country';

const pilotProfiles = [aus, nzl, can, usa, gbr, fra, chn, ind, idn, jpn];
const legislaturePilots = [irn, sau, mmr];

function compositionSourceIds(
  composition:
    | ReturnType<
        typeof countryProfileSchema.parse
      >['parliament']['chambers'][number]['composition']
    | ReturnType<
        typeof legislatureProfileSchema.parse
      >['parliament']['chambers'][number]['composition'],
) {
  if (!composition) return [];
  return 'views' in composition
    ? composition.views.flatMap((view) => [
        ...view.sourceIds,
        ...view.entries.flatMap((entry) => entry.visual?.sourceIds ?? []),
      ])
    : [
        ...composition.sourceIds,
        ...composition.entries.flatMap(
          (entry) => entry.visual?.sourceIds ?? [],
        ),
      ];
}

describe('country profile contract', () => {
  it('accepts every pilot profile', () => {
    for (const profile of pilotProfiles) {
      expect(
        () => countryProfileSchema.parse(profile),
        `${profile.identity.iso3} should satisfy the country profile schema`,
      ).not.toThrow();
    }
  });

  it('accepts the three standalone legislature pilots without full country data', () => {
    for (const profile of legislaturePilots) {
      expect(
        () => legislatureProfileSchema.parse(profile),
        `${profile.identity.iso3} should satisfy the legislature profile schema`,
      ).not.toThrow();
    }

    expect(irn.parliament.chambers).toHaveLength(1);
    expect(sau.parliament.chambers).toHaveLength(1);
    expect(mmr.parliament.chambers).toHaveLength(2);
    expect(mmr.parliament.chambers.map((chamber) => chamber.id).sort()).toEqual(
      ['MM-LC01', 'MM-UC01'],
    );
  });

  it('accepts independently validated multi-view chamber compositions', () => {
    expect(() =>
      chamberSchema.parse({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'unicameral',
        totalSeats: 290,
        speakers: [],
        sourceIds: ['ipu-parline'],
        composition: {
          basis: 'source-reported',
          defaultViewId: 'faction',
          retrievedAt: '2026-09-20T00:00:00.000Z',
          views: [
            {
              id: 'faction',
              label: 'By faction',
              dimension: 'faction',
              reportedSeats: 290,
              entries: [
                { partyId: 'a', party: 'A', seats: 198 },
                { partyId: 'b', party: 'B', seats: 92 },
              ],
              sourceIds: ['wikipedia-example'],
            },
            {
              id: 'party',
              label: 'By party',
              dimension: 'party',
              reportedSeats: 290,
              entries: [
                { partyId: 'c', party: 'C', seats: 200 },
                { partyId: 'd', party: 'D', seats: 90 },
              ],
              sourceIds: ['wikipedia-example'],
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it('rejects composition views whose entries do not equal reportedSeats', () => {
    expect(() =>
      chamberSchema.parse({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'unicameral',
        totalSeats: 290,
        speakers: [],
        sourceIds: ['ipu-parline'],
        composition: {
          basis: 'source-reported',
          defaultViewId: 'party',
          retrievedAt: '2026-09-20T00:00:00.000Z',
          views: [
            {
              id: 'party',
              label: 'By party',
              dimension: 'party',
              reportedSeats: 290,
              entries: [{ partyId: 'a', party: 'A', seats: 289 }],
              sourceIds: ['wikipedia-example'],
            },
          ],
        },
      }),
    ).toThrow('Composition view entry seats must equal reportedSeats');
  });

  it('rejects composition views that exceed statutory chamber size', () => {
    expect(() =>
      chamberSchema.parse({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'unicameral',
        totalSeats: 290,
        speakers: [],
        sourceIds: ['ipu-parline'],
        composition: {
          basis: 'source-reported',
          defaultViewId: 'party',
          retrievedAt: '2026-09-20T00:00:00.000Z',
          views: [
            {
              id: 'party',
              label: 'By party',
              dimension: 'party',
              reportedSeats: 291,
              entries: [{ partyId: 'a', party: 'A', seats: 291 }],
              sourceIds: ['wikipedia-example'],
            },
          ],
        },
      }),
    ).toThrow('Source-reported composition view exceeds chamber size');
  });

  it('rejects duplicate global source IDs', () => {
    const duplicate = sourceRegistry.sources[0];
    expect(() =>
      sourceRegistrySchema.parse({
        ...sourceRegistry,
        sources: [...sourceRegistry.sources, duplicate],
      }),
    ).toThrow(`Duplicate source id: ${duplicate.id}`);
  });

  it('keeps every displayed fact attached to a known source', () => {
    for (const profile of pilotProfiles) {
      const parsed = countryProfileSchema.parse(profile);
      const registry = sourceRegistrySchema.parse(sourceRegistry);
      const knownSources = new Set(registry.sources.map((source) => source.id));
      const usedSources = [
        ...parsed.government.system.sourceIds,
        ...parsed.government.headOfState.flatMap((holder) => holder.sourceIds),
        ...parsed.government.headOfGovernment.flatMap(
          (holder) => holder.sourceIds,
        ),
        ...parsed.parliament.name.sourceIds,
        ...parsed.parliament.chambers.flatMap((chamber) => chamber.sourceIds),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.operationalStatus?.sourceIds ?? [],
        ),
        ...parsed.parliament.chambers.flatMap((chamber) =>
          chamber.speakers.flatMap((speaker) => speaker.sourceIds),
        ),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.electoralSystem?.sourceIds ?? [],
        ),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.latestElection?.sourceIds ?? [],
        ),
        ...parsed.parliament.chambers.flatMap((chamber) =>
          compositionSourceIds(chamber.composition),
        ),
        ...parsed.parliament.chambers.flatMap((chamber) => [
          ...(chamber.latestElection?.outcome?.seatsWonInElection.flatMap(
            (entry) => entry.visual?.sourceIds ?? [],
          ) ?? []),
          ...(chamber.latestElection?.outcome?.postElectionComposition?.flatMap(
            (entry) => entry.visual?.sourceIds ?? [],
          ) ?? []),
          ...compositionSourceIds(chamber.composition),
        ]),
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

  it('keeps IPU authoritative for IPU-backed chambers and election facts', () => {
    const registry = sourceRegistrySchema.parse(sourceRegistry);
    const sourcesById = new Map(
      registry.sources.map((source) => [source.id, source]),
    );

    for (const profile of pilotProfiles) {
      const parsed = countryProfileSchema.parse(profile);

      for (const sourceId of parsed.parliament.name.sourceIds) {
        const source = sourcesById.get(sourceId);
        expect(source?.publisher).toBe('Inter-Parliamentary Union');
        expect(source?.attribution).toMatch(/^Inter-Parliamentary Union:/);
      }

      for (const chamber of parsed.parliament.chambers) {
        const isWikipediaFallback = chamber.id.startsWith('wiki-');
        if (!isWikipediaFallback) {
          for (const sourceId of chamber.sourceIds) {
            const source = sourcesById.get(sourceId);
            expect(source?.publisher).toBe('Inter-Parliamentary Union');
          }
        }

        for (const sourceId of chamber.latestElection?.sourceIds ?? []) {
          const source = sourcesById.get(sourceId);
          expect(source?.publisher).toBe('Inter-Parliamentary Union');
          expect(source?.attribution).toMatch(/^Inter-Parliamentary Union:/);
        }
      }

      for (const election of parsed.nextExpectedElections) {
        for (const sourceId of election.sourceIds) {
          const source = sourcesById.get(sourceId);
          expect(source?.publisher).toBe('Inter-Parliamentary Union');
          expect(source?.attribution).toMatch(/^Inter-Parliamentary Union:/);
        }
      }
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

  it('keeps every legislature-pilot source reference resolvable', () => {
    const registry = sourceRegistrySchema.parse(sourceRegistry);
    const knownSources = new Set(registry.sources.map((source) => source.id));

    for (const profile of legislaturePilots) {
      const parsed = legislatureProfileSchema.parse(profile);
      const usedSources = [
        ...parsed.parliament.name.sourceIds,
        ...parsed.parliament.chambers.flatMap((chamber) => chamber.sourceIds),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.operationalStatus?.sourceIds ?? [],
        ),
        ...parsed.parliament.chambers.flatMap((chamber) =>
          chamber.speakers.flatMap((speaker) => speaker.sourceIds),
        ),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.electoralSystem?.sourceIds ?? [],
        ),
        ...parsed.parliament.chambers.flatMap(
          (chamber) => chamber.latestElection?.sourceIds ?? [],
        ),
        ...parsed.parliament.chambers.flatMap((chamber) =>
          compositionSourceIds(chamber.composition),
        ),
        ...parsed.parliament.chambers.flatMap((chamber) => [
          ...(chamber.latestElection?.outcome?.seatsWonInElection.flatMap(
            (entry) => entry.visual?.sourceIds ?? [],
          ) ?? []),
          ...(chamber.latestElection?.outcome?.postElectionComposition?.flatMap(
            (entry) => entry.visual?.sourceIds ?? [],
          ) ?? []),
          ...compositionSourceIds(chamber.composition),
        ]),
        ...parsed.nextExpectedElections.flatMap(
          (election) => election.sourceIds,
        ),
      ];
      expect(usedSources.every((sourceId) => knownSources.has(sourceId))).toBe(
        true,
      );
    }
  });

  it('publishes ten full profiles and three legislature modules in a deterministic, hash-backed manifest', () => {
    expect(manifest.schemaVersion).toBe(5);
    expect(manifest.profiles).toHaveLength(10);
    expect(manifest.legislatures).toHaveLength(3);
    expect(manifest.legislatures.map((entry) => entry.iso3)).toEqual([
      'IRN',
      'MMR',
      'SAU',
    ]);
    expect(manifest.profiles.map((profile) => profile.iso3)).toEqual(
      [...pilotProfiles]
        .map((profile) => profile.identity.iso3)
        .sort((left, right) => left.localeCompare(right)),
    );

    const sourceContent = readFileSync(
      resolve(process.cwd(), 'public/data', manifest.sourceRegistry.path),
    );
    expect(createHash('sha256').update(sourceContent).digest('hex')).toBe(
      manifest.sourceRegistry.sha256,
    );

    for (const entry of [...manifest.profiles, ...manifest.legislatures]) {
      const content = readFileSync(
        resolve(process.cwd(), 'public/data', entry.path),
      );
      expect(createHash('sha256').update(content).digest('hex')).toBe(
        entry.sha256,
      );
    }
  });
});
