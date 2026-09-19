import { describe, expect, it, vi } from 'vitest';
import {
  WikidataClient,
  canonicalColor,
  unambiguousClaimColor,
} from './client.mjs';

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe('Wikidata visual metadata', () => {
  it('normalizes P465 colours and rejects ambiguous active values', () => {
    expect(canonicalColor('f00011')).toBe('#F00011');
    expect(canonicalColor('#ABCDEF')).toBe('#ABCDEF');
    expect(canonicalColor('red')).toBeUndefined();

    expect(
      unambiguousClaimColor([
        {
          rank: 'normal',
          mainsnak: { datavalue: { value: 'F00011' } },
        },
      ]),
    ).toBe('#F00011');
    expect(
      unambiguousClaimColor([
        {
          rank: 'normal',
          mainsnak: { datavalue: { value: 'F00011' } },
        },
        {
          rank: 'normal',
          mainsnak: { datavalue: { value: '0044C9' } },
        },
      ]),
    ).toBeUndefined();
  });

  it('resolves exact English Wikipedia sitelinks without fuzzy party matching', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(String(url)).toContain('action=wbgetentities');
      expect(String(url)).toContain('sites=enwiki');
      expect(String(url)).toContain('titles=Australian+Labor+Party');
      return response(200, {
        entities: {
          Q216082: {
            id: 'Q216082',
            sitelinks: {
              enwiki: { title: 'Australian Labor Party' },
            },
            claims: {
              P465: [
                {
                  rank: 'normal',
                  mainsnak: { datavalue: { value: 'F00011' } },
                },
              ],
            },
          },
        },
      });
    });
    const client = new WikidataClient({ fetchImpl });

    const resolved = await client.colorsByWikipediaTitles(
      ['Australian Labor Party'],
      '2026-09-19T05:00:00.000Z',
    );

    expect(resolved.get('Australian Labor Party')).toEqual({
      color: '#F00011',
      itemId: 'Q216082',
      source: {
        id: 'wikidata-item-q216082-p465',
        publisher: 'Wikidata',
        title: 'Wikidata item Q216082: sRGB color hex triplet (P465)',
        url: 'https://www.wikidata.org/wiki/Q216082',
        retrievedAt: '2026-09-19T05:00:00.000Z',
        kind: 'reference',
        attribution: 'Wikidata contributors',
        license: 'Creative Commons CC0 1.0 Universal',
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
