import type { Geometry, Position } from 'geojson';

export const ROBINSON_VIEWBOX_WIDTH = 1000;
export const ROBINSON_VIEWBOX_HEIGHT = 520;

const ROBINSON_PADDING = 16;
const ROBINSON_X_SCALE = 0.8487;
const ROBINSON_Y_SCALE = 1.3523;

const X_COEFFICIENTS = [
  1, 0.9986, 0.9954, 0.99, 0.9822, 0.973, 0.96, 0.9427, 0.9216, 0.8962,
  0.8679, 0.835, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322,
] as const;

const Y_COEFFICIENTS = [
  0, 0.062, 0.124, 0.186, 0.248, 0.31, 0.372, 0.434, 0.4958, 0.5571,
  0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1,
] as const;

type LonLat = [number, number];

function interpolate(values: readonly number[], latitude: number) {
  const absoluteLatitude = Math.min(90, Math.abs(latitude));
  if (absoluteLatitude === 90) return values[values.length - 1];

  const index = Math.floor(absoluteLatitude / 5);
  const fraction = (absoluteLatitude - index * 5) / 5;
  return values[index] + (values[index + 1] - values[index]) * fraction;
}

export function projectRobinson(longitude: number, latitude: number): LonLat {
  const xCoefficient = interpolate(X_COEFFICIENTS, latitude);
  const yCoefficient = interpolate(Y_COEFFICIENTS, latitude);

  const longitudeRadians = (longitude * Math.PI) / 180;
  const hemisphere = latitude < 0 ? -1 : 1;
  const rawX = ROBINSON_X_SCALE * longitudeRadians * xCoefficient;
  const rawY = ROBINSON_Y_SCALE * yCoefficient * hemisphere;

  const maximumX = ROBINSON_X_SCALE * Math.PI;
  const maximumY = ROBINSON_Y_SCALE;
  const availableWidth = ROBINSON_VIEWBOX_WIDTH - ROBINSON_PADDING * 2;
  const availableHeight = ROBINSON_VIEWBOX_HEIGHT - ROBINSON_PADDING * 2;
  const scale = Math.min(
    availableWidth / (maximumX * 2),
    availableHeight / (maximumY * 2),
  );

  return [
    ROBINSON_VIEWBOX_WIDTH / 2 + rawX * scale,
    ROBINSON_VIEWBOX_HEIGHT / 2 - rawY * scale,
  ];
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
      ([longitude, latitude]) =>
        [longitude + shift * 360, latitude] as LonLat,
    );
    const leftClipped = clipAgainstLongitude(shifted, -180, true);
    const fullyClipped = clipAgainstLongitude(leftClipped, 180, false);

    if (fullyClipped.length >= 3) clippedRings.push(fullyClipped);
  }

  return clippedRings;
}

function pathForRing(ring: LonLat[]) {
  const projected = ring.map(([longitude, latitude]) =>
    projectRobinson(longitude, latitude),
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

export function geometryToRobinsonPath(geometry: Geometry) {
  if (geometry.type === 'Polygon') {
    return polygonPath(geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(polygonPath).join('');
  }

  return '';
}

function createSpherePath() {
  const coordinates: LonLat[] = [];

  for (let latitude = -90; latitude <= 90; latitude += 3) {
    coordinates.push([-180, latitude]);
  }

  for (let latitude = 90; latitude >= -90; latitude -= 3) {
    coordinates.push([180, latitude]);
  }

  return pathForRing(coordinates);
}

export const ROBINSON_SPHERE_PATH = createSpherePath();
