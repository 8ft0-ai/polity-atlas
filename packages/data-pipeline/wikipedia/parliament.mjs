import {
  extractExplicitChamberKind,
  extractHouseLinks,
  extractPoliticalComposition,
  extractSeatCount,
  parseInfobox,
} from './parse-infobox.mjs';

function slug(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function comparableName(value) {
  return value
    .toLowerCase()
    .replace(
      /\b(the|parliament|national|federal|australian|canadian|british|french|indian|indonesian|japanese|new zealand|united states)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wikipediaSource(page, retrievedAt) {
  return {
    id: `wikipedia-en-page-${page.pageId}`,
    publisher: 'Wikipedia',
    title: page.title,
    url: page.url,
    retrievedAt,
    kind: 'reference',
    attribution: `Wikipedia contributors, "${page.title}"`,
    ...(page.license?.title && { license: page.license.title }),
  };
}

function compositionEntryId(pageId, party, index) {
  return `wiki-${pageId}-${slug(party) || index + 1}`;
}

function sourceReportedComposition(candidate, retrievedAt, chamberSize) {
  if (!candidate.compositionEntries?.length) return undefined;

  const entries = candidate.compositionEntries
    .map((entry, index) => ({
      partyId: compositionEntryId(candidate.pageId, entry.party, index),
      party: entry.party,
      seats: entry.seats,
      ...(entry.group && { group: entry.group }),
    }))
    .sort(
      (left, right) =>
        right.seats - left.seats || left.party.localeCompare(right.party),
    );
  const reportedSeats = entries.reduce((sum, entry) => sum + entry.seats, 0);
  if (reportedSeats > chamberSize) return undefined;

  return {
    basis: 'source-reported',
    reportedSeats,
    retrievedAt,
    entries,
    sourceIds: [candidate.source.id],
  };
}

function hasIpuFullComposition(chamber) {
  return Boolean(
    chamber.latestElection?.outcome?.postElectionComposition?.length,
  );
}

function isWikipediaFallbackComposition(composition) {
  return composition?.sourceIds?.some((sourceId) =>
    sourceId.startsWith('wikipedia-en-page-'),
  );
}

function isWikipediaFallbackChamber(chamber) {
  return (
    chamber.id?.startsWith('wiki-') &&
    chamber.sourceIds?.some((sourceId) =>
      sourceId.startsWith('wikipedia-en-page-'),
    )
  );
}

function candidateMatchesIpu(candidate, chamber) {
  const wikiName = comparableName(candidate.name);
  const ipuName = comparableName(chamber.name);
  const strongNameMatch =
    wikiName &&
    ipuName &&
    (wikiName === ipuName ||
      wikiName.includes(ipuName) ||
      ipuName.includes(wikiName));

  const kindsConflict =
    candidate.kind && chamber.kind && candidate.kind !== chamber.kind;
  if (strongNameMatch && !kindsConflict) return true;

  const compatibleKind =
    candidate.kind && chamber.kind && candidate.kind === chamber.kind;

  return (
    Boolean(compatibleKind) &&
    candidate.totalSeats !== undefined &&
    candidate.totalSeats === chamber.totalSeats
  );
}

function inferKinds(country, candidates, existingChambers) {
  const remainingKinds = new Set(['lower', 'upper']);
  for (const chamber of existingChambers) {
    remainingKinds.delete(chamber.kind);
  }

  const inferred = candidates.map((candidate) => ({ ...candidate }));
  for (const candidate of inferred) {
    if (candidate.kind) remainingKinds.delete(candidate.kind);
  }

  const unknown = inferred.filter((candidate) => !candidate.kind);
  if (!unknown.length) return inferred;

  if (
    existingChambers.length === 0 &&
    inferred.length === 1 &&
    unknown.length === 1
  ) {
    unknown[0].kind = 'unicameral';
    return inferred;
  }

  if (remainingKinds.size === unknown.length && unknown.length === 1) {
    unknown[0].kind = [...remainingKinds][0];
    return inferred;
  }

  if (
    unknown.length === 2 &&
    unknown.every((candidate) => candidate.totalSeats)
  ) {
    const bySeats = [...unknown].sort(
      (left, right) => left.totalSeats - right.totalSeats,
    );
    const smaller = bySeats[0];
    const larger = bySeats[1];

    // Fallback only when Wikipedia does not explicitly label the chambers and
    // no IPU chamber kind can disambiguate them. The normal bicameral heuristic
    // is the larger chamber as lower house; the United Kingdom is the explicit
    // exception because its upper house is larger.
    if (country.iso3 === 'GBR') {
      smaller.kind = 'lower';
      larger.kind = 'upper';
    } else {
      smaller.kind = 'upper';
      larger.kind = 'lower';
    }
  }

  return inferred;
}

export function normalizeWikipediaParliament(snapshot, profile) {
  if (!snapshot.parliamentPage) {
    return {
      missingChambers: [],
      chamberCompositions: [],
      sources: [],
      diagnostics: ['NO_WIKIPEDIA_PARLIAMENT_PAGE'],
    };
  }

  const parliamentParsed = parseInfobox(snapshot.parliamentPage.html);
  const houseLinks = extractHouseLinks(parliamentParsed);
  const parentSource = wikipediaSource(
    snapshot.parliamentPage,
    snapshot.retrievedAt,
  );

  const rawCandidates = snapshot.chamberPages.map((page) => {
    const parsed = parseInfobox(page.html);
    return {
      name:
        houseLinks.find((link) => link.title === page.requestedTitle)?.text ||
        page.title,
      requestedTitle: page.requestedTitle,
      pageId: page.pageId,
      totalSeats: extractSeatCount(parsed),
      kind: extractExplicitChamberKind(parsed),
      compositionEntries: extractPoliticalComposition(parsed),
      source: wikipediaSource(page, snapshot.retrievedAt),
    };
  });

  if (!rawCandidates.some((candidate) => candidate.totalSeats)) {
    const parentSeats = extractSeatCount(parliamentParsed);
    const parentKind = extractExplicitChamberKind(parliamentParsed);
    if (parentSeats && parentKind === 'unicameral') {
      rawCandidates.push({
        name: snapshot.parliamentPage.title,
        requestedTitle: snapshot.parliamentPage.title,
        pageId: snapshot.parliamentPage.pageId,
        totalSeats: parentSeats,
        kind: 'unicameral',
        compositionEntries: extractPoliticalComposition(parliamentParsed),
        source: parentSource,
      });
    }
  }

  const authoritativeChambers = profile.parliament.chambers.filter(
    (chamber) => !isWikipediaFallbackChamber(chamber),
  );
  const matchedCandidates = rawCandidates
    .map((candidate) => ({
      candidate,
      chamber: authoritativeChambers.find((chamber) =>
        candidateMatchesIpu(candidate, chamber),
      ),
    }))
    .filter(({ chamber }) => chamber);

  const chamberCompositions = matchedCandidates
    .filter(({ chamber }) => !hasIpuFullComposition(chamber))
    .map(({ candidate, chamber }) => ({
      chamberId: chamber.id,
      composition: sourceReportedComposition(
        candidate,
        snapshot.retrievedAt,
        chamber.totalSeats,
      ),
    }))
    .filter(({ composition }) => composition);

  const seatBearingCandidates = rawCandidates.filter(
    (candidate) => candidate.totalSeats,
  );
  const unmatched = seatBearingCandidates.filter(
    (candidate) =>
      !matchedCandidates.some(
        ({ candidate: matched }) => matched === candidate,
      ),
  );
  const withKinds = inferKinds(
    snapshot.requestedCountry,
    unmatched,
    authoritativeChambers,
  );

  const missingChambers = withKinds
    .filter((candidate) => candidate.kind && candidate.totalSeats)
    .map((candidate) => ({
      id: `wiki-${snapshot.requestedCountry.iso3.toLowerCase()}-${slug(
        candidate.name,
      )}`,
      name: candidate.name,
      kind: candidate.kind,
      totalSeats: candidate.totalSeats,
      speakers: [],
      ...(sourceReportedComposition(
        candidate,
        snapshot.retrievedAt,
        candidate.totalSeats,
      ) && {
        composition: sourceReportedComposition(
          candidate,
          snapshot.retrievedAt,
          candidate.totalSeats,
        ),
      }),
      sourceIds: [...new Set([parentSource.id, candidate.source.id])],
    }))
    .sort((left, right) => {
      const order = { lower: 0, unicameral: 0, upper: 1 };
      return (
        order[left.kind] - order[right.kind] ||
        left.name.localeCompare(right.name)
      );
    });

  const sourceIds = new Set([
    ...missingChambers.flatMap((chamber) => chamber.sourceIds),
    ...missingChambers.flatMap(
      (chamber) => chamber.composition?.sourceIds ?? [],
    ),
    ...chamberCompositions.flatMap(
      ({ composition }) => composition.sourceIds,
    ),
  ]);
  const sources = [
    parentSource,
    ...rawCandidates.map((candidate) => candidate.source),
  ]
    .filter(
      (source, index, all) =>
        sourceIds.has(source.id) &&
        all.findIndex((candidate) => candidate.id === source.id) === index,
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  const diagnostics = [];
  for (const { candidate, chamber } of matchedCandidates) {
    const entries = candidate.compositionEntries ?? [];
    const reportedSeats = entries.reduce((sum, entry) => sum + entry.seats, 0);
    if (entries.length && reportedSeats > chamber.totalSeats) {
      diagnostics.push(
        `COMPOSITION_EXCEEDS_CHAMBER:${candidate.name}:${reportedSeats}/${chamber.totalSeats}`,
      );
    }
  }
  for (const candidate of rawCandidates) {
    if (!candidate.totalSeats) {
      diagnostics.push(`NO_SEAT_COUNT:${candidate.name}`);
    }
  }
  for (const candidate of withKinds) {
    if (!candidate.kind) diagnostics.push(`NO_CHAMBER_KIND:${candidate.name}`);
  }

  return { missingChambers, chamberCompositions, sources, diagnostics };
}

export function mergeWikipediaChambers(profile, normalized, buildId) {
  const order = { lower: 0, unicameral: 0, upper: 1 };
  const authoritativeChambers = profile.parliament.chambers.filter(
    (chamber) => !isWikipediaFallbackChamber(chamber),
  );

  const compositions = new Map(
    (normalized.chamberCompositions ?? []).map(({ chamberId, composition }) => [
      chamberId,
      composition,
    ]),
  );
  const enrichedChambers = authoritativeChambers.map((chamber) => {
    const next = { ...chamber };
    if (isWikipediaFallbackComposition(next.composition)) {
      delete next.composition;
    }
    if (!hasIpuFullComposition(next) && compositions.has(next.id)) {
      next.composition = compositions.get(next.id);
    }
    return next;
  });

  return {
    ...profile,
    schemaVersion: 4,
    buildId,
    parliament: {
      ...profile.parliament,
      chambers: [...enrichedChambers, ...normalized.missingChambers].sort(
        (left, right) =>
          order[left.kind] - order[right.kind] ||
          left.name.localeCompare(right.name),
      ),
    },
  };
}

export { extractHouseLinks };
