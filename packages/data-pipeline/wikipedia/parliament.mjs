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

function compositionEntryId(pageId, party, group, index) {
  return [
    'wiki',
    pageId,
    slug(group ?? 'ungrouped'),
    slug(party) || 'entry',
    index + 1,
  ].join('-');
}

function compositionEntriesForPage(page, parsed, retrievedAt) {
  const pageSource = wikipediaSource(page, retrievedAt);
  return (extractPoliticalComposition(parsed) ?? []).map((entry) => {
    const entryWikidata = entry.articleTitle
      ? page.wikidataVisuals?.[entry.articleTitle]
      : undefined;
    const groupWikidata = (entry.groupArticleTitles ?? [])
      .map((articleTitle) => ({
        articleTitle,
        value: page.wikidataVisuals?.[articleTitle],
      }))
      .filter(({ value }) => value);

    return {
      ...entry,
      ...(entry.visual && {
        visual: { ...entry.visual, source: pageSource },
      }),
      ...(!entry.visual &&
        entryWikidata && {
          visual: {
            color: entryWikidata.color,
            method: 'wikidata-p465',
            source: entryWikidata.source,
          },
        }),
      ...(groupWikidata.length && {
        groupVisuals: groupWikidata.map(({ articleTitle, value }) => ({
          articleTitle,
          color: value.color,
          method: 'wikidata-p465',
          source: value.source,
        })),
      }),
    };
  });
}

export function visualArticleTitles(entries) {
  const titles = new Set();
  for (const entry of entries ?? []) {
    if (!entry.visual && entry.articleTitle) titles.add(entry.articleTitle);
    for (const articleTitle of entry.groupArticleTitles ?? []) {
      titles.add(articleTitle);
    }
  }
  return [...titles].sort((left, right) => left.localeCompare(right));
}

function sourceReportedComposition(candidate, retrievedAt, chamberSize) {
  if (!candidate.compositionEntries?.length) return undefined;

  const entries = candidate.compositionEntries
    .map((entry, index) => ({
      partyId: compositionEntryId(
        candidate.pageId,
        entry.party,
        entry.group,
        index,
      ),
      party: entry.party,
      seats: entry.seats,
      ...(entry.group && { group: entry.group }),
      ...(entry.visual && {
        visual: {
          color: entry.visual.color,
          method: entry.visual.method,
          sourceIds: [entry.visual.source.id],
        },
      }),
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

function comparableParty(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(the|party|political|of|and)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function comparablePartyMatches(left, right) {
  return (
    left === right ||
    (left.length >= 5 &&
      right.length >= 5 &&
      (left.includes(right) || right.includes(left)))
  );
}

function isGenericPoliticalLabel(value) {
  return /^(?:independent|independents|independent politician|non affiliated|non partisan|non partisans|nonpartisan|nonpartisans|unaffiliated|other|others|vacant|vacancy|vacancies|crossbench|crossbenchers)$/.test(
    comparableParty(value),
  );
}

function distinctVisual(visuals) {
  const byIdentity = new Map();
  for (const visual of visuals.filter(Boolean)) {
    const key = [visual.color, visual.method, visual.source.id].join('\u0000');
    byIdentity.set(key, visual);
  }
  return byIdentity.size === 1 ? [...byIdentity.values()][0] : undefined;
}

function identityForIpuResult(result, entries) {
  const resultKey = comparableParty(result.party);
  const directMatches = entries.filter((entry) => {
    const candidates = [entry.party, entry.articleTitle]
      .filter(Boolean)
      .map(comparableParty)
      .filter(Boolean);
    return candidates.some((candidate) =>
      comparablePartyMatches(candidate, resultKey),
    );
  });

  const groupMatches = entries.filter((entry) => {
    const candidates = [entry.group, ...(entry.groupArticleTitles ?? [])]
      .filter(Boolean)
      .map(comparableParty)
      .filter(Boolean);
    return candidates.some((candidate) =>
      comparablePartyMatches(candidate, resultKey),
    );
  });

  const direct = directMatches.length === 1 ? directMatches[0] : undefined;
  const groupVisual = direct
    ? undefined
    : distinctVisual(
        groupMatches
          .flatMap((entry) => entry.groupVisuals ?? [])
          .filter((visual) =>
            comparablePartyMatches(
              comparableParty(visual.articleTitle),
              resultKey,
            ),
          ),
      );
  const articleTitles = new Set();
  if (direct?.articleTitle) articleTitles.add(direct.articleTitle);
  if (groupVisual?.articleTitle) articleTitles.add(groupVisual.articleTitle);

  return {
    visual: direct?.visual ?? groupVisual,
    entityKeys: isGenericPoliticalLabel(result.party)
      ? []
      : [
          `ipu-party:${result.partyId}`,
          ...[...articleTitles].map(
            (articleTitle) => `wikipedia-article:${articleTitle}`,
          ),
        ],
  };
}

function extractChamberVisualObservations(candidate, chamber) {
  const entries = candidate.compositionEntries ?? [];
  const outcome = chamber.latestElection?.outcome;
  if (!outcome || !entries.length) return [];

  const observations = new Map();
  for (const result of [
    ...(outcome.seatsWonInElection ?? []),
    ...(outcome.postElectionComposition ?? []),
  ]) {
    if (observations.has(result.partyId)) continue;
    const identity = identityForIpuResult(result, entries);
    observations.set(result.partyId, {
      chamberId: chamber.id,
      partyId: result.partyId,
      entityKeys: identity.entityKeys,
      ...(identity.visual && { visual: identity.visual }),
    });
  }
  return [...observations.values()];
}

function selectCanonicalVisual(visuals) {
  if (!visuals.length) return undefined;
  const colors = new Set(visuals.map((visual) => visual.color));
  if (colors.size === 1) {
    return [...visuals].sort(
      (left, right) =>
        Number(right.method === 'wikidata-p465') -
          Number(left.method === 'wikidata-p465') ||
        left.source.id.localeCompare(right.source.id),
    )[0];
  }

  const wikidata = visuals.filter(
    (visual) => visual.method === 'wikidata-p465',
  );
  return new Set(wikidata.map((visual) => visual.color)).size === 1
    ? wikidata.sort((left, right) =>
        left.source.id.localeCompare(right.source.id),
      )[0]
    : undefined;
}

function consolidateChamberVisuals(observations) {
  const byEntityKey = new Map();
  observations.forEach((observation, index) => {
    for (const key of observation.entityKeys) {
      const indexes = byEntityKey.get(key) ?? [];
      indexes.push(index);
      byEntityKey.set(key, indexes);
    }
  });

  const visited = new Set();
  for (let index = 0; index < observations.length; index += 1) {
    if (visited.has(index)) continue;
    const component = [];
    const pending = [index];
    while (pending.length) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const key of observations[current].entityKeys) {
        pending.push(...(byEntityKey.get(key) ?? []));
      }
    }

    const canonical = selectCanonicalVisual(
      component
        .map((componentIndex) => observations[componentIndex].visual)
        .filter(Boolean),
    );
    if (!canonical) continue;
    for (const componentIndex of component) {
      const current = observations[componentIndex];
      if (!current.visual || current.visual.color !== canonical.color) {
        current.visual = canonical;
      }
    }
  }

  const byChamber = new Map();
  for (const observation of observations) {
    if (!observation.visual) continue;
    const visuals = byChamber.get(observation.chamberId) ?? {};
    visuals[observation.partyId] = {
      color: observation.visual.color,
      method: observation.visual.method,
      sourceIds: [observation.visual.source.id],
    };
    byChamber.set(observation.chamberId, visuals);
  }
  return [...byChamber.entries()].map(([chamberId, visuals]) => ({
    chamberId,
    visuals,
  }));
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

function candidateNameMatchesChamber(candidate, chamber) {
  const candidateNames = [candidate.name, candidate.requestedTitle]
    .map(comparableName)
    .filter(Boolean);
  const chamberNames = [chamber.name, ...(chamber.aliases ?? [])]
    .map(comparableName)
    .filter(Boolean);

  return candidateNames.some((candidateName) =>
    chamberNames.some(
      (chamberName) =>
        candidateName === chamberName ||
        (candidateName.length >= 5 &&
          chamberName.length >= 5 &&
          (candidateName.includes(chamberName) ||
            chamberName.includes(candidateName))),
    ),
  );
}

function candidateMatchesIpu(candidate, chamber) {
  if (candidateNameMatchesChamber(candidate, chamber)) return true;

  const compatibleKind =
    candidate.kind && chamber.kind && candidate.kind === chamber.kind;

  return (
    Boolean(compatibleKind) &&
    candidate.totalSeats !== undefined &&
    candidate.totalSeats === chamber.totalSeats
  );
}

function matchCandidates(candidates, chambers) {
  const matched = [];
  const usedChamberIds = new Set();
  const usedCandidates = new Set();

  function availableChambers() {
    return chambers.filter((chamber) => !usedChamberIds.has(chamber.id));
  }

  function bind(candidate, chamber) {
    matched.push({ candidate, chamber });
    usedCandidates.add(candidate);
    usedChamberIds.add(chamber.id);
  }

  for (const candidate of candidates) {
    const direct = availableChambers().find((chamber) =>
      candidateMatchesIpu(candidate, chamber),
    );
    if (direct) bind(candidate, direct);
  }

  for (const candidate of candidates) {
    if (usedCandidates.has(candidate) || !candidate.kind) continue;
    const sameKind = availableChambers().filter(
      (chamber) => chamber.kind === candidate.kind,
    );
    if (sameKind.length === 1) bind(candidate, sameKind[0]);
  }

  for (const candidate of candidates) {
    if (usedCandidates.has(candidate) || candidate.totalSeats === undefined) {
      continue;
    }
    const sameCapacity = availableChambers().filter(
      (chamber) => chamber.totalSeats === candidate.totalSeats,
    );
    if (sameCapacity.length === 1) bind(candidate, sameCapacity[0]);
  }

  return matched;
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
  if (!snapshot.parliamentPage && !snapshot.chamberPages.length) {
    return {
      missingChambers: [],
      chamberCompositions: [],
      chamberVisuals: [],
      sources: [],
      diagnostics: ['NO_WIKIPEDIA_LEGISLATURE_PAGE'],
    };
  }

  const parentPage = snapshot.parliamentPage ?? snapshot.chamberPages[0];
  const parliamentParsed = snapshot.parliamentPage
    ? parseInfobox(snapshot.parliamentPage.html)
    : { rows: [], text: '' };
  const houseLinks = extractHouseLinks(parliamentParsed);
  const parentSource = wikipediaSource(parentPage, snapshot.retrievedAt);

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
      compositionEntries: compositionEntriesForPage(
        page,
        parsed,
        snapshot.retrievedAt,
      ),
      source: wikipediaSource(page, snapshot.retrievedAt),
    };
  });

  if (!rawCandidates.some((candidate) => candidate.totalSeats)) {
    const parentSeats = extractSeatCount(parliamentParsed);
    const parentKind = extractExplicitChamberKind(parliamentParsed);
    if (parentSeats && parentKind === 'unicameral') {
      rawCandidates.push({
        name: parentPage.title,
        requestedTitle: parentPage.title,
        pageId: parentPage.pageId,
        totalSeats: parentSeats,
        kind: 'unicameral',
        compositionEntries: compositionEntriesForPage(
          parentPage,
          parliamentParsed,
          snapshot.retrievedAt,
        ),
        source: parentSource,
      });
    }
  }

  const authoritativeChambers = profile.parliament.chambers.filter(
    (chamber) => !isWikipediaFallbackChamber(chamber),
  );
  const matchedCandidates = matchCandidates(
    rawCandidates,
    authoritativeChambers,
  );

  const chamberVisuals = consolidateChamberVisuals(
    matchedCandidates.flatMap(({ candidate, chamber }) =>
      extractChamberVisualObservations(candidate, chamber),
    ),
  );

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

  const matchedSet = new Set(
    matchedCandidates.map(({ candidate }) => candidate),
  );
  const duplicateAliases = new Set(
    rawCandidates.filter(
      (candidate) =>
        !matchedSet.has(candidate) &&
        authoritativeChambers.some((chamber) =>
          candidateNameMatchesChamber(candidate, chamber),
        ),
    ),
  );
  const seatBearingCandidates = rawCandidates.filter(
    (candidate) => candidate.totalSeats && !duplicateAliases.has(candidate),
  );
  const unmatched = seatBearingCandidates.filter(
    (candidate) => !matchedSet.has(candidate),
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
    ...chamberCompositions.flatMap(({ composition }) => composition.sourceIds),
    ...missingChambers.flatMap(
      (chamber) =>
        chamber.composition?.entries.flatMap(
          (entry) => entry.visual?.sourceIds ?? [],
        ) ?? [],
    ),
    ...chamberCompositions.flatMap(({ composition }) =>
      composition.entries.flatMap((entry) => entry.visual?.sourceIds ?? []),
    ),
    ...chamberVisuals.flatMap(({ visuals }) =>
      Object.values(visuals).flatMap((visual) => visual.sourceIds),
    ),
  ]);
  const sources = [
    parentSource,
    ...rawCandidates.map((candidate) => candidate.source),
    ...rawCandidates.flatMap((candidate) =>
      candidate.compositionEntries.flatMap((entry) =>
        [entry.visual, ...(entry.groupVisuals ?? [])]
          .filter((visual) => visual?.source)
          .map((visual) => visual.source),
      ),
    ),
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

  return {
    missingChambers,
    chamberCompositions,
    chamberVisuals,
    sources,
    diagnostics,
  };
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
  const visuals = new Map(
    (normalized.chamberVisuals ?? []).map(({ chamberId, visuals }) => [
      chamberId,
      visuals,
    ]),
  );

  function applyVisuals(results, chamberId) {
    const byParty = visuals.get(chamberId);
    if (!results?.length || !byParty) return results;
    return results.map((result) =>
      byParty[result.partyId]
        ? { ...result, visual: byParty[result.partyId] }
        : result,
    );
  }

  const enrichedChambers = authoritativeChambers.map((chamber) => {
    const next = { ...chamber };
    if (next.latestElection?.outcome && visuals.has(next.id)) {
      next.latestElection = {
        ...next.latestElection,
        outcome: {
          ...next.latestElection.outcome,
          seatsWonInElection: applyVisuals(
            next.latestElection.outcome.seatsWonInElection,
            next.id,
          ),
          ...(next.latestElection.outcome.postElectionComposition && {
            postElectionComposition: applyVisuals(
              next.latestElection.outcome.postElectionComposition,
              next.id,
            ),
          }),
        },
      };
    }
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
    schemaVersion: 'government' in profile ? 5 : 1,
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
