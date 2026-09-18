import { mkdir, writeFile } from 'node:fs/promises';

const VERSION = 'v5.1.2';
const ROOT =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/' +
  VERSION +
  '/geojson';

const outputRoot = new URL(
  '../../../public/data/geometry/lod/',
  import.meta.url,
);

async function load(name) {
  const response = await fetch(`${ROOT}/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${name}: ${response.status}`);
  }
  return response.json();
}

function minimalCountry(feature) {
  const p = feature.properties ?? {};
  return {
    type: 'Feature',
    properties: {
      name: p.NAME ?? p.ADMIN ?? p.NAME_LONG ?? 'Unknown',
      admin: p.ADMIN ?? null,
      adm0A3: p.ADM0_A3 ?? null,
      sovereign: p.SOVEREIGNT ?? null,
      sovereignA3: p.SOV_A3 ?? null,
      isoA3: p.ISO_A3 ?? null,
      isoN3: p.ISO_N3 ?? null,
      unA3: p.UN_A3 ?? null,
      type: p.TYPE ?? null,
    },
    geometry: feature.geometry,
  };
}

function minimalDisputedArea(feature, index) {
  const p = feature.properties ?? {};
  return {
    type: 'Feature',
    properties: {
      id: `ne-disputed-${index}`,
      name: p.BRK_NAME ?? p.NAME ?? `Disputed area ${index + 1}`,
      type: p.TYPE ?? p.featurecla ?? 'Disputed',
      note: p.NOTE_BRK ?? p.NOTE_ADM0 ?? null,
      admin: p.ADMIN ?? null,
      adminA3: p.ADM0_A3 ?? null,
      sovereign: p.SOVEREIGNT ?? null,
      sovereignA3: p.SOV_A3 ?? null,
      geounit: p.GEOUNIT ?? null,
    },
    geometry: feature.geometry,
  };
}

function minimalBoundary(feature, index) {
  const p = feature.properties ?? {};
  return {
    type: 'Feature',
    properties: {
      id: `ne-disputed-boundary-${index}`,
      name: p.BRK_NAME ?? p.NAME ?? p.NOTE ?? `Disputed boundary ${index + 1}`,
      class: p.FEATURECLA ?? null,
      note: p.NOTE ?? null,
    },
    geometry: feature.geometry,
  };
}

function minimalTinyCountry(feature, index) {
  const p = feature.properties ?? {};
  return {
    type: 'Feature',
    properties: {
      id: `ne-tiny-country-${index}`,
      name: p.NAME ?? p.ADMIN ?? p.NAME_LONG ?? 'Unknown',
      admin: p.ADMIN ?? null,
      adm0A3: p.ADM0_A3 ?? null,
      isoA3: p.ISO_A3 ?? null,
      isoN3: p.ISO_N3 ?? null,
      unA3: p.UN_A3 ?? null,
    },
    geometry: feature.geometry,
  };
}

function sqSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = sqTolerance;
    let index = 0;

    for (let i = first + 1; i < last; i += 1) {
      const distance = sqSegmentDistance(
        points[i],
        points[first],
        points[last],
      );
      if (distance > maxDistance) {
        index = i;
        maxDistance = distance;
      }
    }

    if (index) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, index) => markers[index]);
}

function simplifyGeometry(geometry, tolerance) {
  if (!geometry) return geometry;

  if (geometry.type === 'LineString') {
    return {
      ...geometry,
      coordinates: simplifyLine(geometry.coordinates, tolerance),
    };
  }
  if (geometry.type === 'MultiLineString') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((line) =>
        simplifyLine(line, tolerance),
      ),
    };
  }
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => {
        const simplified = simplifyLine(ring, tolerance);
        return simplified.length >= 4 ? simplified : ring;
      }),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => {
          const simplified = simplifyLine(ring, tolerance);
          return simplified.length >= 4 ? simplified : ring;
        }),
      ),
    };
  }

  return geometry;
}

function simplifyFeatureCollection(collection, tolerance) {
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      geometry: simplifyGeometry(feature.geometry, tolerance),
    })),
  };
}

async function writeJson(path, value) {
  await writeFile(new URL(path, outputRoot), JSON.stringify(value));
}

await mkdir(outputRoot, { recursive: true });

const [countries110, countries50, disputed50, boundaries50, tiny110, tiny50] =
  await Promise.all([
    load('ne_110m_admin_0_countries.geojson'),
    load('ne_50m_admin_0_countries.geojson'),
    load('ne_50m_admin_0_breakaway_disputed_areas.geojson'),
    load('ne_50m_admin_0_boundary_lines_disputed_areas.geojson'),
    load('ne_110m_admin_0_tiny_countries.geojson'),
    load('ne_50m_admin_0_tiny_countries.geojson'),
  ]);

const detailedDisputed = {
  type: 'FeatureCollection',
  features: disputed50.features.map(minimalDisputedArea),
};
const detailedBoundaries = {
  type: 'FeatureCollection',
  features: boundaries50.features.map(minimalBoundary),
};

const outputs = {
  '110m/countries.json': {
    type: 'FeatureCollection',
    features: countries110.features.map(minimalCountry),
  },
  '110m/disputed-areas.json': simplifyFeatureCollection(detailedDisputed, 0.22),
  '110m/disputed-boundaries.json': simplifyFeatureCollection(
    detailedBoundaries,
    0.22,
  ),
  '110m/tiny-countries.json': {
    type: 'FeatureCollection',
    features: tiny110.features.map(minimalTinyCountry),
  },
  '50m/countries.json': {
    type: 'FeatureCollection',
    features: countries50.features.map(minimalCountry),
  },
  '50m/disputed-areas.json': detailedDisputed,
  '50m/disputed-boundaries.json': detailedBoundaries,
  '50m/tiny-countries.json': {
    type: 'FeatureCollection',
    features: tiny50.features.map(minimalTinyCountry),
  },
};

for (const path of Object.keys(outputs)) {
  await mkdir(new URL(path.replace(/[^/]+$/, ''), outputRoot), {
    recursive: true,
  });
  await writeJson(path, outputs[path]);
}

await writeJson('manifest.json', {
  schemaVersion: 1,
  source: 'Natural Earth',
  sourceVersion: VERSION,
  generatedBy: 'packages/data-pipeline/map/build-lod.mjs',
  levels: {
    '110m': {
      countries: '110m/countries.json',
      disputedAreas: '110m/disputed-areas.json',
      disputedBoundaries: '110m/disputed-boundaries.json',
      tinyCountries: '110m/tiny-countries.json',
      disputedSource: '50m source simplified to overview tolerance',
    },
    '50m': {
      countries: '50m/countries.json',
      disputedAreas: '50m/disputed-areas.json',
      disputedBoundaries: '50m/disputed-boundaries.json',
      tinyCountries: '50m/tiny-countries.json',
      disputedSource: 'Natural Earth 50m',
    },
  },
});
