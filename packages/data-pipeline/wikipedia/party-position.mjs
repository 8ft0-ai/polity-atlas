const POSITION_POINTS = [
  'far-left',
  'left',
  'centre-left',
  'centre',
  'centre-right',
  'right',
  'far-right',
];

const ALIASES = new Map([
  ['far left', 'far-left'],
  ['left', 'left'],
  ['left wing', 'left'],
  ['centre left', 'centre-left'],
  ['center left', 'centre-left'],
  ['centre', 'centre'],
  ['center', 'centre'],
  ['centre right', 'centre-right'],
  ['center right', 'centre-right'],
  ['right', 'right'],
  ['right wing', 'right'],
  ['far right', 'far-right'],
]);

function canonicalPoint(value) {
  const key = value
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES.get(key);
}

export function normalizePoliticalPosition(value, sourceIds) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error('Political position must be a string');
  }
  if (value.trim() === '') return undefined;
  if (
    !Array.isArray(sourceIds) ||
    !sourceIds.length ||
    sourceIds.some((id) => typeof id !== 'string' || !id.trim())
  ) {
    throw new Error('Political position requires source IDs');
  }

  const raw = value.trim();
  const comparable = raw.replace(/\s+/g, ' ');
  const point = canonicalPoint(comparable);
  if (point) {
    return { kind: 'scale', from: point, to: point, raw, sourceIds };
  }

  const range =
    comparable.match(/^(.+?)\s+to\s+(.+)$/i) ??
    comparable.match(/^(.+?)\s*[\u2013\u2014]\s*(.+)$/);
  if (range) {
    const from = canonicalPoint(range[1]);
    const to = canonicalPoint(range[2]);
    if (from && to) {
      const first = POSITION_POINTS.indexOf(from);
      const last = POSITION_POINTS.indexOf(to);
      return {
        kind: 'scale',
        from: POSITION_POINTS[Math.min(first, last)],
        to: POSITION_POINTS[Math.max(first, last)],
        raw,
        sourceIds,
      };
    }
  }

  // Preserve only explicitly recognised non-scale political classifications.
  // Other source text remains available as an infobox fact, not as a position.
  if (/^(big[ -]tent|catch[ -]all|syncretic)$/i.test(comparable)) {
    return { kind: 'label', label: comparable, raw, sourceIds };
  }
  return undefined;
}
