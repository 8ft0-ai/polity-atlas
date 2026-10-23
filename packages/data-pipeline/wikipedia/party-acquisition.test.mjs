import { describe, expect, it, vi } from 'vitest';
import {
  linkedPartyCandidates,
  acquireLinkedPartySnapshot,
  normalizeLinkedPartySnapshot,
} from './party-acquisition.mjs';

const retrievedAt = '2026-10-22T02:00:00.000Z';

function chamber(pageId, labels) {
  return {
    pageId,
    title: 'Example Chamber ' + pageId,
    html:
      '<table class="infobox"><tbody><tr><th>Political groups</th><td>' +
      '<ul>' +
      labels
        .map(
          ({ name, title, seats }) =>
            '<li>' +
            (title
              ? '<a href="./' +
                title.replaceAll(' ', '_') +
                '">' +
                name +
                '</a>'
              : name) +
            ' (' +
            seats +
            ')</li>',
        )
        .join('') +
      '</ul></td></tr></tbody></table>',
  };
}

function countrySnapshot(pages) {
  return {
    requestedCountry: { iso3: 'EXA', name: 'Example' },
    retrievedAt,
    parliamentPage: null,
    chamberPages: pages,
  };
}

function partyPage({
  id = 21,
  title = 'Alpha Party',
  position = 'Centre-left',
  withPartyEvidence = true,
} = {}) {
  return {
    pageId: id,
    title,
    url: 'https://en.wikipedia.org/wiki/' + title.replaceAll(' ', '_'),
    revisionId: 1000,
    revisionTimestamp: retrievedAt,
    html:
      '<table class="infobox"><tbody>' +
      '<tr><th>Founded</th><td>2000</td></tr>' +
      (withPartyEvidence
        ? '<tr><th>Ideology</th><td>Social democracy</td></tr>'
        : '') +
      (position
        ? '<tr><th>Political position</th><td>' + position + '</td></tr>'
        : '') +
      '</tbody></table>',
  };
}

const alpha = { name: 'Alpha Party', title: 'Alpha Party', seats: 12 };
const independent = { name: 'Independents', title: 'Independents', seats: 2 };
const beta = { name: 'Beta Party', title: 'Beta Party', seats: 8 };
const base = countrySnapshot([chamber(100, [alpha, independent, beta])]);

describe('Phase 4A exact-link party candidate discovery', () => {
  it('only discovers linked, non-generic political parties', () => {
    expect(linkedPartyCandidates(base)).toEqual([
      {
        requestedTitle: 'Alpha Party',
        sourceLabels: ['Alpha Party'],
        sourceIds: ['wikipedia-en-page-100'],
      },
      {
        requestedTitle: 'Beta Party',
        sourceLabels: ['Beta Party'],
        sourceIds: ['wikipedia-en-page-100'],
      },
    ]);
  });

  it('deduplicates the same article across chambers and source labels', () => {
    const snapshot = countrySnapshot([
      chamber(100, [alpha]),
      chamber(101, [alpha, { name: 'Alpha', title: 'Alpha Party', seats: 7 }]),
    ]);
    expect(linkedPartyCandidates(snapshot)).toEqual([
      {
        requestedTitle: 'Alpha Party',
        sourceLabels: ['Alpha', 'Alpha Party'],
        sourceIds: ['wikipedia-en-page-100', 'wikipedia-en-page-101'],
      },
    ]);
  });

  it('does not turn plain seat or membership labels into search requests', () => {
    const snapshot = countrySnapshot([
      chamber(100, [
        { name: 'Appointed members', title: 'Appointed members', seats: 80 },
        { name: 'Speaker', title: 'Speaker', seats: 1 },
        { name: 'Crossbenchers', title: 'Crossbenchers', seats: 3 },
        { name: 'Unknown group', seats: 2 },
      ]),
    ]);
    expect(linkedPartyCandidates(snapshot)).toEqual([]);
  });

  it('retains exact party links inside nested government, opposition and crossbench aggregates', () => {
    const html = `<table class="infobox"><tbody><tr><th>Political groups</th><td>
      <ul>
        <li>Government (94)<ul><li><a href="./Australian_Labor_Party">Australian Labor Party</a> (94)</li></ul></li>
        <li>Opposition (43)<ul><li><a href="./Liberal_Party_of_Australia">Liberal Party</a> (28)</li><li><a href="./National_Party_of_Australia">National Party</a> (15)</li></ul></li>
        <li>Crossbench (13)<ul><li>Independents (10)</li><li><a href="./Australian_Greens">Australian Greens</a> (1)</li><li><a href="./Centre_Alliance">Centre Alliance</a> (1)</li><li>Vacant (1)</li></ul></li>
      </ul></td></tr></tbody></table>`;
    const source = countrySnapshot([{ ...chamber(61565, []), html }]);
    expect(linkedPartyCandidates(source)).toEqual(
      [
        ['Australian Greens', 'Australian Greens'],
        ['Australian Labor Party', 'Australian Labor Party'],
        ['Centre Alliance', 'Centre Alliance'],
        ['Liberal Party of Australia', 'Liberal Party'],
        ['National Party of Australia', 'National Party'],
      ].map(([requestedTitle, label]) => ({
        requestedTitle,
        sourceLabels: [label],
        sourceIds: ['wikipedia-en-page-61565'],
      })),
    );
  });

  it('excludes nested aggregate headers even when they contain a Wikipedia link', () => {
    const html = `<table class="infobox"><tbody><tr><th>Political groups</th><td><ul>
      <li><a href="./Example_Coalition">Coalition</a> (20)<ul>
        <li><a href="./Alpha_Party">Alpha Party</a> (12)</li>
        <li><a href="./Beta_Party">Beta Party</a> (8)</li>
      </ul></li>
    </ul></td></tr></tbody></table>`;
    const source = countrySnapshot([{ ...chamber(100, []), html }]);
    expect(
      linkedPartyCandidates(source).map((entry) => entry.requestedTitle),
    ).toEqual(['Alpha Party', 'Beta Party']);
  });

  it('refuses an unbound chamber page without a stable page ID', () => {
    expect(() =>
      linkedPartyCandidates(countrySnapshot([chamber(0, [alpha])])),
    ).toThrow('positive page ID');
  });
});

describe('Phase 4A exact article acquisition and deterministic replay', () => {
  it('requests only exact article titles, never an unverified search result', async () => {
    const fetchPageWithHtml = vi.fn(async (title) =>
      title === 'Alpha Party'
        ? partyPage()
        : partyPage({ id: 22, title: 'Beta Party' }),
    );
    const client = {
      fetchPageWithHtml,
      searchPages: vi.fn(() => {
        throw new Error('Search must not be used');
      }),
    };
    const raw = await acquireLinkedPartySnapshot(base, client);
    expect(fetchPageWithHtml.mock.calls).toEqual([
      ['Alpha Party', { allowNotFound: true }],
      ['Beta Party', { allowNotFound: true }],
    ]);
    expect(client.searchPages).not.toHaveBeenCalled();
    expect(raw.countryIso3).toBe('EXA');
    expect(raw.articles.map((item) => item.page.pageId)).toEqual([21, 22]);

    const prepared = normalizeLinkedPartySnapshot(base, raw);
    expect(prepared.profiles).toHaveLength(2);
    expect(prepared.profiles[0].entityId).toBe('party:wikipedia:21');
    expect(prepared.summaries[0].position).toEqual({
      kind: 'scale',
      from: 'centre-left',
      to: 'centre-left',
      raw: 'Centre-left',
      sourceIds: ['wikipedia-en-page-21'],
    });
    expect(prepared.summaries[0].sourceIds).toEqual([
      'wikipedia-en-page-100',
      'wikipedia-en-page-21',
    ]);
    expect(prepared.sources.map((source) => source.id)).toEqual([
      'wikipedia-en-page-21',
      'wikipedia-en-page-22',
    ]);
    expect(prepared.diagnostics).toEqual([]);
    expect(
      normalizeLinkedPartySnapshot(base, JSON.parse(JSON.stringify(raw))),
    ).toEqual(prepared);
    expect(JSON.stringify(prepared)).not.toContain('<table');
  });

  it('records missing or unverified pages without manufacturing identity', async () => {
    const raw = await acquireLinkedPartySnapshot(base, {
      fetchPageWithHtml: async (title) =>
        title === 'Alpha Party'
          ? null
          : partyPage({
              id: 22,
              title: 'Beta Party',
              position: '',
              withPartyEvidence: false,
            }),
    });
    const prepared = normalizeLinkedPartySnapshot(base, raw);
    expect(prepared.summaries).toEqual([]);
    expect(prepared.diagnostics).toEqual([
      'PARTY_ARTICLE_NOT_FOUND:Alpha Party',
      'PARTY_ARTICLE_NOT_VERIFIED:Beta Party',
    ]);
  });

  it('rejects candidate changes and reordered or missing cache entries', async () => {
    const raw = await acquireLinkedPartySnapshot(base, {
      fetchPageWithHtml: async () => partyPage(),
    });
    expect(() =>
      normalizeLinkedPartySnapshot(
        countrySnapshot([chamber(100, [alpha])]),
        raw,
      ),
    ).toThrow('PARTY_CACHE_SNAPSHOT_MISMATCH');
    expect(() =>
      normalizeLinkedPartySnapshot(base, {
        ...raw,
        articles: [...raw.articles].reverse(),
      }),
    ).toThrow('PARTY_CACHE_ARTICLE_IDENTITY_MISMATCH');
    expect(() =>
      normalizeLinkedPartySnapshot(base, {
        ...raw,
        articles: raw.articles.slice(1),
      }),
    ).toThrow('PARTY_CACHE_SNAPSHOT_MISMATCH');
  });

  it('deduplicates redirects by stable page ID', async () => {
    const snapshot = countrySnapshot([
      chamber(100, [
        alpha,
        { name: 'Alpha', title: 'Alternate Alpha Party', seats: 4 },
      ]),
    ]);
    const raw = await acquireLinkedPartySnapshot(snapshot, {
      fetchPageWithHtml: async () => partyPage(),
    });
    const prepared = normalizeLinkedPartySnapshot(snapshot, raw);
    expect(prepared.profiles).toHaveLength(1);
    expect(prepared.summaries[0].entityId).toBe('party:wikipedia:21');
    expect(prepared.diagnostics).toEqual([]);
  });

  it('fails on conflicting page metadata for a shared identity', async () => {
    const snapshot = countrySnapshot([
      chamber(100, [
        alpha,
        { name: 'Alpha', title: 'Alternate Alpha Party', seats: 4 },
      ]),
    ]);
    const raw = await acquireLinkedPartySnapshot(snapshot, {
      fetchPageWithHtml: async (title) =>
        title === 'Alpha Party'
          ? partyPage()
          : partyPage({ position: 'Far-right' }),
    });
    expect(() => normalizeLinkedPartySnapshot(snapshot, raw)).toThrow(
      'PARTY_PAGE_ID_CONFLICT',
    );
  });

  it('limits external source acquisitions and does not swallow failures', async () => {
    await expect(
      acquireLinkedPartySnapshot(base, {}, { maxCandidates: 1 }),
    ).rejects.toThrow('PARTY_CANDIDATE_LIMIT_EXCEEDED');

    await expect(
      acquireLinkedPartySnapshot(base, {
        fetchPageWithHtml: async () => {
          throw new Error('Source unavailable');
        },
      }),
    ).rejects.toThrow('Source unavailable');
  });

  it('keeps an empty candidate source empty and fetch-free', async () => {
    const snapshot = countrySnapshot([]);
    const client = { fetchPageWithHtml: vi.fn() };
    const raw = await acquireLinkedPartySnapshot(snapshot, client);
    expect(client.fetchPageWithHtml).not.toHaveBeenCalled();
    expect(normalizeLinkedPartySnapshot(snapshot, raw)).toMatchObject({
      profiles: [],
      summaries: [],
      diagnostics: [],
    });
  });
});
