import type { CoordSystem, TrackPoint } from './fit';

interface BuildGpxOptions {
  points: TrackPoint[];
  trackName: string;
  originalCoordSystem: CoordSystem;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildTrackExtensions(point: TrackPoint) {
  const parts: string[] = [];

  if (point.heartRate != null) {
    parts.push(`<gpxtpx:hr>${Math.round(point.heartRate)}</gpxtpx:hr>`);
  }

  if (point.cadence != null) {
    parts.push(`<gpxtpx:cad>${Math.round(point.cadence)}</gpxtpx:cad>`);
  }

  if (!parts.length) {
    return '';
  }

  return `<extensions><gpxtpx:TrackPointExtension>${parts.join('')}</gpxtpx:TrackPointExtension></extensions>`;
}

export function buildGpx({ points, trackName, originalCoordSystem }: BuildGpxOptions) {
  const createdAt = points[0]?.time ?? new Date().toISOString();
  const trackPointsXml = points
    .map((point) => {
      const ele = point.ele != null ? `<ele>${point.ele.toFixed(2)}</ele>` : '';
      const time = point.time ? `<time>${escapeXml(point.time)}</time>` : '';
      const extensions = buildTrackExtensions(point);

      return `<trkpt lat="${point.lat.toFixed(7)}" lon="${point.lon.toFixed(7)}">${ele}${time}${extensions}</trkpt>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
  creator="FIT to GPX Converter"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
  <metadata>
    <name>${escapeXml(trackName)}</name>
    <time>${escapeXml(createdAt)}</time>
    <desc>Generated in browser. Source coordinate system: ${escapeXml(originalCoordSystem)}. Output coordinate system: WGS84.</desc>
  </metadata>
  <trk>
    <name>${escapeXml(trackName)}</name>
    <type>activity</type>
    <trkseg>${trackPointsXml}</trkseg>
  </trk>
</gpx>`;
}
