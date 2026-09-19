export function mergeSourceRecords(existingSources, incomingSources) {
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
