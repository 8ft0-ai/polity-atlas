import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WikipediaClient } from './client.mjs';
import { WikidataClient } from '../wikidata/client.mjs';
import {
  discoverAllPartyIdentities,
  validatePartyDiscovery,
} from './party-identity.mjs';
import { associatePreparedParties } from './party-association.mjs';
import {
  acquireLinkedPartySnapshot,
  normalizeLinkedPartySnapshot,
} from './party-acquisition.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cacheRoot = resolve(root, '.cache/wikipedia');

function argument(name) {
  return process.argv
    .find((value) => value.startsWith('--' + name + '='))
    ?.slice(name.length + 3);
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
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

const iso3 = argument('country')?.toUpperCase();
if (!iso3 || !/^[A-Z]{3}$/.test(iso3)) {
  throw new Error('Pass exactly one valid --country=ISO3');
}

const fromCache = process.argv.includes('--from-cache');
const sourcePath = resolve(cacheRoot, iso3 + '.json');
const acquisitionPath = resolve(cacheRoot, 'parties', iso3 + '.json');
const preparedPath = resolve(cacheRoot, 'parties', 'prepared', iso3 + '.json');
const reviewPath = resolve(cacheRoot, 'parties', 'review', iso3 + '.json');
const discoveryPath = resolve(
  cacheRoot,
  'parties',
  'discovery',
  iso3 + '.json',
);

const sourceSnapshot = await readJson(sourcePath);
if (sourceSnapshot.requestedCountry?.iso3 !== iso3) {
  throw new Error('Cached chamber snapshot country does not match --country');
}
const client = new WikipediaClient();
const acquired = fromCache
  ? await readJson(acquisitionPath)
  : await acquireLinkedPartySnapshot(sourceSnapshot, client);
const country = await readJsonIfPresent(
  resolve(root, 'public/data/countries', iso3 + '.json'),
);
const legislature = country
  ? undefined
  : await readJsonIfPresent(
      resolve(root, 'public/data/legislatures', iso3 + '.json'),
    );
const publishedProfile = country ?? legislature;
if (!publishedProfile) {
  throw new Error('No reviewed country or legislature profile for ' + iso3);
}
const aliasRegistry = await readJson(
  resolve(root, 'packages/data-pipeline/config/party-aliases.json'),
);
if (aliasRegistry.schemaVersion !== 1) {
  throw new Error('PARTY_ALIAS_REGISTRY_INVALID');
}
const discovery = fromCache
  ? await readJsonIfPresent(discoveryPath)
  : await discoverAllPartyIdentities(
      sourceSnapshot,
      publishedProfile,
      client,
      new WikidataClient(),
      { mappings: aliasRegistry.mappings },
    );
if (discovery)
  validatePartyDiscovery(sourceSnapshot, publishedProfile, discovery);
const prepared = normalizeLinkedPartySnapshot(
  sourceSnapshot,
  acquired,
  discovery,
);
const sourceRegistry = await readJson(
  resolve(root, 'public/data/sources.json'),
);
const review = associatePreparedParties(
  publishedProfile,
  acquired,
  prepared,
  sourceRegistry,
  [],
  discovery,
);

// No public data, source registry or manifest is changed by this command.
// Validate all cross-references before writing any local cache previews.
if (!fromCache) {
  await writeJson(acquisitionPath, acquired);
  await writeJson(discoveryPath, discovery);
}
await writeJson(preparedPath, prepared);
await writeJson(reviewPath, review);
process.stdout.write(
  'Prepared ' +
    prepared.profiles.length +
    ' exact linked party profile(s) for ' +
    iso3 +
    ' (' +
    prepared.diagnostics.length +
    ' acquisition diagnostic(s); ' +
    review.profile.parties.length +
    ' source-linked parties; ' +
    review.diagnostics.length +
    ' association diagnostic(s))\n',
);
