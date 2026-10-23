import { describe, expect, it } from 'vitest';
import {
  annotateRepresentationKinds,
  isNonPartyRepresentation,
  representationKind,
} from './representation.mjs';

function profile(iso3, entries) {
  return {
    schemaVersion: 6,
    identity: { iso3 },
    parliament: {
      chambers: [
        {
          id: iso3 + '-LC01',
          latestElection: {
            outcome: {
              postElectionComposition: structuredClone(entries),
              seatsWonInElection: structuredClone(entries),
            },
          },
        },
      ],
    },
    parties: [],
  };
}

describe('Phase 4 recovery PR2: non-party parliamentary representations', () => {
  it('distinguishes French electoral alliances and categories from parties', () => {
    const sample = [
      { partyId: 'nfp', party: 'New Popular Front (NFP)/UG', seats: 178 },
      {
        partyId: 'ensemble',
        party: 'Ensemble (presidential majority)',
        seats: 150,
      },
      { partyId: 'rn', party: 'National Rally (RN)', seats: 125 },
      { partyId: 'dvd', party: 'Other parties of the right (DVD)', seats: 27 },
      { partyId: 'dvg', party: 'Other left wing parties (DVG)', seats: 12 },
      {
        partyId: 'udi',
        party: 'Union of Democrats and Independents (UDI)',
        seats: 3,
      },
    ];
    const input = profile('FRA', sample);
    const output = annotateRepresentationKinds(input);
    const rows =
      output.parliament.chambers[0].latestElection.outcome
        .postElectionComposition;
    expect(rows.map((row) => row.representationKind)).toEqual([
      'electoral-alliance',
      'electoral-alliance',
      undefined,
      'electoral-category',
      'electoral-category',
      undefined,
    ]);
    expect(rows.map((row) => row.seats)).toEqual(
      sample.map((row) => row.seats),
    );
    expect(
      input.parliament.chambers[0].latestElection.outcome
        .postElectionComposition[0],
    ).not.toHaveProperty('representationKind');
  });

  it('distinguishes the Liberal National Party from a Liberal–National coalition', () => {
    expect(
      representationKind('Liberal National Party of Queensland', 'AUS'),
    ).toBeUndefined();
    expect(representationKind('Liberal National coalition', 'AUS')).toBe(
      'coalition',
    );
    expect(representationKind('Senate Republicans (France)', 'FRA')).toBe(
      'parliamentary-group',
    );
    expect(representationKind('Ecologist group (Senate)', 'FRA')).toBe(
      'parliamentary-group',
    );
    expect(representationKind('LNP', 'AUS')).toBeUndefined();
    expect(representationKind('The Greens', 'AUS')).toBeUndefined();
    expect(representationKind('Australian Greens', 'AUS')).toBeUndefined();
  });

  it('preserves nominated and independent memberships without classifying them as parties', () => {
    for (const label of [
      'NOM',
      'Nominated',
      'Nominated members',
      'Independents',
      'Vacant',
      'Speaker',
      'Appointed members',
    ]) {
      expect(isNonPartyRepresentation(label, 'IND')).toBe(true);
    }
    expect(isNonPartyRepresentation('National Party', 'AUS')).toBe(false);
  });

  it('retains total seats and groups when adding explicit metadata', () => {
    const input = profile('AUS', [
      { partyId: 'coalition', party: 'Liberal National coalition', seats: 43 },
      { partyId: 'greens', party: 'The Greens', seats: 1 },
      { partyId: 'nom', party: 'NOM', seats: 2 },
    ]);
    input.parliament.chambers[0].composition = {
      basis: 'source-reported',
      reportedSeats: 46,
      sourceIds: ['wikipedia-en-page-100'],
      entries: structuredClone(
        input.parliament.chambers[0].latestElection.outcome
          .postElectionComposition,
      ),
    };
    const result = annotateRepresentationKinds(input);
    const chamber = result.parliament.chambers[0];
    expect(chamber.composition.reportedSeats).toBe(46);
    expect(
      chamber.composition.entries.map((entry) => entry.representationKind),
    ).toEqual(['coalition', undefined, 'membership-role']);
    expect(
      chamber.latestElection.outcome.seatsWonInElection.map(
        (entry) => entry.representationKind,
      ),
    ).toEqual(['coalition', undefined, 'membership-role']);
  });

  it('fails closed if a coalition is already linked to a single-party identity', () => {
    const input = profile('AUS', [
      {
        partyId: 'coalition',
        party: 'Liberal National coalition',
        seats: 43,
        partyEntityId: 'party:wikipedia:21',
      },
    ]);
    expect(() => annotateRepresentationKinds(input)).toThrow(
      'PARTY_GROUP_IDENTITY_CONFLICT',
    );
  });

  it('rejects conflicting review metadata rather than silently reclassifying a row', () => {
    const input = profile('FRA', [
      {
        partyId: 'nfp',
        party: 'New Popular Front (NFP)/UG',
        seats: 178,
        representationKind: 'coalition',
      },
    ]);
    expect(() => annotateRepresentationKinds(input)).toThrow(
      'PARTY_GROUP_KIND_CONFLICT',
    );
  });

  it('does not expand one electoral alliance into presumed component parties', () => {
    const input = profile('FRA', [
      { partyId: 'nfp', party: 'New Popular Front (NFP)/UG', seats: 178 },
    ]);
    const result = annotateRepresentationKinds(input);
    expect(
      result.parliament.chambers[0].latestElection.outcome
        .postElectionComposition,
    ).toEqual([
      {
        partyId: 'nfp',
        party: 'New Popular Front (NFP)/UG',
        seats: 178,
        representationKind: 'electoral-alliance',
      },
    ]);
    expect(result.parties).toEqual([]);
  });
});
