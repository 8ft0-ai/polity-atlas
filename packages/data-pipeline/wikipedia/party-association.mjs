import { isGeneric } from './party-acquisition.mjs';
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
  if (!Array.isArray(ids) || ids.length === 0) fail(context + ' has no sources');
  for (const id of ids) {
    if (!knownSources.has(id)) fail(context + ' unknown source: ' + id);
  }
}

export function validatePartyPublication(
  profile,
  partyDetails,
  mergedSources,
) {
  const knownSources = new Set(mergedSources.map((source) => source.id));
  const summaries = profile.parties ?? [];
  const byId = new Map();

  for (const party of summaries) {
    if (byId.has(party.entityId)) fail('Duplicate party summary: ' + party.entityId);
    if (party.entityId !== 'party:wikipedia:' + party.wikipedia.pageId) {
      fail('Party summary identity mismatch: ' + party.entityId);
    }
    byId.set(party.entityId, party);
    assertPartySources(party.sourceIds, knownSources, party.entityId);
    if (party.position) {
      assertPartySources(
        party.position.sourceIds,
        knownSources,
        party.entityId + ' position',
      );
    }
  }

  const detailsById = new Map();
  for (const detail of partyDetails) {
    if (detailsById.has(detail.entityId)) fail('Duplicate party detail: ' + detail.entityId);
    if (
      detail.entityId !==
      'party:wikipedia:' + detail.identity.wikipediaPageId
    ) {
      fail('Party detail identity mismatch: ' + detail.entityId);
    }
    if (!/^https:\/\/en\.wikipedia\.org\/wiki\/[^?#]+$/.test(detail.identity.wikipediaUrl)) {
      fail('Unsafe Wikipedia detail URL: ' + detail.entityId);
    }
    detailsById.set(detail.entityId, detail);
    assertPartySources(detail.sourceIds, knownSources, detail.entityId);
    for (const fact of detail.facts) {
      assertPartySources(
        fact.sourceIds,
        knownSources,
        detail.entityId + ' fact',
      );
    }
    if (detail.position) {
      assertPartySources(
        detail.position.sourceIds,
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
      if (isGeneric(entry.party)) fail('Generic entry was linked: ' + entry.party);
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

/**
 * Strictly join *already sourced* Wikipedia party-composition rows.
 * Election-only IPU names do not qualify for identity based on name similarity.
 * The returned profile is a REVIEW PREVIEW, not a public schema-version change.
 */
export function associatePreparedParties(profile, acquired, prepared, registry) {
  if (
    !profile?.identity?.iso3 ||
    profile.identity.iso3 !== acquired?.countryIso3 ||
    prepared?.countryIso3 !== acquired.countryIso3 ||
    prepared?.retrievedAt !== acquired.retrievedAt ||
    !Array.isArray(prepared?.summaries) ||
    !Array.isArray(prepared?.profiles) ||
    !Array.isArray(prepared?.sources) ||
    !Array.isArray(registry?.sources)
  ) {
    fail('Country identity or prepared snapshot does not match');
  }

  const bindings = exactCandidateBindings(acquired, prepared);
  const output = structuredClone(profile);
  const partyIdsByEntity = new Map();
  const provenanceByEntity = new Map();
  const diagnostics = [];

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
        if (
          entry.partyEntityId &&
          entry.partyEntityId !== result.entityId
        ) {
          fail('Existing party reference conflicts: ' + entry.partyId);
        }
        entry.partyEntityId = result.entityId;
        const ids = partyIdsByEntity.get(result.entityId) ?? new Set();
        ids.add(entry.partyId);
        partyIdsByEntity.set(result.entityId, ids);
        const sources = provenanceByEntity.get(result.entityId) ?? new Set();
        for (const id of sourceIds) {
          if (bindings.get(id + '\u0000' + exactLabel(entry.party))?.has(result.entityId)) {
            sources.add(id);
          }
        }
        provenanceByEntity.set(result.entityId, sources);
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
      sourceIds: [...new Set([
        'wikipedia-en-page-' + summary.wikipedia.pageId,
        ...provenanceByEntity.get(summary.entityId),
      ])].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.entityId.localeCompare(right.entityId));

  const details = prepared.profiles.filter((party) => active.has(party.entityId));
  const pageSourceIds = new Set(
    output.parties.map((summary) => 'wikipedia-en-page-' + summary.wikipedia.pageId),
  );
  const sources = prepared.sources.filter((source) => pageSourceIds.has(source.id));
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
