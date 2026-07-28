/**
 * Zero-parking disclosure for directory detail pages.
 *
 * Some operators report a location with ZERO truck-parking spaces (for
 * example a fuel-only Travel Stop). Such a location may appear in the
 * directory as a real place, but the page must never imply that a driver
 * can park or rest there. These helpers are the single source of truth for
 * how the detail page states truck-parking capacity.
 */

/** True only for an operator-confirmed, finite count of exactly zero. */
export function isOperatorReportedZeroParking(spaces: unknown): boolean {
  return typeof spaces === 'number' && Number.isFinite(spaces) && spaces === 0;
}

/**
 * The value shown for the "Truck parking" fact.
 * - null/undefined/non-finite → null (fact is omitted entirely: unknown is
 *   never displayed as a number, and never as "none").
 * - 0 → explicit no-parking wording instead of a bare "0".
 * - positive → the count as text.
 */
export function truckParkingFactValue(spaces: unknown): string | null {
  if (typeof spaces !== 'number' || !Number.isFinite(spaces)) return null;
  if (spaces === 0) return 'None reported by the operator';
  if (spaces < 0) return null;
  return String(spaces);
}

/** Copy for the visible no-parking notice on the detail page. */
export const ZERO_PARKING_NOTICE =
  'The operator reports no truck parking at this location. Do not plan a rest break or overnight stop here.';
