const DEFAULT_REST_BASE_URL = 'https://en.wikipedia.org/w/rest.php/v1/';
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

function redirectFromHtml(html) {
  const href = html.match(/<a\s+href=["']([^"']+)["']/i)?.[1];
  return href?.replaceAll('&amp;', '&');
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
    let url = new URL(path.replace(/^\//, ''), this.restBaseUrl);
    const allowedOrigin = new URL(this.restBaseUrl).origin;

    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const response = await this.fetchImpl(url, {
        redirect: 'manual',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'identity',
          'User-Agent': DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const headerLocation = response.headers?.get?.('location');
        const bodyLocation = headerLocation
          ? undefined
          : redirectFromHtml(await response.text());
        const location = headerLocation ?? bodyLocation;
        if (!location) {
          throw new Error(
            `Wikimedia REST redirect (${response.status}) is missing a target for ${url}`,
          );
        }
        const nextUrl = new URL(location, url);
        if (nextUrl.origin !== allowedOrigin) {
          throw new Error(
            `Wikimedia REST redirect left the allowed origin: ${nextUrl}`,
          );
        }
        url = nextUrl;
        continue;
      }

      if (allowNotFound && response.status === 404) return undefined;
      if (!response.ok) {
        throw new Error(
          `Wikimedia REST request failed (${response.status}) for ${url}`,
        );
      }
      return response.json();
    }

    throw new Error(`Wikimedia REST redirect limit exceeded for ${url}`);
  }

  async fetchPageWithHtml(title, { allowNotFound = false } = {}) {
    const pageKey = encodeURIComponent(title.replaceAll(' ', '_'));
    const response = await this.request(`page/${pageKey}/with_html`, {
      allowNotFound,
    });
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

    const countryNeedle = normalizedTitle(countryName);
    const queries = [
      requestedTitle,
      `legislature ${countryName}`,
      `national assembly ${countryName}`,
      `consultative assembly ${countryName}`,
      `congress ${countryName}`,
    ];
    const candidates = new Map();
    for (const query of queries) {
      for (const entry of await this.searchPages(query, 10)) {
        candidates.set(entry.id ?? entry.key ?? entry.title, entry);
      }
    }

    const legislativeTerms =
      /\b(parliament|assembly|congress|council|legislature|majlis|hluttaw|shura)\b/;
    const rejectedTerms =
      /\b(election|building|history|constituenc|list of|speaker)\b/;
    const ranked = Array.from(candidates.values())
      .map((entry) => {
        const title = normalizedTitle(entry.title ?? entry.key ?? '');
        const context = normalizedTitle(
          [entry.title, entry.description, entry.excerpt]
            .filter(Boolean)
            .join(' '),
        );
        let score = 0;
        if (legislativeTerms.test(title)) score += 8;
        if (context.includes(countryNeedle)) score += 6;
        if (title.includes(countryNeedle)) score += 4;
        if (rejectedTerms.test(title)) score -= 8;
        return { entry, score };
      })
      .filter(({ score }) => score >= 8)
      .sort(
        (left, right) =>
          right.score - left.score ||
          String(left.entry.title).localeCompare(String(right.entry.title)),
      );

    const candidate = ranked[0]?.entry;
    return candidate
      ? this.fetchPageWithHtml(candidate.key ?? candidate.title)
      : undefined;
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
