import { describe, expect, it } from 'vitest';
import { countryProfileSchema } from '../../schemas/country.ts';
import {
  extractExplicitChamberKind,
  extractHouseLinks,
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

function chamberHtml({ seats, kind }) {
  return `
    <table class="infobox">
      <tbody>
        ${kind ? `<tr><th>Type</th><td>${kind} house</td></tr>` : ''}
        <tr><th>Seats</th><td>${seats}</td></tr>
      </tbody>
    </table>
  `;
}

function profile(chambers = []) {
  return {
    schemaVersion: 3,
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
      html: chamberHtml({ seats: house.seats, kind: house.kind }),
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

  it('does not duplicate a Wikipedia chamber that matches an IPU chamber by seats', () => {
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

  it('uses explicit Wikipedia chamber type before seat-count inference', () => {
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Small House', title: 'Small House', seats: 100, kind: 'lower' },
          { name: 'Large House', title: 'Large House', seats: 400, kind: 'upper' },
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
