const DEFAULT_REST_BASE_URL =
  'https://en.wikipedia.org/w/rest.php/v1/';
const DEFAULT_USER_AGENT =
  'Polity-Atlas/0.1 (+https://github.com/8ft0-ai/polity-atlas)';

function normalizedTitle(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalArticleUrl(page) {
  const key = page.key ?? page.title?.replaceAll(' ', '_');
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(key)}`;
}

function pageSnapshot(page) {
  if (!page?.id || !page?.title || typeof page.html !== 'string') {
    throw new Error('Wikimedia REST page response is missing required fields');
  }

  return {
    pageId: page.id,
    title: page.title,
    ...(page.key && { key: page.key }),
    ...(page.latest?.id !== undefined && { revisionId: page.latest.id }),
    ...(page.latest?.timestamp && {
      revisionTimestamp: page.latest.timestamp,
    }),
    ...(page.license?.title &&
      page.license?.url && {
        license: {
          title: page.license.title,
          url: page.license.url,
        },
      }),
    url: canonicalArticleUrl(page),
    html: page.html,
  };
}

export class WikipediaClient {
  constructor({
    restBaseUrl = DEFAULT_REST_BASE_URL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30_000,
  } = {}) {
    if (!fetchImpl) throw new Error('A fetch implementation is required');
    this.restBaseUrl = restBaseUrl.endsWith('/')
      ? restBaseUrl
      : `${restBaseUrl}/`;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { allowNotFound = false } = {}) {
    const url = new URL(path.replace(/^\//, ''), this.restBaseUrl);
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (allowNotFound && response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(
        `Wikimedia REST request failed (${response.status}) for ${url}`,
      );
    }
    return response.json();
  }

  async fetchPageWithHtml(title, { allowNotFound = false } = {}) {
    const pageKey = encodeURIComponent(title.replaceAll(' ', '_'));
    const response = await this.request(
      `page/${pageKey}/with_html`,
      { allowNotFound },
    );
    return response ? pageSnapshot(response) : undefined;
  }

  async searchPages(query, limit = 10) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const response = await this.request(`search/page?${params}`);
    return response.pages ?? [];
  }

  async resolveParliamentPage(countryName) {
    const requestedTitle = `Parliament of ${countryName}`;
    const exact = await this.fetchPageWithHtml(requestedTitle, {
      allowNotFound: true,
    });
    if (exact) return exact;

    const search = await this.searchPages(requestedTitle, 10);
    const requestedNeedle = normalizedTitle(requestedTitle);
    const countryNeedle = normalizedTitle(countryName);

    const candidate =
      search.find(
        (entry) =>
          normalizedTitle(entry.title ?? entry.key ?? '') === requestedNeedle,
      ) ??
      search.find((entry) => {
        const title = normalizedTitle(entry.title ?? entry.key ?? '');
        return title.includes('parliament') && title.includes(countryNeedle);
      });
    if (!candidate) return undefined;

    return this.fetchPageWithHtml(candidate.key ?? candidate.title);
  }

  async fetchParliamentSnapshot(country, retrievedAt) {
    const parliamentPage = await this.resolveParliamentPage(country.name);
    return {
      acquisition: {
        provider: 'Wikimedia',
        api: 'MediaWiki REST API',
        version: 'v1',
      },
      retrievedAt,
      requestedCountry: country,
      parliamentPage,
      chamberPages: [],
    };
  }
}
