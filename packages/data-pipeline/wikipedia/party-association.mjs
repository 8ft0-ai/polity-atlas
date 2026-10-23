import { isGeneric } from './party-acquisition.mjs';
import { isNonPartyRepresentation } from './representation.mjs';
import { mergeSourceRecords } from '../sources/registry.mjs';

function exactLabel(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function fail(message) {
  throw new Error('PARTY_PUBLICATION_INVALID:' + message);
}

function exactCandidateBindings(acquired, prepared) {
  const knownEntityIds = new Set(
    prepared.summaries.map((summary) => summary.entityId),
  );
  if (acquired.candidates.length !== acquired.articles.length) {
    fail('Candidate and article counts differ');
  }

  const bindings = new Map();
  for (let index = 0; index < acquired.candidates.length; index += 1) {
    const candidate = acquired.candidates[index];
    const observation = acquired.articles[index];
    if (candidate.requestedTitle !== observation.requestedTitle) {
      fail('Candidate and article titles disagree');
    }
    const pageId = observation.page?.pageId;
    if (!Number.isSafeInteger(pageId) || pageId <= 0) continue;
    const entityId = 'party:wikipedia:' + pageId;
    if (!knownEntityIds.has(entityId)) continue;

    for (const sourceId of candidate.sourceIds) {
      for (const sourceLabel of candidate.sourceLabels) {
        if (isGeneric(sourceLabel) || !exactLabel(sourceLabel)) continue;
        const key = sourceId + '\u0000' + exactLabel(sourceLabel);
        const values = bindings.get(key) ?? new Set();
        values.add(entityId);
        bindings.set(key, values);
      }
    }
  }
  return bindings;
}

function compositionViews(chamber) {
  const composition = chamber.composition;
  if (!composition || composition.basis !== 'source-reported') return [];
  if ('views' in composition) {
    return composition.views
      .filter((view) => view.dimension === 'party')
      .map((view) => ({
        entries: view.entries,
        sourceIds: view.sourceIds,
      }));
  }
  return [
    {
      entries: composition.entries,
      sourceIds: composition.sourceIds,
    },
  ];
}

function linkedEntityForEntry(entry, sourceIds, binding) {
  if (isGeneric(entry.party)) return { kind: 'generic' };
  const entities = new Set();
  const label = exactLabel(entry.party);
  for (const sourceId of sourceIds) {
    for (const entityId of binding.get(sourceId + '\u0000' + label) ?? []) {
      entities.add(entityId);
    }
  }
  if (entities.size > 1) return { kind: 'ambiguous' };
  if (!entities.size) return { kind: 'unresolved' };
  return { kind: 'linked', entityId: [...entities][0] };
}

function referencedEntries(chamber) {
  return [
    ...(chamber.composition
      ? 'views' in chamber.composition
        ? chamber.composition.views.flatMap((view) => view.entries)
        : chamber.composition.entries
      : []),
    ...(chamber.latestElection?.outcome?.seatsWonInElection ?? []),
    ...(chamber.latestElection?.outcome?.postElectionComposition ?? []),
  ];
}

function assertPartySources(ids, knownSources, context) {
  if (!Array.isArray(ids) || ids.length === 0)
    fail(context + ' has no sources');
  for (const id of ids) {
    if (!knownSources.has(id)) fail(context + ' unknown source: ' + id);
  }
}

const POSITION_POINTS = [
  'far-left',
  'left',
  'centre-left',
  'centre',
  'centre-right',
  'right',
  'far-right',
];

function assertPosition(position, knownSources, context) {
  if (!position || !['scale', 'label'].includes(position.kind)) {
    fail(context + ' is malformed');
  }
  assertPartySources(position.sourceIds, knownSources, context);
  if (typeof position.raw !== 'string' || !position.raw.trim()) {
    fail(context + ' has no raw source value');
  }
  if (position.kind === 'label') {
    if (typeof position.label !== 'string' || !position.label.trim()) {
      fail(context + ' has no label');
    }
    return;
  }
  const from = POSITION_POINTS.indexOf(position.from);
  const to = POSITION_POINTS.indexOf(position.to);
  if (from < 0 || to < 0 || from > to) {
    fail(context + ' has an invalid or reversed scale range');
  }
}

export function validatePartyPublication(profile, partyDetails, mergedSources) {
  if (
    ![6, 2].includes(profile?.schemaVersion) ||
    !Array.isArray(profile?.parties) ||
    !Array.isArray(profile?.parliament?.chambers)
  ) {
    fail('Profile does not match the active public schema version');
  }
  const knownSources = new Set(mergedSources.map((source) => source.id));
  const summaries = profile.parties;
  const byId = new Map();

  for (const party of summaries) {
    if (byId.has(party.entityId))
      fail('Duplicate party summary: ' + party.entityId);
    if (
      !Number.isSafeInteger(party.wikipedia?.pageId) ||
      party.wikipedia.pageId <= 0 ||
      party.entityId !== 'party:wikipedia:' + party.wikipedia.pageId
    ) {
      fail('Party summary identity mismatch: ' + party.entityId);
    }
    if (!Array.isArray(party.sourcePartyIds) || !party.sourcePartyIds.length) {
      fail('Party summary has no source party IDs: ' + party.entityId);
    }
    if (
      typeof party.displayName !== 'string' ||
      !party.displayName.trim() ||
      typeof party.wikipedia.title !== 'string' ||
      !party.wikipedia.title.trim() ||
      party.sourcePartyIds.some(
        (sourcePartyId) =>
          typeof sourcePartyId !== 'string' || !sourcePartyId.trim(),
      )
    ) {
      fail('Party summary is malformed: ' + party.entityId);
    }
    byId.set(party.entityId, party);
    assertPartySources(party.sourceIds, knownSources, party.entityId);
    if (party.position) {
      assertPosition(
        party.position,
        knownSources,
        party.entityId + ' position',
      );
    }
  }

  const detailsById = new Map();
  for (const detail of partyDetails) {
    if (detailsById.has(detail.entityId))
      fail('Duplicate party detail: ' + detail.entityId);
    if (
      detail.schemaVersion !== 1 ||
      !Number.isSafeInteger(detail.identity?.wikipediaPageId) ||
      detail.identity.wikipediaPageId <= 0 ||
      detail.entityId !== 'party:wikipedia:' + detail.identity.wikipediaPageId
    ) {
      fail('Party detail identity mismatch: ' + detail.entityId);
    }
    if (
      typeof detail.identity.displayName !== 'string' ||
      !detail.identity.displayName.trim() ||
      typeof detail.identity.wikipediaTitle !== 'string' ||
      !detail.identity.wikipediaTitle.trim()
    ) {
      fail('Party detail identity is malformed: ' + detail.entityId);
    }
    if (
      !/^https:\/\/en\.wikipedia\.org\/wiki\/[^?#]+$/.test(
        detail.identity.wikipediaUrl,
      )
    ) {
      fail('Unsafe Wikipedia detail URL: ' + detail.entityId);
    }
    detailsById.set(detail.entityId, detail);
    assertPartySources(detail.sourceIds, knownSources, detail.entityId);
    if (!Array.isArray(detail.facts) || !detail.facts.length) {
      fail('Party detail has no verified facts: ' + detail.entityId);
    }
    for (const fact of detail.facts) {
      if (
        typeof fact.key !== 'string' ||
        !fact.key.trim() ||
        typeof fact.label !== 'string' ||
        !fact.label.trim() ||
        !Array.isArray(fact.values) ||
        !fact.values.length ||
        fact.values.some((value) => typeof value !== 'string' || !value.trim())
      ) {
        fail(detail.entityId + ' has a malformed fact');
      }
      assertPartySources(
        fact.sourceIds,
        knownSources,
        detail.entityId + ' fact',
      );
      for (const link of fact.links ?? []) {
        if (
          typeof link.label !== 'string' ||
          !link.label.trim() ||
          typeof link.url !== 'string'
        ) {
          fail(detail.entityId + ' fact has a malformed link');
        }
        let url;
        try {
          url = new URL(link.url);
        } catch {
          fail(detail.entityId + ' fact has an invalid link');
        }
        if (url.protocol !== 'https:') {
          fail(detail.entityId + ' fact has an unsafe link');
        }
      }
    }
    if (detail.position) {
      assertPosition(
        detail.position,
        knownSources,
        detail.entityId + ' position',
      );
    }
  }

  const partyIdOwners = new Map();
  for (const [entityId, summary] of byId) {
    const detail = detailsById.get(entityId);
    if (!detail) fail('Missing detail: ' + entityId);
    if (
      detail.identity.wikipediaPageId !== summary.wikipedia.pageId ||
      detail.identity.wikipediaTitle !== summary.wikipedia.title ||
      JSON.stringify(detail.position ?? null) !==
        JSON.stringify(summary.position ?? null)
    ) {
      fail('Summary and detail disagree: ' + entityId);
    }
    for (const sourcePartyId of summary.sourcePartyIds) {
      const prior = partyIdOwners.get(sourcePartyId);
      if (prior && prior !== entityId) {
        fail('Source party ID links to multiple entities: ' + sourcePartyId);
      }
      partyIdOwners.set(sourcePartyId, entityId);
    }
  }
  for (const entityId of detailsById.keys()) {
    if (!byId.has(entityId)) fail('Orphan party detail: ' + entityId);
  }

  for (const chamber of profile.parliament.chambers) {
    for (const entry of referencedEntries(chamber)) {
      if (!entry.partyEntityId) continue;
      if (isGeneric(entry.party)) {
        fail('Generic entry was linked: ' + entry.party);
      }
      if (
        entry.representationKind ||
        isNonPartyRepresentation(entry.party, profile.identity.iso3)
      ) {
        fail('Non-party representation was linked: ' + entry.party);
      }
      if (!byId.has(entry.partyEntityId)) {
        fail('Dangling party entry: ' + entry.partyEntityId);
      }
      if (partyIdOwners.get(entry.partyId) !== entry.partyEntityId) {
        fail('Party ID ownership mismatch: ' + entry.partyId);
      }
    }
  }
  return true;
}

export function validatePartyDataset(profiles, partyDetails, mergedSources) {
  if (!Array.isArray(profiles) || !Array.isArray(partyDetails)) {
    fail('Published party dataset must contain profile and detail arrays');
  }
  const detailsById = new Map();
  for (const detail of partyDetails) {
    if (detailsById.has(detail.entityId)) {
      fail('Duplicate party detail: ' + detail.entityId);
    }
    detailsById.set(detail.entityId, detail);
  }

  const referenced = new Set();
  const sourcePartyOwners = new Map();
  for (const profile of profiles) {
    const ids = new Set((profile.parties ?? []).map((party) => party.entityId));
    validatePartyPublication(
      profile,
      partyDetails.filter((detail) => ids.has(detail.entityId)),
      mergedSources,
    );
    for (const summary of profile.parties) {
      referenced.add(summary.entityId);
      for (const sourcePartyId of summary.sourcePartyIds) {
        const prior = sourcePartyOwners.get(sourcePartyId);
        if (prior && prior !== summary.entityId) {
          fail('Source party ID links to multiple entities: ' + sourcePartyId);
        }
        sourcePartyOwners.set(sourcePartyId, summary.entityId);
      }
    }
  }
  for (const entityId of referenced) {
    if (!detailsById.has(entityId)) fail('Missing detail: ' + entityId);
  }
  for (const entityId of detailsById.keys()) {
    if (!referenced.has(entityId)) fail('Orphan party detail: ' + entityId);
  }
  return true;
}

/**
 * Strictly join *already sourced* Wikipedia party-composition rows.
 * Election-only IPU names do not qualify for identity based on name similarity.
 * The returned profile is a REVIEW PREVIEW, not a public schema-version change.
 */
export function associatePreparedParties(
  profile,
  acquired,
  prepared,
  registry,
  partyIdentityEvidence = [],
  discovery,
) {
  if (
    !profile?.identity?.iso3 ||
    profile.identity.iso3 !== acquired?.countryIso3 ||
    prepared?.countryIso3 !== acquired.countryIso3 ||
    prepared?.retrievedAt !== acquired.retrievedAt ||
    !Array.isArray(prepared?.summaries) ||
    !Array.isArray(prepared?.profiles) ||
    !Array.isArray(prepared?.sources) ||
    !Array.isArray(registry?.sources) ||
    !Array.isArray(partyIdentityEvidence)
  ) {
    fail('Country identity or prepared snapshot does not match');
  }

  const bindings = exactCandidateBindings(acquired, prepared);
  const output = structuredClone(profile);
  const partyIdsByEntity = new Map();
  const provenanceByEntity = new Map();
  const diagnostics = [];

  function linkEntry(entry, entityId, sourceIds) {
    if (entry.representationKind || isNonPartyRepresentation(entry.party, output.identity.iso3)) {
      fail('Non-party representation cannot inherit a party identity: ' + entry.partyId);
    }
    if (entry.partyEntityId && entry.partyEntityId !== entityId) {
      fail('Existing party reference conflicts: ' + entry.partyId);
    }
    entry.partyEntityId = entityId;
    const ids = partyIdsByEntity.get(entityId) ?? new Set();
    ids.add(entry.partyId);
    partyIdsByEntity.set(entityId, ids);
    const sources = provenanceByEntity.get(entityId) ?? new Set();
    for (const id of sourceIds) sources.add(id);
    provenanceByEntity.set(entityId, sources);
  }

  for (const chamber of output.parliament.chambers) {
    for (const view of compositionViews(chamber)) {
      const sourceIds = view.sourceIds.filter((id) =>
        /^wikipedia-en-page-\d+$/.test(id),
      );
      if (!sourceIds.length) continue;
      for (const entry of view.entries) {
        const result = linkedEntityForEntry(entry, sourceIds, bindings);
        if (result.kind === 'ambiguous') {
          diagnostics.push('PARTY_IDENTITY_AMBIGUOUS:' + entry.partyId);
          continue;
        }
        if (result.kind !== 'linked') continue;
        linkEntry(
          entry,
          result.entityId,
          sourceIds.filter((id) =>
            bindings
              .get(id + '\u0000' + exactLabel(entry.party))
              ?.has(result.entityId),
          ),
        );
      }
    }
  }

  // IPU rows may reuse a party identity only when its already-matched
  // Wikipedia chamber supplied one *exact* party article link. Avoid using
  // political colour, coalition group membership or similarity-only names.
  const ipuChoices = new Map();
  for (const observation of partyIdentityEvidence) {
    if (
      !observation ||
      typeof observation.chamberId !== 'string' ||
      typeof observation.partyId !== 'string' ||
      typeof observation.party !== 'string' ||
      typeof observation.articleTitle !== 'string' ||
      !Number.isSafeInteger(observation.sourcePageId) ||
      observation.sourcePageId <= 0 ||
      isGeneric(observation.party)
    ) {
      continue;
    }
    const sourceId = 'wikipedia-en-page-' + observation.sourcePageId;
    const index = acquired.candidates.findIndex(
      (candidate) =>
        candidate.requestedTitle === observation.articleTitle &&
        candidate.sourceIds.includes(sourceId),
    );
    if (index < 0) continue;
    const pageId = acquired.articles[index]?.page?.pageId;
    const entityId = 'party:wikipedia:' + pageId;
    if (!prepared.summaries.some((summary) => summary.entityId === entityId)) {
      continue;
    }

    const chamber = output.parliament.chambers.find(
      (item) => item.id === observation.chamberId,
    );
    if (!chamber?.latestElection?.outcome) continue;
    const rows = [
      ...(chamber.latestElection.outcome.seatsWonInElection ?? []),
      ...(chamber.latestElection.outcome.postElectionComposition ?? []),
    ].filter(
      (entry) =>
        entry.partyId === observation.partyId &&
        entry.party === observation.party &&
        !isGeneric(entry.party),
    );
    if (!rows.length) continue;
    const key = observation.chamberId + '\u0000' + observation.partyId;
    const choice = ipuChoices.get(key) ?? {
      entities: new Set(),
      rows: [],
      sources: new Set(),
    };
    choice.entities.add(entityId);
    choice.rows.push(...rows);
    choice.sources.add(sourceId);
    ipuChoices.set(key, choice);
  }

  for (const [key, choice] of ipuChoices) {
    if (choice.entities.size !== 1) {
      diagnostics.push(
        'PARTY_IDENTITY_AMBIGUOUS:' + key.replace('\u0000', ':'),
      );
      continue;
    }
    const entityId = [...choice.entities][0];
    for (const entry of new Set(choice.rows)) {
      linkEntry(entry, entityId, [...choice.sources]);
    }
  }

  // Supplemental IPU identity is valid only when the observed article was
  // independently verified. Preserve the exact source ID and withhold any
  // identity already contradicted by the stronger chamber-link evidence.
  if (discovery) {
    for (const observation of discovery.observations) {
      if (observation.status !== 'verified') continue;
      const winner = observation.candidates.filter(
        (candidate) => candidate.verified && candidate.page,
      );
      if (winner.length !== 1) {
        fail('Discovery observation is not uniquely verified');
      }
      const entityId = 'party:wikipedia:' + winner[0].page.pageId;
      if (!prepared.summaries.some((party) => party.entityId === entityId)) {
        fail('Discovery identity has no verified party summary');
      }
      const chamber = output.parliament.chambers.find(
        (item) => item.id === observation.chamberId,
      );
      if (!chamber?.latestElection?.outcome) continue;
      const rows = [
        ...(chamber.latestElection.outcome.seatsWonInElection ?? []),
        ...(chamber.latestElection.outcome.postElectionComposition ?? []),
      ].filter(
        (entry) =>
          entry.partyId === observation.partyId &&
          entry.party === observation.party &&
          !isGeneric(entry.party),
      );
      for (const entry of rows) {
        if (entry.partyEntityId && entry.partyEntityId !== entityId) {
          diagnostics.push(
            'PARTY_DISCOVERY_CONFLICT:' +
              observation.chamberId +
              ':' +
              observation.partyId,
          );
          continue;
        }
        const proofSources = [
          'wikipedia-en-page-' + winner[0].page.pageId,
          ...(observation.reviewedSourceIds ?? []),
        ];
        linkEntry(entry, entityId, proofSources);
      }
    }
  }

  const active = new Set(partyIdsByEntity.keys());
  output.parties = prepared.summaries
    .filter((party) => active.has(party.entityId))
    .map((summary) => ({
      ...summary,
      sourcePartyIds: [...partyIdsByEntity.get(summary.entityId)].sort(
        (left, right) => left.localeCompare(right),
      ),
      sourceIds: [
        ...new Set([
          'wikipedia-en-page-' + summary.wikipedia.pageId,
          ...provenanceByEntity.get(summary.entityId),
        ]),
      ].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.entityId.localeCompare(right.entityId));

  const details = prepared.profiles.filter((party) =>
    active.has(party.entityId),
  );
  const pageSourceIds = new Set(
    output.parties.map(
      (summary) => 'wikipedia-en-page-' + summary.wikipedia.pageId,
    ),
  );
  const sources = prepared.sources.filter((source) =>
    pageSourceIds.has(source.id),
  );
  const mergedSources = mergeSourceRecords(registry.sources, sources);
  validatePartyPublication(output, details, mergedSources);

  return {
    countryIso3: output.identity.iso3,
    profile: output,
    partyDetails: details,
    additionalSources: sources,
    diagnostics: diagnostics.sort((a, b) => a.localeCompare(b)),
  };
}
