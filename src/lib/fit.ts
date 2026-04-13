import FitParser from 'fit-file-parser';

export type CoordSystem = 'WGS84' | 'GCJ02' | 'BD09';

export interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time: string;
  heartRate?: number;
  cadence?: number;
  distance?: number;
  speed?: number;
}

export interface FitSummary {
  sport?: string;
  startedAt?: string;
  endedAt?: string;
  totalDistanceKm?: number;
}

interface RawRecord {
  position_lat?: number;
  position_long?: number;
  altitude?: number;
  enhanced_altitude?: number;
  heart_rate?: number;
  cadence?: number;
  distance?: number;
  speed?: number;
  enhanced_speed?: number;
  timestamp: string;
}

interface FitParseLike {
  sport?: string;
  records?: RawRecord[];
  sessions?: Array<{
    total_distance?: number;
  }>;
}

const SEMICIRCLE_TO_DEGREE = 180 / 2147483648;

function normalizeCoordinate(value: number, axis: 'lat' | 'lon') {
  const limit = axis === 'lat' ? 90 : 180;

  if (Math.abs(value) <= limit) {
    return value;
  }

  return value * SEMICIRCLE_TO_DEGREE;
}

function toIsoString(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isValidCoordinate(lat: number, lon: number) {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && Math.abs(lat) <= 90
    && Math.abs(lon) <= 180;
}

export async function parseFitFile(file: File): Promise<{ points: TrackPoint[]; summary: FitSummary }> {
  const buffer = await file.arrayBuffer();
  const parser = new FitParser({
    force: true,
    mode: 'list',
    speedUnit: 'km/h',
    lengthUnit: 'km',
    elapsedRecordField: true,
  });

  const parsed = await parser.parseAsync(buffer) as FitParseLike;
  const records = Array.isArray(parsed.records) ? parsed.records : [];

  const points = records
    .filter((record) => record.position_lat != null && record.position_long != null)
    .map((record) => {
      const lat = normalizeCoordinate(record.position_lat as number, 'lat');
      const lon = normalizeCoordinate(record.position_long as number, 'lon');

      return {
        lat,
        lon,
        ele: record.enhanced_altitude ?? record.altitude,
        time: toIsoString(record.timestamp),
        heartRate: record.heart_rate,
        cadence: record.cadence,
        distance: record.distance,
        speed: record.enhanced_speed ?? record.speed,
      } satisfies TrackPoint;
    })
    .filter((point) => isValidCoordinate(point.lat, point.lon));

  const totalDistanceKm = parsed.sessions?.[0]?.total_distance
    ?? points.at(-1)?.distance;

  return {
    points,
    summary: {
      sport: parsed.sport,
      startedAt: points.at(0)?.time,
      endedAt: points.at(-1)?.time,
      totalDistanceKm,
    },
  };
}
