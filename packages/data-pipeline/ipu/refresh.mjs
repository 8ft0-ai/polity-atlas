import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

const mergedSources = mergeSourceRecords(
  existingSourceRegistry.sources,
  emittedSources,
);

await mkdir(cacheDirectory, { recursive: true });
const stagingDirectory = await mkdtemp(
  resolve(cacheDirectory, '.staged-public-data-'),
);

try {
  const stagedProfiles = [];
  for (const prepared of preparedProfiles) {
    const stagedPath = resolve(
      stagingDirectory,
      'countries',
      `${prepared.country.iso3}.json`,
    );
    await writeJson(stagedPath, prepared.profile);
    stagedProfiles.push({ ...prepared, stagedPath });
  }

  const stagedSourcesPath = resolve(stagingDirectory, 'sources.json');
  await writeJson(stagedSourcesPath, {
    schemaVersion: 1,
    sources: mergedSources,
  });

  await execFileAsync(formatterPath, [
    ...stagedProfiles.map(({ stagedPath }) => stagedPath),
    stagedSourcesPath,
  ]);

  const manifestProfiles = [];
  const profileOutputs = new Map();
  for (const prepared of stagedProfiles) {
    const formattedOutput = await readFile(prepared.stagedPath);
    profileOutputs.set(prepared.country.iso3, formattedOutput);
    manifestProfiles.push({
      iso3: prepared.country.iso3,
      path: `countries/${prepared.country.iso3}.json`,
      sha256: sha256(formattedOutput),
    });
  }

  manifestProfiles.sort((left, right) => left.iso3.localeCompare(right.iso3));
  const sourcesOutput = await readFile(stagedSourcesPath);
  const stagedManifestPath = resolve(stagingDirectory, 'manifest.json');
  await writeJson(stagedManifestPath, {
    schemaVersion: 3,
    buildId,
    generatedAt: retrievedAt,
    profiles: manifestProfiles,
    sourceRegistry: {
      path: 'sources.json',
      sha256: sha256(sourcesOutput),
    },
  });
  await execFileAsync(formatterPath, [stagedManifestPath]);
  const manifestOutput = await readFile(stagedManifestPath);

  for (const prepared of preparedProfiles) {
    await writeFile(
      prepared.profilePath,
      profileOutputs.get(prepared.country.iso3),
    );
    process.stdout.write(`Updated ${prepared.country.iso3}\n`);
  }
  await writeFile(sourcesPath, sourcesOutput);
  await writeFile(manifestPath, manifestOutput);
  process.stdout.write(
    `Updated manifest for ${manifestProfiles.length} profiles\n`,
  );
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}
