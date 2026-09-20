import { describe, expect, it } from 'vitest';
import { countryProfileSchema } from '../../schemas/country.ts';
import {
  extractExplicitChamberKind,
  extractHouseLinks,
  extractPoliticalComposition,
  extractPoliticalCompositionViews,
  extractSeatCount,
  parseInfobox,
} from './parse-infobox.mjs';
import {
  mergeWikipediaChambers,
  normalizeWikipediaParliament,
  visualArticleTitles,
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
    schemaVersion: 5,
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

function ipuChamber({ id, name, aliases, kind, totalSeats }) {
  return {
    id,
    name,
    ...(aliases && { aliases }),
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
      ...(house.wikidataVisuals && {
        wikidataVisuals: house.wikidataVisuals,
      }),
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
    expect(entries[0].party).not.toContain('.mw-parser-output');
  });

  it('isolates independent Wikipedia composition views instead of flattening them', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 290,
        kind: 'unicameral',
        compositionHtml: `
          <tr>
            <th>Political groups</th>
            <td>
              <div class="collapsible-list">
                <div><b>By faction</b></div>
                <div><ul>
                  <li><a href="./Principlists">Principlists</a> (198)</li>
                  <li><a href="./Reformists">Reformists</a> (43)</li>
                  <li><a href="./Independent_politician">Independents</a> (44)</li>
                  <li>Vacant (5)</li>
                </ul></div>
              </div>
              <div class="collapsible-list">
                <div><b>By coalition</b></div>
                <div><ul>
                  <li>Government (43)<ul><li>VNC (43)</li></ul></li>
                  <li>Confidence and supply (119)<ul>
                    <li>CCIRF (106)</li>
                    <li>CCA (13)</li>
                  </ul></li>
                  <li>Opposition (79)<ul><li>PAIRF (79)</li></ul></li>
                  <li>Independent (44)<ul><li>IND (44)</li></ul></li>
                  <li>Vacant (5)<ul><li>Vacant (5)</li></ul></li>
                </ul></div>
              </div>
              <div class="collapsible-list">
                <div><b>By party</b></div>
                <div><ul>
                  <li>FIRS (15)</li>
                  <li>ICP (3)</li>
                  <li>PJPII (2)</li>
                  <li>SPIR (2)</li>
                  <li>SDIR (1)</li>
                  <li>DJP (1)</li>
                  <li>YEKTA (1)</li>
                  <li>ISE (1)</li>
                  <li>IAPI (1)</li>
                  <li>ECP (1)</li>
                  <li>MDP (1)</li>
                  <li>UIIPP (1)</li>
                  <li>AFIL (1)</li>
                  <li>Independents (254)</li>
                  <li>Vacant (5)</li>
                </ul></div>
              </div>
            </td>
          </tr>
        `,
      }),
    );

    const views = extractPoliticalCompositionViews(parsed);
    expect(views.map(({ id, dimension }) => ({ id, dimension }))).toEqual([
      { id: 'faction', dimension: 'faction' },
      { id: 'coalition', dimension: 'coalition' },
      { id: 'party', dimension: 'party' },
    ]);
    expect(
      views
        .find((view) => view.id === 'faction')
        .entries.reduce((sum, entry) => sum + entry.seats, 0),
    ).toBe(290);
    expect(
      views
        .find((view) => view.id === 'party')
        .entries.reduce((sum, entry) => sum + entry.seats, 0),
    ).toBe(290);
    expect(
      views.find((view) => view.id === 'coalition').containsNestedAggregates,
    ).toBe(true);

    const legacySelection = extractPoliticalComposition(parsed);
    expect(legacySelection.reduce((sum, entry) => sum + entry.seats, 0)).toBe(
      290,
    );
    expect(
      legacySelection.some((entry) => entry.party === 'Principlists'),
    ).toBe(false);
  });

  it('preserves a canonical Wikipedia legend colour and linked party title', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 100,
        kind: 'lower',
        compositionHtml: `
          <tr>
            <th>Political groups</th>
            <td>
              <ul>
                <li>
                  <span class="legend-color" style="background-color: rgb(18, 52, 86)"></span>
                  <a href="./Example_Party">Example Party</a> (100)
                </li>
              </ul>
            </td>
          </tr>
        `,
      }),
    );

    expect(extractPoliticalComposition(parsed)).toEqual([
      {
        party: 'Example Party',
        seats: 100,
        articleTitle: 'Example Party',
        visual: { color: '#123456', method: 'wikipedia-entry' },
      },
    ]);
  });

  it('removes Wikimedia TemplateStyles text from a leaf party label', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 100,
        kind: 'upper',
        compositionHtml: `
          <tr>
            <th>Political groups</th>
            <td>
              <ul>
                <li>
                  .mw-parser-output .legend{color:black}.mw-parser-output .legend-text{}
                  Example Party (100)
                </li>
              </ul>
            </td>
          </tr>
        `,
      }),
    );

    expect(extractPoliticalComposition(parsed)).toEqual([
      { party: 'Example Party', seats: 100 },
    ]);
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

  it('preserves exact article identities attached to aggregate groups', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 100,
        kind: 'lower',
        compositionHtml: `
          <tr>
            <th>Political groups</th>
            <td>
              <p>
                <b><a href="./Official_Opposition_(Example)">Opposition</a> (40)</b><br>
                <a href="./Example_Coalition">Coalition</a>
              </p>
              <ul>
                <li><a href="./Example_Liberal_Party">Liberal</a> (30)</li>
                <li><a href="./Example_National_Party">National</a> (10)</li>
              </ul>
            </td>
          </tr>
        `,
      }),
    );
    const entries = extractPoliticalComposition(parsed);

    expect(entries).toEqual([
      {
        party: 'Liberal',
        seats: 30,
        group: 'Opposition',
        groupArticleTitles: [
          'Official Opposition (Example)',
          'Example Coalition',
        ],
        articleTitle: 'Example Liberal Party',
      },
      {
        party: 'National',
        seats: 10,
        group: 'Opposition',
        groupArticleTitles: [
          'Official Opposition (Example)',
          'Example Coalition',
        ],
        articleTitle: 'Example National Party',
      },
    ]);
    expect(visualArticleTitles(entries)).toEqual([
      'Example Coalition',
      'Example Liberal Party',
      'Example National Party',
      'Official Opposition (Example)',
    ]);
  });

  it('requests entity colours even when a chamber entry has a swatch', () => {
    const parsed = parseInfobox(
      chamberHtml({
        seats: 100,
        kind: 'lower',
        compositionHtml: `
          <tr><th>Political groups</th><td><ul><li>
            <span class="legend-color" style="background-color:#123456"></span>
            <a href="./Example_Labour_Party">Labour Party</a> (100)
          </li></ul></td></tr>
        `,
      }),
    );
    const entries = extractPoliticalComposition(parsed);

    expect(entries[0].visual).toEqual({
      color: '#123456',
      method: 'wikipedia-entry',
    });
    expect(visualArticleTitles(entries)).toEqual(['Example Labour Party']);
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

  it('matches an exact chamber name even when Wikipedia type metadata conflicts', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'House of Representatives',
        kind: 'lower',
        totalSeats: 580,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'House of Representatives',
            title: 'House of Representatives',
            seats: 580,
            kind: 'unicameral',
            compositionHtml:
              '<tr><th>Political groups</th><td><ul><li>Party A (580)</li></ul></td></tr>',
          },
        ],
      }),
      current,
    );

    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');
    expect(normalized.missingChambers).toEqual([]);
    expect(merged.parliament.chambers).toHaveLength(1);
    expect(merged.parliament.chambers[0]).toMatchObject({
      id: 'EX-LC01',
      composition: { reportedSeats: 580 },
    });
  });

  it('does not replace an IPU-backed membership composition with Wikipedia', () => {
    const current = profile([
      {
        ...ipuChamber({
          id: 'EX-LC01',
          name: 'Assembly',
          kind: 'unicameral',
          totalSeats: 151,
        }),
        composition: {
          basis: 'source-reported',
          defaultViewId: 'membership',
          retrievedAt: '2026-09-20T00:00:00.000Z',
          views: [
            {
              id: 'membership',
              label: 'Membership composition',
              dimension: 'membership-role',
              reportedSeats: 151,
              entries: [
                {
                  partyId: 'ex-appointed-members',
                  party: 'Appointed members',
                  seats: 150,
                },
                {
                  partyId: 'ex-speaker',
                  party: 'Speaker',
                  seats: 1,
                },
              ],
              sourceIds: ['ipu-parline'],
            },
          ],
        },
      },
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Assembly',
            title: 'Assembly',
            seats: 151,
            kind: 'unicameral',
            compositionHtml:
              '<tr><th>Political groups</th><td><ul><li>Nonpartisan (150)</li></ul></td></tr>',
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-20');

    expect(normalized.chamberCompositions).toEqual([]);
    expect(merged.parliament.chambers[0].composition).toEqual(
      current.parliament.chambers[0].composition,
    );
  });

  it('completes a one-seat-short nonpartisan Wikipedia fallback with the IPU Speaker role', () => {
    const current = profile([
      {
        ...ipuChamber({
          id: 'EX-LC01',
          name: 'Assembly',
          kind: 'unicameral',
          totalSeats: 151,
        }),
        speakers: [
          {
            personId: 'ex-speaker',
            name: 'Example Speaker',
            acting: false,
            vacant: false,
            sourceIds: ['ipu-parline'],
          },
        ],
        electoralSystem: {
          directlyElected: false,
          systems: [],
          appointedSeats: 151,
          sourceIds: ['ipu-parline'],
        },
      },
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'Assembly',
            title: 'Assembly',
            seats: 151,
            kind: 'unicameral',
            compositionHtml:
              '<tr><th>Political groups</th><td><ul><li>Nonpartisan (150)</li></ul></td></tr>',
          },
        ],
      }),
      current,
    );

    expect(normalized.chamberCompositions).toEqual([
      {
        chamberId: 'EX-LC01',
        composition: {
          basis: 'source-reported',
          defaultViewId: 'membership',
          retrievedAt: '2026-09-19T00:00:00.000Z',
          views: [
            {
              id: 'membership',
              label: 'Membership composition',
              dimension: 'membership-role',
              reportedSeats: 151,
              entries: [
                {
                  partyId: 'wiki-2-ungrouped-nonpartisan-1',
                  party: 'Nonpartisan',
                  seats: 150,
                },
                {
                  partyId: 'ex-lc01-speaker',
                  party: 'Speaker',
                  seats: 1,
                },
              ],
              sourceIds: ['wikipedia-en-page-2', 'ipu-parline'],
            },
          ],
        },
      },
    ]);
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

  it('matches source aliases by statutory capacity only when the capacity is unambiguous and one-to-one', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'House of Representatives',
        kind: 'lower',
        totalSeats: 440,
      }),
      ipuChamber({
        id: 'EX-UC01',
        name: 'House of Nationalities',
        kind: 'upper',
        totalSeats: 224,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Pyithu Hluttaw', title: 'Pyithu Hluttaw', seats: 440 },
          { name: 'Amyotha Hluttaw', title: 'Amyotha Hluttaw', seats: 224 },
        ],
      }),
      current,
    );

    expect(normalized.missingChambers).toEqual([]);
  });

  it('matches Wikipedia chamber aliases from IPU local/full names', () => {
    const current = profile([
      ipuChamber({
        id: 'EX-LC01',
        name: 'House of the People',
        aliases: ['Lok Sabha'],
        kind: 'lower',
        totalSeats: 545,
      }),
      ipuChamber({
        id: 'EX-UC01',
        name: 'Council of States',
        aliases: ['Rajya Sabha'],
        kind: 'upper',
        totalSeats: 245,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          { name: 'Lok Sabha', title: 'Lok Sabha', seats: 543 },
          { name: 'Rajya Sabha', title: 'Rajya Sabha', seats: 245 },
        ],
      }),
      current,
    );

    expect(normalized.missingChambers).toEqual([]);
  });

  it('does not use an already-matched equal seat count to identify a second chamber', () => {
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

  it('publishes validated faction and party views while rejecting nested coalition aggregates', () => {
    const current = profile([
      ipuChamber({
        id: 'IR-LC01',
        name: 'Islamic Consultative Assembly',
        kind: 'unicameral',
        totalSeats: 290,
      }),
    ]);

    const normalized = normalizeWikipediaParliament(
      snapshot({
        iso3: 'IRN',
        parliamentTitle: 'Islamic Consultative Assembly',
        houses: [
          {
            name: 'Islamic Consultative Assembly',
            title: 'Islamic Consultative Assembly',
            seats: 290,
            kind: 'unicameral',
            compositionHtml: `
              <tr>
                <th>Political groups</th>
                <td>
                  <div class="collapsible-list">
                    <div><b>By faction</b></div>
                    <div><ul>
                      <li><a href="./Principlists">Principlists</a> (198)</li>
                      <li><a href="./Reformists">Reformists</a> (43)</li>
                      <li>Independents (44)</li>
                      <li>Vacant (5)</li>
                    </ul></div>
                  </div>
                  <div class="collapsible-list">
                    <div><b>By coalition</b></div>
                    <div><ul>
                      <li>Government (43)<ul><li>VNC (43)</li></ul></li>
                      <li>Confidence and supply (119)<ul>
                        <li>CCIRF (106)</li>
                        <li>CCA (13)</li>
                      </ul></li>
                      <li>Opposition (79)<ul><li>PAIRF (79)</li></ul></li>
                      <li>Independent (44)<ul><li>IND (44)</li></ul></li>
                      <li>Vacant (5)<ul><li>Vacant (5)</li></ul></li>
                    </ul></div>
                  </div>
                  <div class="collapsible-list">
                    <div><b>By party</b></div>
                    <div><ul>
                      <li><a href="./Example_party">Example party</a> (31)</li>
                      <li>Independents (254)</li>
                      <li>Vacant (5)</li>
                    </ul></div>
                  </div>
                </td>
              </tr>
            `,
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-20');
    const composition = merged.parliament.chambers[0].composition;

    expect(composition.defaultViewId).toBe('faction');
    expect(composition.views.map((view) => view.id)).toEqual([
      'faction',
      'party',
    ]);
    expect(composition.views.every((view) => view.reportedSeats === 290)).toBe(
      true,
    );
    expect(
      composition.views.every(
        (view) =>
          view.entries.reduce((sum, entry) => sum + entry.seats, 0) === 290,
      ),
    ).toBe(true);
    expect(normalized.diagnostics).toContain(
      'COMPOSITION_VIEW_NESTED_AGGREGATES:Islamic Consultative Assembly:coalition',
    );
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

  it('reuses one sourced colour for the same IPU party across chambers', () => {
    const lower = ipuChamber({
      id: 'EX-LC01',
      name: 'House',
      kind: 'lower',
      totalSeats: 100,
    });
    const upper = ipuChamber({
      id: 'EX-UC01',
      name: 'Senate',
      kind: 'upper',
      totalSeats: 50,
    });
    for (const chamber of [lower, upper]) {
      chamber.latestElection = {
        id: `${chamber.id}-E1`,
        date: { from: '2026-01-01' },
        scope: 'full-renewal',
        seatsAtStake: chamber.totalSeats,
        chamberSize: chamber.totalSeats,
        outcome: {
          display: 'post-election-full-composition',
          seatsWonInElection: [
            {
              partyId: 'exa-republican-party',
              party: 'Republican Party',
              seats: chamber.totalSeats,
            },
          ],
          postElectionComposition: [
            {
              partyId: 'exa-republican-party',
              party: 'Republican Party',
              seats: chamber.totalSeats,
            },
          ],
        },
        sourceIds: ['ipu-parline'],
      };
    }

    const current = profile([lower, upper]);
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'House',
            title: 'House',
            seats: 100,
            kind: 'lower',
            compositionHtml: `
              <tr><th>Political groups</th><td><ul>
                <li><a href="./Republican_Party_(Example)">Republican</a> (100)</li>
              </ul></td></tr>
            `,
          },
          {
            name: 'Senate',
            title: 'Senate',
            seats: 50,
            kind: 'upper',
            compositionHtml: `
              <tr><th>Political groups</th><td><ul>
                <li>
                  <span class="legend-color" style="background-color:#E81B23"></span>
                  <a href="./Republican_Party_(Example)">Republican</a> (50)
                </li>
              </ul></td></tr>
            `,
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');
    const colours = merged.parliament.chambers.map(
      (chamber) =>
        chamber.latestElection.outcome.postElectionComposition[0].visual,
    );

    expect(colours).toEqual([
      {
        color: '#E81B23',
        method: 'wikipedia-entry',
        sourceIds: ['wikipedia-en-page-3'],
      },
      {
        color: '#E81B23',
        method: 'wikipedia-entry',
        sourceIds: ['wikipedia-en-page-3'],
      },
    ]);
  });

  it('uses an exact Wikidata entity colour instead of chamber-local swatches', () => {
    const lower = ipuChamber({
      id: 'EX-LC01',
      name: 'House',
      kind: 'lower',
      totalSeats: 100,
    });
    const upper = ipuChamber({
      id: 'EX-UC01',
      name: 'Senate',
      kind: 'upper',
      totalSeats: 50,
    });
    for (const chamber of [lower, upper]) {
      chamber.latestElection = {
        id: `${chamber.id}-E1`,
        date: { from: '2026-01-01' },
        scope: 'full-renewal',
        seatsAtStake: chamber.totalSeats,
        chamberSize: chamber.totalSeats,
        outcome: {
          display: 'post-election-full-composition',
          seatsWonInElection: [
            {
              partyId: 'exa-labour-party',
              party: 'Labour Party',
              seats: chamber.totalSeats,
            },
          ],
          postElectionComposition: [
            {
              partyId: 'exa-labour-party',
              party: 'Labour Party',
              seats: chamber.totalSeats,
            },
          ],
        },
        sourceIds: ['ipu-parline'],
      };
    }
    const wikidataVisual = {
      color: '#E4003B',
      itemId: 'Q456',
      source: {
        id: 'wikidata-item-q456-p465',
        publisher: 'Wikidata',
        title: 'Wikidata item Q456: sRGB color hex triplet (P465)',
        url: 'https://www.wikidata.org/wiki/Q456',
        retrievedAt: '2026-09-19T00:00:00.000Z',
        kind: 'reference',
        attribution: 'Wikidata contributors',
        license: 'Creative Commons CC0 1.0 Universal',
      },
    };
    const compositionHtml = (color) => `
      <tr><th>Political groups</th><td><ul>
        <li>
          <span class="legend-color" style="background-color:${color}"></span>
          <a href="./Labour_Party_(Example)">Labour Party</a> (1)
        </li>
        <li>
          <span class="legend-color" style="background-color:#FF0000"></span>
          <a href="./Social_Democratic_and_Labour_Party_(Example)">Social Democratic and Labour Party</a> (1)
        </li>
      </ul></td></tr>
    `;

    const current = profile([lower, upper]);
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'House',
            title: 'House',
            seats: 100,
            kind: 'lower',
            compositionHtml: compositionHtml('#111111'),
            wikidataVisuals: {
              'Labour Party (Example)': wikidataVisual,
            },
          },
          {
            name: 'Senate',
            title: 'Senate',
            seats: 50,
            kind: 'upper',
            compositionHtml: compositionHtml('#222222'),
            wikidataVisuals: {
              'Labour Party (Example)': wikidataVisual,
            },
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');

    expect(
      merged.parliament.chambers.map(
        (chamber) =>
          chamber.latestElection.outcome.postElectionComposition[0].visual,
      ),
    ).toEqual([
      {
        color: '#E4003B',
        method: 'wikidata-p465',
        sourceIds: ['wikidata-item-q456-p465'],
      },
      {
        color: '#E4003B',
        method: 'wikidata-p465',
        sourceIds: ['wikidata-item-q456-p465'],
      },
    ]);
    expect(normalized.sources).toContainEqual(wikidataVisual.source);
  });

  it('uses an exact group sitelink colour for a safely identified coalition', () => {
    const lower = ipuChamber({
      id: 'EX-LC01',
      name: 'House',
      kind: 'lower',
      totalSeats: 100,
    });
    const upper = ipuChamber({
      id: 'EX-UC01',
      name: 'Senate',
      kind: 'upper',
      totalSeats: 50,
    });
    const coalitionResults = [
      {
        chamber: lower,
        partyId: 'exa-liberal-national-coalition',
        party: 'Liberal National coalition',
        seats: 40,
      },
      {
        chamber: upper,
        partyId: 'exa-note-coalition-opposition',
        party: 'Coalition (opposition)',
        seats: 20,
      },
    ];
    for (const { chamber, partyId, party, seats } of coalitionResults) {
      chamber.latestElection = {
        id: `${chamber.id}-E1`,
        date: { from: '2026-01-01' },
        scope: 'full-renewal',
        seatsAtStake: chamber.totalSeats,
        chamberSize: chamber.totalSeats,
        outcome: {
          display: 'post-election-full-composition',
          seatsWonInElection: [{ partyId, party, seats }],
          postElectionComposition: [{ partyId, party, seats }],
        },
        sourceIds: ['ipu-parline'],
      };
    }
    upper.latestElection.outcome.seatsWonInElection = [
      {
        partyId: 'exa-liberal-party',
        party: 'Liberal Party',
        seats: 10,
      },
    ];

    const groupComposition = `
      <tr><th>Political groups</th><td>
        <p>
          <b><a href="./Opposition_(Example)">Opposition</a> (40)</b><br>
          <a href="./Liberal–National_Coalition">Coalition</a>
        </p>
        <ul>
          <li>
            <span class="legend-color" style="background-color:#080CAB"></span>
            <a href="./Example_Liberal_Party">Liberal</a> (30)
          </li>
          <li><a href="./Example_National_Party">National</a> (10)</li>
        </ul>
      </td></tr>
    `;
    const coalitionWikidata = {
      color: '#00557C',
      itemId: 'Q123',
      source: {
        id: 'wikidata-item-q123-p465',
        publisher: 'Wikidata',
        title: 'Wikidata item Q123: sRGB color hex triplet (P465)',
        url: 'https://www.wikidata.org/wiki/Q123',
        retrievedAt: '2026-09-19T00:00:00.000Z',
        kind: 'reference',
        attribution: 'Wikidata contributors',
        license: 'Creative Commons CC0 1.0 Universal',
      },
    };
    const current = profile([lower, upper]);
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'House',
            title: 'House',
            seats: 100,
            kind: 'lower',
            compositionHtml: groupComposition,
            wikidataVisuals: {
              'Liberal–National Coalition': coalitionWikidata,
            },
          },
          {
            name: 'Senate',
            title: 'Senate',
            seats: 50,
            kind: 'upper',
            compositionHtml: groupComposition,
            wikidataVisuals: {
              'Liberal–National Coalition': coalitionWikidata,
            },
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');

    expect(
      merged.parliament.chambers.map(
        (chamber) =>
          chamber.latestElection.outcome.postElectionComposition[0].visual,
      ),
    ).toEqual([
      {
        color: '#00557C',
        method: 'wikidata-p465',
        sourceIds: ['wikidata-item-q123-p465'],
      },
      {
        color: '#00557C',
        method: 'wikidata-p465',
        sourceIds: ['wikidata-item-q123-p465'],
      },
    ]);
    expect(normalized.sources).toContainEqual(coalitionWikidata.source);
    expect(
      merged.parliament.chambers[1].latestElection.outcome.seatsWonInElection[0]
        .visual,
    ).toEqual({
      color: '#080CAB',
      method: 'wikipedia-entry',
      sourceIds: ['wikipedia-en-page-3'],
    });
  });

  it('does not treat generic independent labels as one cross-chamber entity', () => {
    const lower = ipuChamber({
      id: 'EX-LC01',
      name: 'House',
      kind: 'lower',
      totalSeats: 100,
    });
    const upper = ipuChamber({
      id: 'EX-UC01',
      name: 'Senate',
      kind: 'upper',
      totalSeats: 50,
    });
    for (const [index, chamber] of [lower, upper].entries()) {
      chamber.latestElection = {
        id: `${chamber.id}-E1`,
        date: { from: '2026-01-01' },
        scope: 'full-renewal',
        seatsAtStake: chamber.totalSeats,
        chamberSize: chamber.totalSeats,
        outcome: {
          display: 'post-election-full-composition',
          seatsWonInElection: [
            {
              partyId: `exa-independent-${index}`,
              party: 'Independent',
              seats: 1,
            },
          ],
          postElectionComposition: [
            {
              partyId: `exa-independent-${index}`,
              party: 'Independent',
              seats: 1,
            },
          ],
        },
        sourceIds: ['ipu-parline'],
      };
    }

    const current = profile([lower, upper]);
    const genericWikidata = {
      color: '#DDDDDD',
      itemId: 'Q327591',
      source: {
        id: 'wikidata-item-q327591-p465',
        publisher: 'Wikidata',
        title: 'Wikidata item Q327591: sRGB color hex triplet (P465)',
        url: 'https://www.wikidata.org/wiki/Q327591',
        retrievedAt: '2026-09-19T00:00:00.000Z',
        kind: 'reference',
        attribution: 'Wikidata contributors',
        license: 'Creative Commons CC0 1.0 Universal',
      },
    };
    const normalized = normalizeWikipediaParliament(
      snapshot({
        houses: [
          {
            name: 'House',
            title: 'House',
            seats: 100,
            kind: 'lower',
            compositionHtml: `
              <tr><th>Political groups</th><td><ul><li>
                <span class="legend-color" style="background-color:#888888"></span>
                <a href="./Independent_politician">Independent</a> (1)
              </li></ul></td></tr>
            `,
            wikidataVisuals: {
              'Independent politician': genericWikidata,
            },
          },
          {
            name: 'Senate',
            title: 'Senate',
            seats: 50,
            kind: 'upper',
            compositionHtml: `
              <tr><th>Political groups</th><td><ul>
                <li><a href="./Independent_politician">Independent</a> (1)</li>
              </ul></td></tr>
            `,
            wikidataVisuals: {
              'Independent politician': genericWikidata,
            },
          },
        ],
      }),
      current,
    );
    const merged = mergeWikipediaChambers(current, normalized, '2026-09-19');

    expect(
      merged.parliament.chambers[0].latestElection.outcome
        .postElectionComposition[0].visual?.color,
    ).toBe('#888888');
    expect(
      merged.parliament.chambers[1].latestElection.outcome
        .postElectionComposition[0].visual,
    ).toBeUndefined();
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
