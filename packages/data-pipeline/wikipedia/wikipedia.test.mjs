import { describe, expect, it } from 'vitest';
import { countryProfileSchema } from '../../schemas/country.ts';
import {
  extractExplicitChamberKind,
  extractHouseLinks,
  extractPoliticalComposition,
  extractSeatCount,
  parseInfobox,
} from './parse-infobox.mjs';
import {
  mergeWikipediaChambers,
  normalizeWikipediaParliament,
} from './parliament.mjs';

function parliamentHtml(houses) {
  return `
    <table class="infobox">
      <tbody>
        <tr>
          <th>Houses</th>
          <td>
            ${houses
              .map(
                (house) =>
                  `<a href="./${house.title.replaceAll(' ', '_')}">${house.name}</a>`,
              )
              .join('<br>')}
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

function chamberHtml({ seats, kind, compositionHtml = '' }) {
  return `
    <table class="infobox">
      <tbody>
        ${kind ? `<tr><th>Type</th><td>${kind} house</td></tr>` : ''}
        <tr><th>Seats</th><td>${seats ?? ''}</td></tr>
        ${compositionHtml}
      </tbody>
    </table>
  `;
}

function politicalGroupsRow() {
  return `
    <tr>
      <th>NPC political groups</th>
      <td>
        <b>Ruling Party (2,478)</b>
        <dl>
          <dd>CCP and Nonpartisan (2,478)</dd>
        </dl>
        <p><b>Democratic Parties (369)</b></p>
        <dl>
          <dd>Jiusan Society (61)</dd>
          <dd>CPWDP (60)</dd>
          <dd>CDL (55)</dd>
          <dd>CAPD (54)</dd>
          <dd>CNDCA (44)</dd>
          <dd>RCCK (43)</dd>
          <dd>CZGP (39)</dd>
          <dd>TDSL (13)</dd>
        </dl>
      </td>
    </tr>
  `;
}

function lordsGroupsRow() {
  return `
    <tr>
      <th>Political groups</th>
      <td>
        <div>Lords Spiritual</div>
        <div><ul><li>Bishops (25)</li></ul></div>
        <div>Lords Temporal</div>
        <b>HM Government</b>
        <div><ul><li>Labour Party (233)</li></ul></div>
        <b>HM Official Opposition</b>
        <div><ul><li>Conservative Party (247)</li></ul></div>
        <b>Other groups</b>
        <div>
          <ul>
            <li>Liberal Democrats (80)</li>
            <li>Democratic Unionist Party (6)</li>
            <li>Non-affiliated (43)</li>
          </ul>
        </div>
        <b>Crossbench</b>
        <div><ul><li>Crossbenchers (155)</li></ul></div>
        <b>Presiding officer</b>
        <div><ul><li>Lord Speaker (1)</li></ul></div>
      </td>
    </tr>
  `;
}

function profile(chambers = []) {
  return {
    schemaVersion: 4,
    buildId: '2026-09-19',
    identity: {
      iso2: 'EX',
      iso3: 'EXA',
      m49: '999',
      name: 'Example',
      officialName: 'Example',
      capital: 'Example City',
    },
    government: {
      system: {
        value: 'Example system',
        asOf: '2026-09-19',
        retrievedAt: '2026-09-19T00:00:00.000Z',
        sourceIds: ['example-government'],
        confidence: 'verified',
      },
      headOfState: [],
      headOfGovernment: [],
    },
    parliament: {
      name: {
        value: 'Parliament',
        asOf: '2026-09-19',
        retrievedAt: '2026-09-19T00:00:00.000Z',
        sourceIds: ['ipu-parline'],
        confidence: 'verified',
      },
      chambers,
    },
    nextExpectedElections: [],
    relations: [],
  };
}

function ipuChamber({ id, name, kind, totalSeats }) {
  return {
    id,
    name,
    kind,
    totalSeats,
    speakers: [],
    electoralSystem: {
      directlyElected: true,
      systems: ['Example'],
      sourceIds: ['ipu-parline'],
    },
    sourceIds: ['ipu-parline'],
  };
}

function snapshot({
  iso3 = 'EXA',
  parliamentTitle = 'Parliament of Example',
  houses,
}) {
  return {
    retrievedAt: '2026-09-19T00:00:00.000Z',
    requestedCountry: {
      entityId: 'state:m49:999',
      iso2: 'EX',
      iso3,
      m49: '999',
      name: iso3 === 'GBR' ? 'United Kingdom' : 'Example',
    },
    parliamentPage: {
      pageId: 1,
      title: parliamentTitle,
      url: 'https://en.wikipedia.org/wiki/Parliament_of_Example',
      html: parliamentHtml(houses),
    },
    chamberPages: houses.map((house, index) => ({
      pageId: index + 2,
      title: house.title,
      requestedTitle: house.title,
      url: `https://en.wikipedia.org/wiki/${house.title.replaceAll(' ', '_')}`,
      html: chamberHtml({
        seats: house.seats,
        kind: house.kind,
        compositionHtml: house.compositionHtml,
      }),
    })),
  };
}

describe('Wikipedia infobox parsing', () => {
  it('extracts houses, seat counts, and explicit chamber kinds', () => {
    const parent = parseInfobox(
      parliamentHtml([
        { name: 'Assembly', title: 'Assembly', seats: 400 },
        { name: 'Council', title: 'Council', seats: 100 },
      ]),
    );
    expect(extractHouseLinks(parent)).toEqual([
      { text: 'Assembly', title: 'Assembly' },
      { text: 'Council', title: 'Council' },
    ]);

    const chamber = parseInfobox(chamberHtml({ seats: 400, kind: 'lower' }));
    expect(extractSeatCount(chamber)).toBe(400);
    expect(extractExplicitChamberKind(chamber)).toBe('lower');
  });

  it('parses nested political-group totals without double-counting aggregates', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 3000,
        kind: 'unicameral',
        compositionHtml: politicalGroupsRow(),
      }),
    );
    const entries = extractPoliticalComposition(parsed);

    expect(entries).toHaveLength(9);
    expect(entries).toContainEqual({
      party: 'CCP and Nonpartisan',
      seats: 2478,
      group: 'Ruling Party',
    });
    expect(entries).toContainEqual({
      party: 'Jiusan Society',
      seats: 61,
      group: 'Democratic Parties',
    });
    expect(entries.reduce((sum, entry) => sum + entry.seats, 0)).toBe(2847);
  });

  it('uses structural group headings that do not contain seat totals', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 790,
        kind: 'upper',
        compositionHtml: lordsGroupsRow(),
      }),
    );
    const entries = extractPoliticalComposition(parsed);

    expect(entries).toContainEqual({
      party: 'Labour Party',
      seats: 233,
      group: 'HM Government',
    });
    expect(entries).toContainEqual({
      party: 'Conservative Party',
      seats: 247,
      group: 'HM Official Opposition',
    });
    expect(entries).toContainEqual({
      party: 'Liberal Democrats',
      seats: 80,
      group: 'Other groups',
    });
    expect(entries).toContainEqual({
      party: 'Crossbenchers',
      seats: 155,
      group: 'Crossbench',
    });
    expect(entries).toContainEqual({
      party: 'Lord Speaker',
      seats: 1,
      group: 'Presiding officer',
    });
  });
});

describe('Wikipedia chamber fallback', () => {
  it('adds an unregistered chamber without replacing the IPU chamber', () => {
    const existing = ipuChamber({
      id: 'EX-LC01',
      name: 'Assembly',
      kind: 'lower',
      totalSeats: 400,
    });
    const current = profile([existing]);
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 400 },
          { name: 'Council', title: 'Council', seats: 100 },
        ],
      }),
      current,
    );

    expect(normalized.missingChambers).toHaveLength(1);
    expect(normalized.missingChambers[0]).toMatchObject({
      name: 'Council',
      kind: 'upper',
      totalSeats: 100,
    });

    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');
    expect(merged.parliament.chambers).toHaveLength(2);
    expect(merged.parliament.chambers[0]).toEqual(existing);
    expect(() => countryProfileSchema.parse(merged)).not.toThrow();
  });

  it('does not duplicate a Wikipedia chamber that strongly matches an IPU chamber by name', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'National Assembly',
        kind: 'lower',
        totalSeats: 400,
      }),
      ipuChamber({
        id: 'EX-UC01',
        name: 'Council of States',
        kind: 'upper',
        totalSeats: 100,
      }),
    ]);
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 400 },
          { name: 'Council', title: 'Council', seats: 100 },
        ],
      }),
      current,
    );
    expect(normalized.missingChambers).toEqual([]);
  });

  it('replaces a previously generated Wikipedia fallback on refresh', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'lower',
        totalSeats: 400,
      }),
      {
        id: 'wiki-exa-council',
        name: 'Council',
        kind: 'upper',
        totalSeats: 100,
        speakers: [],
        sourceIds: ['wikipedia-en-page-1', 'wikipedia-en-page-3'],
      },
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 400 },
          { name: 'Council', title: 'Council', seats: 120 },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-20');

    expect(normalized.missingChambers).toHaveLength(1);
    expect(merged.parliament.chambers).toHaveLength(2);
    expect(merged.parliament.chambers[1]).toMatchObject({
      id: 'wiki-exa-council',
      name: 'Council',
      kind: 'upper',
      totalSeats: 120,
    });
  });

  it('removes a Wikipedia fallback when IPU later registers that chamber', () => {
    const lower = ipuChamber({
      id: 'EX-LC01',
      name: 'Assembly',
      kind: 'lower',
      totalSeats: 400,
    });
    const upper = ipuChamber({
      id: 'EX-UC01',
      name: 'Council',
      kind: 'upper',
      totalSeats: 120,
    });
    const current = profile([
      lower,
      upper,
      {
        id: 'wiki-exa-council',
        name: 'Council',
        kind: 'upper',
        totalSeats: 100,
        speakers: [],
        sourceIds: ['wikipedia-en-page-1', 'wikipedia-en-page-3'],
      },
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 400 },
          { name: 'Council', title: 'Council', seats: 120 },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-20');

    expect(normalized.missingChambers).toEqual([]);
    expect(merged.parliament.chambers).toEqual([lower, upper]);
  });

  it('matches a uniquely typed chamber despite source aliases and seat-count drift', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'House of the People',
        kind: 'lower',
        totalSeats: 545,
      }),
      ipuChamber({
        id: 'EX-UC01',
        name: 'Council of States',
        kind: 'upper',
        totalSeats: 245,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Lok Sabha',
            title: 'Lok Sabha',
            seats: 543,
            kind: 'lower',
            compositionHtml:
              '<tr><th>Political groups</th><td><ul><li>Party A (540)</li></ul></td></tr>',
          },
          {
            name: 'Council of States',
            title: 'Council of States',
            seats: 245,
            kind: 'upper',
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');

    expect(normalized.missingChambers).toEqual([]);
    expect(merged.parliament.chambers).toHaveLength(2);
    expect(
      merged.parliament.chambers.find((chamber) => chamber.id === 'EX-LC01')
        ?.composition?.reportedSeats,
    ).toBe(540);
  });

  it('does not use equal seat count alone to identify an IPU chamber', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'lower',
        totalSeats: 100,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 100 },
          { name: 'Council', title: 'Council', seats: 100 },
        ],
      }),
      current,
    );

    expect(normalized.missingChambers).toEqual([
      expect.objectContaining({
        name: 'Council',
        kind: 'upper',
        totalSeats: 100,
      }),
    ]);
  });

  it('reports a chamber page whose infobox has no seat count', () => {
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 400 },
          { name: 'Council', title: 'Council', seats: undefined },
        ],
      }),
      profile([
        ipuChamber({
          id: 'EX-LC01',
          name: 'Assembly',
          kind: 'lower',
          totalSeats: 400,
        }),
      ]),
    );

    expect(normalized.diagnostics).toContain('NO_SEAT_COUNT:Council');
    expect(normalized.missingChambers).toEqual([]);
  });

  it('uses explicit Wikipedia chamber type before seat-count inference', () => {
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Small House',
            title: 'Small House',
            seats: 100,
            kind: 'lower',
          },
          {
            name: 'Large House',
            title: 'Large House',
            seats: 400,
            kind: 'upper',
          },
        ],
      }),
      profile(),
    );
    expect(
      normalized.missingChambers.map(({ name, kind }) => ({ name, kind })),
    ).toEqual([
      { name: 'Small House', kind: 'lower' },
      { name: 'Large House', kind: 'upper' },
    ]);
  });

  it('uses the larger chamber as lower-house fallback when labels are absent', () => {
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Small House', title: 'Small House', seats: 100 },
          { name: 'Large House', title: 'Large House', seats: 400 },
        ],
      }),
      profile(),
    );
    expect(
      normalized.missingChambers.map(({ name, kind }) => ({ name, kind })),
    ).toEqual([
      { name: 'Large House', kind: 'lower' },
      { name: 'Small House', kind: 'upper' },
    ]);
  });

  it('uses the UK exception when the upper chamber is larger', () => {
    const current = profile();
    current.identity.iso2 = 'GB';
    current.identity.iso3 = 'GBR';
    current.identity.m49 = '826';
    current.identity.name = 'United Kingdom';
    current.identity.officialName = 'United Kingdom';

    const normalized = normalizeWikipediaParliament(
      snapshot({
        iso3: 'GBR',
        parliamentTitle: 'Parliament of the United Kingdom',
        houses: [
          { name: 'House of Commons', title: 'House of Commons', seats: 650 },
          { name: 'House of Lords', title: 'House of Lords', seats: 800 },
        ],
      }),
      current,
    );
    expect(
      normalized.missingChambers.map(({ name, kind }) => ({ name, kind })),
    ).toEqual([
      { name: 'House of Commons', kind: 'lower' },
      { name: 'House of Lords', kind: 'upper' },
    ]);
  });

  it('enriches a matched IPU chamber when IPU has no full party split', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'unicameral',
        totalSeats: 3000,
      }),
    ]);
    current.parliament.chambers[0].latestElection = {
      id: 'EX-E1',
      date: { from: '2023-03-05' },
      scope: 'full-renewal',
      seatsAtStake: 2977,
      chamberSize: 3000,
      sourceIds: ['ipu-parline'],
    };

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Assembly',
            title: 'Assembly',
            seats: 3000,
            kind: 'unicameral',
            compositionHtml: politicalGroupsRow(),
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');

    expect(normalized.chamberCompositions).toHaveLength(1);
    expect(merged.parliament.chambers[0].composition).toMatchObject({
      basis: 'source-reported',
      reportedSeats: 2847,
    });
    expect(merged.parliament.chambers[0].composition.entries).toHaveLength(9);
    expect(
      new Set(
        merged.parliament.chambers[0].composition.entries.map(
          (entry) => entry.partyId,
        ),
      ).size,
    ).toBe(9);
    expect(() => countryProfileSchema.parse(merged)).not.toThrow();
  });

  it('does not attach Wikipedia composition when IPU already provides a full composition', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'unicameral',
        totalSeats: 3000,
      }),
    ]);
    current.parliament.chambers[0].latestElection = {
      id: 'EX-E1',
      date: { from: '2023-03-05' },
      scope: 'full-renewal',
      seatsAtStake: 3000,
      chamberSize: 3000,
      outcome: {
        display: 'post-election-full-composition',
        seatsWonInElection: [
          { partyId: 'party-a', party: 'Party A', seats: 3000 },
        ],
        postElectionComposition: [
          { partyId: 'party-a', party: 'Party A', seats: 3000 },
        ],
      },
      sourceIds: ['ipu-parline'],
    };

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Assembly',
            title: 'Assembly',
            seats: 3000,
            kind: 'unicameral',
            compositionHtml: politicalGroupsRow(),
          },
        ],
      }),
      current,
    );

    expect(normalized.chamberCompositions).toEqual([]);
  });

  it('rejects a parsed source composition that exceeds statutory chamber size', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'Assembly',
        kind: 'unicameral',
        totalSeats: 100,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Assembly',
            title: 'Assembly',
            seats: 100,
            kind: 'unicameral',
            compositionHtml:
              '<tr><th>Political groups</th><td><ul><li>Party A (80)</li><li>Party B (40)</li></ul></td></tr>',
          },
        ],
      }),
      current,
    );

    expect(normalized.chamberCompositions).toEqual([]);
    expect(normalized.diagnostics).toContain(
      'COMPOSITION_EXCEEDS_CHAMBER:Assembly:120/100',
    );
  });

  it('keeps Wikipedia provenance on every added chamber', () => {
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Assembly', title: 'Assembly', seats: 400 },
          { name: 'Council', title: 'Council', seats: 100 },
        ],
      }),
      profile(),
    );
    expect(normalized.sources.map((source) => source.id)).toEqual([
      'wikipedia-en-page-1',
      'wikipedia-en-page-2',
      'wikipedia-en-page-3',
    ]);
    expect(
      normalized.missingChambers.every((chamber) =>
        chamber.sourceIds.includes('wikipedia-en-page-1'),
      ),
    ).toBe(true);
  });
});
