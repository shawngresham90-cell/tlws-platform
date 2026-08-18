import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';
import type { ResumePlace, TripResumeRecord } from '@/lib/trip-planner/trip-resume';

/**
 * Where the Trip Planner keeps the context needed to CONTINUE a trip
 * after the driver rests at their planned stop (TP-5).
 *
 * Plumbing only. Every rule — freshness, the fresh-clocks gate, via
 * semantics, what ends a trip — lives in `lib/trip-planner/trip-resume.ts`;
 * this file stores and returns a record and decides nothing.
 *
 * DEVICE-LOCAL AND ONE SLOT, for the same reasons as the planned stop:
 * the four synced domains are fixed by a database CHECK constraint, and a
 * trip in progress on one device is not a claim about any other. One
 * record, most recently written — planning a new trip replaces it.
 *
 * STRICT SHAPE, FAIL-SOFT READ: a partially-written or hand-edited record
 * is dropped whole (never repaired), and the planner behaves as though no
 * trip was underway — a state it already handles. Note what the shape
 * does NOT include: no clocks, no limits, no schedules, no margins.
 * A record that somehow carried them would still parse to a shape without
 * them, so stale HOS arithmetic cannot round-trip through this store.
 */

export const TRIP_RESUME_KEY = 'tlws-trip-resume-v1';
export const TRIP_RESUME_VERSION = 1;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function place(v: unknown): ResumePlace | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  if (label === '') return null;
  const pos = o.position;
  if (typeof pos !== 'object' || pos === null) return null;
  const lat = num((pos as Record<string, unknown>).lat);
  const lng = num((pos as Record<string, unknown>).lng);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const country = o.country === 'US' || o.country === 'CA' ? o.country : null;
  return { label, position: { lat, lng }, country };
}

function shapeResumeRecord(payload: Record<string, unknown>): TripResumeRecord | null {
  const createdAtMs = num(payload.createdAtMs);
  if (createdAtMs === null || createdAtMs <= 0) return null;

  const stopPlace = place(payload.plannedStop);
  const stopId =
    typeof (payload.plannedStop as Record<string, unknown> | null | undefined)?.id === 'string'
      ? ((payload.plannedStop as Record<string, unknown>).id as string).trim()
      : '';
  if (stopPlace === null || stopId === '') return null;

  const destination = place(payload.originalDestination);
  if (destination === null) return null;

  let remainingVia: TripResumeRecord['remainingVia'] = null;
  if (payload.remainingVia !== null && payload.remainingVia !== undefined) {
    const viaPlace = place(payload.remainingVia);
    const via = payload.remainingVia as Record<string, unknown>;
    const dwellMin = num(via.dwellMin);
    // A via we cannot fully rebuild drops the WHOLE record, not just the
    // via: silently resuming without a stop the driver planned around is
    // a different trip than the one they saved.
    if (viaPlace === null || dwellMin === null || dwellMin < 0) return null;
    remainingVia = {
      ...viaPlace,
      dwellMin,
      dwellQualifiesForBreak: via.dwellQualifiesForBreak === true,
    };
  }

  return {
    createdAtMs,
    plannedStop: { ...stopPlace, id: stopId },
    originalDestination: destination,
    remainingVia,
  };
}

export function readTripResumeRecord(): TripResumeRecord | null {
  const stored = readVersioned<TripResumeRecord>(
    TRIP_RESUME_KEY,
    TRIP_RESUME_VERSION,
    shapeResumeRecord,
  );
  return stored.ok ? stored.value : null;
}

export function writeTripResumeRecord(record: TripResumeRecord): void {
  writeVersioned(TRIP_RESUME_KEY, TRIP_RESUME_VERSION, {
    createdAtMs: record.createdAtMs,
    plannedStop: record.plannedStop,
    originalDestination: record.originalDestination,
    remainingVia: record.remainingVia,
  });
}

/**
 * Forget the trip. Called when the trip completes at its destination,
 * when the driver explicitly ends it, when a new trip replaces it, and
 * whenever a stored record is refused — a record refused once will be
 * refused every time.
 */
export function clearTripResumeRecord(): void {
  clearVersioned(TRIP_RESUME_KEY);
}
