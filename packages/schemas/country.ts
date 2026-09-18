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
});

const partyCompositionSchema = z.object({
  party: z.string(),
  shortName: z.string(),
  seats: z.number().int().nonnegative(),
  color: z.string(),

  // Optional because most parties will not belong to a grouping.
  groupingIds: z.array(z.string()).optional(),
});

const parliamentaryGroupingSchema = z.object({
  id: z.string(),
  name: z.string(),

  kind: z.enum([
    'governing-coalition',
    'opposition-alliance',
    'parliamentary-alliance',
    'electoral-alliance',
    'parliamentary-group',
  ]),

  memberParties: z.array(z.string()).min(1),

  asOf: z.iso.date(),

  sourceIds: z.array(z.string()).min(1),
});

const chamberSchema = z
  .object({
    id: z.string(),
    name: z.string(),

    kind: z.enum(['lower', 'upper', 'unicameral']),

    totalSeats: z.number().int().positive(),

    compositionAsOf: z.iso.date(),

    composition: z.array(partyCompositionSchema),

    // Optional because many chambers will not need any grouping metadata.
    groupings: z.array(parliamentaryGroupingSchema).optional(),

    sourceIds: z.array(z.string()).min(1),
  })
  .superRefine((chamber, ctx) => {
    const groupings = chamber.groupings ?? [];

    const groupingIds = new Set<string>();

    //
    // Grouping IDs must be unique within the chamber.
    //
    groupings.forEach((grouping, groupingIndex) => {
      if (groupingIds.has(grouping.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate parliamentary grouping id: ${grouping.id}`,
          path: ['groupings', groupingIndex, 'id'],
        });
      }

      groupingIds.add(grouping.id);
    });

    const compositionPartyNames = new Set(
      chamber.composition.map((entry) => entry.party),
    );

    //
    // Every groupingId referenced by a party must exist.
    //
    chamber.composition.forEach((entry, compositionIndex) => {
      for (const groupingId of entry.groupingIds ?? []) {
        if (!groupingIds.has(groupingId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Unknown parliamentary grouping id: ${groupingId}`,
            path: ['composition', compositionIndex, 'groupingIds'],
          });
        }
      }
    });

    //
    // Every party named by a grouping must actually exist in the
    // chamber composition.
    //
    groupings.forEach((grouping, groupingIndex) => {
      grouping.memberParties.forEach((party, memberIndex) => {
        if (!compositionPartyNames.has(party)) {
          ctx.addIssue({
            code: 'custom',
            message: `Grouping "${grouping.name}" references party "${party}", which is not present in the chamber composition`,
            path: [
              'groupings',
              groupingIndex,
              'memberParties',
              memberIndex,
            ],
          });
        }
      });
    });

    //
    // Keep grouping membership consistent in both directions.
    //
    groupings.forEach((grouping, groupingIndex) => {
      for (const memberParty of grouping.memberParties) {
        const compositionEntry = chamber.composition.find(
          (entry) => entry.party === memberParty,
        );

        if (
          compositionEntry &&
          !compositionEntry.groupingIds?.includes(grouping.id)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: `Party "${memberParty}" is listed in grouping "${grouping.name}" but does not reference grouping id "${grouping.id}"`,
            path: ['groupings', groupingIndex, 'memberParties'],
          });
        }
      }
    });

    //
    // Party seats may total less than the chamber size because of
    // vacancies, appointed seats, unknown affiliation, etc.,
    // but they must never exceed the statutory chamber total.
    //
    const allocatedSeats = chamber.composition.reduce(
      (total, entry) => total + entry.seats,
      0,
    );

    if (allocatedSeats > chamber.totalSeats) {
      ctx.addIssue({
        code: 'custom',
        message: `Composition contains ${allocatedSeats} seats but chamber total is only ${chamber.totalSeats}`,
        path: ['composition'],
      });
    }
  });

export const countryProfileSchema = z.object({
  schemaVersion: z.literal(1),

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

  elections: z.array(
    z.object({
      title: z.string(),

      status: z.enum(['confirmed', 'tentative', 'expected']),

      dateLabel: z.string(),

      note: z.string(),

      sourceIds: z.array(z.string()).min(1),
    }),
  ),

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

  sources: z.array(sourceSchema),
});

export type CountryProfile = z.infer<typeof countryProfileSchema>;

export type SourceRecord = z.infer<typeof sourceSchema>;

export type ParliamentaryChamber = z.infer<typeof chamberSchema>;

export type ParliamentaryGrouping = z.infer<
  typeof parliamentaryGroupingSchema
>;

export type PartyComposition = z.infer<typeof partyCompositionSchema>;