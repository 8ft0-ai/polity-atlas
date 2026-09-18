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
    chambers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(['lower', 'upper', 'unicameral']),
        totalSeats: z.number().int().positive(),
        compositionAsOf: z.iso.date(),
        composition: z.array(
          z.object({
            party: z.string(),
            shortName: z.string(),
            seats: z.number().int().nonnegative(),
            color: z.string(),
          }),
        ),
        sourceIds: z.array(z.string()).min(1),
      }),
    ),
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
