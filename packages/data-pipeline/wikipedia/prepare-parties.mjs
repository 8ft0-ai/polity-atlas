import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WikipediaClient } from './client.mjs';
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

const sourceSnapshot = await readJson(sourcePath);
if (sourceSnapshot.requestedCountry?.iso3 !== iso3) {
  throw new Error('Cached chamber snapshot country does not match --country');
}
const acquired = fromCache
  ? await readJson(acquisitionPath)
  : await acquireLinkedPartySnapshot(sourceSnapshot, new WikipediaClient());
const prepared = normalizeLinkedPartySnapshot(sourceSnapshot, acquired);

// No public data files, source registry, or manifest are changed here.
if (!fromCache) await writeJson(acquisitionPath, acquired);
await writeJson(preparedPath, prepared);
process.stdout.write(
  'Prepared ' +
    prepared.profiles.length +
    ' exact linked party profile(s) for ' +
    iso3 +
    ' (' +
    prepared.diagnostics.length +
    ' diagnostic(s))\n',
);
