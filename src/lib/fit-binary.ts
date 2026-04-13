import { Decoder, Encoder, Stream } from '@garmin/fitsdk';
import gcoord from 'gcoord';
import type { CoordSystem } from './fit';

const COORDINATE_MAP = {
  WGS84: gcoord.WGS84,
  GCJ02: gcoord.GCJ02,
  BD09: gcoord.BD09,
} as const;

const SEMICIRCLES_PER_DEGREE = 2147483648 / 180;
const RAW_COORDINATE_KEY_PAIRS = [
  ['positionLat', 'positionLong'],
  ['startPositionLat', 'startPositionLong'],
  ['endPositionLat', 'endPositionLong'],
  ['necLat', 'necLong'],
  ['swcLat', 'swcLong'],
] as const;

type FitMessage = Record<string, unknown> & {
  developerFields?: Record<number, unknown>;
};

function semicirclesToDegrees(value: number) {
  return value / SEMICIRCLES_PER_DEGREE;
}

function degreesToSemicircles(value: number) {
  return Math.round(value * SEMICIRCLES_PER_DEGREE);
}

function isValidCoordinate(lat: number, lon: number) {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && Math.abs(lat) <= 90
    && Math.abs(lon) <= 180;
}

function convertRawCoordinatePair(latValue: number, lonValue: number, sourceCoord: CoordSystem) {
  const lat = semicirclesToDegrees(latValue);
  const lon = semicirclesToDegrees(lonValue);

  if (!isValidCoordinate(lat, lon) || sourceCoord === 'WGS84') {
    return [latValue, lonValue] as const;
  }

  const [convertedLon, convertedLat] = gcoord.transform(
    [lon, lat],
    COORDINATE_MAP[sourceCoord],
    COORDINATE_MAP.WGS84,
  );

  return [degreesToSemicircles(convertedLat), degreesToSemicircles(convertedLon)] as const;
}

function convertMessageCoordinates(message: FitMessage, sourceCoord: CoordSystem) {
  if (sourceCoord === 'WGS84') {
    return message;
  }

  const nextMessage: FitMessage = { ...message };

  for (const [latKey, lonKey] of RAW_COORDINATE_KEY_PAIRS) {
    const latValue = nextMessage[latKey];
    const lonValue = nextMessage[lonKey];

    if (typeof latValue !== 'number' || typeof lonValue !== 'number') {
      continue;
    }

    const [convertedLat, convertedLon] = convertRawCoordinatePair(latValue, lonValue, sourceCoord);

    nextMessage[latKey] = convertedLat;
    nextMessage[lonKey] = convertedLon;
  }

  return nextMessage;
}

function createDecoder(buffer: ArrayBuffer) {
  return new Decoder(Stream.fromArrayBuffer(buffer.slice(0)));
}

function getFirstErrorMessage(errors: Error[]) {
  return errors.find(Boolean)?.message;
}

export async function convertFitFileToWgs84(file: File, sourceCoord: CoordSystem): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();

  if (sourceCoord === 'WGS84') {
    return new Uint8Array(buffer.slice(0));
  }

  const validationDecoder = createDecoder(buffer);

  if (!validationDecoder.isFIT()) {
    throw new Error('这不是合法的 FIT 文件。');
  }

  if (!validationDecoder.checkIntegrity()) {
    throw new Error('FIT 文件 CRC 校验失败，文件可能已损坏。');
  }

  const encoder = new Encoder();
  const decoder = createDecoder(buffer);
  const { errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    includeUnknownData: false,
    mergeHeartRates: false,
    decodeMemoGlobs: false,
    mesgListener: (mesgNum, mesg) => {
      encoder.onMesg(mesgNum, convertMessageCoordinates(mesg, sourceCoord));
    },
    fieldDescriptionListener: (key, developerDataIdMesg, fieldDescriptionMesg) => {
      encoder.addDeveloperField(key, developerDataIdMesg, fieldDescriptionMesg);
    },
  });

  const firstErrorMessage = getFirstErrorMessage(errors);

  if (firstErrorMessage) {
    throw new Error(`FIT 重编码失败：${firstErrorMessage}`);
  }

  return encoder.close();
}