/**
 * Parliamentary seat rows do not necessarily represent political parties.
 * These conservative labels describe the source *row*, not the ideology or
 * legal identity of its constituent members. Unknown rows stay unclassified.
 */
const membershipLabels = new Set([
  'nom',
  'nominated',
  'nominated members',
  'appointed members',
  'ind',
  'independent',
  'independents',
  'independent politician',
  'non affiliated',
  'non partisan',
  'non partisans',
  'nonpartisan',
  'unaffiliated',
  'crossbench',
  'crossbenchers',
  'speaker',
  'vacant',
  'vacancy',
  'vacancies',
]);

const electoralCategoryLabels = new Set([
  'other',
  'others',
  'other div',
  'far right exd',
  'regionalist reg',
  'other parties of the right dvd',
  'other left wing parties dvg',
  'other parties of the centre',
]);

export function comparableRepresentation(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Do not classify a party merely because its name contains "National" or
 * "Liberal". In particular, the Liberal National Party of Queensland is not
 * the broader Liberal–National coalition.
 */
export function representationKind(label, countryIso3) {
  const value = comparableRepresentation(label);
  if (!value) return undefined;
  if (membershipLabels.has(value)) return 'membership-role';
  if (electoralCategoryLabels.has(value) || /^(other |others )/.test(value)) {
    return 'electoral-category';
  }
  if (
    countryIso3 === 'FRA' &&
    (/\bgroup\b/.test(value) || value === 'senate republicans france')
  )
    return 'parliamentary-group';
  if (/\b(coalition|coalition partners)\b/.test(value)) return 'coalition';
  if (
    /\b(electoral alliance|political alliance|electoral bloc)\b/.test(value)
  ) {
    return 'electoral-alliance';
  }
  if (countryIso3 === 'FRA') {
    if (
      /^new popular front\b/.test(value) ||
      /^ensemble presidential majority$/.test(value)
    ) {
      return 'electoral-alliance';
    }
    if (/^union of the far right$/.test(value)) {
      return 'electoral-category';
    }
  }
  return undefined;
}

export function isNonPartyRepresentation(label, countryIso3) {
  return representationKind(label, countryIso3) !== undefined;
}

/**
 * Explicitly annotate rows with group semantics, without changing seat
 * totals or attempting to resolve the constituent parties. For source rows
 * with established party identities we only preserve the link if the kind
 * remains eligible; contradictions fail closed.
 */
export function annotateRepresentationKinds(profile) {
  const result = structuredClone(profile);
  const countryIso3 = result.identity.iso3;
  for (const chamber of result.parliament.chambers) {
    const views = chamber.composition
      ? 'views' in chamber.composition
        ? chamber.composition.views
        : [chamber.composition]
      : [];
    const entries = [
      ...views.flatMap((view) => view.entries),
      ...(chamber.latestElection?.outcome?.seatsWonInElection ?? []),
      ...(chamber.latestElection?.outcome?.postElectionComposition ?? []),
    ];
    for (const entry of entries) {
      const kind = representationKind(entry.party, countryIso3);
      if (!kind) continue;
      if (entry.partyEntityId) {
        throw new Error(
          'PARTY_GROUP_IDENTITY_CONFLICT:' + chamber.id + ':' + entry.partyId,
        );
      }
      if (entry.representationKind && entry.representationKind !== kind) {
        throw new Error(
          'PARTY_GROUP_KIND_CONFLICT:' + chamber.id + ':' + entry.partyId,
        );
      }
      entry.representationKind = kind;
    }
  }
  return result;
}
