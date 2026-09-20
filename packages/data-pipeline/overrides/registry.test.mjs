import { describe, expect, it } from 'vitest';
import {
  applyCuratedOverrides,
  hasCuratedOverrides,
  validateOverrideRegistry,
} from './registry.mjs';

const emptyRegistry = { schemaVersion: 1, overrides: [] };

function replacementOverride(overrides = {}) {
  return {
    id: 'synthetic-seat-correction',
    target: { iso3: 'TST', mode: 'full' },
    operation: 'replace',
    path: ['parliament', 'chambers', 0, 'totalSeats'],
    value: 101,
    sourceIds: ['synthetic-source'],
    reason: 'Synthetic test correction',
    author: 'test-author',
    reviewedBy: 'test-reviewer',
    reviewedAt: '2026-09-20',
    ...overrides,
  };
}

const profile = {
  parliament: {
    chambers: [{ name: 'Synthetic chamber', totalSeats: 100 }],
  },
};

describe('curated override registry', () => {
  it('is a byte-neutral no-op when the committed registry is empty', () => {
    expect(
      applyCuratedOverrides(profile, emptyRegistry, {
        iso3: 'TST',
        mode: 'full',
      }),
    ).toBe(profile);
  });

  it('applies an explicit reviewed replacement to an existing path', () => {
    const registry = {
      schemaVersion: 1,
      overrides: [replacementOverride()],
    };
    const output = applyCuratedOverrides(
      profile,
      registry,
      { iso3: 'TST', mode: 'full' },
      { knownSourceIds: new Set(['synthetic-source']) },
    );

    expect(output.parliament.chambers[0].totalSeats).toBe(101);
    expect(profile.parliament.chambers[0].totalSeats).toBe(100);
    expect(hasCuratedOverrides(registry, { iso3: 'TST', mode: 'full' })).toBe(
      true,
    );
  });

  it('fails closed for a missing target path', () => {
    const registry = {
      schemaVersion: 1,
      overrides: [
        replacementOverride({ path: ['parliament', 'missing', 'value'] }),
      ],
    };

    expect(() =>
      applyCuratedOverrides(profile, registry, {
        iso3: 'TST',
        mode: 'full',
      }),
    ).toThrow(/path that does not exist/);
  });

  it('fails closed for unknown provenance', () => {
    const registry = {
      schemaVersion: 1,
      overrides: [replacementOverride()],
    };

    expect(() =>
      applyCuratedOverrides(
        profile,
        registry,
        { iso3: 'TST', mode: 'full' },
        { knownSourceIds: new Set(['different-source']) },
      ),
    ).toThrow(/unknown source ID/);
  });

  it('rejects unsafe paths and incomplete review metadata', () => {
    expect(() =>
      validateOverrideRegistry({
        schemaVersion: 1,
        overrides: [replacementOverride({ path: ['__proto__', 'polluted'] })],
      }),
    ).toThrow(/unsafe path segment/);

    expect(() =>
      validateOverrideRegistry({
        schemaVersion: 1,
        overrides: [replacementOverride({ reviewedBy: '' })],
      }),
    ).toThrow(/reviewedBy/);
  });
});
