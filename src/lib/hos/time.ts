/**
 * Minute-precision time helpers for the HOS calculator. The engine works in
 * integer minutes ONLY — decimal hours are banned from core calculations
 * (7 h 30 min = 450 min, never 7.5).
 */

/**
 * Parse "H", "H:MM" or "HH:MM" into minutes. Returns null on anything else
 * (fail closed — callers must refuse, never guess).
 */
export function parseHM(value: string): number | null {
  const m = /^(\d{1,3})(?::([0-5]?\d))?$/.exec(String(value).trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const total = h * 60 + min;
  return Number.isFinite(total) ? total : null;
}

/** Format minutes as "H:MM" (negative values keep their sign). */
export function formatHM(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(minutes));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** True for a non-negative finite integer minute count. */
export function isValidMinutes(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}
