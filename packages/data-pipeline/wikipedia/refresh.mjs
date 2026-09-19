import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { mergeSourceRecords } from '../sources/registry.mjs';
import { WikipediaClient } from './client.mjs';
import {
  extractHouseLinks,
  mergeWikipediaChambers,
  normalizeWikipediaParliament,
} from './parliament.mjs';
import { parseInfobox } from './parse-infobox.mjs';

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
const cacheDirectory = resolve(repositoryRoot, '.cache/wikipedia');
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

function normalizedTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

async function resolveNamedPage(client, title, countryName) {
  const exact = await client.fetchPageWithHtml(title, {
    allowNotFound: true,
  });
  if (exact) return exact;

  const results = await client.searchPages(`${title} ${countryName}`, 8);
  const needle = normalizedTitle(title);
  const candidate =
    results.find(
      (entry) => normalizedTitle(entry.title ?? entry.key) === needle,
    ) ??
    results.find((entry) => {
      const candidateTitle = normalizedTitle(entry.title ?? entry.key);
      return (
        candidateTitle.includes(needle) ||
        (needle.length >= 5 && needle.includes(candidateTitle))
      );
    });
  return candidate
    ? client.fetchPageWithHtml(candidate.key ?? candidate.title)
    : undefined;
}

async function fetchSnapshot(client, country, retrievedAt, profile) {
  const base = await client.fetchParliamentSnapshot(country, retrievedAt);
  const houseLinks = base.parliamentPage
    ? extractHouseLinks(parseInfobox(base.parliamentPage.html))
    : [];
  const titles = [
    ...houseLinks.map((link) => link.title).filter(Boolean),
    ...profile.parliament.chambers.map((chamber) => chamber.name),
  ];

  const chamberPages = [];
  const seenPageIds = new Set();
  for (const requestedTitle of new Set(titles)) {
    const page = await resolveNamedPage(client, requestedTitle, country.name);
    if (!page || seenPageIds.has(page.pageId)) continue;
    seenPageIds.add(page.pageId);
    chamberPages.push({ ...page, requestedTitle });
  }

  return { ...base, chamberPages };
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

const client = new WikipediaClient();
const existingSourceRegistry = await readJson(sourcesPath);
const emittedSources = [];
const prepared = [];

for (const country of targets) {
  const outputPath =
    country.mode === 'full'
      ? resolve(profileDirectory, `${country.iso3}.json`)
      : resolve(legislatureDirectory, `${country.iso3}.json`);
  const previous = await readJson(outputPath);
  const snapshotPath = resolve(cacheDirectory, `${country.iso3}.json`);
  const snapshot = fromCache
    ? await readJson(snapshotPath)
    : await fetchSnapshot(client, country, retrievedAt, previous);
  if (!fromCache) await writeJson(snapshotPath, snapshot);

  const normalized = normalizeWikipediaParliament(snapshot, previous);
  const value = mergeWikipediaChambers(previous, normalized, buildId);
  emittedSources.push(...normalized.sources);
  prepared.push({ country, mode: country.mode, outputPath, value });

  const diagnosticSuffix = normalized.diagnostics.length
    ? ` (${normalized.diagnostics.join(', ')})`
    : '';
  process.stdout.write(
    `Prepared ${country.iso3}: +${normalized.missingChambers.length} chamber(s), ${normalized.chamberCompositions.length} composition fallback(s), ${normalized.chamberVisuals.length} colour set(s)${diagnosticSuffix}\n`,
  );
}

const uniqueEmittedSources = [
  ...new Map(emittedSources.map((source) => [source.id, source])).values(),
];
const mergedSources = mergeSourceRecords(
  existingSourceRegistry.sources,
  uniqueEmittedSources,
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
    stagedProfiles.push({
      country,
      outputPath,
      stagedPath,
      selected: Boolean(candidate),
    });
  }

  const stagedLegislatures = [];
  for (const country of legislatureConfig.countries) {
    const candidate = prepared.find(
      (entry) =>
        entry.mode === 'legislature' && entry.country.iso3 === country.iso3,
    );
    const outputPath = resolve(legislatureDirectory, `${country.iso3}.json`);
    const value = candidate?.value ?? (await readJsonIfPresent(outputPath));
    if (!value) {
      throw new Error(
        `Legislature ${country.iso3} has not been generated; run the IPU refresh first`,
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
    await writeFile(entry.outputPath, profileOutputs.get(entry.country.iso3));
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
