const DEFAULT_API_URL = 'https://www.wikidata.org/w/api.php';
const DEFAULT_USER_AGENT =
  'Polity-Atlas/0.1 (+https://github.com/8ft0-ai/polity-atlas)';

function canonicalColor(value) {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toUpperCase()}` : undefined;
}

function unambiguousClaimColor(claims) {
  const usable = (claims ?? [])
    .filter((claim) => claim.rank !== 'deprecated')
    .map((claim) => ({
      rank: claim.rank,
      color: canonicalColor(claim.mainsnak?.datavalue?.value),
    }))
    .filter(({ color }) => color);

  const preferred = usable.filter(({ rank }) => rank === 'preferred');
  const candidates = preferred.length ? preferred : usable;
  const colors = Array.from(new Set(candidates.map(({ color }) => color)));
  return colors.length === 1 ? colors[0] : undefined;
}

function sourceRecord(itemId, retrievedAt) {
  return {
    id: `wikidata-item-${itemId.toLowerCase()}-p465`,
    publisher: 'Wikidata',
    title: `Wikidata item ${itemId}: sRGB color hex triplet (P465)`,
    url: `https://www.wikidata.org/wiki/${itemId}`,
    retrievedAt,
    kind: 'reference',
    attribution: 'Wikidata contributors',
    license: 'Creative Commons CC0 1.0 Universal',
  };
}

export class WikidataClient {
  constructor({
    apiUrl = DEFAULT_API_URL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30_000,
  } = {}) {
    if (!fetchImpl) throw new Error('A fetch implementation is required');
    this.apiUrl = apiUrl;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(params) {
    const url = new URL(this.apiUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `Wikidata request failed (${response.status}) for ${url}`,
      );
    }
    return response.json();
  }

  async colorsByWikipediaTitles(titles, retrievedAt) {
    const uniqueTitles = Array.from(new Set(titles.filter(Boolean))).sort(
      (left, right) => left.localeCompare(right),
    );
    const resolved = new Map();

    for (let index = 0; index < uniqueTitles.length; index += 20) {
      const batch = uniqueTitles.slice(index, index + 20);
      const response = await this.request({
        action: 'wbgetentities',
        sites: 'enwiki',
        titles: batch.join('|'),
        props: 'claims|sitelinks',
        format: 'json',
        formatversion: '2',
      });

      for (const entity of Object.values(response.entities ?? {})) {
        if (!entity?.id || entity.missing) continue;
        const title = entity.sitelinks?.enwiki?.title;
        const color = unambiguousClaimColor(entity.claims?.P465);
        if (!title || !color) continue;
        resolved.set(title, {
          color,
          itemId: entity.id,
          source: sourceRecord(entity.id, retrievedAt),
        });
      }
    }

    return resolved;
  }
}

export { canonicalColor, unambiguousClaimColor };
