import { describe, expect, it, vi } from 'vitest';
import { WikipediaClient } from './client.mjs';

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

function restPage({
  id = 123,
  key = 'Parliament_of_Example',
  title = 'Parliament of Example',
  html = '<table class="infobox"></table>',
} = {}) {
  return {
    id,
    key,
    title,
    latest: {
      id: 987654,
      timestamp: '2026-09-19T01:02:03Z',
    },
    license: {
      title: 'CC BY-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    html,
  };
}

describe('WikipediaClient Wikimedia REST acquisition', () => {
  it('retrieves an exact parliament page through REST with revision metadata', async () => {
    const fetchImpl = vi.fn(async () => response(200, restPage()));
    const client = new WikipediaClient({
      restBaseUrl: 'https://en.wikipedia.org/w/rest.php/v1/',
      fetchImpl,
    });

    const snapshot = await client.fetchParliamentSnapshot(
      {
        iso3: 'EXA',
        name: 'Example',
      },
      '2026-09-19T02:00:00.000Z',
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://en.wikipedia.org/w/rest.php/v1/page/Parliament_of_Example/with_html',
    );
    expect(String(url)).not.toContain('w/api.php');
    expect(String(url)).not.toContain('action=');
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.headers['User-Agent']).toContain('Polity-Atlas');

    expect(snapshot.acquisition).toEqual({
      provider: 'Wikimedia',
      api: 'MediaWiki REST API',
      version: 'v1',
    });
    expect(snapshot.parliamentPage).toEqual({
      pageId: 123,
      title: 'Parliament of Example',
      key: 'Parliament_of_Example',
      revisionId: 987654,
      revisionTimestamp: '2026-09-19T01:02:03Z',
      license: {
        title: 'CC BY-SA 4.0',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
      url: 'https://en.wikipedia.org/wiki/Parliament_of_Example',
      html: '<table class="infobox"></table>',
    });
  });

  it('falls back to REST page search when the conventional title is absent', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => response(404, {}))
      .mockImplementationOnce(async () =>
        response(200, {
          pages: [
            {
              id: 456,
              key: 'Legislature_of_Example',
              title: 'Legislature of Example',
            },
            {
              id: 789,
              key: 'Example_Parliament',
              title: 'Example Parliament',
            },
          ],
        }),
      )
      .mockImplementationOnce(async () =>
        response(
          200,
          restPage({
            id: 789,
            key: 'Example_Parliament',
            title: 'Example Parliament',
          }),
        ),
      );

    const client = new WikipediaClient({ fetchImpl });
    const page = await client.resolveParliamentPage('Example');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      '/w/rest.php/v1/search/page?',
    );
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      'q=Parliament+of+Example',
    );
    expect(String(fetchImpl.mock.calls[2][0])).toContain(
      '/page/Example_Parliament/with_html',
    );
    expect(page.pageId).toBe(789);
    expect(page.title).toBe('Example Parliament');
  });

  it('returns an empty parliament snapshot when REST discovery finds no page', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => response(404, {}))
      .mockImplementationOnce(async () => response(200, { pages: [] }));

    const client = new WikipediaClient({ fetchImpl });
    const snapshot = await client.fetchParliamentSnapshot(
      {
        iso3: 'EXA',
        name: 'Example',
      },
      '2026-09-19T02:00:00.000Z',
    );

    expect(snapshot.parliamentPage).toBeUndefined();
    expect(snapshot.chamberPages).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails explicitly on non-404 REST errors', async () => {
    const fetchImpl = vi.fn(async () => response(429, {}));
    const client = new WikipediaClient({ fetchImpl });

    await expect(client.resolveParliamentPage('Example')).rejects.toThrow(
      'Wikimedia REST request failed (429)',
    );
  });
});
