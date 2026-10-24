import { describe, expect, it } from 'vitest';
import aus from '@/public/data/countries/AUS.json';
import fra from '@/public/data/countries/FRA.json';
import { countryProfileSchema } from '@/packages/schemas/country';
import { representationDetailFor } from './representation-details';

const australia = countryProfileSchema.parse(aus);
const france = countryProfileSchema.parse(fra);

describe('source-backed composite representation detail', () => {
  it('renders the exact Australian House coalition aggregate without inventing party seats', () => {
    const detail = representationDetailFor(
      australia,
      'AU-LC01',
      'au-liberal_national_coalition',
    );
    expect(detail).toMatchObject({
      chamberName: 'House of Representatives',
      kind: 'coalition',
      seats: 43,
      observation: { type: 'election' },
    });
    expect(detail?.members.map((member) => member.name)).toEqual([
      'Liberal Party of Australia',
      'The Nationals',
      'Liberal National Party of Queensland',
      'Country Liberal Party',
    ]);
    expect(detail?.membershipEvidence[0].url).toMatch(
      /^https:\/\/www.pbo.gov.au\//,
    );
    expect(detail?.members.every((member) => !('seats' in member))).toBe(true);
    expect(detail).not.toHaveProperty('position');
  });

  it('uses the same separately sourced membership for the Senate aggregate', () => {
    const detail = representationDetailFor(
      australia,
      'AU-UC01',
      'au-uc01-e20250503-note-coalition-opposition',
    );
    expect(detail?.kind).toBe('coalition');
    expect(detail?.seats).toBe(27);
    expect(detail?.members).toHaveLength(4);
  });

  it('exposes reviewed 2024 French alliance members and only links published party profiles', () => {
    const detail = representationDetailFor(
      france,
      'FR-LC01',
      'fr-new-popular-front-(nfp)-ug',
    );
    expect(detail?.seats).toBe(178);
    expect(detail?.kind).toBe('electoral-alliance');
    expect(detail?.members).toHaveLength(4);
    expect(detail?.members.filter((member) => member.partyEntityId)).toEqual([
      { name: 'Socialist Party', partyEntityId: 'party:wikipedia:39565408' },
    ]);
    expect(detail?.membershipEvidence).toHaveLength(1);
    expect(detail).not.toHaveProperty('position');
  });

  it('shows unresolved alliances and parliamentary groups without guessing members', () => {
    const alliance = representationDetailFor(
      france,
      'FR-LC01',
      'fr-ensemble_presidential_majority_',
    );
    expect(alliance?.seats).toBe(150);
    expect(alliance?.members).toEqual([]);
    expect(alliance?.membershipEvidence).toEqual([]);

    const group = representationDetailFor(
      france,
      'FR-UC01',
      'wiki-567323-ungrouped-lr-1',
    );
    expect(group?.kind).toBe('parliamentary-group');
    expect(group?.seats).toBe(124);
    expect(group?.members).toEqual([]);
    expect(group?.observation?.type).toBe('retrieved');
  });

  it('never creates a group detail for electoral categories, unknown parties or mismatched chambers', () => {
    expect(
      representationDetailFor(france, 'FR-LC01', 'fr-other_parties_right_dvd'),
    ).toBeUndefined();
    expect(
      representationDetailFor(
        australia,
        'AU-LC01',
        'au-australian_labor_party_alp',
      ),
    ).toBeUndefined();
    expect(
      representationDetailFor(france, 'FR-LC01', 'wiki-567323-ungrouped-lr-1'),
    ).toBeUndefined();
  });
});
