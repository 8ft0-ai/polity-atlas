const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function fail(message) {
  throw new Error(`CURATED_OVERRIDE_INVALID: ${message}`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
}

function requireReviewDate(value, label) {
  requireString(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    fail(`${label} must be an ISO date`);
  }
}

function validatePath(path, label) {
  if (!Array.isArray(path) || path.length === 0) {
    fail(`${label} must be a non-empty path array`);
  }

  for (const segment of path) {
    const validSegment =
      (typeof segment === 'string' && segment.length > 0) ||
      (Number.isInteger(segment) && segment >= 0);
    if (!validSegment) {
      fail(`${label} contains an invalid path segment`);
    }
    if (typeof segment === 'string' && UNSAFE_PATH_SEGMENTS.has(segment)) {
      fail(`${label} contains an unsafe path segment`);
    }
  }
}

function validateOverride(override, index) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    fail(`overrides[${index}] must be an object`);
  }

  requireString(override.id, `overrides[${index}].id`);
  if (
    !override.target ||
    typeof override.target !== 'object' ||
    !/^[A-Z]{3}$/.test(override.target.iso3 ?? '') ||
    !['full', 'legislature'].includes(override.target.mode)
  ) {
    fail(`overrides[${index}].target must contain ISO3 and a valid mode`);
  }
  if (override.operation !== 'replace') {
    fail(`overrides[${index}].operation must be replace`);
  }
  validatePath(override.path, `overrides[${index}].path`);
  if (!Object.hasOwn(override, 'value')) {
    fail(`overrides[${index}].value is required`);
  }
  if (
    !Array.isArray(override.sourceIds) ||
    override.sourceIds.length === 0 ||
    override.sourceIds.some(
      (sourceId) => typeof sourceId !== 'string' || !sourceId.trim(),
    )
  ) {
    fail(`overrides[${index}].sourceIds must contain at least one source ID`);
  }
  requireString(override.reason, `overrides[${index}].reason`);
  requireString(override.author, `overrides[${index}].author`);
  requireString(override.reviewedBy, `overrides[${index}].reviewedBy`);
  requireReviewDate(override.reviewedAt, `overrides[${index}].reviewedAt`);
}

export function validateOverrideRegistry(registry) {
  if (
    !registry ||
    typeof registry !== 'object' ||
    registry.schemaVersion !== 1 ||
    !Array.isArray(registry.overrides)
  ) {
    fail('registry must use schemaVersion 1 and contain an overrides array');
  }

  const ids = new Set();
  registry.overrides.forEach((override, index) => {
    validateOverride(override, index);
    if (ids.has(override.id)) {
      fail(`duplicate override id: ${override.id}`);
    }
    ids.add(override.id);
  });

  return registry;
}

function matchesTarget(override, target) {
  return (
    override.target.iso3 === target.iso3 && override.target.mode === target.mode
  );
}

export function hasCuratedOverrides(registry, target) {
  validateOverrideRegistry(registry);
  return registry.overrides.some((override) => matchesTarget(override, target));
}

function replaceAtPath(value, override) {
  let parent = value;
  for (const segment of override.path.slice(0, -1)) {
    if (
      parent === null ||
      typeof parent !== 'object' ||
      !Object.hasOwn(parent, segment)
    ) {
      fail(`${override.id} targets a path that does not exist`);
    }
    parent = parent[segment];
  }

  const leaf = override.path.at(-1);
  if (
    parent === null ||
    typeof parent !== 'object' ||
    !Object.hasOwn(parent, leaf)
  ) {
    fail(`${override.id} targets a path that does not exist`);
  }
  parent[leaf] = structuredClone(override.value);
}

export function applyCuratedOverrides(
  value,
  registry,
  target,
  { knownSourceIds } = {},
) {
  validateOverrideRegistry(registry);
  const overrides = registry.overrides.filter((override) =>
    matchesTarget(override, target),
  );
  if (overrides.length === 0) return value;

  const output = structuredClone(value);
  for (const override of overrides) {
    if (knownSourceIds) {
      for (const sourceId of override.sourceIds) {
        if (!knownSourceIds.has(sourceId)) {
          fail(`${override.id} references unknown source ID ${sourceId}`);
        }
      }
    }
    replaceAtPath(output, override);
  }
  return output;
}
