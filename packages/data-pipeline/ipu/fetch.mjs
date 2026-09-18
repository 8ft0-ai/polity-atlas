import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API = 'https://api.data.ipu.org/v1';
const config = JSON.parse(
  await readFile(new URL('../config/pilot-countries.json', import.meta.url), 'utf8'),
);

const countryArg = process.argv.indexOf('--country');
const requested =
  countryArg >= 0
    ? config.countries.filter((country) =>
        [country.iso2, country.iso3].includes(
          process.argv[countryArg + 1]?.toUpperCase(),
        ),
      )
    : config.countries;

if (requested.length === 0) throw new Error('No configured pilot matched --country');

async function getJson(resource) {
  const response = await fetch(`${API}${resource}`, {
    headers: { Accept: 'application/vnd.api+json, application/json' },
  });
  if (!response.ok) {
    throw new Error(`IPU request failed (${response.status}) for ${resource}`);
  }
  return response.json();
}

function resources(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  return payload?.data ? [payload.data] : [];
}

function resourceId(resource) {
  return resource?.id ?? resource?.attributes?.chamber_code ?? null;
}

const cacheDir = path.resolve('.cache/ipu');
await mkdir(cacheDir, { recursive: true });

for (const country of requested) {
  const [countryData, parliaments, chambers] = await Promise.all([
    getJson(`/countries/${country.iso2}`),
    getJson(`/countries/${country.iso2}/parliaments`),
    getJson(`/countries/${country.iso2}/chambers`),
  ]);
  const elections = {};
  for (const chamber of resources(chambers)) {
    const id = resourceId(chamber);
    if (!id) continue;
    elections[id] = await getJson(
      `/chambers/${encodeURIComponent(id)}/elections?page[size]=100`,
    );
  }
  const snapshot = {
    provider: 'ipu-parline',
    apiVersion: 'v1',
    retrievedAt: new Date().toISOString(),
    country: countryData,
    parliaments,
    chambers,
    elections,
  };
  const target = path.join(cacheDir, `${country.iso3}.json`);
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(`wrote ${target}\n`);
}
