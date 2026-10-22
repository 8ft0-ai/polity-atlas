import { describe, expect, it } from 'vitest';
import { normalizePoliticalPosition } from './party-position.mjs';
import { normalizeVerifiedPartyPage } from './party.mjs';
import {
  partyProfileSchema,
  partySummarySchema,
  politicalPositionSchema,
} from '../../schemas/party.ts';

const sourceIds = ['wikipedia-en-page-123'];
const retrievedAt = '2026-10-22T01:00:00.000Z';

function partyPage(rows, overrides = {}) {
  return {
    pageId: 123,
    title: 'Example Party',
    url: 'https://en.wikipedia.org/wiki/Example_Party',
    html: '<table class="infobox"><tbody>' + rows + '</tbody></table>',
    license: { title: 'CC BY-SA 4.0' },
    ...overrides,
  };
}

function row(label, value) {
  return '<tr><th>' + label + '</th><td>' + value + '</td></tr>';
}

describe('Phase 4A political position normalisation', () => {
  it.each([
    ['Far-left', 'far-left'],
    ['Left-wing', 'left'],
    ['Centre-left', 'centre-left'],
    ['Center-left', 'centre-left'],
    ['Centre', 'centre'],
    ['Center', 'centre'],
    ['Centre right', 'centre-right'],
    ['Right-wing', 'right'],
    ['Far right', 'far-right'],
  ])('maps explicit source position %s to %s', (raw, point) => {
    expect(normalizePoliticalPosition(raw, sourceIds)).toEqual({
      kind: 'scale',
      from: point,
      to: point,
      raw,
      sourceIds,
    });
  });

  it.each([
    ['Centre-left to centre', 'centre-left', 'centre'],
    ['Centre-right to right-wing', 'centre-right', 'right'],
    ['Left–centre-left', 'left', 'centre-left'],
    ['Centre—far-right', 'centre', 'far-right'],
  ])('keeps the explicit endpoints of %s', (raw, from, to) => {
    const position = normalizePoliticalPosition(raw, sourceIds);
    expect(position).toEqual({ kind: 'scale', from, to, raw, sourceIds });
    expect(() => politicalPositionSchema.parse(position)).not.toThrow();
  });

  it.each(['Big tent', 'Catch-all', 'Syncretic', 'left / centre-left'])(
    'preserves %s as a non-linear source label',
    (raw) => {
      expect(normalizePoliticalPosition(raw, sourceIds)).toEqual({
        kind: 'label',
        label: raw,
        raw,
        sourceIds,
      });
    },
  );

  it('does not silently reverse an invalid position range', () => {
    expect(
      normalizePoliticalPosition('Right to centre-left', sourceIds),
    ).toMatchObject({ kind: 'label', label: 'Right to centre-left' });
  });

  it('never emits a classification without provenance or source text', () => {
    expect(normalizePoliticalPosition('  ', sourceIds)).toBeUndefined();
    expect(normalizePoliticalPosition(undefined, sourceIds)).toBeUndefined();
    expect(() => normalizePoliticalPosition('Centre', [])).toThrow(
      'requires source IDs',
    );
  });
});

describe('Phase 4A verified Wikipedia infobox extraction', () => {
  it('emits sourced standalone summary/detail from exact page identity', () => {
    const result = normalizeVerifiedPartyPage(
      partyPage(
        row('Abbreviation', 'EP') +
          row('Leader', '<a href="./Jane_Doe">Jane Doe</a>') +
          row('Founded', '1991') +
          row('Ideology', 'Social democracy') +
          row('Political position', 'Centre-left to centre') +
          row('Website', '<a href="https://example.com">Official site</a>') +
          row('Unsupported row', 'not published'),
      ),
      retrievedAt,
    );

    expect(result).toBeDefined();
    expect(partyProfileSchema.parse(result.profile)).toEqual(result.profile);
    expect(partySummarySchema.parse(result.summary)).toEqual(result.summary);
    expect(result.profile.entityId).toBe('party:wikipedia:123');
    expect(result.summary.wikipedia).toEqual({
      pageId: 123,
      title: 'Example Party',
    });
    expect(result.profile.position).toMatchObject({
      kind: 'scale',
      from: 'centre-left',
      to: 'centre',
      sourceIds,
    });
    expect(result.profile.facts.map((fact) => fact.key)).toEqual([
      'abbreviation',
      'leader',
      'founded',
      'ideology',
      'political-position',
      'website',
    ]);
    expect(result.profile.facts[1].values).toEqual(['Jane Doe']);
    expect(JSON.stringify(result.profile)).not.toContain('href=');
    expect(JSON.stringify(result.profile)).not.toContain('Unsupported row');
    expect(result.source).toMatchObject({
      id: 'wikipedia-en-page-123',
      url: 'https://en.wikipedia.org/wiki/Example_Party',
      kind: 'reference',
      license: 'CC BY-SA 4.0',
    });
  });

  it('does not promote ideology or political colour into position', () => {
    const result = normalizeVerifiedPartyPage(
      partyPage(row('Ideology', 'Conservatism') + row('Colours', 'Blue')),
      retrievedAt,
    );
    expect(result.profile.position).toBeUndefined();
    expect(result.summary.position).toBeUndefined();
  });

  it('preserves a non-linear Wikipedia political-position value as text', () => {
    const result = normalizeVerifiedPartyPage(
      partyPage(row('Political position', 'Big tent')),
      retrievedAt,
    );
    expect(result.profile.position).toEqual({
      kind: 'label',
      label: 'Big tent',
      raw: 'Big tent',
      sourceIds,
    });
  });

  it('fails closed on conflicting position rows', () => {
    const result = normalizeVerifiedPartyPage(
      partyPage(
        row('Position', 'Centre-left') +
          row('Political position', 'Centre-right'),
      ),
      retrievedAt,
    );
    expect(result.profile.position).toBeUndefined();
    expect(
      result.profile.facts.find((fact) => fact.key === 'political-position')
        .values,
    ).toEqual(['Centre-left', 'Centre-right']);
  });

  it('deduplicates identical infobox field values', () => {
    const result = normalizeVerifiedPartyPage(
      partyPage(
        row('Political position', 'Left-wing') +
          row('Position', 'Left-wing'),
      ),
      retrievedAt,
    );
    expect(result.profile.position?.kind).toBe('scale');
    expect(
      result.profile.facts.find((fact) => fact.key === 'political-position')
        .values,
    ).toEqual(['Left-wing']);
  });

  it('does not publish an empty or unrelated infobox', () => {
    expect(
      normalizeVerifiedPartyPage(partyPage(row('Unrelated', '123')), retrievedAt),
    ).toBeUndefined();
  });

  it('maintains stable identity across a Wikipedia article rename', () => {
    const result = normalizeVerifiedPartyPage(
      partyPage(row('Founded', '2000'), {
        title: 'Renamed Party',
        url: 'https://en.wikipedia.org/wiki/Renamed_Party',
      }),
      retrievedAt,
    );
    expect(result.profile.entityId).toBe('party:wikipedia:123');
  });

  it('rejects invalid article identity and unsafe origins', () => {
    expect(() =>
      normalizeVerifiedPartyPage(
        partyPage(row('Founded', '2000'), { pageId: 0 }),
        retrievedAt,
      ),
    ).toThrow();
    expect(() =>
      normalizeVerifiedPartyPage(
        partyPage(row('Founded', '2000'), {
          url: 'https://other.example/wiki/Example_Party',
        }),
        retrievedAt,
      ),
    ).toThrow('English Wikipedia HTTPS URL');
  });
});
