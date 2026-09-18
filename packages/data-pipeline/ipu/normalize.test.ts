import { describe, expect, it } from 'vitest';
import {
  electionDisplay,
  ipuAttribution,
  makeIpuSource,
  normalizeIpuElection,
  upcomingElectionFromOutcome,
} from './normalize';

describe('IPU Parline normalizer', () => {
  it('uses the IPU-required dataset attribution format', () => {
    expect(ipuAttribution('2026-09-18T00:00:00.000Z')).toBe(
      'Inter-Parliamentary Union: Parline, September 2026',
    );
    expect(makeIpuSource('2026-09-18T00:00:00.000Z', 'AU')).toMatchObject({
      id: 'ipu-parline',
      kind: 'intergovernmental',
      termsUrl: 'https://www.ipu.org/terms-use',
    });
  });

  it('keeps partial-renewal results separate from a supplied full chamber composition', () => {
    const outcome = normalizeIpuElection({
      code: 'US-UC01-E20241105',
      dateFrom: '2024-11-05',
      scope: 'Partial renewal',
      seatsAtStake: 34,
      expectedNextDate: '2026-11-03',
      seats: [
        { party: 'Republican Party', seats: 15, fullComposition: 53 },
        { party: 'Democratic Party', seats: 19, fullComposition: 47 },
      ],
    });
    expect(outcome.resultSeats).toEqual([
      { party: 'Republican Party', seats: 15 },
      { party: 'Democratic Party', seats: 19 },
    ]);
    expect(electionDisplay(outcome)).toEqual({
      kind: 'post-election-composition',
      seats: [
        { party: 'Republican Party', seats: 53 },
        { party: 'Democratic Party', seats: 47 },
      ],
      total: 100,
    });
  });

  it('never turns a partial result into a whole-chamber composition', () => {
    const outcome = normalizeIpuElection({
      code: 'EX-UC01-E20260101',
      dateFrom: '2026-01-01',
      scope: 'Partial renewal',
      seatsAtStake: 50,
      seats: [
        { party: 'Party A', seats: 30 },
        { party: 'Party B', seats: 20 },
      ],
    });
    expect(outcome.postElectionComposition).toBeUndefined();
    expect(electionDisplay(outcome)?.kind).toBe('contested-seats-only');
  });

  it('emits a chamber-scoped upcoming event without assuming local elections', () => {
    const outcome = normalizeIpuElection({
      code: 'AU-UC01-E20250503',
      dateFrom: '2025-05-03',
      scope: 'Partial renewal',
      seatsAtStake: 40,
      expectedNextDate: '2028-05-31',
    });
    expect(
      upcomingElectionFromOutcome('AU-UC01', 'Senate', 'Directly elected', outcome),
    ).toMatchObject({
      level: 'national',
      chamberId: 'AU-UC01',
      eventType: 'partial-renewal',
      dateLabel: '2028-05-31',
    });
  });
});
