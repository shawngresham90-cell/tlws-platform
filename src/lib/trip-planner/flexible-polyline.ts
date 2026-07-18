/**
 * Decoder for HERE's "flexible polyline" encoding (the geometry format the
 * Routing API v8 returns). Pure and dependency-free so it is fully
 * offline-testable against the reference vectors from the published spec
 * (github.com/heremaps/flexible-polyline, Apache-2.0 algorithm spec).
 *
 * Only decoding is implemented — this platform never sends geometry to HERE.
 */

const ENCODING_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const DECODING_TABLE = new Map<string, number>(
  Array.from(ENCODING_TABLE, (c, i) => [c, i] as [string, number]),
);

export type DecodedPolyline = {
  precision: number;
  thirdDim: number;
  thirdDimPrecision: number;
  /** [lat, lng] or [lat, lng, thirdDim] tuples. */
  positions: number[][];
};

/** Little-endian varint stream of 5-bit chunks (bit 6 = continuation). */
function decodeUnsignedValues(encoded: string): number[] {
  const values: number[] = [];
  let result = 0;
  let shift = 0;
  for (const char of encoded) {
    const value = DECODING_TABLE.get(char);
    if (value === undefined) throw new Error('invalid character in polyline');
    // Multiplication (not <<) — coordinates routinely exceed 32-bit range.
    result += (value & 0x1f) * Math.pow(2, shift);
    if ((value & 0x20) === 0) {
      values.push(result);
      result = 0;
      shift = 0;
    } else {
      shift += 5;
    }
  }
  if (shift > 0) throw new Error('truncated polyline');
  return values;
}

function zigzagDecode(n: number): number {
  return n % 2 === 1 ? -(n + 1) / 2 : n / 2;
}

/** Decode a flexible polyline string into positions. Throws on malformed input. */
export function decodeFlexiblePolyline(encoded: string): DecodedPolyline {
  const values = decodeUnsignedValues(encoded);
  if (values.length < 2) throw new Error('polyline too short');
  const version = values[0];
  if (version !== 1) throw new Error(`unsupported polyline version ${version}`);
  const header = values[1];
  const precision = header & 15;
  const thirdDim = (header >> 4) & 7;
  const thirdDimPrecision = (header >> 7) & 15;

  const dims = thirdDim > 0 ? 3 : 2;
  const factor = Math.pow(10, precision);
  const thirdFactor = Math.pow(10, thirdDimPrecision);

  const positions: number[][] = [];
  let lat = 0;
  let lng = 0;
  let z = 0;
  for (let i = 2; i + dims - 1 < values.length; i += dims) {
    lat += zigzagDecode(values[i]);
    lng += zigzagDecode(values[i + 1]);
    if (dims === 3) {
      z += zigzagDecode(values[i + 2]);
      positions.push([lat / factor, lng / factor, z / thirdFactor]);
    } else {
      positions.push([lat / factor, lng / factor]);
    }
  }
  return { precision, thirdDim, thirdDimPrecision, positions };
}
