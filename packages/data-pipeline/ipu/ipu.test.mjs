import { describe, expect, it } from 'vitest';
import { countryProfileSchema } from '../../schemas/country.ts';
import { IpuAuthenticationRequiredError, IpuClient } from './client.mjs';
import { mergeIpuProfile, normalizeIpuSnapshot } from './normalize.mjs';

const dated = (value) => [
  {
    value,
    date_from: '2024-01-01',
    date_to: '',
    missing_reason: '',
    annotation: { notes: { en: '', fr: '' } },
  },
];

const snapshot = {
  apiVersion: 'v1',
  retrievedAt: '2026-09-18T00:00:00.000Z',
  requestedCountry: {
    entityId: 'state:m49:036',
    iso2: 'AU',
    iso3: 'AUS',
    m49: '036',
    name: 'Australia',
  },
  country: {
    id: 'AU',
    attributes: {
      country_code: { value: 'AU' },
      iso_alpha3: { value: 'AUS' },
      iso_numeric3: { value: 36 },
    },
  },
  parliaments: [
    {
      id: 'AU',
      attributes: {
        parliament_name: dated({ en: 'Parliament', fr: 'Parlement' }),
        structure_of_parliament: dated({ term: 'bicameral' }),
        compulsory_voting: dated({ term: 'yes' }),
      },
    },
  ],
  chambers: [
    {
      id: 'AU-LC01',
      attributes: {
        chamber_name: dated({ en: 'House of Representatives' }),
        chamber_name_local: dated({ en: 'Local Assembly' }),
        chamber_name_full: dated({
          en: 'Local Assembly (House of Representatives)',
        }),
        struct_parl_status: { value: { term: 'lower_chamber' } },
        statutory_members_number: dated(100),
        directly_elected_number: { value: 100 },
        not_directly_elected: { value: false },
        electoral_systems: dated([{ term: 'plurality_majority' }]),
        min_age_vote_elect: dated(18),
        min_age_member_parl: dated(18),
        chamber_speakers: dated([
          {
            info: 'au-example-speaker',
            official_title: { en: 'Speaker' },
            is_acting: false,
            vacant: false,
            term: { from: '2025-01-02T00:00:00.000Z', to: null },
          },
        ]),
        speaker_designation_mode: dated({
          term: 'elected_from_among_members',
        }),
      },
    },
    {
      id: 'AU-UC01',
      attributes: {
        chamber_name: dated({ en: 'Senate' }),
        struct_parl_status: { value: { term: 'upper_chamber' } },
        statutory_members_number: dated(100),
        directly_elected_number: { value: 100 },
        not_directly_elected: { value: false },
        electoral_systems: dated([{ term: 'proportional_representation' }]),
        chamber_speakers: dated([]),
      },
    },
  ],
  electionsByChamber: {
    'AU-LC01': [
      {
        id: 'AU-LC01-E20250501',
        attributes: {
          election_date: { value: { from: '2025-05-01T00:00:00.000Z' } },
          number_of_seats_at_stake: { value: 50 },
          scope_of_elections: { value: { term: 'partial_renewal' } },
          expect_date_next_election: {
            value: '2028-05-01T00:00:00.000Z',
          },
          seats_per_parties: {
            value: [
              {
                party: 'au-party-a',
                total_number_of_seats: 30,
                vote_breakdown: [
                  { label: { en: 'Full composition' }, value: 55 },
                ],
              },
              {
                party: 'au-party-b',
                total_number_of_seats: 20,
                vote_breakdown: [
                  { label: { en: 'Full composition' }, value: 45 },
                ],
              },
            ],
            annotation: { notes: { en: '' } },
          },
        },
      },
    ],
    'AU-UC01': [
      {
        id: 'AU-UC01-E20250501',
        attributes: {
          elected_note: {
            value: {
              en: [
                'The distribution above covers the 50 seats renewed.',
                '',
                'The full composition of the Senate was as follows:',
                '',
                '- Party A: 55',
                '',
                '- Party B: 45',
              ].join('\n'),
            },
          },
          election_date: { value: { from: '2025-05-01T00:00:00.000Z' } },
          number_of_seats_at_stake: { value: 50 },
          scope_of_elections: { value: { term: 'partial_renewal' } },
          expect_date_next_election: {
            value: '2028-05-01T00:00:00.000Z',
          },
          seats_per_parties: {
            value: [
              {
                party: 'au-party-a',
                total_number_of_seats: 28,
                vote_breakdown: [],
              },
              {
                party: 'au-party-b',
                total_number_of_seats: 22,
                vote_breakdown: [],
              },
            ],
            annotation: { notes: { en: '' } },
          },
        },
      },
    ],
  },
  parties: [
    {
      political_party_code: 'au-party-a',
      party_name: { en: 'Party A' },
    },
    {
      political_party_code: 'au-party-b',
      party_name: { en: 'Party B' },
    },
  ],
  people: [
    {
      person_code: 'au-example-speaker',
      first_name: 'Alex',
      family_name: 'Example',
    },
  ],
  taxonomies: [
    {
      key: 'electoral_system',
      terms: [
        {
          key: 'plurality_majority',
          value: { en: 'Plurality/majority' },
        },
        {
          key: 'proportional_representation',
          value: { en: 'Proportional representation' },
        },
      ],
    },
    {
      key: 'compulsory_voting',
      terms: [{ key: 'yes', value: { en: 'Yes' } }],
    },
    {
      key: 'speaker_designation_mode',
      terms: [
        {
          key: 'elected_from_among_members',
          value: { en: 'Elected from among members' },
        },
      ],
    },
  ],
};

const previousProfile = {
  identity: {
    iso2: 'AU',
    iso3: 'AUS',
    m49: '036',
    name: 'Australia',
    officialName: 'Commonwealth of Australia',
    capital: 'Canberra',
  },
  government: {
    system: {
      value: 'Federal parliamentary constitutional monarchy',
      asOf: '2026-09-18',
      retrievedAt: '2026-09-18T00:00:00.000Z',
      sourceIds: ['government-source'],
      confidence: 'verified',
    },
    headOfState: [],
    headOfGovernment: [],
  },
  parliament: { name: { sourceIds: ['old-parliament-source'] }, chambers: [] },
  elections: [{ sourceIds: ['old-election-source'] }],
  relations: [],
  sources: [
    {
      id: 'government-source',
      publisher: 'Official source',
      title: 'Government source',
      url: 'https://example.com/government',
      retrievedAt: '2026-09-18T00:00:00.000Z',
      kind: 'official',
    },
    {
      id: 'old-parliament-source',
      publisher: 'Wikipedia',
      title: 'Old parliament source',
      url: 'https://en.wikipedia.org/wiki/Example',
      retrievedAt: '2026-09-18T00:00:00.000Z',
      kind: 'reference',
    },
  ],
};

describe('IPU normalisation', () => {
  it('is deterministic and accepts explicit full compositions in structured fields or election notes', () => {
    const first = normalizeIpuSnapshot(structuredClone(snapshot));
    const second = normalizeIpuSnapshot(structuredClone(snapshot));
    expect(first).toEqual(second);

    const house = first.parliament.chambers.find(
      (chamber) => chamber.id === 'AU-LC01',
    );
    const senate = first.parliament.chambers.find(
      (chamber) => chamber.id === 'AU-UC01',
    );
    expect(house.latestElection.outcome.display).toBe(
      'post-election-full-composition',
    );
    expect(house.latestElection.outcome.postElectionComposition).toEqual([
      { partyId: 'au-party-a', party: 'Party A', seats: 55 },
      { partyId: 'au-party-b', party: 'Party B', seats: 45 },
    ]);
    expect(senate.latestElection.outcome.display).toBe(
      'post-election-full-composition',
    );
    expect(senate.latestElection.outcome.postElectionComposition).toEqual([
      {
        partyId: 'au-uc01-e20250501-note-party-a',
        party: 'Party A',
        seats: 55,
      },
      {
        partyId: 'au-uc01-e20250501-note-party-b',
        party: 'Party B',
        seats: 45,
      },
    ]);
  });

  it('does not treat incomplete election-note figures as a full composition', () => {
    const incomplete = structuredClone(snapshot);
    incomplete.electionsByChamber[
      'AU-UC01'
    ][0].attributes.elected_note.value.en =
      'Full composition:\n\n- Party A: 55';

    const normalized = normalizeIpuSnapshot(incomplete);
    const senate = normalized.parliament.chambers.find(
      (chamber) => chamber.id === 'AU-UC01',
    );

    expect(senate.latestElection.outcome.display).toBe('contested-seats-only');
    expect(
      senate.latestElection.outcome.postElectionComposition,
    ).toBeUndefined();
  });

  it('emits generic Speaker, electoral-system, and multi-entry national election data', () => {
    const normalized = normalizeIpuSnapshot(snapshot);
    const house = normalized.parliament.chambers[0];
    expect(house.aliases).toEqual([
      'Local Assembly',
      'Local Assembly (House of Representatives)',
    ]);
    expect(house.speakers[0]).toMatchObject({
      personId: 'au-example-speaker',
      name: 'Alex Example',
      officialTitle: 'Speaker',
      designationMode: 'Elected from among members',
    });
    expect(house.electoralSystem).toMatchObject({
      directlyElected: true,
      systems: ['Plurality/majority'],
      votingAge: 18,
      eligibilityAge: 18,
      compulsoryVoting: 'Yes',
    });
    expect(normalized.nextExpectedElections).toHaveLength(2);
    expect(
      normalized.nextExpectedElections.every(
        (election) => election.level === 'national',
      ),
    ).toBe(true);
  });

  it('classifies an appointed chamber as an appointment renewal', () => {
    const appointed = structuredClone(snapshot);
    appointed.chambers[0].attributes.not_directly_elected = { value: true };
    delete appointed.chambers[0].attributes.directly_elected_number;
    appointed.chambers[0].attributes.appointed_members_number = { value: 100 };

    const normalized = normalizeIpuSnapshot(appointed);
    expect(
      normalized.nextExpectedElections.find(
        (election) => election.chamberId === 'AU-LC01',
      )?.eventType,
    ).toBe('appointment-renewal');
    expect(
      normalized.parliament.chambers.find((chamber) => chamber.id === 'AU-LC01')
        ?.electoralSystem,
    ).toMatchObject({
      directlyElected: false,
      appointedSeats: 100,
    });
  });

  it('derives an appointed membership-role composition only from a reconciling IPU appointment note', () => {
    const appointed = structuredClone(snapshot);
    appointed.requestedCountry = {
      entityId: 'state:m49:682',
      iso2: 'SA',
      iso3: 'SAU',
      m49: '682',
      name: 'Saudi Arabia',
    };
    appointed.country.attributes = {
      country_code: { value: 'SA' },
      iso_alpha3: { value: 'SAU' },
      iso_numeric3: { value: 682 },
    };
    appointed.chambers = [structuredClone(appointed.chambers[0])];
    appointed.chambers[0].id = 'SA-LC01';
    appointed.chambers[0].attributes.chamber_name = dated({
      en: 'Shura Council',
    });
    appointed.chambers[0].attributes.statutory_members_number = dated(151);
    appointed.chambers[0].attributes.not_directly_elected = { value: true };
    appointed.chambers[0].attributes.appointed_members_number = {
      value: 151,
    };
    delete appointed.chambers[0].attributes.directly_elected_number;
    appointed.electionsByChamber = {
      'SA-LC01': [
        {
          id: 'SA-LC01-E20240902',
          attributes: {
            election_date: { value: { from: '2024-09-02T00:00:00.000Z' } },
            number_of_seats_at_stake: { value: 150 },
            scope_of_elections: { value: { term: 'full_renewal' } },
            elected_note: {
              value: {
                en: 'On 2 September 2024, 150 members and the Speaker were appointed by Royal Order for a four-year term.',
              },
            },
            seats_per_parties: {
              value: [],
              annotation: { notes: { en: '' } },
            },
          },
        },
      ],
    };

    const normalized = normalizeIpuSnapshot(appointed);
    const chamber = normalized.parliament.chambers[0];

    expect(chamber.totalSeats).toBe(151);
    expect(chamber.electoralSystem).toMatchObject({
      directlyElected: false,
      appointedSeats: 151,
    });
    expect(chamber.composition).toEqual({
      basis: 'source-reported',
      defaultViewId: 'membership',
      retrievedAt: '2026-09-18T00:00:00.000Z',
      views: [
        {
          id: 'membership',
          label: 'Membership composition',
          dimension: 'membership-role',
          reportedSeats: 151,
          entries: [
            {
              partyId: 'sa-lc01-appointed-members',
              party: 'Appointed members',
              seats: 150,
            },
            {
              partyId: 'sa-lc01-speaker',
              party: 'Speaker',
              seats: 1,
            },
          ],
          sourceIds: ['ipu-parline'],
        },
      ],
    });

    appointed.electionsByChamber[
      'SA-LC01'
    ][0].attributes.elected_note.value.en =
      '149 members and the Speaker were appointed.';
    expect(
      normalizeIpuSnapshot(appointed).parliament.chambers[0].composition,
    ).toBeUndefined();
  });

  it('preserves a fallback composition only while IPU lacks a full composition', () => {
    const noFull = structuredClone(snapshot);
    noFull.electionsByChamber['AU-LC01'][0].attributes.seats_per_parties.value =
      [
        {
          party: 'au-party-a',
          total_number_of_seats: 30,
          vote_breakdown: [],
        },
        {
          party: 'au-party-b',
          total_number_of_seats: 20,
          vote_breakdown: [],
        },
      ];

    const previous = structuredClone(previousProfile);
    previous.parliament.chambers = [
      {
        id: 'AU-LC01',
        composition: {
          basis: 'source-reported',
          reportedSeats: 90,
          retrievedAt: '2026-09-18T00:00:00.000Z',
          entries: [
            {
              partyId: 'wiki-1-party-a',
              party: 'Party A',
              seats: 90,
            },
          ],
          sourceIds: ['wikipedia-en-page-1'],
        },
      },
    ];

    const retained = mergeIpuProfile(
      previous,
      normalizeIpuSnapshot(noFull),
      '2026-09-19',
    );
    expect(retained.parliament.chambers[0].composition).toEqual(
      previous.parliament.chambers[0].composition,
    );

    const replaced = mergeIpuProfile(
      previous,
      normalizeIpuSnapshot(snapshot),
      '2026-09-19',
    );
    expect(replaced.parliament.chambers[0].composition).toBeUndefined();

    const ipuStructured = normalizeIpuSnapshot(noFull);
    ipuStructured.parliament.chambers[0].composition = {
      basis: 'source-reported',
      defaultViewId: 'membership',
      retrievedAt: '2026-09-19T00:00:00.000Z',
      views: [
        {
          id: 'membership',
          label: 'Membership composition',
          dimension: 'membership-role',
          reportedSeats: 100,
          entries: [
            {
              partyId: 'au-lc01-appointed-members',
              party: 'Appointed members',
              seats: 99,
            },
            { partyId: 'au-lc01-speaker', party: 'Speaker', seats: 1 },
          ],
          sourceIds: ['ipu-parline'],
        },
      ],
    };
    const preferred = mergeIpuProfile(previous, ipuStructured, '2026-09-19');
    expect(preferred.parliament.chambers[0].composition).toEqual(
      ipuStructured.parliament.chambers[0].composition,
    );
  });

  it('replaces the parliamentary slice without embedding source metadata', () => {
    const profile = mergeIpuProfile(
      previousProfile,
      normalizeIpuSnapshot(snapshot),
      '2026-09-18',
    );
    expect(() => countryProfileSchema.parse(profile)).not.toThrow();
    expect(profile.schemaVersion).toBe(5);
    expect(profile).not.toHaveProperty('sources');
  });
});

describe('IPU client authentication handling', () => {
  it('uses no credentials and reports a clear error if IPU starts requiring them', async () => {
    let request;
    const client = new IpuClient({
      retries: 0,
      fetchImpl: async (_url, options) => {
        request = options;
        return new Response('', { status: 401 });
      },
    });

    await expect(client.request('countries/AU')).rejects.toBeInstanceOf(
      IpuAuthenticationRequiredError,
    );
    expect(request.headers).not.toHaveProperty('Authorization');
    expect(request.credentials).toBeUndefined();
  });
});
