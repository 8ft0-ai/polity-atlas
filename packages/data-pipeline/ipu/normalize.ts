import type {
  ElectionOutcome,
  SourceRecord,
  UpcomingElection,
} from '@/packages/schemas/country';

export const IPU_API_BASE_URL = 'https://api.data.ipu.org/v1';
export const IPU_SOURCE_ID = 'ipu-parline';
export const IPU_TERMS_URL = 'https://www.ipu.org/terms-use';

export type IpuElectionInput = {
  code: string;
  dateFrom: string;
  dateTo?: string;
  scope?: 'Full renewal' | 'Partial renewal';
  seatsAtStake?: number;
  seats?: Array<{ party: string; seats: number; fullComposition?: number }>;
  expectedNextDate?: string;
};

export function ipuAttribution(retrievedAt: string) {
  const date = new Date(retrievedAt);
  const monthYear = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return `Inter-Parliamentary Union: Parline, ${monthYear}`;
}

export function makeIpuSource(
  retrievedAt: string,
  countryCode?: string,
): SourceRecord {
  return {
    id: IPU_SOURCE_ID,
    publisher: 'Inter-Parliamentary Union',
    title: 'IPU Parline',
    url: countryCode
      ? `https://data.ipu.org/parliament/${countryCode}/`
      : 'https://data.ipu.org/',
    retrievedAt,
    kind: 'intergovernmental',
    attribution: ipuAttribution(retrievedAt),
    termsUrl: IPU_TERMS_URL,
  };
}

export function normalizeIpuElection(input: IpuElectionInput): ElectionOutcome {
  const resultSeats = input.seats?.map(({ party, seats }) => ({ party, seats }));
  const hasFullComposition = input.seats?.some(
    (row) => row.fullComposition !== undefined,
  );
  const postElectionComposition = hasFullComposition
    ? input.seats
        ?.filter((row) => row.fullComposition !== undefined)
        .map((row) => ({ party: row.party, seats: row.fullComposition! }))
    : input.scope === 'Full renewal'
      ? resultSeats
      : undefined;

  return {
    upstreamId: input.code,
    date: { from: input.dateFrom, ...(input.dateTo ? { to: input.dateTo } : {}) },
    scope:
      input.scope === 'Full renewal'
        ? 'full-renewal'
        : input.scope === 'Partial renewal'
          ? 'partial-renewal'
          : 'unknown',
    ...(input.seatsAtStake ? { seatsAtStake: input.seatsAtStake } : {}),
    ...(resultSeats ? { resultSeats } : {}),
    ...(postElectionComposition ? { postElectionComposition } : {}),
    ...(input.expectedNextDate
      ? { expectedNextDate: input.expectedNextDate }
      : {}),
    sourceIds: [IPU_SOURCE_ID],
  };
}

export function upcomingElectionFromOutcome(
  chamberId: string,
  chamberName: string,
  designationMode: string | undefined,
  outcome: ElectionOutcome,
): UpcomingElection | null {
  if (!outcome.expectedNextDate) return null;
  const eventType =
    outcome.scope === 'partial-renewal'
      ? 'partial-renewal'
      : designationMode === 'Indirectly elected'
        ? 'indirect-election'
        : 'chamber-election';

  return {
    id: `${chamberId}-next`,
    title: `${chamberName} next election or renewal`,
    level: 'national',
    chamberId,
    eventType,
    status: 'expected',
    dateLabel: outcome.expectedNextDate,
    note:
      'Expected date reported by IPU Parline; it may be based on law, practice, the chamber term or the timing of a partial renewal.',
    sourceIds: [IPU_SOURCE_ID],
  };
}

export function electionDisplay(outcome: ElectionOutcome) {
  if (outcome.postElectionComposition?.length) {
    return {
      kind: 'post-election-composition' as const,
      seats: outcome.postElectionComposition,
      total:
        outcome.postElectionTotalSeats ??
        outcome.postElectionComposition.reduce((sum, row) => sum + row.seats, 0),
    };
  }
  if (outcome.resultSeats?.length) {
    return {
      kind: 'contested-seats-only' as const,
      seats: outcome.resultSeats,
      total:
        outcome.seatsAtStake ??
        outcome.resultSeats.reduce((sum, row) => sum + row.seats, 0),
    };
  }
  return null;
}
