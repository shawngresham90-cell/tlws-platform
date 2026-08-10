/**
 * Driver-facing US unit formatting (pilot round 1). US drivers read "m"
 * as miles, so the production driver UI never shows meters: distances
 * under a tenth of a mile display as feet (rounded to 50 ft), everything
 * else as miles with one decimal. Pure functions, no locale machinery —
 * the driver UI is US-only (doc 03).
 */

export const FEET_PER_MILE = 5280;
const FEET_PER_METER = 3.280839895;

/**
 * "250 ft" / "800 ft" under 0.2 mi; "0.2 mi" / "1.4 mi" / "25.7 mi" at or
 * above. The feet cutover is 0.2 mi so every owner-approved example holds
 * (800 ft = 0.15 mi must display as feet); feet round to the nearest 50.
 */
export function formatDriverDistanceMi(mi: number | null | undefined): string {
  if (mi === null || mi === undefined || !Number.isFinite(mi) || mi < 0) return '—';
  if (mi < 0.2) {
    const ft = Math.max(50, Math.round((mi * FEET_PER_MILE) / 50) * 50);
    return `${ft} ft`;
  }
  return `${mi.toFixed(1)} mi`;
}

/** GPS accuracy for the status screen: meters in, feet out ("±80 ft"). */
export function formatAccuracyFt(accuracyM: number): string {
  if (!Number.isFinite(accuracyM) || accuracyM < 0) return '—';
  const ft = Math.max(10, Math.round((accuracyM * FEET_PER_METER) / 10) * 10);
  return `±${ft} ft`;
}

/**
 * Truck height the way a driver reads it off a bridge placard: 13.5 → "13′6″".
 * Inches round to the nearest whole inch and carry into feet at 12, so
 * 12.999 is "13′0″", never "12′12″". Prime marks, not quotes — the same
 * glyphs the placard uses.
 */
export function formatTruckHeightFtIn(heightFt: number): string {
  if (!Number.isFinite(heightFt) || heightFt < 0) return '—';
  let ft = Math.floor(heightFt);
  let inches = Math.round((heightFt - ft) * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return `${ft}′${inches}″`;
}
