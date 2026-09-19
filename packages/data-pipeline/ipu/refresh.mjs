import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { IpuClient } from './client.mjs';
import {
  createIpuLegislatureProfile,
  mergeIpuProfile,
  normalizeIpuSnapshot,
} from './normalize.mjs';
import { mergeSourceRecords } from '../sources/registry.mjs';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const fullConfigPath = resolve(
  repositoryRoot,
  'packages/data-pipeline/config/pilot-countries.json',
);
const legislatureConfigPath = resolve(
  repositoryRoot,
  'packages/data-pipeline/config/legislature-pilots.json',
);
const profileDirectory = resolve(repositoryRoot, 'public/data/countries');
const legislatureDirectory = resolve(
  repositoryRoot,
  'public/data/legislatures',
);
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

async function readJsonIfPresent(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
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
const onlyIso3 = option('country')?.toUpperCase();
const retrievedAt =
  option('retrieved-at') ??
  new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
const buildId = option('build-id') ?? retrievedAt.slice(0, 10);
const fullConfig = await readJson(fullConfigPath);
const legislatureConfig = await readJson(legislatureConfigPath);
const allTargets = [
  ...fullConfig.countries.map((country) => ({ ...country, mode: 'full' })),
  ...legislatureConfig.countries.map((country) => ({
    ...country,
    mode: 'legislature',
  })),
];
const targets = onlyIso3
  ? allTargets.filter((country) => country.iso3 === onlyIso3)
  : allTargets;
if (onlyIso3 && !targets.length) {
  throw new Error(`Unknown configured legislature country: ${onlyIso3}`);
}

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

const prepared = [];
for (const country of targets) {
  const snapshotPath = resolve(cacheDirectory, `${country.iso3}.json`);
  const snapshot = fromCache
    ? await readJson(snapshotPath)
    : await client.fetchCountrySnapshot(country, taxonomies, retrievedAt);
  if (!fromCache) await writeJson(snapshotPath, snapshot);

  const normalized = normalizeIpuSnapshot(snapshot);
  emittedSources.push(normalized.source);

  if (country.mode === 'full') {
    const outputPath = resolve(profileDirectory, `${country.iso3}.json`);
    const previous = await readJson(outputPath);
    prepared.push({
      country,
      mode: country.mode,
      outputPath,
      value: mergeIpuProfile(previous, normalized, buildId),
    });
  } else {
    const outputPath = resolve(
      legislatureDirectory,
      `${country.iso3}.json`,
    );
    prepared.push({
      country,
      mode: country.mode,
      outputPath,
      value: createIpuLegislatureProfile(country, normalized, buildId),
    });
  }
  process.stdout.write(`Prepared ${country.iso3} (${country.mode})\n`);
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
  for (const country of fullConfig.countries) {
    const candidate = prepared.find(
      (entry) => entry.mode === 'full' && entry.country.iso3 === country.iso3,
    );
    const outputPath = resolve(profileDirectory, `${country.iso3}.json`);
    const value = candidate?.value ?? (await readJson(outputPath));
    const stagedPath = resolve(
      stagingDirectory,
      'countries',
      `${country.iso3}.json`,
    );
    await writeJson(stagedPath, value);
    stagedProfiles.push({ country, outputPath, stagedPath, selected: Boolean(candidate) });
  }

  const stagedLegislatures = [];
  for (const country of legislatureConfig.countries) {
    const candidate = prepared.find(
      (entry) =>
        entry.mode === 'legislature' && entry.country.iso3 === country.iso3,
    );
    const outputPath = resolve(
      legislatureDirectory,
      `${country.iso3}.json`,
    );
    const value =
      candidate?.value ?? (await readJsonIfPresent(outputPath));
    if (!value) {
      throw new Error(
        `Legislature ${country.iso3} has not been generated; run the full IPU refresh first`,
      );
    }
    const stagedPath = resolve(
      stagingDirectory,
      'legislatures',
      `${country.iso3}.json`,
    );
    await writeJson(stagedPath, value);
    stagedLegislatures.push({
      country,
      outputPath,
      stagedPath,
      selected: Boolean(candidate),
    });
  }

  const stagedSourcesPath = resolve(stagingDirectory, 'sources.json');
  await writeJson(stagedSourcesPath, {
    schemaVersion: 1,
    sources: mergedSources,
  });

  await execFileAsync(formatterPath, [
    ...stagedProfiles.map(({ stagedPath }) => stagedPath),
    ...stagedLegislatures.map(({ stagedPath }) => stagedPath),
    stagedSourcesPath,
  ]);

  const profileOutputs = new Map();
  const manifestProfiles = [];
  for (const entry of stagedProfiles) {
    const output = await readFile(entry.stagedPath);
    profileOutputs.set(entry.country.iso3, output);
    manifestProfiles.push({
      iso3: entry.country.iso3,
      path: `countries/${entry.country.iso3}.json`,
      sha256: sha256(output),
    });
  }

  const legislatureOutputs = new Map();
  const manifestLegislatures = [];
  for (const entry of stagedLegislatures) {
    const output = await readFile(entry.stagedPath);
    legislatureOutputs.set(entry.country.iso3, output);
    manifestLegislatures.push({
      iso3: entry.country.iso3,
      path: `legislatures/${entry.country.iso3}.json`,
      sha256: sha256(output),
    });
  }

  manifestProfiles.sort((left, right) => left.iso3.localeCompare(right.iso3));
  manifestLegislatures.sort((left, right) =>
    left.iso3.localeCompare(right.iso3),
  );
  const sourcesOutput = await readFile(stagedSourcesPath);
  const stagedManifestPath = resolve(stagingDirectory, 'manifest.json');
  await writeJson(stagedManifestPath, {
    schemaVersion: 5,
    buildId,
    generatedAt: retrievedAt,
    profiles: manifestProfiles,
    legislatures: manifestLegislatures,
    sourceRegistry: {
      path: 'sources.json',
      sha256: sha256(sourcesOutput),
    },
  });
  await execFileAsync(formatterPath, [stagedManifestPath]);
  const manifestOutput = await readFile(stagedManifestPath);

  for (const entry of stagedProfiles.filter(({ selected }) => selected)) {
    await writeFile(
      entry.outputPath,
      profileOutputs.get(entry.country.iso3),
    );
    process.stdout.write(`Updated ${entry.country.iso3}\n`);
  }
  for (const entry of stagedLegislatures.filter(({ selected }) => selected)) {
    await mkdir(dirname(entry.outputPath), { recursive: true });
    await writeFile(
      entry.outputPath,
      legislatureOutputs.get(entry.country.iso3),
    );
    process.stdout.write(`Updated legislature ${entry.country.iso3}\n`);
  }
  await writeFile(sourcesPath, sourcesOutput);
  await writeFile(manifestPath, manifestOutput);
  process.stdout.write(
    `Updated manifest for ${manifestProfiles.length} full profiles and ${manifestLegislatures.length} legislature modules\n`,
  );
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}
