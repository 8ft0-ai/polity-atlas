import type { Geometry, Position } from 'geojson';

export const MERCATOR_WORLD_SIZE = 1000;
export const MERCATOR_VIEWBOX_WIDTH = 1000;
export const MERCATOR_VIEWBOX_HEIGHT = 600;
export const MERCATOR_MAX_LATITUDE = 85.05112878;

type LonLat = [number, number];

function clampLatitude(latitude: number) {
  return Math.max(
    -MERCATOR_MAX_LATITUDE,
    Math.min(MERCATOR_MAX_LATITUDE, latitude),
  );
}

export function projectMercator(longitude: number, latitude: number): LonLat {
  const clampedLatitude = clampLatitude(latitude);
  const latitudeRadians = (clampedLatitude * Math.PI) / 180;
  const x = ((longitude + 180) / 360) * MERCATOR_WORLD_SIZE;
  const mercatorY = Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2));
  const y = (0.5 - mercatorY / (2 * Math.PI)) * MERCATOR_WORLD_SIZE;

  return [x, y];
}

function coordinatesMatch(left: Position, right: Position) {
  return left[0] === right[0] && left[1] === right[1];
}

function normaliseRing(ring: Position[]): LonLat[] {
  if (ring.length === 0) return [];

  const source =
    ring.length > 1 && coordinatesMatch(ring[0], ring[ring.length - 1])
      ? ring.slice(0, -1)
      : ring;

  if (source.length === 0) return [];

  const first: LonLat = [source[0][0] ?? 0, source[0][1] ?? 0];
  const unwrapped: LonLat[] = [first];
  let previousLongitude = first[0];

  for (const coordinate of source.slice(1)) {
    let longitude = coordinate[0] ?? 0;
    const latitude = coordinate[1] ?? 0;

    while (longitude - previousLongitude > 180) longitude -= 360;
    while (longitude - previousLongitude < -180) longitude += 360;

    unwrapped.push([longitude, latitude]);
    previousLongitude = longitude;
  }

  return unwrapped;
}

function longitudeIntersection(
  start: LonLat,
  end: LonLat,
  longitude: number,
): LonLat {
  const longitudeDelta = end[0] - start[0];
  if (longitudeDelta === 0) return [longitude, start[1]];

  const ratio = (longitude - start[0]) / longitudeDelta;
  return [longitude, start[1] + (end[1] - start[1]) * ratio];
}

function clipAgainstLongitude(
  points: LonLat[],
  boundary: number,
  keepGreater: boolean,
) {
  if (points.length === 0) return [];

  const output: LonLat[] = [];
  const isInside = (point: LonLat) =>
    keepGreater ? point[0] >= boundary : point[0] <= boundary;

  let previous = points[points.length - 1];
  let previousInside = isInside(previous);

  for (const current of points) {
    const currentInside = isInside(current);

    if (currentInside !== previousInside) {
      output.push(longitudeIntersection(previous, current, boundary));
    }

    if (currentInside) output.push(current);

    previous = current;
    previousInside = currentInside;
  }

  return output;
}

export function clipRingAtAntimeridian(ring: Position[]): LonLat[][] {
  const unwrapped = normaliseRing(ring);
  if (unwrapped.length < 3) return [];

  const longitudes = unwrapped.map(([longitude]) => longitude);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);

  const minimumShift = Math.ceil((-180 - maximumLongitude) / 360);
  const maximumShift = Math.floor((180 - minimumLongitude) / 360);
  const clippedRings: LonLat[][] = [];

  for (let shift = minimumShift; shift <= maximumShift; shift += 1) {
    const shifted = unwrapped.map(
      ([longitude, latitude]) => [longitude + shift * 360, latitude] as LonLat,
    );
    const leftClipped = clipAgainstLongitude(shifted, -180, true);
    const fullyClipped = clipAgainstLongitude(leftClipped, 180, false);

    if (fullyClipped.length >= 3) clippedRings.push(fullyClipped);
  }

  return clippedRings;
}

function pathForRing(ring: LonLat[]) {
  const projected = ring.map(([longitude, latitude]) =>
    projectMercator(longitude, latitude),
  );
  if (projected.length < 3) return '';

  const [firstX, firstY] = projected[0];
  const segments = projected
    .slice(1)
    .map(([x, y]) => `L${x.toFixed(2)},${y.toFixed(2)}`)
    .join('');

  return `M${firstX.toFixed(2)},${firstY.toFixed(2)}${segments}Z`;
}

function polygonPath(rings: Position[][]) {
  return rings
    .flatMap((ring) => clipRingAtAntimeridian(ring))
    .map(pathForRing)
    .join('');
}

export function geometryToMercatorPath(geometry: Geometry) {
  if (geometry.type === 'Polygon') {
    return polygonPath(geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(polygonPath).join('');
  }

  return '';
}

export function initialMercatorY(scale = 1) {
  return (MERCATOR_VIEWBOX_HEIGHT - MERCATOR_WORLD_SIZE * scale) / 2;
}
