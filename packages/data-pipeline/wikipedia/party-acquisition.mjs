import {
  extractPoliticalCompositionViews,
  parseInfobox,
} from './parse-infobox.mjs';
import { normalizeVerifiedPartyPage } from './party.mjs';

const GENERIC_NAMES = new Set([
  'ind',
  'independent',
  'independents',
  'independent politician',
  'non affiliated',
  'non partisan',
  'nonpartisan',
  'unaffiliated',
  'other',
  'others',
  'vacant',
  'vacancy',
  'vacancies',
  'crossbench',
  'crossbenchers',
  'speaker',
  'appointed members',
  'nom',
  'nominated',
  'nominated members',
  'government',
  'opposition',
]);

function normaliseName(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isGeneric(name) {
  return GENERIC_NAMES.has(normaliseName(name));
}

export function articleHasPartyEvidence(page) {
  if (typeof page?.html !== 'string') return false;
  const fields = new Set(
    parseInfobox(page.html).rows.map((row) => normaliseName(row.label)),
  );
  const politicalField = [
    'ideology',
    'political position',
    'position',
    'international affiliation',
    'national affiliation',
  ].some((field) => fields.has(field));
  const organisationalFields = [
    'leader',
    'party leader',
    'president',
    'chairperson',
    'founded',
    'formation',
    'headquarters',
  ].filter((field) => fields.has(field));
  // Political position is optional. Two independent organisational fields
  // can confirm an exact party article even when position is absent.
  return organisationalFields.length >= 1 &&
    (politicalField || organisationalFields.length >= 2);
}

/**
 * Only source-linked parties from the party dimension are eligible.
 * A Wikipedia search hit or a matching display name is not proof of identity.
 */
export function linkedPartyCandidates(snapshot) {
  if (!/^[A-Z]{3}$/.test(snapshot?.requestedCountry?.iso3 ?? '')) {
    throw new Error('Linked party acquisition needs a source ISO3 identity');
  }
  const pages = [
    snapshot.parliamentPage,
    ...(snapshot.chamberPages ?? []),
  ].filter(Boolean);
  const candidates = new Map();
  for (const page of pages) {
    if (!Number.isSafeInteger(page.pageId) || page.pageId <= 0) {
      throw new Error(
        'Source chamber page identity must be a positive page ID',
      );
    }
    const views = extractPoliticalCompositionViews(parseInfobox(page.html));
    for (const view of views ?? []) {
      // Nested seat aggregates describe group totals, but the parser emits
      // only leaf entries. Retain exact links on the individual parties.
      if (view.dimension !== 'party') {
        continue;
      }
      for (const entry of view.entries) {
        const title = entry.articleTitle;
        if (
          !title ||
          isGeneric(entry.party) ||
          isGeneric(title) ||
          !normaliseName(entry.party)
        ) {
          continue;
        }
        const current = candidates.get(title) ?? {
          requestedTitle: title,
          sourceLabels: [],
          sourceIds: [],
        };
        if (!current.sourceLabels.includes(entry.party)) {
          current.sourceLabels.push(entry.party);
        }
        const sourceId = 'wikipedia-en-page-' + page.pageId;
        if (!current.sourceIds.includes(sourceId)) {
          current.sourceIds.push(sourceId);
        }
        candidates.set(title, current);
      }
    }
  }
  return [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      sourceLabels: candidate.sourceLabels.sort((a, b) => a.localeCompare(b)),
      sourceIds: candidate.sourceIds.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.requestedTitle.localeCompare(b.requestedTitle));
}

/**
 * Acquire only exact linked articles. Cache is a complete raw observation
 * including 404s and source identity; it never contains guessed matches.
 */
export async function acquireLinkedPartySnapshot(
  snapshot,
  client,
  { maxCandidates = 100 } = {},
) {
  const candidates = linkedPartyCandidates(snapshot);
  if (candidates.length > maxCandidates) {
    throw new Error('PARTY_CANDIDATE_LIMIT_EXCEEDED');
  }
  const articles = [];
  for (const candidate of candidates) {
    const page = await client.fetchPageWithHtml(candidate.requestedTitle, {
      allowNotFound: true,
    });
    articles.push({
      requestedTitle: candidate.requestedTitle,
      page: page ?? null,
    });
  }
  return {
    schemaVersion: 1,
    countryIso3: snapshot.requestedCountry.iso3,
    retrievedAt: snapshot.retrievedAt,
    candidates,
    articles,
  };
}

/**
 * Cache replay is pure and fails closed on changed candidate sets, missing
 * observations or conflicting page identities. No client is needed.
 */
export function normalizeLinkedPartySnapshot(snapshot, acquired, discovery) {
  const expected = linkedPartyCandidates(snapshot);
  if (
    acquired?.schemaVersion !== 1 ||
    acquired.countryIso3 !== snapshot.requestedCountry.iso3 ||
    acquired.retrievedAt !== snapshot.retrievedAt ||
    JSON.stringify(acquired.candidates) !== JSON.stringify(expected) ||
    !Array.isArray(acquired.articles) ||
    acquired.articles.length !== expected.length
  ) {
    throw new Error('PARTY_CACHE_SNAPSHOT_MISMATCH');
  }

  const records = new Map();
  const diagnostics = [];
  for (let index = 0; index < expected.length; index += 1) {
    const candidate = expected[index];
    const article = acquired.articles[index];
    if (article?.requestedTitle !== candidate.requestedTitle) {
      throw new Error('PARTY_CACHE_ARTICLE_IDENTITY_MISMATCH');
    }
    const page = article.page;
    if (page === null) {
      diagnostics.push('PARTY_ARTICLE_NOT_FOUND:' + candidate.requestedTitle);
      continue;
    }
    if (!page || !articleHasPartyEvidence(page)) {
      diagnostics.push(
        'PARTY_ARTICLE_NOT_VERIFIED:' + candidate.requestedTitle,
      );
      continue;
    }
    const result = normalizeVerifiedPartyPage(page, acquired.retrievedAt);
    if (!result) {
      diagnostics.push(
        'PARTY_ARTICLE_NOT_VERIFIED:' + candidate.requestedTitle,
      );
      continue;
    }

    const existing = records.get(result.profile.entityId);
    if (existing) {
      if (JSON.stringify(existing.profile) !== JSON.stringify(result.profile)) {
        throw new Error('PARTY_PAGE_ID_CONFLICT:' + result.profile.entityId);
      }
      existing.summary.sourceIds = [
        ...new Set([...existing.summary.sourceIds, ...candidate.sourceIds]),
      ].sort((a, b) => a.localeCompare(b));
      continue;
    }
    result.summary.sourceIds = [
      ...new Set([...result.summary.sourceIds, ...candidate.sourceIds]),
    ].sort((a, b) => a.localeCompare(b));
    records.set(result.profile.entityId, result);
  }

  if (discovery) {
    for (const observation of discovery.observations) {
      if (observation.status !== 'verified') continue;
      const winner = observation.candidates.filter(
        (candidate) => candidate.verified && candidate.page,
      );
      if (winner.length !== 1) {
        throw new Error('PARTY_DISCOVERY_CACHE_MISMATCH');
      }
      const page = winner[0].page;
      if (!articleHasPartyEvidence(page)) {
        throw new Error('PARTY_DISCOVERY_CACHE_MISMATCH');
      }
      const result = normalizeVerifiedPartyPage(page, acquired.retrievedAt);
      if (!result) continue;
      const existing = records.get(result.profile.entityId);
      if (existing && JSON.stringify(existing.profile) !== JSON.stringify(result.profile)) {
        throw new Error('PARTY_PAGE_ID_CONFLICT:' + result.profile.entityId);
      }
      if (!existing) records.set(result.profile.entityId, result);
    }
  }

  const ordered = [...records.values()].sort((a, b) =>
    a.profile.entityId.localeCompare(b.profile.entityId),
  );
  return {
    schemaVersion: 1,
    countryIso3: acquired.countryIso3,
    retrievedAt: acquired.retrievedAt,
    summaries: ordered.map((record) => record.summary),
    profiles: ordered.map((record) => record.profile),
    sources: ordered.map((record) => record.source),
    diagnostics: diagnostics.sort((a, b) => a.localeCompare(b)),
  };
}
