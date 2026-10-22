import { parseInfobox } from './parse-infobox.mjs';
import { normalizePoliticalPosition } from './party-position.mjs';

const FACT_FIELDS = new Map([
  ['abbreviation', ['abbreviation', 'Abbreviation']],
  ['leader', ['leader', 'Leader']],
  ['party leader', ['leader', 'Leader']],
  ['president', ['president', 'President']],
  ['chairperson', ['chairperson', 'Chairperson']],
  ['chairman', ['chairperson', 'Chairperson']],
  ['chairwoman', ['chairperson', 'Chairperson']],
  ['founded', ['founded', 'Founded']],
  ['formation', ['founded', 'Founded']],
  ['headquarters', ['headquarters', 'Headquarters']],
  ['ideology', ['ideology', 'Ideology']],
  ['political position', ['political-position', 'Political position']],
  ['position', ['political-position', 'Political position']],
  ['national affiliation', ['national-affiliation', 'National affiliation']],
  [
    'international affiliation',
    ['international-affiliation', 'International affiliation'],
  ],
  ['european affiliation', ['european-affiliation', 'European affiliation']],
  ['colours', ['colours', 'Colours']],
  ['colors', ['colours', 'Colours']],
  ['colour', ['colours', 'Colours']],
  ['color', ['colours', 'Colours']],
  ['website', ['website', 'Website']],
]);

function fieldName(label) {
  return label.toLowerCase().replace(/\s+/g, ' ').trim();
}

function validateVerifiedPage(page, retrievedAt) {
  if (
    !Number.isSafeInteger(page?.pageId) ||
    page.pageId <= 0 ||
    typeof page.title !== 'string' ||
    !page.title.trim() ||
    typeof page.html !== 'string'
  ) {
    throw new Error('Verified Wikipedia party page identity is incomplete');
  }
  const url = new URL(page.url);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'en.wikipedia.org' ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith('/wiki/')
  ) {
    throw new Error('Party article must use an English Wikipedia HTTPS URL');
  }
  if (
    typeof retrievedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(retrievedAt) ||
    !Number.isFinite(Date.parse(retrievedAt))
  ) {
    throw new Error('Party retrieval timestamp must be an ISO datetime');
  }
}

/**
 * Parse structured infobox rows only. This function is not an identity
 * resolver: callers must first establish the exact source article, and must
 * never use fuzzy name matching to treat its result as a verified party.
 */
export function normalizeVerifiedPartyPage(page, retrievedAt) {
  validateVerifiedPage(page, retrievedAt);

  const sourceId = 'wikipedia-en-page-' + page.pageId;
  const sourceIds = [sourceId];
  const parsed = parseInfobox(page.html);
  const facts = [];
  const byKey = new Map();

  for (const row of parsed.rows) {
    const field = FACT_FIELDS.get(fieldName(row.label));
    const value = row.text.replace(/\s+/g, ' ').trim();
    if (!field || !value) continue;

    const [key, label] = field;
    let fact = byKey.get(key);
    if (!fact) {
      fact = { key, label, values: [], sourceIds };
      byKey.set(key, fact);
      facts.push(fact);
    }
    if (!fact.values.includes(value)) fact.values.push(value);
  }

  if (!facts.length) return undefined;

  // Multiple contradictory position rows are not silently reconciled.
  // Preserve their raw values as infobox facts but withhold classification.
  const positions = byKey.get('political-position')?.values ?? [];
  const position =
    positions.length === 1
      ? normalizePoliticalPosition(positions[0], sourceIds)
      : undefined;
  const entityId = 'party:wikipedia:' + page.pageId;

  const profile = {
    schemaVersion: 1,
    entityId,
    identity: {
      displayName: page.title,
      wikipediaPageId: page.pageId,
      wikipediaTitle: page.title,
      wikipediaUrl: page.url,
    },
    ...(position && { position }),
    facts,
    sourceIds,
  };
  const summary = {
    entityId,
    displayName: page.title,
    sourcePartyIds: [],
    wikipedia: { pageId: page.pageId, title: page.title },
    ...(position && { position }),
    sourceIds,
  };
  const source = {
    id: sourceId,
    publisher: 'Wikipedia',
    title: page.title,
    url: page.url,
    retrievedAt,
    kind: 'reference',
    attribution: 'Wikipedia contributors, "' + page.title + '"',
    ...(page.license?.title && { license: page.license.title }),
  };

  return { summary, profile, source };
}
