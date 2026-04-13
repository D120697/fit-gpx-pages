import gcoord from 'gcoord';
import type { CoordSystem, TrackPoint } from './fit';

const COORDINATE_MAP = {
  WGS84: gcoord.WGS84,
  GCJ02: gcoord.GCJ02,
  BD09: gcoord.BD09,
} as const;

export function convertTrackPointsToWgs84(points: TrackPoint[], sourceCoord: CoordSystem): TrackPoint[] {
  if (sourceCoord === 'WGS84') {
    return points;
  }

  return points.map((point) => {
    const [lon, lat] = gcoord.transform(
      [point.lon, point.lat],
      COORDINATE_MAP[sourceCoord],
      COORDINATE_MAP.WGS84,
    );

    return {
      ...point,
      lat,
      lon,
    };
  });
}
