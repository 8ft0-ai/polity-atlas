import { describe, expect, it } from 'vitest';
import {
  acquireLinkedPartySnapshot,
  normalizeLinkedPartySnapshot,
} from './party-acquisition.mjs';
import {
  associatePreparedParties,
  validatePartyDataset,
  validatePartyPublication,
} from './party-association.mjs';

const retrievedAt = '2026-10-22T10:00:00.000Z';

function row(name, title, seats) {
  return (
    '<li><a href="./' +
    title.replaceAll(' ', '_') +
    '">' +
    name +
    '</a> (' +
    seats +
    ')</li>'
  );
}

function parliamentPage(pageId, entries) {
  return {
    pageId,
    title: 'Example Chamber',
    html:
      '<table class="infobox"><tbody><tr><th>Political groups</th><td><ul>' +
      entries.map((entry) => row(...entry)).join('') +
      '</ul></td></tr></tbody></table>',
  };
}

function verifiedParty(pageId, title) {
  return {
    pageId,
    title,
    url: 'https://en.wikipedia.org/wiki/' + title.replaceAll(' ', '_'),
    html:
      '<table class="infobox"><tbody>' +
      '<tr><th>Founded</th><td>1980</td></tr>' +
      '<tr><th>Political position</th><td>Centre-left</td></tr>' +
      '</tbody></table>',
  };
}

function source(id, title = id) {
  return {
    id,
    publisher: 'Wikipedia',
    title,
    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title),
    retrievedAt,
    kind: 'reference',
  };
}

const alpha = ['Alpha Party', 'Alpha Party', 12];
const beta = ['Beta Party', 'Beta Party', 9];
const snapshot = {
  requestedCountry: { iso3: 'EXA', name: 'Example' },
  retrievedAt,
  parliamentPage: null,
  chamberPages: [parliamentPage(100, [alpha, beta])],
};

function profile() {
  return {
    schemaVersion: 6,
    buildId: '2026-10-22',
    identity: { iso3: 'EXA' },
    parliament: {
      chambers: [
        {
          id: 'EX-LC01',
          composition: {
            basis: 'source-reported',
            retrievedAt,
            reportedSeats: 23,
            entries: [
              { partyId: 'wiki-alpha', party: 'Alpha Party', seats: 12 },
              { partyId: 'wiki-beta', party: 'Beta Party', seats: 9 },
              { partyId: 'wiki-ind', party: 'Independents', seats: 2 },
            ],
            sourceIds: ['wikipedia-en-page-100'],
          },
          latestElection: {
            outcome: {
              seatsWonInElection: [
                { partyId: 'ipu-alpha', party: 'Alpha Party', seats: 11 },
              ],
            },
          },
        },
      ],
    },
    parties: [],
  };
}

function registry(known = ['wikipedia-en-page-100']) {
  return { schemaVersion: 1, sources: known.map((id) => source(id)) };
}

async function preparation(workingSnapshot = snapshot) {
  const acquired = await acquireLinkedPartySnapshot(workingSnapshot, {
    fetchPageWithHtml: async (title) =>
      title === 'Alpha Party'
        ? verifiedParty(21, 'Alpha Party')
        : verifiedParty(22, 'Beta Party'),
  });
  return {
    acquired,
    prepared: normalizeLinkedPartySnapshot(workingSnapshot, acquired),
  };
}

describe('Phase 4A sourced party association', () => {
  it('joins only provenance-backed composition entries, never IPU name-only entries', async () => {
    const { acquired, prepared } = await preparation();
    const original = profile();
    const result = associatePreparedParties(
      original,
      acquired,
      prepared,
      registry(),
    );
    const chamber = result.profile.parliament.chambers[0];
    expect(
      chamber.composition.entries.map((entry) => entry.partyEntityId),
    ).toEqual(['party:wikipedia:21', 'party:wikipedia:22', undefined]);
    expect(
      chamber.latestElection.outcome.seatsWonInElection[0].partyEntityId,
    ).toBeUndefined();
    expect(
      original.parliament.chambers[0].composition.entries[0],
    ).not.toHaveProperty('partyEntityId');
    expect(result.profile.parties).toHaveLength(2);
    expect(result.profile.parties[0]).toMatchObject({
      entityId: 'party:wikipedia:21',
      sourcePartyIds: ['wiki-alpha'],
      sourceIds: ['wikipedia-en-page-100', 'wikipedia-en-page-21'],
      position: {
        kind: 'scale',
        from: 'centre-left',
        to: 'centre-left',
      },
    });
    expect(result.partyDetails).toHaveLength(2);
    expect(result.additionalSources.map((entry) => entry.id)).toEqual([
      'wikipedia-en-page-21',
      'wikipedia-en-page-22',
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(
      associatePreparedParties(profile(), acquired, prepared, registry()),
    ).toEqual(result);
  });

  it('does not let an electoral coalition inherit a constituent party position', async () => {
    const { acquired, prepared } = await preparation();
    const original = profile();
    const chamber = original.parliament.chambers[0];
    chamber.composition.entries[0].party = 'Liberal National coalition';
    const result = associatePreparedParties(
      original,
      acquired,
      prepared,
      registry(),
    );
    expect(
      result.profile.parliament.chambers[0].composition.entries[0],
    ).toMatchObject({
      party: 'Liberal National coalition',
      representationKind: 'coalition',
      seats: 12,
    });
    expect(
      result.profile.parliament.chambers[0].composition.entries[0]
        .partyEntityId,
    ).toBeUndefined();
    expect(result.profile.parties.map((party) => party.entityId)).toEqual([
      'party:wikipedia:22',
    ]);
    result.profile.parliament.chambers[0].composition.entries[0].partyEntityId =
      'party:wikipedia:22';
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, [
        ...registry().sources,
        ...result.additionalSources,
      ]),
    ).toThrow('Non-party representation was linked');
  });

  it('links IPU election rows only with exact chamber/article evidence', async () => {
    const { acquired, prepared } = await preparation();
    const original = profile();
    original.parliament.chambers[0].latestElection.outcome.postElectionComposition =
      [
        { partyId: 'ipu-alpha', party: 'Alpha Party', seats: 12 },
        { partyId: 'ipu-nom', party: 'NOM', seats: 1 },
      ];
    const evidence = [
      {
        chamberId: 'EX-LC01',
        partyId: 'ipu-alpha',
        party: 'Alpha Party',
        articleTitle: 'Alpha Party',
        sourcePageId: 100,
      },
      {
        chamberId: 'EX-LC01',
        partyId: 'ipu-nom',
        party: 'NOM',
        articleTitle: 'Beta Party',
        sourcePageId: 100,
      },
    ];
    const result = associatePreparedParties(
      original,
      acquired,
      prepared,
      registry(),
      evidence,
    );
    const outcome =
      result.profile.parliament.chambers[0].latestElection.outcome;
    expect(outcome.seatsWonInElection[0].partyEntityId).toBe(
      'party:wikipedia:21',
    );
    expect(outcome.postElectionComposition[0].partyEntityId).toBe(
      'party:wikipedia:21',
    );
    expect(outcome.postElectionComposition[1].partyEntityId).toBeUndefined();
    expect(result.profile.parties[0].sourcePartyIds).toEqual([
      'ipu-alpha',
      'wiki-alpha',
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(
      original.parliament.chambers[0].latestElection.outcome
        .seatsWonInElection[0].partyEntityId,
    ).toBeUndefined();
  });

  it('withholds wrong source pages and ambiguous IPU article identities', async () => {
    const { acquired, prepared } = await preparation();
    const proof = {
      chamberId: 'EX-LC01',
      partyId: 'ipu-alpha',
      party: 'Alpha Party',
      articleTitle: 'Alpha Party',
      sourcePageId: 101,
    };
    const unmatched = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
      [proof],
    );
    expect(
      unmatched.profile.parliament.chambers[0].latestElection.outcome
        .seatsWonInElection[0].partyEntityId,
    ).toBeUndefined();

    const ambiguous = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
      [
        { ...proof, sourcePageId: 100 },
        { ...proof, sourcePageId: 100, articleTitle: 'Beta Party' },
      ],
    );
    expect(
      ambiguous.profile.parliament.chambers[0].latestElection.outcome
        .seatsWonInElection[0].partyEntityId,
    ).toBeUndefined();
    expect(ambiguous.diagnostics).toContain(
      'PARTY_IDENTITY_AMBIGUOUS:EX-LC01:ipu-alpha',
    );
  });

  it('refuses name-only association from another chamber source', async () => {
    const { acquired, prepared } = await preparation();
    const original = profile();
    original.parliament.chambers.push({
      id: 'EX-UC01',
      composition: {
        basis: 'source-reported',
        reportedSeats: 12,
        entries: [{ partyId: 'elsewhere', party: 'Alpha Party', seats: 12 }],
        sourceIds: ['wikipedia-en-page-101'],
      },
    });
    const result = associatePreparedParties(
      original,
      acquired,
      prepared,
      registry(['wikipedia-en-page-100', 'wikipedia-en-page-101']),
    );
    expect(
      result.profile.parliament.chambers[1].composition.entries[0]
        .partyEntityId,
    ).toBeUndefined();
  });

  it('leaves equally plausible exact links unresolved rather than picking a winner', async () => {
    const ambiguousSnapshot = {
      ...snapshot,
      chamberPages: [
        parliamentPage(100, [
          ['Unity Party', 'Alpha Party', 12],
          ['Unity Party', 'Beta Party', 9],
        ]),
      ],
    };
    const { acquired, prepared } = await preparation(ambiguousSnapshot);
    const original = profile();
    original.parliament.chambers[0].composition.entries = [
      { partyId: 'wiki-unity', party: 'Unity Party', seats: 21 },
    ];
    const result = associatePreparedParties(
      original,
      acquired,
      prepared,
      registry(),
    );
    expect(
      result.profile.parliament.chambers[0].composition.entries[0],
    ).not.toHaveProperty('partyEntityId');
    expect(result.profile.parties).toEqual([]);
    expect(result.partyDetails).toEqual([]);
    expect(result.diagnostics).toEqual(['PARTY_IDENTITY_AMBIGUOUS:wiki-unity']);
  });

  it('rejects an unknown chamber source rather than publishing dangling provenance', async () => {
    const { acquired, prepared } = await preparation();
    expect(() =>
      associatePreparedParties(profile(), acquired, prepared, registry([])),
    ).toThrow('unknown source: wikipedia-en-page-100');
  });

  it('rejects a mismatched country identity and does not mutate input', async () => {
    const { acquired, prepared } = await preparation();
    expect(() =>
      associatePreparedParties(
        { ...profile(), identity: { iso3: 'OTHER' } },
        acquired,
        prepared,
        registry(),
      ),
    ).toThrow('Country identity');
  });

  it('blocks an injected link to a nonexistent summary', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    result.profile.parliament.chambers[0].composition.entries[0].partyEntityId =
      'party:wikipedia:999';
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, [
        ...registry().sources,
        ...result.additionalSources,
      ]),
    ).toThrow('Dangling party entry');
  });

  it('blocks malformed source-party ownership and missing party detail', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    const sources = [...registry().sources, ...result.additionalSources];
    expect(() =>
      validatePartyPublication(
        result.profile,
        result.partyDetails.slice(1),
        sources,
      ),
    ).toThrow('Missing detail');
    result.profile.parties[1].sourcePartyIds = ['wiki-alpha'];
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('multiple entities');
  });

  it('blocks fabricated or orphaned party details and position sources', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    const sources = [...registry().sources, ...result.additionalSources];
    result.partyDetails.push({
      ...result.partyDetails[0],
      entityId: 'party:wikipedia:999',
      identity: {
        ...result.partyDetails[0].identity,
        wikipediaPageId: 999,
      },
    });
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('Orphan party detail');
    result.partyDetails.pop();
    result.profile.parties[0].position.sourceIds = ['unknown'];
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('unknown source');
  });

  it('blocks malformed party detail records before publication', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    const sources = [...registry().sources, ...result.additionalSources];
    result.partyDetails[0].facts[0].values = [];
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('malformed fact');

    result.partyDetails[0].facts[0].values = ['1980'];
    result.partyDetails[0].schemaVersion = 2;
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('identity mismatch');
  });

  it('rejects generic party labels injected with entity links', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    result.profile.parliament.chambers[0].composition.entries[2].partyEntityId =
      'party:wikipedia:21';
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, [
        ...registry().sources,
        ...result.additionalSources,
      ]),
    ).toThrow('Generic entry was linked');
  });

  it('rejects malformed position ranges and stale profile schemas', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    const sources = [...registry().sources, ...result.additionalSources];
    result.profile.parties[0].position = {
      ...result.profile.parties[0].position,
      from: 'right',
      to: 'left',
    };
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('invalid or reversed scale range');

    result.profile.schemaVersion = 5;
    expect(() =>
      validatePartyPublication(result.profile, result.partyDetails, sources),
    ).toThrow('active public schema version');
  });

  it('validates partial-refresh datasets and rejects cross-profile source ID conflicts', async () => {
    const { acquired, prepared } = await preparation();
    const result = associatePreparedParties(
      profile(),
      acquired,
      prepared,
      registry(),
    );
    const sources = [...registry().sources, ...result.additionalSources];
    const untouched = {
      schemaVersion: 6,
      identity: { iso3: 'OTH' },
      parliament: { chambers: [] },
      parties: [],
    };
    expect(
      validatePartyDataset(
        [result.profile, untouched],
        result.partyDetails,
        sources,
      ),
    ).toBe(true);

    const alphaProfile = structuredClone(result.profile);
    alphaProfile.parties = [structuredClone(result.profile.parties[0])];
    alphaProfile.parliament.chambers[0].composition.entries = [
      structuredClone(
        result.profile.parliament.chambers[0].composition.entries[0],
      ),
    ];
    const betaProfile = structuredClone(result.profile);
    betaProfile.identity.iso3 = 'EXB';
    betaProfile.parties = [structuredClone(result.profile.parties[1])];
    betaProfile.parties[0].sourcePartyIds = ['wiki-alpha'];
    betaProfile.parliament.chambers[0].composition.entries = [
      {
        ...structuredClone(
          result.profile.parliament.chambers[0].composition.entries[1],
        ),
        partyId: 'wiki-alpha',
      },
    ];
    expect(() =>
      validatePartyDataset(
        [alphaProfile, betaProfile],
        result.partyDetails,
        sources,
      ),
    ).toThrow('Source party ID links to multiple entities');
  });
});
