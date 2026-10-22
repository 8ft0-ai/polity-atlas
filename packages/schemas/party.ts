import { z } from 'zod';

const positionPoints = [
  'far-left',
  'left',
  'centre-left',
  'centre',
  'centre-right',
  'right',
  'far-right',
] as const;

const positionPointSchema = z.enum(positionPoints);
const sourceIdsSchema = z.array(z.string().min(1)).min(1);

export const politicalPositionSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('scale'),
      from: positionPointSchema,
      to: positionPointSchema,
      raw: z.string().min(1),
      sourceIds: sourceIdsSchema,
    }),
    z.object({
      kind: z.literal('label'),
      label: z.string().min(1),
      raw: z.string().min(1),
      sourceIds: sourceIdsSchema,
    }),
  ])
  .superRefine((position, ctx) => {
    if (
      position.kind === 'scale' &&
      positionPoints.indexOf(position.from) > positionPoints.indexOf(position.to)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Political position range must not be reversed',
        path: ['to'],
      });
    }
  });

const secureUrlSchema = z
  .url()
  .refine((url) => url.startsWith('https://'), 'Links must use HTTPS');

const wikipediaUrlSchema = secureUrlSchema.refine((value) => {
  const url = new URL(value);
  return (
    url.hostname === 'en.wikipedia.org' &&
    url.pathname.startsWith('/wiki/') &&
    !url.username &&
    !url.password &&
    !url.port
  );
}, 'Party article must be an English Wikipedia article');

export const partyFactSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
  links: z
    .array(z.object({ label: z.string().min(1), url: secureUrlSchema }))
    .optional(),
  sourceIds: sourceIdsSchema,
});

export const partySummarySchema = z
  .object({
    entityId: z.string().min(1),
    displayName: z.string().min(1),
    sourcePartyIds: z.array(z.string().min(1)),
    wikipedia: z.object({
      pageId: z.number().int().positive(),
      title: z.string().min(1),
    }),
    position: politicalPositionSchema.optional(),
    sourceIds: sourceIdsSchema,
  })
  .superRefine((party, ctx) => {
    if (party.entityId !== 'party:wikipedia:' + party.wikipedia.pageId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Party identity must match its Wikipedia page ID',
        path: ['entityId'],
      });
    }
  });

export const partyProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    entityId: z.string().min(1),
    identity: z.object({
      displayName: z.string().min(1),
      abbreviation: z.string().min(1).optional(),
      wikipediaPageId: z.number().int().positive(),
      wikipediaTitle: z.string().min(1),
      wikipediaUrl: wikipediaUrlSchema,
      wikidataId: z.string().regex(/^Q[1-9]\d*$/).optional(),
    }),
    position: politicalPositionSchema.optional(),
    facts: z.array(partyFactSchema),
    sourceIds: sourceIdsSchema,
  })
  .superRefine((party, ctx) => {
    if (party.entityId !== 'party:wikipedia:' + party.identity.wikipediaPageId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Party identity must match its Wikipedia page ID',
        path: ['entityId'],
      });
    }
  });

export type PoliticalPosition = z.infer<typeof politicalPositionSchema>;
export type PartyFact = z.infer<typeof partyFactSchema>;
export type PartySummary = z.infer<typeof partySummarySchema>;
export type PartyProfile = z.infer<typeof partyProfileSchema>;
