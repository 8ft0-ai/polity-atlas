import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { IpuClient } from './client.mjs';
import { mergeIpuProfile, normalizeIpuSnapshot } from './normalize.mjs';
import { mergeSourceRecords } from '../sources/registry.mjs';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const configPath = resolve(
  repositoryRoot,
  'packages/data-pipeline/config/pilot-countries.json',
);
const profileDirectory = resolve(repositoryRoot, 'public/data/countries');
const cacheDirectory = resolve(repositoryRoot, '.cache/ipu');
const manifestPath = resolve(repositoryRoot, 'public/data/manifest.json');
const sourcesPath = resolve(repositoryRoot, 'public/data/sources.json');
const formatterPath = resolve(repositoryRoot, 'node_modules/.bin/oxfmt');
const execFileAsync = promisify(execFile);

function option(name) {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const output = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, output);
  return output;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const fromCache = process.argv.includes('--from-cache');
const retrievedAt =
  option('retrieved-at') ??
  new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
const buildId = option('build-id') ?? retrievedAt.slice(0, 10);
const config = await readJson(configPath);
const client = new IpuClient();
const existingSourceRegistry = await readJson(sourcesPath);
const emittedSources = [];

let taxonomies;
if (fromCache) {
  taxonomies = await readJson(resolve(cacheDirectory, 'taxonomies.json'));
} else {
  taxonomies = await client.fetchTaxonomies();
  await writeJson(resolve(cacheDirectory, 'taxonomies.json'), taxonomies);
}

const preparedProfiles = [];
for (const country of config.countries) {
  const snapshotPath = resolve(cacheDirectory, `${country.iso3}.json`);
  const snapshot = fromCache
    ? await readJson(snapshotPath)
    : await client.fetchCountrySnapshot(country, taxonomies, retrievedAt);
  if (!fromCache) await writeJson(snapshotPath, snapshot);

  const profilePath = resolve(profileDirectory, `${country.iso3}.json`);
  const previousProfile = await readJson(profilePath);
  const normalized = normalizeIpuSnapshot(snapshot);
  const profile = mergeIpuProfile(previousProfile, normalized, buildId);
  emittedSources.push(normalized.source);
  preparedProfiles.push({ country, profilePath, profile });
  process.stdout.write(`Prepared ${country.iso3}\n`);
}

for (const prepared of preparedProfiles) {
  await writeJson(prepared.profilePath, prepared.profile);
  process.stdout.write(`Updated ${prepared.country.iso3}\n`);
}

await execFileAsync(
  formatterPath,
  preparedProfiles.map(({ profilePath }) => profilePath),
);

const manifestProfiles = [];
for (const prepared of preparedProfiles) {
  const formattedOutput = await readFile(prepared.profilePath);
  manifestProfiles.push({
    iso3: prepared.country.iso3,
    path: `countries/${prepared.country.iso3}.json`,
    sha256: sha256(formattedOutput),
  });
}

manifestProfiles.sort((left, right) => left.iso3.localeCompare(right.iso3));
const mergedSources = mergeSourceRecords(
  existingSourceRegistry.sources,
  emittedSources,
);
await writeJson(sourcesPath, { schemaVersion: 1, sources: mergedSources });
await execFileAsync(formatterPath, [sourcesPath]);
const sourcesOutput = await readFile(sourcesPath);

await writeJson(manifestPath, {
  schemaVersion: 3,
  buildId,
  generatedAt: retrievedAt,
  profiles: manifestProfiles,
  sourceRegistry: {
    path: 'sources.json',
    sha256: sha256(sourcesOutput),
  },
});
await execFileAsync(formatterPath, [manifestPath]);
process.stdout.write(
  `Updated manifest for ${manifestProfiles.length} profiles\n`,
);
