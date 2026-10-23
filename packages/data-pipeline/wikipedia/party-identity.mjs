import { isGeneric, articleHasPartyEvidence } from './party-acquisition.mjs';
import { parseInfobox } from './parse-infobox.mjs';
import { isNonPartyRepresentation } from './representation.mjs';

const SEARCH_LIMIT = 5;
const SEARCH_ROWS_LIMIT = 24;

function comparable(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function identityName(value) {
  return String(value ?? '')
    .replace(/\s+\([A-Z][A-Z0-9.-]{1,8}\)\s*$/, '')
    .trim();
}

export function isPartyDiscoveryExcluded(name, countryIso3) {
  const value = comparable(name);
  return (
    !value ||
    isGeneric(name) ||
    isNonPartyRepresentation(name, countryIso3) ||
    /^(other |others |far right |far left |regionalist |ecologist |union of the far right$)/.test(
      value,
    ) ||
    /\b(coalition|alliance|electoral bloc|popular front|presidential majority)\b/.test(
      value,
    )
  );
}

export function ipuPartyRows(profile) {
  const rows = new Map();
  for (const chamber of profile.parliament.chambers) {
    const outcome = chamber.latestElection?.outcome;
    const entries = [
      ...(outcome?.seatsWonInElection ?? []),
      ...(outcome?.postElectionComposition ?? []),
    ];
    for (const entry of entries) {
      if (isPartyDiscoveryExcluded(entry.party, profile.identity.iso3))
        continue;
      const key = chamber.id + '\u0000' + entry.partyId;
      const prior = rows.get(key);
      if (prior && prior.party !== entry.party) {
        rows.set(key, { ...prior, conflicting: true });
        continue;
      }
      if (!prior) {
        rows.set(key, {
          chamberId: chamber.id,
          partyId: entry.partyId,
          party: entry.party,
        });
      }
    }
  }
  return [...rows.values()]
    .filter((row) => !row.conflicting)
    .sort(
      (a, b) =>
        a.chamberId.localeCompare(b.chamberId) ||
        a.partyId.localeCompare(b.partyId),
    );
}

function sourceCountryMatches(page, countryName) {
  const expected = comparable(countryName);
  const countryRows = parseInfobox(page.html).rows.filter((row) =>
    /^(country|state)$/.test(comparable(row.label)),
  );
  if (countryRows.length) {
    return countryRows.some((row) => comparable(row.text) === expected);
  }
  return comparable(page.title).endsWith(expected);
}

function titleMatchesParty(pageTitle, partyName, countryName) {
  const title = comparable(pageTitle);
  const party = comparable(identityName(partyName));
  const country = comparable(countryName);
  return title === party || title === party + ' ' + country;
}

/**
 * A Wikipedia search result is discovery only. Verified country context,
 * matching article identity and independent party-infobox evidence are
 * required before accepting the fetched article.
 */
export function verifyPartyDiscoveryPage(page, partyName, countryName) {
  return Boolean(
    page &&
    titleMatchesParty(page.title, partyName, countryName) &&
    sourceCountryMatches(page, countryName) &&
    articleHasPartyEvidence(page),
  );
}

function validateReviewedMappings(mappings, iso3) {
  if (!Array.isArray(mappings)) throw new Error('PARTY_ALIAS_REGISTRY_INVALID');
  const used = new Set();
  for (const entry of mappings) {
    if (
      !/^[A-Z]{3}$/.test(entry.countryIso3 ?? '') ||
      !entry.chamberId ||
      !entry.partyId ||
      !entry.partyName ||
      !entry.reason ||
      !entry.reviewer ||
      !entry.reviewDate ||
      !Array.isArray(entry.sourceIds) ||
      !entry.sourceIds.length ||
      Number(Boolean(entry.wikidataId)) +
        Number(Boolean(entry.wikipediaTitle)) !==
        1 ||
      (entry.wikidataId && !/^Q[1-9]\d*$/.test(entry.wikidataId))
    ) {
      throw new Error('PARTY_ALIAS_REGISTRY_INVALID');
    }
    const key = [entry.countryIso3, entry.chamberId, entry.partyId].join(
      '\u0000',
    );
    if (used.has(key)) throw new Error('PARTY_ALIAS_REGISTRY_DUPLICATE');
    used.add(key);
  }
  return mappings.filter((entry) => entry.countryIso3 === iso3);
}

/**
 * Resolve source-backed IPU identities not already reconciled by an exact
 * chamber link. Do not invent alias records: reviewed mappings are opt-in.
 *
 * Returned observations include every attempted page and a diagnostic for
 * each unresolved identity, so cache replay never reruns the search.
 */
export async function discoverPartyIdentities(
  snapshot,
  profile,
  client,
  wikidataClient,
  { mappings = [], maxRows = SEARCH_ROWS_LIMIT, offset = 0, knownEvidence = [] } = {},
) {
  const iso3 = snapshot.requestedCountry.iso3;
  if (iso3 !== profile.identity.iso3) {
    throw new Error('PARTY_IDENTITY_COUNTRY_MISMATCH');
  }
  const reviewed = validateReviewedMappings(mappings, iso3);
  // A verified exact chamber-linked article takes precedence over discovery.
  const alreadyLinked = new Set(
    knownEvidence.map(
      (entry) =>
        entry.chamberId + '\u0000' + entry.partyId + '\u0000' + entry.party,
    ),
  );
  const rows = ipuPartyRows(profile).filter(
    (entry) =>
      !alreadyLinked.has(
        entry.chamberId + '\u0000' + entry.partyId + '\u0000' + entry.party,
      ),
  );
  if (!Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > SEARCH_ROWS_LIMIT) {
    throw new Error('PARTY_DISCOVERY_BATCH_INVALID');
  }
  const diagnostics = [];
  const observations = [];
  if (offset + maxRows < rows.length) {
    diagnostics.push('PARTY_DISCOVERY_MORE_BATCHES:' + iso3 + ':' + (offset + maxRows));
  }
  const selected = rows.slice(offset, offset + maxRows);
  for (const row of selected) {
    const mapping = reviewed.find(
      (item) =>
        item.chamberId === row.chamberId &&
        item.partyId === row.partyId &&
        item.partyName === row.party,
    );
    let candidateTitles = [];
    let method = 'verified-search';
    let wikidataId;
    if (mapping?.wikidataId) {
      const sitelinks = await wikidataClient.enwikiSitelinksByIds([
        mapping.wikidataId,
      ]);
      const title = sitelinks.get(mapping.wikidataId);
      candidateTitles = title ? [title] : [];
      wikidataId = mapping.wikidataId;
      method = 'reviewed-wikidata-sitelink';
    } else if (mapping?.wikipediaTitle) {
      candidateTitles = [mapping.wikipediaTitle];
      method = 'reviewed-wikipedia-alias';
    } else {
      const search = await client.searchPages(
        identityName(row.party) + ' ' + snapshot.requestedCountry.name,
        SEARCH_LIMIT,
      );
      candidateTitles = [
        ...new Set(
          search
            .map((hit) => hit.title ?? hit.key)
            .filter(
              (title) =>
                title &&
                titleMatchesParty(
                  title,
                  row.party,
                  snapshot.requestedCountry.name,
                ),
            ),
        ),
      ].slice(0, SEARCH_LIMIT);
    }

    const candidates = [];
    for (const title of candidateTitles) {
      const page = await client.fetchPageWithHtml(title, {
        allowNotFound: true,
      });
      const verified = mapping
        ? Boolean(page && articleHasPartyEvidence(page))
        : verifyPartyDiscoveryPage(
            page,
            row.party,
            snapshot.requestedCountry.name,
          );
      candidates.push({
        requestedTitle: title,
        page: page ?? null,
        verified,
      });
    }
    const verified = candidates.filter((candidate) => candidate.verified);
    const status =
      verified.length === 1
        ? 'verified'
        : verified.length > 1
          ? 'ambiguous'
          : 'unresolved';
    if (status !== 'verified') {
      diagnostics.push(
        'PARTY_DISCOVERY_' +
          status.toUpperCase() +
          ':' +
          row.chamberId +
          ':' +
          row.partyId,
      );
    }
    observations.push({
      ...row,
      method,
      ...(wikidataId && { wikidataId }),
      ...(mapping && {
        reviewedSourceIds: mapping.sourceIds,
      }),
      candidates,
      status,
    });
  }
  return {
    schemaVersion: 1,
    countryIso3: iso3,
    countryName: snapshot.requestedCountry.name,
    retrievedAt: snapshot.retrievedAt,
    offset,
    totalRows: rows.length,
    observations,
    diagnostics: diagnostics.sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Complete deterministic coverage in bounded windows, preserving the row
 * order and one observation per eligible IPU party. Never silently truncate
 * the country at the first 24 parties.
 */
export async function discoverAllPartyIdentities(
  snapshot,
  profile,
  client,
  wikidataClient,
  options = {},
) {
  const batchSize = options.maxRows ?? SEARCH_ROWS_LIMIT;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 ||
      batchSize > SEARCH_ROWS_LIMIT) {
    throw new Error('PARTY_DISCOVERY_BATCH_INVALID');
  }
  const observations = [];
  const diagnostics = [];
  let totalRows;
  for (let offset = 0; totalRows === undefined || offset < totalRows; offset += batchSize) {
    const batch = await discoverPartyIdentities(
      snapshot, profile, client, wikidataClient,
      { ...options, maxRows: batchSize, offset },
    );
    if (totalRows !== undefined && totalRows !== batch.totalRows) {
      throw new Error('PARTY_DISCOVERY_BATCH_DRIFT');
    }
    totalRows = batch.totalRows;
    observations.push(...batch.observations);
    diagnostics.push(...batch.diagnostics.filter(
      (message) => !message.startsWith('PARTY_DISCOVERY_MORE_BATCHES:'),
    ));
  }
  return {
    schemaVersion: 1,
    countryIso3: snapshot.requestedCountry.iso3,
    countryName: snapshot.requestedCountry.name,
    retrievedAt: snapshot.retrievedAt,
    offset: 0,
    totalRows,
    observations,
    diagnostics: diagnostics.sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * No network or search on replay; all identity decisions are reproduced from
 * the observed pages and stable source-party identifiers.
 */
export function validatePartyDiscovery(snapshot, profile, discovery) {
  if (
    discovery?.schemaVersion !== 1 ||
    discovery.countryIso3 !== snapshot.requestedCountry.iso3 ||
    discovery.countryName !== snapshot.requestedCountry.name ||
    discovery.retrievedAt !== snapshot.retrievedAt ||
    discovery.countryIso3 !== profile.identity.iso3 ||
    !Array.isArray(discovery.observations) ||
    !Number.isSafeInteger(discovery.offset) ||
    discovery.offset < 0 ||
    !Number.isSafeInteger(discovery.totalRows) ||
    discovery.totalRows < 0
  ) {
    throw new Error('PARTY_DISCOVERY_CACHE_MISMATCH');
  }
  const rows = new Map(
    ipuPartyRows(profile).map((row) => [
      row.chamberId + '\u0000' + row.partyId,
      row.party,
    ]),
  );
  if (discovery.totalRows > rows.size ||
      discovery.observations.length > discovery.totalRows) {
    throw new Error('PARTY_DISCOVERY_CACHE_MISMATCH');
  }
  const seen = new Set();
  for (const item of discovery.observations) {
    const key = item.chamberId + '\u0000' + item.partyId;
    if (
      seen.has(key) ||
      rows.get(key) !== item.party ||
      !Array.isArray(item.candidates) ||
      ![
        'verified-search',
        'reviewed-wikipedia-alias',
        'reviewed-wikidata-sitelink',
      ].includes(item.method) ||
      !['verified', 'ambiguous', 'unresolved'].includes(item.status)
    ) {
      throw new Error('PARTY_DISCOVERY_CACHE_MISMATCH');
    }
    seen.add(key);
    const valid = item.candidates.filter((candidate) => {
      if (candidate.page === null) return false;
      if (!candidate.page || !candidate.verified) return false;
      if (
        item.method === 'verified-search' &&
        !verifyPartyDiscoveryPage(
          candidate.page,
          item.party,
          discovery.countryName,
        )
      )
        return false;
      return articleHasPartyEvidence(candidate.page);
    });
    const status =
      valid.length === 1
        ? 'verified'
        : valid.length > 1
          ? 'ambiguous'
          : 'unresolved';
    if (status !== item.status) {
      throw new Error('PARTY_DISCOVERY_CACHE_MISMATCH');
    }
  }
  return discovery;
}
