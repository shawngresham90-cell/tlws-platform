/**
 * Test-only flexible-polyline ENCODER (2D, precision 5) so harnesses can
 * build HERE-shaped fixtures with arbitrary geometry. The production code
 * deliberately ships only the decoder (`src/lib/trip-planner/
 * flexible-polyline.ts`) — this platform never sends geometry to HERE — so
 * the encoder lives with the tests, and the maneuver harness round-trips
 * every fixture through the real decoder, which keeps the two in lockstep
 * with the published spec (github.com/heremaps/flexible-polyline).
 */

const ENCODING_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

function encodeUnsigned(value: number, out: string[]): void {
  let v = value;
  while (v >= 0x20) {
    out.push(ENCODING_TABLE[(v & 0x1f) | 0x20]);
    v = Math.floor(v / 32);
  }
  out.push(ENCODING_TABLE[v]);
}

function zigzagEncode(n: number): number {
  return n < 0 ? -2 * n - 1 : 2 * n;
}

/** Encode [lat, lng] tuples as a version-1, precision-5, 2D flexible polyline. */
export function encodeTestPolyline(coords: [number, number][]): string {
  const out: string[] = [];
  encodeUnsigned(1, out); // version
  encodeUnsigned(5, out); // header: precision 5, no third dimension
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of coords) {
    const scaledLat = Math.round(lat * 1e5);
    const scaledLng = Math.round(lng * 1e5);
    encodeUnsigned(zigzagEncode(scaledLat - prevLat), out);
    encodeUnsigned(zigzagEncode(scaledLng - prevLng), out);
    prevLat = scaledLat;
    prevLng = scaledLng;
  }
  return out.join('');
}
