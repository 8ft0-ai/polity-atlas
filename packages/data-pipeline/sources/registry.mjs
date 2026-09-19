function assertUniqueSourceIds(sources, label) {
  const seen = new Set();
  for (const source of sources) {
    if (seen.has(source.id)) {
      throw new Error(`Duplicate source id in ${label}: ${source.id}`);
    }
    seen.add(source.id);
  }
}

export function mergeSourceRecords(existingSources, incomingSources) {
  assertUniqueSourceIds(existingSources, 'existing registry');
  assertUniqueSourceIds(incomingSources, 'incoming sources');

  const sources = new Map(existingSources.map((source) => [source.id, source]));

  for (const source of incomingSources) {
    const existing = sources.get(source.id);
    if (existing) {
      const stableExisting = { ...existing };
      const stableIncoming = { ...source };
      delete stableExisting.retrievedAt;
      delete stableIncoming.retrievedAt;
      delete stableExisting.attribution;
      delete stableIncoming.attribution;
      if (
        source.id.startsWith('wikipedia-en-page-') &&
        stableExisting.publisher === 'Wikipedia' &&
        stableIncoming.publisher === 'Wikipedia'
      ) {
        delete stableExisting.title;
        delete stableIncoming.title;
        delete stableExisting.url;
        delete stableIncoming.url;
      }
      if (JSON.stringify(stableExisting) !== JSON.stringify(stableIncoming)) {
        throw new Error(`Conflicting source metadata for ${source.id}`);
      }
    }
    sources.set(source.id, source);
  }

  return [...sources.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}
