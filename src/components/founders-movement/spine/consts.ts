/**
 * Shared Founders Movement spine constants.
 *
 * Deliberately dependency-free: DOM-side components (the year odometer) import
 * these too, and must not drag three.js into the route-initial bundle.
 */
export const ROAD_LEN = 420;

/** Mile-marker years — the real journey, then the promise (2036 → 2076). */
export const YEARS = [2009, 2012, 2015, 2018, 2021, 2024, 2026, 2036, 2056, 2076];

/** Map overall scroll progress (0–1) to an interpolated "travel year". */
export function yearAt(p: number): number {
  const clamped = Math.min(1, Math.max(0, p));
  const idx = clamped * (YEARS.length - 1);
  const i = Math.min(YEARS.length - 2, Math.floor(idx));
  const t = idx - i;
  return Math.round(YEARS[i] + (YEARS[i + 1] - YEARS[i]) * t);
}
