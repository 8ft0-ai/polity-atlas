const DEFAULT_API_URL = 'https://en.wikipedia.org/w/api.php';
const DEFAULT_USER_AGENT =
  'Polity-Atlas/0.1 (+https://github.com/8ft0-ai/polity-atlas)';

function normalizedTitle(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export class WikipediaClient {
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
    for (const [key, value] of Object.entries({
      format: 'json',
      formatversion: 2,
      ...params,
    })) {
      url.searchParams.set(key, String(value));
    }

    const response = await this.fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `Wikipedia request failed (${response.status}) for ${url}`,
      );
    }
    return response.json();
  }

  async resolveParliamentPage(countryName) {
    const requestedTitle = `Parliament of ${countryName}`;
    const exact = await this.request({
      action: 'query',
      redirects: 1,
      prop: 'info',
      inprop: 'url',
      titles: requestedTitle,
    });
    const page = exact.query?.pages?.[0];
    if (page && !page.missing) return page;

    const search = await this.request({
      action: 'query',
      list: 'search',
      srnamespace: 0,
      srlimit: 10,
      srsearch: `intitle:"${requestedTitle}"`,
    });
    const countryNeedle = normalizedTitle(countryName);
    const candidate = search.query?.search?.find((entry) => {
      const title = normalizedTitle(entry.title);
      return title.includes('parliament') && title.includes(countryNeedle);
    });
    if (!candidate) return undefined;

    const resolved = await this.request({
      action: 'query',
      redirects: 1,
      prop: 'info',
      inprop: 'url',
      titles: candidate.title,
    });
    return resolved.query?.pages?.find((entry) => !entry.missing);
  }

  async fetchParsedPage(title) {
    const response = await this.request({
      action: 'parse',
      page: title,
      prop: 'text',
      disableeditsection: 1,
    });
    if (!response.parse?.text) {
      throw new Error(`Wikipedia returned no parsed HTML for ${title}`);
    }
    return {
      pageId: response.parse.pageid,
      title: response.parse.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        response.parse.title.replaceAll(' ', '_'),
      )}`,
      html: response.parse.text,
    };
  }

  async fetchParliamentSnapshot(country, retrievedAt) {
    const resolved = await this.resolveParliamentPage(country.name);
    if (!resolved) {
      return {
        retrievedAt,
        requestedCountry: country,
        parliamentPage: undefined,
        chamberPages: [],
      };
    }

    const parliamentPage = await this.fetchParsedPage(resolved.title);
    return {
      retrievedAt,
      requestedCountry: country,
      parliamentPage,
      chamberPages: [],
    };
  }
}
