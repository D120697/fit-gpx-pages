import gcoord from 'gcoord';
import type { CoordSystem, FitPreservedData, TrackPoint } from './fit';

const COORDINATE_MAP = {
  WGS84: gcoord.WGS84,
  GCJ02: gcoord.GCJ02,
  BD09: gcoord.BD09,
} as const;

const SEMICIRCLE_TO_DEGREE = 180 / 2147483648;
const COORDINATE_KEY_PAIRS = [
  ['position_lat', 'position_long'],
  ['start_position_lat', 'start_position_long'],
  ['end_position_lat', 'end_position_long'],
  ['nec_lat', 'nec_long'],
  ['swc_lat', 'swc_long'],
] as const;

function normalizeCoordinate(value: number, axis: 'lat' | 'lon') {
  const limit = axis === 'lat' ? 90 : 180;

  if (Math.abs(value) <= limit) {
    return value;
  }

  return value * SEMICIRCLE_TO_DEGREE;
}

function convertCoordinatePair(lon: number, lat: number, sourceCoord: CoordSystem) {
  if (sourceCoord === 'WGS84') {
    return [lon, lat] as const;
  }

  const [convertedLon, convertedLat] = gcoord.transform(
    [lon, lat],
    COORDINATE_MAP[sourceCoord],
    COORDINATE_MAP.WGS84,
  );

  return [convertedLon, convertedLat] as const;
}

function deepConvertFitData(value: unknown, sourceCoord: CoordSystem): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepConvertFitData(item, sourceCoord));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, deepConvertFitData(child, sourceCoord)]),
  ) as Record<string, unknown>;

  for (const [latKey, lonKey] of COORDINATE_KEY_PAIRS) {
    const latValue = record[latKey];
    const lonValue = record[lonKey];

    if (typeof latValue !== 'number' || typeof lonValue !== 'number') {
      continue;
    }

    const normalizedLat = normalizeCoordinate(latValue, 'lat');
    const normalizedLon = normalizeCoordinate(lonValue, 'lon');
    const [convertedLon, convertedLat] = convertCoordinatePair(normalizedLon, normalizedLat, sourceCoord);

    record[latKey] = convertedLat;
    record[lonKey] = convertedLon;
  }

  return record;
}

export function convertTrackPointsToWgs84(points: TrackPoint[], sourceCoord: CoordSystem): TrackPoint[] {
  if (sourceCoord === 'WGS84') {
    return points;
  }

  return points.map((point) => {
    const [lon, lat] = convertCoordinatePair(point.lon, point.lat, sourceCoord);

    return {
      ...point,
      lat,
      lon,
    };
  });
}

export function convertPreservedFitDataToWgs84(
  preservedData: FitPreservedData,
  sourceCoord: CoordSystem,
): FitPreservedData {
  if (sourceCoord === 'WGS84') {
    return preservedData;
  }

  return deepConvertFitData(preservedData, sourceCoord) as FitPreservedData;
}
