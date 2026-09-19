import { describe, expect, it } from 'vitest';
import { mergeSourceRecords } from './registry.mjs';

const source = {
  id: 'example',
  publisher: 'Example',
  title: 'Example source',
  url: 'https://example.com/',
  retrievedAt: '2026-09-18T00:00:00.000Z',
  kind: 'official',
};

describe('global source registry', () => {
  it('deduplicates stable source identities and advances retrieval time', () => {
    const merged = mergeSourceRecords(
      [source],
      [
        {
          ...source,
          retrievedAt: '2026-09-19T00:00:00.000Z',
          attribution: 'Example, September 2026',
        },
      ],
    );
    expect(merged).toEqual([
      {
        ...source,
        retrievedAt: '2026-09-19T00:00:00.000Z',
        attribution: 'Example, September 2026',
      },
    ]);
  });

  it('rejects materially conflicting reuse of a source id', () => {
    expect(() =>
      mergeSourceRecords(
        [source],
        [{ ...source, title: 'Different source' }],
      ),
    ).toThrow('Conflicting source metadata for example');
  });
});
