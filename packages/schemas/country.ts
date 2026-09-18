import { z } from 'zod';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const factSchema = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    asOf: z.string().regex(isoDate),
    retrievedAt: z.iso.datetime(),
    sourceIds: z.array(z.string()).min(1),
    confidence: z.enum(['verified', 'reported', 'conflicting']).default('verified'),
    note: z.string().optional(),
  });

export const sourceSchema = z.object({
  id: z.string().min(1),
  publisher: z.string().min(1),
  title: z.string().min(1),
  url: z.url().refine((url) => new URL(url).protocol === 'https:', {
    message: 'Source URLs must use HTTPS',
  }),
  retrievedAt: z.iso.datetime(),
  kind: z.enum(['official', 'intergovernmental', 'reference', 'secondary']),
  attribution: z.string().optional(),
  termsUrl: z.url().optional(),
});

const officeHolderSchema = z.object({
  office: z.string().min(1),
  name: z.string().min(1),
  since: z.string().regex(isoDate),
  sourceIds: z.array(z.string()).min(1),
});

const seatResultSchema = z.object({
  party: z.string().min(1),
  shortName: z.string().min(1).optional(),
  seats: z.number().int().nonnegative(),
});

const speakerSchema = z.object({
  name: z.string().min(1).optional(),
  officialTitle: z.string().min(1),
  termStart: z.string().regex(isoDate).optional(),
  termEnd: z.string().regex(isoDate).optional(),
  acting: z.boolean().optional(),
  vacant: z.boolean().optional(),
  sourceIds: z.array(z.string()).min(1),
}).refine((speaker) => speaker.vacant || speaker.name, {
  message: 'A non-vacant presiding office must identify its holder',
});

const electoralSystemSchema = z.object({
  directlyElected: z.boolean(),
  system: z.string().min(1).optional(),
  subsystem: z.string().min(1).optional(),
  minimumVotingAge: z.number().int().nonnegative().optional(),
  minimumEligibilityAge: z.number().int().nonnegative().optional(),
  compulsoryVoting: z.enum(['yes', 'no', 'unknown']).optional(),
  sourceIds: z.array(z.string()).min(1),
});

const electionOutcomeSchema = z.object({
  upstreamId: z.string().min(1),
  date: z.object({
    from: z.string().regex(isoDate),
    to: z.string().regex(isoDate).optional(),
  }),
  scope: z.enum(['full-renewal', 'partial-renewal', 'unknown']),
  seatsAtStake: z.number().int().positive().optional(),
  resultSeats: z.array(seatResultSchema).optional(),
  postElectionComposition: z.array(seatResultSchema).optional(),
  postElectionTotalSeats: z.number().int().positive().optional(),
  expectedNextDate: z.string().regex(isoDate).optional(),
  sourceIds: z.array(z.string()).min(1),
}).superRefine((election, ctx) => {
  if (election.date.to && election.date.to < election.date.from) {
    ctx.addIssue({ code: 'custom', message: 'Election end date cannot precede start date' });
  }
  const resultTotal = election.resultSeats?.reduce((sum, row) => sum + row.seats, 0) ?? 0;
  if (election.seatsAtStake && resultTotal > election.seatsAtStake) {
    ctx.addIssue({ code: 'custom', message: 'Election-result seats cannot exceed seats at stake' });
  }
  const postTotal = election.postElectionComposition?.reduce((sum, row) => sum + row.seats, 0) ?? 0;
  if (election.postElectionTotalSeats && postTotal > election.postElectionTotalSeats) {
    ctx.addIssue({ code: 'custom', message: 'Post-election composition cannot exceed its reported total' });
  }
});

const chamberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['unicameral', 'lower', 'upper']),
  statutorySeats: z.number().int().positive(),
  termYears: z.number().positive().optional(),
  designationMode: z.string().min(1).optional(),
  speakers: z.array(speakerSchema).default([]),
  electoralSystem: electoralSystemSchema.optional(),
  latestElection: electionOutcomeSchema.optional(),
  sourceIds: z.array(z.string()).min(1),
});

const upcomingElectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: z.enum(['national', 'subnational', 'local', 'supranational']),
  chamberId: z.string().min(1).optional(),
  eventType: z.enum([
    'general-election',
    'chamber-election',
    'partial-renewal',
    'indirect-election',
    'appointment-renewal',
    'other',
  ]),
  status: z.enum(['confirmed', 'tentative', 'expected']),
  dateLabel: z.string().min(1),
  note: z.string().optional(),
  sourceIds: z.array(z.string()).min(1),
});

const relationSchema = z.object({
  country: z.string().min(1),
  m49: z.string().regex(/^\d{3}$/),
  status: z.enum([
    'resident-mission',
    'non-resident-accreditation',
    'relations-without-mission',
  ]),
  note: z.string().min(1),
  sourceIds: z.array(z.string()).min(1),
});

export const countryProfileSchema = z.object({
  schemaVersion: z.literal(2),
  buildId: z.string().min(1),
  identity: z.object({
    iso2: z.string().length(2),
    iso3: z.string().length(3),
    m49: z.string().regex(/^\d{3}$/),
    name: z.string().min(1),
    officialName: z.string().min(1),
    capital: z.string().min(1),
  }),
  government: z.object({
    system: factSchema(z.string().min(1)),
    headOfState: z.array(officeHolderSchema).min(1),
    headOfGovernment: z.array(officeHolderSchema).min(1),
  }),
  parliament: z.object({
    name: factSchema(z.string().min(1)),
    chambers: z.array(chamberSchema).min(1),
  }),
  elections: z.array(upcomingElectionSchema),
  relations: z.array(relationSchema),
  territories: z.array(z.object({
    name: z.string().min(1),
    status: z.string().min(1),
    sourceIds: z.array(z.string()).min(1),
  })).default([]),
  sources: z.array(sourceSchema).min(1),
});

export type CountryProfile = z.infer<typeof countryProfileSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export type Chamber = CountryProfile['parliament']['chambers'][number];
export type ElectionOutcome = NonNullable<Chamber['latestElection']>;
export type UpcomingElection = CountryProfile['elections'][number];
