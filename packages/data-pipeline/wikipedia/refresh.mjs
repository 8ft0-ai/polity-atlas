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
const configPath = resolve(
  repositoryRoot,
  'packages/data-pipeline/config/pilot-countries.json',
);
const profileDirectory = resolve(repositoryRoot, 'public/data/countries');
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

async function fetchSnapshot(client, country, retrievedAt) {
  const base = await client.fetchParliamentSnapshot(country, retrievedAt);
  if (!base.parliamentPage) return base;

  const houseLinks = extractHouseLinks(parseInfobox(base.parliamentPage.html));
  const uniqueTitles = [
    ...new Set(houseLinks.map((link) => link.title).filter(Boolean)),
  ];
  const chamberPages = [];
  for (const requestedTitle of uniqueTitles) {
    const page = await client.fetchPageWithHtml(requestedTitle);
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
const config = await readJson(configPath);
const countries = onlyIso3
  ? config.countries.filter((country) => country.iso3 === onlyIso3)
  : config.countries;
if (onlyIso3 && !countries.length) {
  throw new Error(`Unknown configured country: ${onlyIso3}`);
}

const client = new WikipediaClient();
const existingSourceRegistry = await readJson(sourcesPath);
const emittedSources = [];
const preparedProfiles = [];

for (const country of countries) {
  const snapshotPath = resolve(cacheDirectory, `${country.iso3}.json`);
  const snapshot = fromCache
    ? await readJson(snapshotPath)
    : await fetchSnapshot(client, country, retrievedAt);
  if (!fromCache) await writeJson(snapshotPath, snapshot);

  const profilePath = resolve(profileDirectory, `${country.iso3}.json`);
  const previousProfile = await readJson(profilePath);
  const normalized = normalizeWikipediaParliament(snapshot, previousProfile);
  const profile = mergeWikipediaChambers(previousProfile, normalized, buildId);
  emittedSources.push(...normalized.sources);
  preparedProfiles.push({ country, profilePath, profile });

  const diagnosticSuffix = normalized.diagnostics.length
    ? ` (${normalized.diagnostics.join(', ')})`
    : '';
  process.stdout.write(
    `Prepared ${country.iso3}: +${normalized.missingChambers.length} chamber(s)${diagnosticSuffix}\n`,
  );
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
  const untouchedProfiles = [];
  for (const country of config.countries) {
    const prepared = preparedProfiles.find(
      (candidate) => candidate.country.iso3 === country.iso3,
    );
    const profilePath = resolve(profileDirectory, `${country.iso3}.json`);
    const profile = prepared?.profile ?? (await readJson(profilePath));
    const stagedPath = resolve(
      stagingDirectory,
      'countries',
      `${country.iso3}.json`,
    );
    await writeJson(stagedPath, profile);
    if (prepared) {
      stagedProfiles.push({ ...prepared, stagedPath });
    } else {
      untouchedProfiles.push({ country, profilePath, stagedPath });
    }
  }

  const stagedSourcesPath = resolve(stagingDirectory, 'sources.json');
  await writeJson(stagedSourcesPath, {
    schemaVersion: 1,
    sources: mergedSources,
  });

  const allStagedProfiles = [...stagedProfiles, ...untouchedProfiles];
  await execFileAsync(formatterPath, [
    ...allStagedProfiles.map(({ stagedPath }) => stagedPath),
    stagedSourcesPath,
  ]);

  const manifestProfiles = [];
  const profileOutputs = new Map();
  for (const prepared of allStagedProfiles) {
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
    schemaVersion: 4,
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
