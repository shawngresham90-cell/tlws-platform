'use client';

import {
  routingFingerprint,
  NO_CONFIRMATION,
  type ConfirmationState,
  type EditableProfile,
} from '@/lib/navigator/truck-profile';
import {
  clearLegacySession,
  clearVersioned,
  readLegacySession,
  readVersioned,
  writeVersioned,
} from './versioned-storage';

/**
 * The confirmed truck, remembered on this device (pre-trip setup
 * milestone).
 *
 * WHAT MOVED, AND WHY. The record itself is unchanged — same key, same
 * `{v:1, profile, confirmed}` envelope, same rule that a stored
 * confirmation is only honoured when it still matches the stored values.
 * Two things changed around it:
 *
 *   1. It lives in localStorage, so a driver who closes the tab at a
 *      truck stop and reopens it in the morning still has the truck they
 *      verified. sessionStorage could not do that, and re-verifying a
 *      truck every visit is exactly the friction that gets a
 *      safety-critical screen skipped.
 *   2. The parsing and the writing moved OFF the driving screen into
 *      this module. That is what makes "corrupt clocks must not destroy a
 *      valid truck profile" a structural fact rather than a promise:
 *      three records, three parsers, three keys, no shared try/catch.
 *
 * MIGRATION. A driver mid-pilot has a truck in sessionStorage under this
 * same key. It is read once, re-written to localStorage, and the old copy
 * removed — so upgrading does not cost anyone the truck they already
 * confirmed. The version did not change because the SHAPE did not change;
 * only where it is kept did.
 *
 * THE CONFIRMATION RULE IS THE SAFETY PROPERTY. A stored fingerprint is
 * honoured only if it still equals `routingFingerprint(profile)`. A
 * record whose values were edited — by us, by a migration, by hand —
 * comes back UNCONFIRMED, and Start stays disabled until a human looks at
 * it again. Restoring a truck must never restore permission to route for
 * a truck nobody checked.
 */

export const TRUCK_PROFILE_KEY = 'tlws-navigator-truck-v1';
export const TRUCK_VERSION = 1;

export type StoredTruck = { profile: EditableProfile; confirmation: ConfirmationState };

/** The shape check, shared by the live record and the legacy one. */
function shapeTruck(payload: Record<string, unknown>): StoredTruck | null {
  if (payload.profile === null || typeof payload.profile !== 'object') return null;
  const p = payload.profile as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const heightFt = num(p.heightFt);
  const widthFt = num(p.widthFt);
  const lengthFt = num(p.lengthFt);
  const grossWeightLbs = num(p.grossWeightLbs);
  const axles = num(p.axles);
  if (
    heightFt === null ||
    widthFt === null ||
    lengthFt === null ||
    grossWeightLbs === null ||
    axles === null
  ) {
    return null;
  }
  const hazmatClass =
    p.hazmatClass === null || typeof p.hazmatClass === 'string'
      ? (p.hazmatClass as string | null)
      : null;
  const avoid = Array.isArray(p.avoid)
    ? p.avoid.filter((a): a is string => typeof a === 'string')
    : [];
  const profile: EditableProfile = {
    heightFt,
    widthFt,
    lengthFt,
    grossWeightLbs,
    axles,
    hazmatClass,
    avoid,
  };
  // A stored confirmation is only honoured when it still matches the
  // stored values — a tampered or partially written record re-asks.
  const confirmed = typeof payload.confirmed === 'string' ? payload.confirmed : null;
  return {
    profile,
    confirmation:
      confirmed !== null && confirmed === routingFingerprint(profile)
        ? { confirmedFingerprint: confirmed }
        : NO_CONFIRMATION,
  };
}

/**
 * The saved truck, or null for a driver who has never confirmed one.
 *
 * Checks localStorage first, then the sessionStorage record an earlier
 * build wrote — promoting it on the way past, so the migration happens
 * once and silently.
 */
export function readTruck(): StoredTruck | null {
  const current = readVersioned<StoredTruck>(TRUCK_PROFILE_KEY, TRUCK_VERSION, shapeTruck);
  if (current.ok) return current.value;
  const legacy = readLegacySession<StoredTruck>(TRUCK_PROFILE_KEY, TRUCK_VERSION, shapeTruck);
  if (!legacy.ok) return null;
  writeTruck(legacy.value.profile, legacy.value.confirmation);
  clearLegacySession(TRUCK_PROFILE_KEY);
  return legacy.value;
}

/** Save the truck and whatever confirmation currently stands for it. */
export function writeTruck(profile: EditableProfile, confirmation: ConfirmationState): void {
  writeVersioned(TRUCK_PROFILE_KEY, TRUCK_VERSION, {
    profile,
    confirmed: confirmation.confirmedFingerprint,
  });
}

/** Forget the truck. Nothing else is touched. */
export function clearTruck(): void {
  clearVersioned(TRUCK_PROFILE_KEY);
  clearLegacySession(TRUCK_PROFILE_KEY);
}
