import { z } from 'zod';
import reviewedMemberships from '@/src/data/representations/verified-memberships.json';
import {
  representationKindSchema,
  type CountryProfile,
  type LegislatureProfile,
} from '@/packages/schemas/country';

const memberSchema = z.object({
  name: z.string().min(1),
  partyEntityId: z.string().regex(/^party:wikipedia:[1-9]\\d*$/).optional(),
});

const membershipSchema = z.object({
  countryIso3: z.string().regex(/^[A-Z]{3}$/),
  chamberId: z.string().min(1),
  partyId: z.string().min(1),
  kind: representationKindSchema.refine(
    (kind) =>
      kind === 'coalition' ||
      kind === 'electoral-alliance' ||
      kind === 'parliamentary-group',
  ),
  members: z.array(memberSchema).min(1),
  evidence: z.array(z.object({
    title: z.string().min(1),
    url: z.url().startsWith('https://'),
  })).min(1),
  context: z.string().min(1),
});

const membershipsSchema = z.object({
  schemaVersion: z.literal(1),
  representations: z.array(membershipSchema),
}).superRefine((registry, ctx) => {
  const seen = new Set<string>();
  for (const [index, row] of registry.representations.entries()) {
    const key = [row.countryIso3, row.chamberId, row.partyId].join(':');
    if (seen.has(key)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate reviewed representation identity',
        path: ['representations', index],
      });
    }
    seen.add(key);
    if (new Set(row.members.map((member) => member.name)).size !== row.members.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate constituent name',
        path: ['representations', index, 'members'],
      });
    }
  }
});

const registry = membershipsSchema.parse(reviewedMemberships);

type BriefingProfile = CountryProfile | LegislatureProfile;
export type CompositeKind =
  | 'coalition'
  | 'electoral-alliance'
  | 'parliamentary-group';

export type RepresentationDetail = {
  chamberId: string;
  chamberName: string;
  name: string;
  partyId: string;
  kind: CompositeKind;
  seats: number;
  sourceIds: string[];
  observation: { value: string; type: 'election' | 'retrieved' } | null;
  members: Array<{ name: string; partyEntityId?: string }>;
  membershipEvidence: Array<{ title: string; url: string }>;
  membershipContext?: string;
};

/**
 * Derive a composite entity from its *reported* chamber entry. Review data
 * may supply only independently sourced constituent identities; it never
 * allocates the aggregate seat count or supplies a group-wide ideology.
 */
export function representationDetailFor(
  profile: BriefingProfile,
  chamberId: string,
  partyId: string,
): RepresentationDetail | undefined {
  const chamber = profile.parliament.chambers.find((item) => item.id === chamberId);
  if (!chamber) return undefined;
  const election = chamber.latestElection;
  const outcome = election?.outcome;
  const composition = chamber.composition;
  const compositionChoices = composition
    ? 'views' in composition
      ? composition.views.flatMap((view) =>
          view.entries.map((entry) => ({
            entry,
            sourceIds: view.sourceIds,
            observation: { value: composition.retrievedAt, type: 'retrieved' as const },
          })),
        )
      : composition.entries.map((entry) => ({
          entry,
          sourceIds: composition.sourceIds,
          observation: { value: composition.retrievedAt, type: 'retrieved' as const },
        }))
    : [];
  const choices = [
    ...(outcome?.postElectionComposition ?? []).map((entry) => ({
      entry,
      sourceIds: election?.sourceIds ?? [],
      observation: election ? { value: election.date.from, type: 'election' as const } : null,
    })),
    ...compositionChoices,
    ...(outcome?.seatsWonInElection ?? []).map((entry) => ({
      entry,
      sourceIds: election?.sourceIds ?? [],
      observation: election ? { value: election.date.from, type: 'election' as const } : null,
    })),
  ];
  const selected = choices.find((choice) => choice.entry.partyId === partyId);
  if (!selected) return undefined;
  const { entry, sourceIds, observation } = selected;
  if (
    entry.representationKind !== 'coalition' &&
    entry.representationKind !== 'electoral-alliance' &&
    entry.representationKind !== 'parliamentary-group'
  ) return undefined;
  if (entry.partyEntityId) return undefined;

  const reviewed = registry.representations.find(
    (item) =>
      item.countryIso3 === profile.identity.iso3 &&
      item.chamberId === chamberId &&
      item.partyId === partyId &&
      item.kind === entry.representationKind,
  );
  const availableParties = new Set(profile.parties.map((party) => party.entityId));
  return {
    chamberId,
    chamberName: chamber.name,
    name: entry.party,
    partyId,
    kind: entry.representationKind,
    seats: entry.seats,
    sourceIds,
    observation,
    members: (reviewed?.members ?? []).map((member) => ({
      name: member.name,
      ...(member.partyEntityId && availableParties.has(member.partyEntityId)
        ? { partyEntityId: member.partyEntityId }
        : {}),
    })),
    membershipEvidence: reviewed?.evidence ?? [],
    membershipContext: reviewed?.context,
  };
}
