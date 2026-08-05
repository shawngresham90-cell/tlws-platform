/**
 * Navigator truck-profile validation (milestone N8a) — the strict gate a
 * profile must pass before ANY route request may spend a provider
 * transaction. Stricter than the Trip Planner's adapter guard on purpose:
 * the planner falls back to a labeled estimate when routing declines, but
 * a NAVIGATION session has no such fallback — a wrong restriction here
 * becomes a truck under a low bridge. Anything implausible is rejected
 * with a structured, field-level reason; nothing is guessed or coerced.
 *
 * Pure (AD-2): data in, issues out. No I/O, no clock.
 */

import type { TruckProfile } from '@/lib/trip-planner/types';
import { TRUCK_LIMITS } from '@/lib/trip-planner/here-routing';

export type TruckValidationIssue = {
  field: string;
  code: string;
  /** Plain-language reason, safe to show a driver. */
  message: string;
};

/**
 * Legal-per-axle ceiling used for the impossibility cross-check, lbs.
 * Federal single-axle limit is 20,000 lbs; treating every axle as a full
 * single axle is deliberately GENEROUS — a profile that fails even this
 * bound cannot exist on a US highway.
 */
export const MAX_LBS_PER_AXLE = 20_000;

/** Combination vehicles (length beyond a straight truck) need ≥ 3 axles. */
export const COMBINATION_LENGTH_FT = 45;
/** Multi-trailer territory (doubles/triples) needs ≥ 5 axles. */
export const MULTI_TRAILER_LENGTH_FT = 85;

/**
 * DOT hazmat classes and the divisions that exist for each. A placard
 * that names a nonexistent division ("3.1", "2.4") is a data error, and
 * the Navigator refuses to route on invented restrictions.
 */
const HAZMAT_DIVISIONS: Record<string, string[]> = {
  '1': ['1', '2', '3', '4', '5', '6'],
  '2': ['1', '2', '3'],
  '3': [],
  '4': ['1', '2', '3'],
  '5': ['1', '2'],
  '6': ['1', '2'],
  '7': [],
  '8': [],
  '9': [],
};

function issue(field: string, code: string, message: string): TruckValidationIssue {
  return { field, code, message };
}

function checkRange(
  field: string,
  value: number,
  min: number,
  max: number,
  unit: string,
): TruckValidationIssue | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return issue(field, 'missing-or-not-a-number', `${field} is required and must be a number.`);
  }
  if (value < min || value > max) {
    return issue(
      field,
      'out-of-range',
      `${field} of ${value} ${unit} is outside the plausible range ${min}–${max} ${unit}.`,
    );
  }
  return null;
}

/** Validate a hazmat placard string. Null (no hazmat) is always valid. */
export function validateHazmatClass(hazmatClass: string | null): TruckValidationIssue[] {
  if (hazmatClass === null) return [];
  if (typeof hazmatClass !== 'string' || hazmatClass.trim() === '') {
    return [issue('hazmatClass', 'hazmat-empty', 'Hazmat class must be null or a DOT class.')];
  }
  const cls = hazmatClass.trim();
  const m = /^([1-9])(?:\.([0-9]))?$/.exec(cls);
  if (!m) {
    return [
      issue(
        'hazmatClass',
        'hazmat-format',
        `"${cls}" is not a DOT hazmat class (expected "1".."9", optionally with a division like "2.1").`,
      ),
    ];
  }
  const divisions = HAZMAT_DIVISIONS[m[1]];
  if (m[2] !== undefined && !divisions.includes(m[2])) {
    return [
      issue(
        'hazmatClass',
        'hazmat-division-invalid',
        `Class ${m[1]} has no division ${m[1]}.${m[2]} — the placard combination does not exist.`,
      ),
    ];
  }
  return [];
}

/**
 * Every check, structured. Empty array = the profile may be routed.
 * A non-empty array MUST prevent the provider request entirely.
 */
export function validateNavigatorTruckProfile(t: TruckProfile): TruckValidationIssue[] {
  const issues: TruckValidationIssue[] = [];

  const dims: [string, number, { min: number; max: number }, string][] = [
    ['heightFt', t.heightFt, TRUCK_LIMITS.heightFt, 'ft'],
    ['widthFt', t.widthFt, TRUCK_LIMITS.widthFt, 'ft'],
    ['lengthFt', t.lengthFt, TRUCK_LIMITS.lengthFt, 'ft'],
    ['grossWeightLbs', t.grossWeightLbs, TRUCK_LIMITS.grossWeightLbs, 'lbs'],
    ['axles', t.axles, TRUCK_LIMITS.axles, 'axles'],
  ];
  for (const [field, value, bounds, unit] of dims) {
    const bad = checkRange(field, value, bounds.min, bounds.max, unit);
    if (bad) issues.push(bad);
  }
  if (Number.isFinite(t.axles) && !Number.isInteger(t.axles)) {
    issues.push(issue('axles', 'axles-not-integer', 'Axle count must be a whole number.'));
  }

  // Cross-field impossibility (trailer-combination plausibility). Only
  // meaningful when the individual fields are themselves usable numbers.
  const numbersOk = issues.every((i) => i.code !== 'missing-or-not-a-number');
  if (numbersOk) {
    if (t.grossWeightLbs > t.axles * MAX_LBS_PER_AXLE) {
      issues.push(
        issue(
          'grossWeightLbs',
          'weight-exceeds-axle-capacity',
          `${t.grossWeightLbs} lbs on ${t.axles} axle(s) exceeds ${MAX_LBS_PER_AXLE} lbs per axle — no legal configuration carries this.`,
        ),
      );
    }
    if (t.lengthFt > COMBINATION_LENGTH_FT && t.axles < 3) {
      issues.push(
        issue(
          'axles',
          'combination-needs-axles',
          `A ${t.lengthFt} ft combination vehicle cannot run on ${t.axles} axles.`,
        ),
      );
    }
    if (t.lengthFt > MULTI_TRAILER_LENGTH_FT && t.axles < 5) {
      issues.push(
        issue(
          'axles',
          'multi-trailer-needs-axles',
          `A ${t.lengthFt} ft multi-trailer combination cannot run on ${t.axles} axles.`,
        ),
      );
    }
  }

  issues.push(...validateHazmatClass(t.hazmatClass));
  return issues;
}
