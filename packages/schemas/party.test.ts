import { describe, expect, it } from 'vitest';
import {
  partyFactSchema,
  partyProfileSchema,
  partySummarySchema,
  politicalPositionSchema,
} from './party';

const sourceIds = ['wikipedia-en-page-123'];
const position = {
  kind: 'scale' as const,
  from: 'centre-left' as const,
  to: 'centre' as const,
  raw: 'Centre-left to centre',
  sourceIds,
};

const summary = {
  entityId: 'party:wikipedia:123',
  displayName: 'Example Party',
  sourcePartyIds: ['ipu-example'],
  wikipedia: { pageId: 123, title: 'Example Party' },
  position,
  sourceIds,
};

const profile = {
  schemaVersion: 1,
  entityId: 'party:wikipedia:123',
  identity: {
    displayName: 'Example Party',
    wikipediaPageId: 123,
    wikipediaTitle: 'Example Party',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Example_Party',
  },
  position,
  facts: [
    {
      key: 'founded',
      label: 'Founded',
      values: ['1991'],
      sourceIds,
    },
  ],
  sourceIds,
};

describe('Phase 4A party data schemas', () => {
  it('accepts a canonical point, forward range, or sourced non-linear label', () => {
    expect(politicalPositionSchema.parse(position)).toEqual(position);
    expect(
      politicalPositionSchema.parse({
        ...position,
        from: 'centre',
        to: 'centre',
      }),
    ).toBeDefined();
    expect(
      politicalPositionSchema.parse({
        kind: 'label',
        label: 'Big tent',
        raw: 'Big tent',
        sourceIds,
      }),
    ).toBeDefined();
  });

  it('rejects reversed ranges and invalid positions', () => {
    expect(() =>
      politicalPositionSchema.parse({
        ...position,
        from: 'right',
        to: 'left',
      }),
    ).toThrow('Political position range must not be reversed');
    expect(
      politicalPositionSchema.safeParse({ ...position, to: 'extreme-centre' })
        .success,
    ).toBe(false);
  });

  it('refuses position and fact data without provenance', () => {
    expect(
      politicalPositionSchema.safeParse({ ...position, sourceIds: [] }).success,
    ).toBe(false);
    expect(
      partyFactSchema.safeParse({
        key: 'leader',
        label: 'Leader',
        values: ['Jane Doe'],
        sourceIds: [],
      }).success,
    ).toBe(false);
  });

  it('accepts stable party summary and profile identities', () => {
    expect(partySummarySchema.parse(summary)).toEqual(summary);
    expect(partyProfileSchema.parse(profile)).toEqual(profile);
  });

  it('rejects dangling or inconsistent Wikipedia identity', () => {
    expect(
      partySummarySchema.safeParse({
        ...summary,
        entityId: 'party:wikipedia:456',
      }).success,
    ).toBe(false);
    expect(
      partyProfileSchema.safeParse({
        ...profile,
        identity: { ...profile.identity, wikipediaPageId: 456 },
      }).success,
    ).toBe(false);
    expect(
      partyProfileSchema.safeParse({
        ...profile,
        identity: {
          ...profile.identity,
          wikipediaUrl: 'http://en.wikipedia.org/wiki/Example_Party',
        },
      }).success,
    ).toBe(false);
    expect(
      partyProfileSchema.safeParse({
        ...profile,
        identity: {
          ...profile.identity,
          wikipediaUrl: 'https://attacker.example/wiki/Example_Party',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects hostile links and missing values', () => {
    expect(
      partyFactSchema.safeParse({
        key: 'leader',
        label: 'Leader',
        values: ['Jane Doe'],
        links: [{ label: 'Jane', url: 'javascript:alert(1)' }],
        sourceIds,
      }).success,
    ).toBe(false);
    expect(
      partyFactSchema.safeParse({
        key: 'leader',
        label: 'Leader',
        values: [],
        sourceIds,
      }).success,
    ).toBe(false);
  });
});
