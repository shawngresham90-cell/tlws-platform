import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';
import type { PlannedStop } from '@/lib/trip-planner/planned-stop';

/**
 * Where the Trip Planner leaves a chosen parking stop for the Navigator.
 *
 * Plumbing only. Every rule about whether a stop may still be used lives in
 * `lib/trip-planner/planned-stop.ts`; this file stores and returns a record
 * and decides nothing.
 *
 * ---------------------------------------------------------------------------
 * DEVICE-LOCAL, AND DELIBERATELY NOT A SYNC DOMAIN
 *
 * The four synced domains are fixed at `truck`, `route_prefs`, `hos_clocks`
 * and `onboarding`, and migration 050 enforces that with a CHECK constraint
 * rather than trusting callers to be careful. Adding a fifth here would be
 * rejected by the database, which is the right answer for a second reason
 * that outlives the constraint: a planned stop is a claim about the hours a
 * driver had on ONE device at ONE moment. Syncing it to a second device would
 * carry a stale window onto a screen with no way to know it was stale.
 *
 * So it stays on the device that planned it, and it expires on its own.
 *
 * ---------------------------------------------------------------------------
 * ONE SLOT, NOT A QUEUE
 *
 * Planning again replaces the record. A list of planned stops would need an
 * ordering rule, a staleness rule per entry and a way for a driver to reason
 * about which one the Navigator picked — three new ways to be wrong in
 * service of a case TP-1 does not have. One stop, most recently chosen.
 */

export const PLANNED_STOP_KEY = 'tlws-navigator-planned-stop-v1';
export const PLANNED_STOP_VERSION = 1;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Rebuild a record from storage, or refuse.
 *
 * Strict on purpose: a partially-written record is a record whose numbers
 * cannot be trusted, and the numbers are the entire reason a driver would
 * believe this stop is reachable. A single missing field drops the whole
 * thing, and the Navigator behaves as though no plan was made — which is a
 * state it already handles.
 */
function shapePlannedStop(payload: Record<string, unknown>): PlannedStop | null {
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (id === '' || name === '') return null;

  const pos = payload.position;
  if (typeof pos !== 'object' || pos === null) return null;
  const lat = num((pos as Record<string, unknown>).lat);
  const lng = num((pos as Record<string, unknown>).lng);
  if (lat === null || lng === null) return null;

  const arriveAtMs = num(payload.arriveAtMs);
  const clockLeftMin = num(payload.clockLeftMin);
  const detourMiles = num(payload.detourMiles);
  const detourMinutes = num(payload.detourMinutes);
  const plannedAtMs = num(payload.plannedAtMs);
  /*
   * A record written before fingerprints existed has none. It is dropped
   * rather than admitted with an empty one: an empty fingerprint would match
   * nothing and be refused on the next read anyway, and admitting it here
   * would mean one code path where "no fingerprint" silently means "inputs
   * unchanged" — the exact assumption this field exists to remove.
   */
  const inputsFingerprint =
    typeof payload.inputsFingerprint === 'string' && payload.inputsFingerprint !== ''
      ? payload.inputsFingerprint
      : null;
  if (inputsFingerprint === null) return null;
  if (
    arriveAtMs === null ||
    clockLeftMin === null ||
    detourMiles === null ||
    detourMinutes === null ||
    plannedAtMs === null
  ) {
    return null;
  }

  return {
    id,
    name,
    position: { lat, lng },
    arriveAtMs,
    clockLeftMin,
    detourMiles,
    detourMinutes,
    source: typeof payload.source === 'string' ? payload.source : '',
    plannedAtMs,
    inputsFingerprint,
  };
}

export function readPlannedStopRecord(): PlannedStop | null {
  const stored = readVersioned<PlannedStop>(
    PLANNED_STOP_KEY,
    PLANNED_STOP_VERSION,
    shapePlannedStop,
  );
  return stored.ok ? stored.value : null;
}

export function writePlannedStopRecord(stop: PlannedStop): void {
  writeVersioned(PLANNED_STOP_KEY, PLANNED_STOP_VERSION, {
    id: stop.id,
    name: stop.name,
    position: stop.position,
    arriveAtMs: stop.arriveAtMs,
    clockLeftMin: stop.clockLeftMin,
    detourMiles: stop.detourMiles,
    detourMinutes: stop.detourMinutes,
    source: stop.source,
    plannedAtMs: stop.plannedAtMs,
    inputsFingerprint: stop.inputsFingerprint,
  });
}

/**
 * Clear it. Called when the driver takes the stop (it has served its purpose),
 * when they dismiss it, and whenever it is refused — stale, or qualified
 * against clocks and a truck that have since moved. A record refused once will
 * be refused every time, and leaving it in place would re-offer the same dead
 * plan on every visit.
 *
 * Also called by the planner the moment any planning input changes, so a stop
 * stops being on offer at the instant it stops being true rather than at the
 * next read.
 */
export function clearPlannedStopRecord(): void {
  clearVersioned(PLANNED_STOP_KEY);
}
