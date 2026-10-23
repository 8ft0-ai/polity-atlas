import { describe, expect, it, vi } from 'vitest';
import {
  discoverPartyIdentities,
  ipuPartyRows,
  isPartyDiscoveryExcluded,
  validatePartyDiscovery,
  verifyPartyDiscoveryPage,
} from './party-identity.mjs';
import {
  acquireLinkedPartySnapshot,
  normalizeLinkedPartySnapshot,
} from './party-acquisition.mjs';
import { associatePreparedParties } from './party-association.mjs';

const retrievedAt = '2026-10-23T06:00:00.000Z';

function page(id, title, country = 'United States', withPosition = false) {
  return {
    pageId: id,
    title,
    url: 'https://en.wikipedia.org/wiki/' + title.replaceAll(' ', '_'),
    revisionId: id + 100,
    revisionTimestamp: retrievedAt,
    html:
      '<table class="infobox"><tbody>' +
      '<tr><th>Country</th><td>' + country + '</td></tr>' +
      '<tr><th>Founded</th><td>1970</td></tr>' +
      '<tr><th>Leader</th><td>Example Leader</td></tr>' +
      (withPosition
        ? '<tr><th>Political position</th><td>Centre-left</td></tr>'
        : '') +
      '</tbody></table>',
  };
}

function setup({ iso3 = 'USA', country = 'United States', parties } = {}) {
  const pairs = parties ?? [
    ['dems-house', 'Democratic Party', 'HOUSE'],
    ['reps-house', 'Republican Party', 'HOUSE'],
    ['dems-senate', 'Democratic Party', 'SENATE'],
    ['reps-senate', 'Republican Party', 'SENATE'],
  ];
  const chambers = [...new Set(pairs.map((entry) => entry[2]))].map((id) => {
    const entries = pairs
      .filter((pair) => pair[2] === id)
      .map(([partyId, party]) => ({ partyId, party, seats: 20 }));
    return {
      id,
      name: id,
      latestElection: {
        outcome: {
          postElectionComposition: entries,
          seatsWonInElection: structuredClone(entries),
        },
      },
    };
  });
  return {
    snapshot: {
      requestedCountry: { iso3, name: country },
      retrievedAt,
      parliamentPage: null,
      chamberPages: [],
    },
    profile: {
      schemaVersion: 6,
      identity: { iso3 },
      parliament: { chambers },
      parties: [],
    },
  };
}

function fakeClient(pages, search = []) {
  return {
    fetchPageWithHtml: vi.fn(async (title) => pages[title]),
    searchPages: vi.fn(async () => search),
  };
}

const missingWikidata = {
  enwikiSitelinksByIds: vi.fn(async () => new Map()),
};

describe('Phase 4 PR1 party identity discovery', () => {
  it('resolves both US parties across both chambers and keeps positions optional', async () => {
    const { snapshot, profile } = setup();
    const client = fakeClient(
      {
        'Democratic Party (United States)': page(
          111,
          'Democratic Party (United States)',
        ),
        'Republican Party (United States)': page(
          222,
          'Republican Party (United States)',
          'United States',
          true,
        ),
      },
      [
        { title: 'Democratic Party (United States)' },
        { title: 'Republican Party (United States)' },
        { title: 'Democratic Party of Another Country' },
      ],
    );
    const discovery = await discoverPartyIdentities(
      snapshot,
      profile,
      client,
      missingWikidata,
    );
    expect(discovery.observations).toHaveLength(4);
    expect(discovery.observations.every((item) => item.status === 'verified')).toBe(
      true,
    );
    expect(client.searchPages).toHaveBeenCalledTimes(4);
    validatePartyDiscovery(snapshot, profile, JSON.parse(JSON.stringify(discovery)));

    const acquired = await acquireLinkedPartySnapshot(snapshot, client);
    const prepared = normalizeLinkedPartySnapshot(snapshot, acquired, discovery);
    expect(prepared.profiles).toHaveLength(2);
    expect(prepared.profiles.find((party) => party.entityId === 'party:wikipedia:111').position).toBeUndefined();
    expect(prepared.profiles.find((party) => party.entityId === 'party:wikipedia:222').position.raw).toBe('Centre-left');

    const registry = {
      sources: [
        {
          id: 'ipu-parline',
          publisher: 'IPU',
          title: 'IPU election results',
          url: 'https://data.ipu.org/',
          retrievedAt,
          kind: 'reference',
        },
      ],
    };
    const linked = associatePreparedParties(
      profile,
      acquired,
      prepared,
      registry,
      [],
      discovery,
    );
    const [house, senate] = linked.profile.parliament.chambers;
    expect(house.latestElection.outcome.postElectionComposition.map((entry) => entry.partyEntityId)).toEqual([
      'party:wikipedia:111',
      'party:wikipedia:222',
    ]);
    expect(senate.latestElection.outcome.postElectionComposition.map((entry) => entry.partyEntityId)).toEqual([
      'party:wikipedia:111',
      'party:wikipedia:222',
    ]);
    expect(linked.profile.parties).toHaveLength(2);
    expect(linked.profile.parties.find((entry) => entry.entityId === 'party:wikipedia:111').sourcePartyIds).toEqual([
      'dems-house',
      'dems-senate',
    ]);
  });

  it('accepts only unambiguous verified search, rejecting wrong country and missing identity', async () => {
    const { snapshot, profile } = setup({
      parties: [['dems-house', 'Democratic Party', 'HOUSE']],
    });
    const client = fakeClient(
      {
        'Democratic Party': page(30, 'Democratic Party', 'Other Country'),
        'Democratic Party (United States)': page(
          31,
          'Democratic Party (United States)',
          'Other Country',
        ),
      },
      [{ title: 'Democratic Party' }, { title: 'Democratic Party (United States)' }],
    );
    const discovery = await discoverPartyIdentities(snapshot, profile, client, missingWikidata);
    expect(discovery.observations[0].status).toBe('unresolved');
    expect(discovery.diagnostics).toContain('PARTY_DISCOVERY_UNRESOLVED:HOUSE:dems-house');
    expect(verifyPartyDiscoveryPage(page(21, 'Democratic Party', 'Other Country'), 'Democratic Party', 'United States')).toBe(false);
  });

  it('withholds identity when two credible country-matching search candidates exist', async () => {
    const { snapshot, profile } = setup({ parties: [['dems', 'Democratic Party', 'HOUSE']] });
    const client = fakeClient(
      {
        'Democratic Party': page(30, 'Democratic Party'),
        'Democratic Party (United States)': page(31, 'Democratic Party (United States)'),
      },
      [{ title: 'Democratic Party' }, { title: 'Democratic Party (United States)' }],
    );
    const discovery = await discoverPartyIdentities(snapshot, profile, client, missingWikidata);
    expect(discovery.observations[0].status).toBe('ambiguous');
    expect(discovery.diagnostics).toContain('PARTY_DISCOVERY_AMBIGUOUS:HOUSE:dems');
  });

  it('supports an audited country-scoped alias where source names differ', async () => {
    const { snapshot, profile } = setup({
      iso3: 'AUS',
      country: 'Australia',
      parties: [['au-greens', 'The Greens', 'HOUSE']],
    });
    const client = fakeClient({
      'Australian Greens': page(777, 'Australian Greens', 'Australia'),
    });
    const mapping = {
      countryIso3: 'AUS',
      chamberId: 'HOUSE',
      partyId: 'au-greens',
      partyName: 'The Greens',
      wikipediaTitle: 'Australian Greens',
      reason: 'Verified source identity in the original chamber record',
      reviewer: 'Synthetic test reviewer',
      reviewDate: '2026-10-23',
      sourceIds: ['ipu-parline'],
    };
    const discovery = await discoverPartyIdentities(
      snapshot,
      profile,
      client,
      missingWikidata,
      { mappings: [mapping] },
    );
    expect(client.searchPages).not.toHaveBeenCalled();
    expect(discovery.observations[0]).toMatchObject({
      method: 'reviewed-wikipedia-alias',
      status: 'verified',
      reviewedSourceIds: ['ipu-parline'],
    });
    expect(() => validatePartyDiscovery(snapshot, profile, discovery)).not.toThrow();
    expect(
      await discoverPartyIdentities(
        snapshot,
        profile,
        client,
        missingWikidata,
        { mappings: [{ ...mapping, countryIso3: 'USA' }] },
      ),
    ).toMatchObject({
      observations: [{ status: 'unresolved' }],
    });
  });

  it('uses only a supplied Wikidata Q ID and its exact enwiki sitelink', async () => {
    const { snapshot, profile } = setup({ parties: [['party-x', 'Example Party', 'HOUSE']] });
    const client = fakeClient({
      'Example Party (United States)': page(404, 'Example Party (United States)'),
    });
    const wikidata = {
      enwikiSitelinksByIds: vi.fn(async () => new Map([['Q123', 'Example Party (United States)']])),
    };
    const discovery = await discoverPartyIdentities(
      snapshot,
      profile,
      client,
      wikidata,
      {
        mappings: [{
          countryIso3: 'USA',
          chamberId: 'HOUSE',
          partyId: 'party-x',
          partyName: 'Example Party',
          wikidataId: 'Q123',
          reason: 'Manually verified exact Wikidata identity',
          reviewer: 'Synthetic test reviewer',
          reviewDate: '2026-10-23',
          sourceIds: ['ipu-parline'],
        }],
      },
    );
    expect(wikidata.enwikiSitelinksByIds).toHaveBeenCalledWith(['Q123']);
    expect(client.searchPages).not.toHaveBeenCalled();
    expect(discovery.observations[0].status).toBe('verified');
    expect(discovery.observations[0].method).toBe('reviewed-wikidata-sitelink');
  });

  it('never discovers generic categories and coalitions as individual parties', async () => {
    const { snapshot, profile } = setup({
      iso3: 'FRA',
      country: 'France',
      parties: [
        ['nfp', 'New Popular Front (NFP)/UG', 'ASSEMBLY'],
        ['other', 'Other parties of the right (DVD)', 'ASSEMBLY'],
        ['majority', 'Ensemble (presidential majority)', 'ASSEMBLY'],
        ['rn', 'National Rally (RN)', 'ASSEMBLY'],
      ],
    });
    expect(isPartyDiscoveryExcluded('Liberal National coalition')).toBe(true);
    expect(isPartyDiscoveryExcluded('NOM')).toBe(true);
    expect(ipuPartyRows(profile).map((row) => row.party)).toEqual(['National Rally (RN)']);
    const discovery = await discoverPartyIdentities(
      snapshot,
      profile,
      fakeClient({}, []),
      missingWikidata,
    );
    expect(discovery.observations).toHaveLength(1);
  });

  it('bounds discovery work and rejects mismatched offline cache or aliases', async () => {
    const { snapshot, profile } = setup();
    const client = fakeClient({}, []);
    const discovery = await discoverPartyIdentities(
      snapshot,
      profile,
      client,
      missingWikidata,
      { maxRows: 1 },
    );
    expect(discovery.observations).toHaveLength(1);
    expect(discovery.diagnostics).toContain('PARTY_DISCOVERY_LIMIT_EXCEEDED:USA');
    expect(() => validatePartyDiscovery(
      { ...snapshot, requestedCountry: { iso3: 'FRA', name: 'France' } },
      profile,
      discovery,
    )).toThrow('PARTY_DISCOVERY_CACHE_MISMATCH');
    expect(() =>
      validatePartyDiscovery(snapshot, profile, {
        ...discovery,
        observations: [...discovery.observations, discovery.observations[0]],
      }),
    ).toThrow('PARTY_DISCOVERY_CACHE_MISMATCH');
    await expect(
      discoverPartyIdentities(snapshot, profile, client, missingWikidata, {
        mappings: [{
          countryIso3: 'USA',
          chamberId: 'HOUSE',
          partyId: 'dems-house',
          partyName: 'Democratic Party',
          wikipediaTitle: 'Democratic Party',
        }],
      }),
    ).rejects.toThrow('PARTY_ALIAS_REGISTRY_INVALID');
  });
});
