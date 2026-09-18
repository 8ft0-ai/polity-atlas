const DEFAULT_BASE_URL = 'https://api.data.ipu.org/v1/';
const DEFAULT_USER_AGENT =
  'Polity-Atlas/0.1 (+https://github.com/8ft0-ai/polity-atlas)';

export class IpuAuthenticationRequiredError extends Error {
  constructor(status) {
    super(`IPU_AUTHENTICATION_REQUIRED: Parline returned HTTP ${status}`);
    this.name = 'IpuAuthenticationRequiredError';
    this.code = 'IPU_AUTHENTICATION_REQUIRED';
  }
}

export class IpuClient {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    retries = 2,
    timeoutMs = 30_000,
  } = {}) {
    if (!fetchImpl) throw new Error('A fetch implementation is required');
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.retries = retries;
    this.timeoutMs = timeoutMs;
  }

  async request(path, searchParams = {}) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: 'application/vnd.api+json',
            'User-Agent': DEFAULT_USER_AGENT,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.status === 401 || response.status === 403) {
          throw new IpuAuthenticationRequiredError(response.status);
        }

        if (!response.ok) {
          const body = await response.text();
          const error = new Error(
            `IPU request failed (${response.status}) for ${url}: ${body.slice(0, 300)}`,
          );
          error.status = response.status;
          throw error;
        }

        const body = await response.text();
        if (!body) throw new Error(`IPU returned an empty response for ${url}`);
        return JSON.parse(body);
      } catch (error) {
        if (error instanceof IpuAuthenticationRequiredError) throw error;
        lastError = error;
        const retryable =
          error.name === 'TimeoutError' ||
          error.name === 'AbortError' ||
          error.status === 429 ||
          error.status >= 500;
        if (!retryable || attempt === this.retries) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }

    throw lastError;
  }

  async all(path, searchParams = {}) {
    const pageSize = 100;
    const first = await this.request(path, {
      ...searchParams,
      'page[size]': pageSize,
      'page[number]': 1,
    });
    const rows = [...(first.data ?? [])];
    const total = first.meta?.total ?? rows.length;

    for (let page = 2; rows.length < total; page += 1) {
      const response = await this.request(path, {
        ...searchParams,
        'page[size]': pageSize,
        'page[number]': page,
      });
      rows.push(...(response.data ?? []));
      if (!response.data?.length) break;
    }

    return { meta: first.meta ?? {}, data: rows };
  }

  async fetchTaxonomies() {
    return (await this.all('metadata/taxonomies/')).data;
  }

  async fetchCountrySnapshot(country, taxonomies, retrievedAt) {
    const countryResponse = await this.request(`countries/${country.iso2}`);
    const [parliaments, chambers, parties] = await Promise.all([
      this.all(`countries/${country.iso2}/parliaments`),
      this.all(`countries/${country.iso2}/chambers`),
      this.all('political_parties/', {
        filter: `political_party_country:eq:${country.iso2}`,
      }),
    ]);

    const electionsByChamber = {};
    await Promise.all(
      chambers.data.map(async (chamber) => {
        electionsByChamber[chamber.id] = (
          await this.all('elections/', {
            filter: `chamber:eq:${chamber.id}`,
          })
        ).data;
      }),
    );

    const speakerIds = new Set();
    for (const chamber of chambers.data) {
      const values = chamber.attributes?.chamber_speakers ?? [];
      for (const series of values) {
        for (const speaker of series.value ?? []) {
          if (speaker.info) speakerIds.add(speaker.info);
        }
      }
    }

    const people = [];
    await Promise.all(
      [...speakerIds].map(async (personId) => {
        const response = await this.all('people/', {
          filter: `person_code:eq:${personId}`,
        });
        people.push(...response.data);
      }),
    );

    return {
      apiVersion: 'v1',
      retrievedAt,
      requestedCountry: country,
      meta: {
        publisher: countryResponse.meta?.publisher,
        termsOfUse: countryResponse.meta?.terms_of_use,
        licence: countryResponse.meta?.licence,
      },
      country: countryResponse.data,
      parliaments: parliaments.data,
      chambers: chambers.data,
      electionsByChamber,
      parties: parties.data,
      people,
      taxonomies,
    };
  }
}
