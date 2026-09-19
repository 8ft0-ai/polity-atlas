import { z } from 'zod';

export const factSchema = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    asOf: z.iso.date(),
    retrievedAt: z.iso.datetime(),
    sourceIds: z.array(z.string()).min(1),
    confidence: z.enum(['verified', 'probable', 'uncertain']),
    note: z.string().optional(),
  });

export const sourceSchema = z.object({
  id: z.string(),
  publisher: z.string(),
  title: z.string(),
  url: z
    .url()
    .refine((url) => url.startsWith('https://'), 'Sources must use HTTPS'),
  retrievedAt: z.iso.datetime(),
  kind: z.enum(['official', 'intergovernmental', 'reference', 'secondary']),
  attribution: z.string().optional(),
  termsUrl: z
    .url()
    .refine((url) => url.startsWith('https://'), 'Terms URLs must use HTTPS')
    .optional(),
  license: z.string().optional(),
});

const electionPartyResultSchema = z.object({
  partyId: z.string(),
  party: z.string(),
  seats: z.number().int().nonnegative(),
});

const chamberCompositionEntrySchema = electionPartyResultSchema.extend({
  group: z.string().optional(),
});

const chamberCompositionSchema = z
  .object({
    basis: z.literal('source-reported'),
    reportedSeats: z.number().int().nonnegative(),
    retrievedAt: z.iso.datetime(),
    entries: z.array(chamberCompositionEntrySchema).min(1),
    sourceIds: z.array(z.string()).min(1),
  })
  .superRefine((composition, ctx) => {
    const entrySeats = composition.entries.reduce(
      (sum, entry) => sum + entry.seats,
      0,
    );
    if (entrySeats !== composition.reportedSeats) {
      ctx.addIssue({
        code: 'custom',
        message: 'Composition entry seats must equal reportedSeats',
        path: ['reportedSeats'],
      });
    }
  });

const electionOutcomeSchema = z
  .object({
    display: z.enum(['post-election-full-composition', 'contested-seats-only']),
    seatsWonInElection: z.array(electionPartyResultSchema),
    postElectionComposition: z.array(electionPartyResultSchema).optional(),
  })
  .superRefine((outcome, ctx) => {
    if (
      outcome.display === 'post-election-full-composition' &&
      !outcome.postElectionComposition
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'A full-composition display requires post-election composition data',
        path: ['postElectionComposition'],
      });
    }

    if (
      outcome.display === 'contested-seats-only' &&
      outcome.postElectionComposition
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Contested-seat-only results must not claim a full composition',
        path: ['postElectionComposition'],
      });
    }
  });

const latestElectionSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    date: z.object({
      from: z.iso.date(),
      to: z.iso.date().optional(),
    }),
    scope: z.enum(['full-renewal', 'partial-renewal', 'unknown']),
    seatsAtStake: z.number().int().positive().optional(),
    chamberSize: z.number().int().positive(),
    outcome: electionOutcomeSchema.optional(),
    notes: z.array(z.string()).optional(),
    sourceIds: z.array(z.string()).min(1),
  })
  .superRefine((election, ctx) => {
    if (election.date.to && election.date.to < election.date.from) {
      ctx.addIssue({
        code: 'custom',
        message: 'Election end date must not precede its start date',
        path: ['date', 'to'],
      });
    }

    if (
      election.seatsAtStake !== undefined &&
      election.seatsAtStake > election.chamberSize
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Seats at stake must not exceed the chamber size',
        path: ['seatsAtStake'],
      });
    }

    if (election.outcome) {
      const seatsWon = election.outcome.seatsWonInElection.reduce(
        (sum, result) => sum + result.seats,
        0,
      );

      if (
        election.seatsAtStake !== undefined &&
        seatsWon > election.seatsAtStake
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Election results exceed the number of seats at stake',
          path: ['outcome', 'seatsWonInElection'],
        });
      }

      const fullComposition = election.outcome.postElectionComposition?.reduce(
        (sum, result) => sum + result.seats,
        0,
      );

      if (
        fullComposition !== undefined &&
        fullComposition > election.chamberSize
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Post-election composition exceeds the chamber size',
          path: ['outcome', 'postElectionComposition'],
        });
      }
    }
  });

const speakerSchema = z.object({
  personId: z.string().optional(),
  name: z.string().optional(),
  officialTitle: z.string().optional(),
  acting: z.boolean(),
  vacant: z.boolean(),
  term: z
    .object({
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
    .optional(),
  additionalInformation: z.string().optional(),
  designationMode: z.string().optional(),
  designationAuthority: z.string().optional(),
  stateRank: z.string().optional(),
  becomesInterimHeadOfState: z.boolean().optional(),
  mandateContinuesBetweenLegislatures: z.boolean().optional(),
  sourceIds: z.array(z.string()).min(1),
});

const electoralSystemSchema = z.object({
  directlyElected: z.boolean(),
  systems: z.array(z.string()),
  directlyElectedSeats: z.number().int().nonnegative().optional(),
  indirectlyElectedSeats: z.number().int().nonnegative().optional(),
  appointedSeats: z.number().int().nonnegative().optional(),
  votingAge: z.number().int().nonnegative().optional(),
  eligibilityAge: z.number().int().nonnegative().optional(),
  compulsoryVoting: z.string().optional(),
  sourceIds: z.array(z.string()).min(1),
});

const chamberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['lower', 'upper', 'unicameral']),
    totalSeats: z.number().int().positive(),
    parliamentaryTermYears: z.number().positive().optional(),
    renewalFrequencyYears: z.number().positive().optional(),
    speakers: z.array(speakerSchema),
    electoralSystem: electoralSystemSchema.optional(),
    latestElection: latestElectionSchema.optional(),
    composition: chamberCompositionSchema.optional(),
    sourceIds: z.array(z.string()).min(1),
  })
  .superRefine((chamber, ctx) => {
    if (
      chamber.composition &&
      chamber.composition.reportedSeats > chamber.totalSeats
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Source-reported composition exceeds chamber size',
        path: ['composition', 'reportedSeats'],
      });
    }
  });

const expectedElectionSchema = z
  .object({
    id: z.string(),
    level: z.literal('national'),
    chamberId: z.string(),
    chamberName: z.string(),
    eventType: z.enum([
      'full-renewal',
      'partial-renewal',
      'indirect-renewal',
      'appointment-renewal',
      'other',
    ]),
    status: z.literal('expected'),
    date: z.object({
      from: z.iso.date(),
      to: z.iso.date().optional(),
    }),
    sourceIds: z.array(z.string()).min(1),
  })
  .superRefine((election, ctx) => {
    if (election.date.to && election.date.to < election.date.from) {
      ctx.addIssue({
        code: 'custom',
        message: 'Expected election end date must not precede its start date',
        path: ['date', 'to'],
      });
    }
  });

export const sourceRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(sourceSchema),
  })
  .superRefine((registry, ctx) => {
    const seen = new Set<string>();
    registry.sources.forEach((source, index) => {
      if (seen.has(source.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate source id: ${source.id}`,
          path: ['sources', index, 'id'],
        });
      }
      seen.add(source.id);
    });
  });

export const countryProfileSchema = z.object({
  schemaVersion: z.literal(4),
  buildId: z.string(),
  identity: z.object({
    iso2: z.string().length(2),
    iso3: z.string().length(3),
    m49: z.string().length(3),
    name: z.string(),
    officialName: z.string(),
    capital: z.string(),
  }),
  government: z.object({
    system: factSchema(z.string()),
    headOfState: z.array(
      z.object({
        office: z.string(),
        name: z.string(),
        since: z.iso.date(),
        sourceIds: z.array(z.string()).min(1),
      }),
    ),
    headOfGovernment: z.array(
      z.object({
        office: z.string(),
        name: z.string(),
        since: z.iso.date(),
        sourceIds: z.array(z.string()).min(1),
      }),
    ),
  }),
  parliament: z.object({
    name: factSchema(z.string()),
    chambers: z.array(chamberSchema),
  }),
  nextExpectedElections: z.array(expectedElectionSchema),
  relations: z.array(
    z.object({
      country: z.string(),
      m49: z.string().length(3),
      status: z.enum([
        'resident-mission',
        'non-resident-accreditation',
        'relations-without-mission',
      ]),
      note: z.string(),
      sourceIds: z.array(z.string()).min(1),
    }),
  ),
  territories: z
    .array(
      z.object({
        entityId: z.string(),
        name: z.string(),
        relationship: z.enum([
          'dependency',
          'overseas-territory',
          'disputed-territory',
        ]),
        statusLabel: z.string(),
        sourceIds: z.array(z.string()).min(1),
      }),
    )
    .optional(),
});

export type CountryProfile = z.infer<typeof countryProfileSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;
export type ParliamentaryChamber = z.infer<typeof chamberSchema>;
export type ElectionPartyResult = z.infer<typeof electionPartyResultSchema>;
export type ChamberCompositionEntry = z.infer<
  typeof chamberCompositionEntrySchema
>;
