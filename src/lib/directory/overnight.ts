/**
 * Overnight truth — the single vocabulary every surface shares (M3, 2026-07-29).
 *
 * `locations.overnight_status` (migration 047) is the ONLY authority for a
 * driver-facing overnight claim. The legacy `overnight_parking` boolean was
 * set by imports that carried no evidence, so it can never produce a
 * confirmed claim: the 330 unreviewed `csv-import` rows read "unknown"
 * until a reviewed source upgrades them (Option A, owner-approved
 * 2026-07-29 — accuracy over the higher number).
 *
 * Rules, applied identically everywhere:
 *   confirmed  → "Overnight confirmed"    (evidence + provenance recorded)
 *   prohibited → "Overnight prohibited"   (explicit statute/policy wording)
 *   unknown / NULL / unrecognized → "Overnight unknown"
 *
 * Unknown never silently becomes confirmed. Prohibited never satisfies a
 * confirmed-overnight filter. Unknown rows may still appear in general
 * parking results when they otherwise qualify — labeled honestly.
 */

export type OvernightStatus = 'confirmed' | 'prohibited' | 'unknown';

export type OvernightLabel = 'Overnight confirmed' | 'Overnight prohibited' | 'Overnight unknown';

/**
 * Chip text emitted onto `DirectoryEntry.amenities`. Unknown emits NO chip —
 * absence is not a claim — and surfaces that show an explicit state render
 * the "Overnight unknown" label instead.
 */
export const OVERNIGHT_CONFIRMED_CHIP = 'Overnight confirmed';
export const OVERNIGHT_PROHIBITED_CHIP = 'Overnight prohibited';

/** Any input (DB text, JSON, undefined) → the three-way union, fail-safe. */
export function normalizeOvernightStatus(value: unknown): OvernightStatus {
  return value === 'confirmed' || value === 'prohibited' ? value : 'unknown';
}

export function overnightLabelFor(status: unknown): OvernightLabel {
  const s = normalizeOvernightStatus(status);
  if (s === 'confirmed') return 'Overnight confirmed';
  if (s === 'prohibited') return 'Overnight prohibited';
  return 'Overnight unknown';
}

/** Chip for the amenities array, or null when the status makes no claim. */
export function overnightChipFor(status: unknown): string | null {
  const s = normalizeOvernightStatus(status);
  if (s === 'confirmed') return OVERNIGHT_CONFIRMED_CHIP;
  if (s === 'prohibited') return OVERNIGHT_PROHIBITED_CHIP;
  return null;
}

/** The ONLY predicate that may gate a "confirmed overnight" experience. */
export function isConfirmedOvernight(status: unknown): boolean {
  return normalizeOvernightStatus(status) === 'confirmed';
}

/** Explicitly disallowed — used to keep prohibited rows out of overnight results. */
export function isProhibitedOvernight(status: unknown): boolean {
  return normalizeOvernightStatus(status) === 'prohibited';
}
