import type { LatLng } from '@/lib/map/bounds';
import type { DestinationFacility } from '@/lib/navigator/truck-entrance';
import type { ParkingChoice } from './plan-my-day';

/**
 * The handoff: one parking choice the driver picked in Plan My Day,
 * carried to the Navigator as a PLANNED WAYPOINT.
 *
 * Pure. No storage, no React, no clock — every timestamp arrives as an
 * argument. The storage half is `components/navigator/planned-stop-storage.ts`
 * and it contains no rules.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE RECORD AND NOT JUST A DESTINATION
 *
 * A planned stop is a different claim from a destination. A destination is
 * "where I am going". A planned stop is "where the planner said I could
 * legally stop, given the clocks I typed in at the time". The second claim
 * decays and the first does not, so they cannot share a shape without the
 * decay being lost.
 *
 * ---------------------------------------------------------------------------
 * WHY IT GOES STALE, AND WHY THAT IS THE WHOLE POINT
 *
 * The choice was qualified against a driving window computed from clocks the
 * driver entered at a moment in time. Hours later those clocks are wrong by
 * exactly the time that has passed, and the stop that "fits inside your
 * buffered window" may now sit well beyond it. Nothing in the record itself
 * announces that — it looks equally confident either way.
 *
 * So the record carries the moment it was planned, and a reader that cannot
 * show the plan is still fresh must refuse it rather than route to it. The
 * failure direction is deliberate: a refused waypoint costs a driver one tap
 * to re-plan; an accepted stale one costs them a stop they cannot legally
 * reach, offered by a screen that sounded certain.
 *
 * Twelve hours is not a regulatory number and is not presented as one. It is
 * shorter than the shortest cycle this planner models, so a record can never
 * outlive the day it was reasoning about.
 */

/** How long a planned stop may be trusted before it must be re-planned. */
export const PLANNED_STOP_TTL_MS = 12 * 60 * 60 * 1000;

/** Shown when a driver arrives at the Navigator carrying an expired plan. */
export const PLANNED_STOP_STALE_NOTICE =
  'Your planned stop was worked out more than 12 hours ago, so your clocks have moved on. Plan again to get a stop that fits the hours you have now.';

/** Shown beside a live planned stop, so its origin is never a mystery. */
export const PLANNED_STOP_SOURCE_NOTICE =
  'Planned in Trip Planner from the clocks you entered. Verify against your ELD before you rely on it.';

export type PlannedStop = {
  /** Directory listing id — stable, so a re-plan replaces rather than stacks. */
  id: string;
  name: string;
  position: LatLng;
  /** Arrival the planner projected, epoch ms. Informational, never a promise. */
  arriveAtMs: number;
  /** Minutes of clock left on arrival, above the driver's safety buffer. */
  clockLeftMin: number;
  detourMiles: number;
  detourMinutes: number;
  /** Where the underlying record came from, carried through for the label. */
  source: string;
  /** When the plan was made. The reader compares this against now. */
  plannedAtMs: number;
};

/**
 * A planned stop is a place a truck parks, so it hands the Navigator the
 * facility class that makes arrival guidance behave: `truck-stop`. The
 * planner's candidates are directory parking and truck-stop records; calling
 * them 'unknown' would discard information we actually hold, and calling them
 * anything more specific would be inventing one.
 */
export const PLANNED_STOP_FACILITY: DestinationFacility = 'truck-stop';

export type PlannedStopProblem =
  /** No usable coordinate — nothing can be routed to. */
  | 'no-position'
  /** The record carries no id, so it could never be replaced or matched. */
  | 'no-id'
  /** Planned too long ago to be trusted against today's clocks. */
  | 'stale';

export type PlannedStopRead =
  | { ok: true; stop: PlannedStop }
  | { ok: false; problem: PlannedStopProblem };

/** A finite, real coordinate. `0,0` is in the Atlantic and is never a stop. */
function isUsablePosition(p: unknown): p is LatLng {
  if (typeof p !== 'object' || p === null) return false;
  const { lat, lng } = p as { lat?: unknown; lng?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Build the record from a choice the driver tapped.
 *
 * `plannedAtMs` is injected rather than read from a clock so the whole
 * lifecycle — fresh, nearly-stale, stale — is enumerable in a test without
 * waiting twelve hours for one assertion.
 */
export function plannedStopFromChoice(
  choice: ParkingChoice,
  plannedAtMs: number,
): PlannedStop | null {
  const c = choice.candidate;
  if (typeof c.id !== 'string' || c.id.trim() === '') return null;
  if (!isUsablePosition(c.position)) return null;
  return {
    id: c.id,
    name: c.name,
    position: { lat: c.position.lat, lng: c.position.lng },
    arriveAtMs: choice.arriveAtMs,
    clockLeftMin: choice.clockLeftMin,
    detourMiles: choice.detourMiles,
    detourMinutes: choice.detourMinutes,
    source: choice.source,
    plannedAtMs,
  };
}

/**
 * Decide whether a stored record may be used right now.
 *
 * Every refusal is named, because the Navigator says different things for
 * each: a stale plan invites a re-plan, while a malformed one is a bug the
 * driver can do nothing about and should simply be dropped.
 */
export function readPlannedStop(stop: PlannedStop | null, nowMs: number): PlannedStopRead {
  if (stop === null) return { ok: false, problem: 'no-id' };
  if (typeof stop.id !== 'string' || stop.id.trim() === '') {
    return { ok: false, problem: 'no-id' };
  }
  if (!isUsablePosition(stop.position)) return { ok: false, problem: 'no-position' };
  if (plannedStopIsStale(stop, nowMs)) return { ok: false, problem: 'stale' };
  return { ok: true, stop };
}

/**
 * Age check, exclusive at the boundary.
 *
 * A record exactly `PLANNED_STOP_TTL_MS` old is still usable; one millisecond
 * past is not. The boundary has to fall somewhere and a test pins it, so that
 * a future edit changing `>` to `>=` is a failing assertion rather than an
 * hour of quietly different behaviour.
 *
 * A record timestamped in the FUTURE is treated as stale rather than fresh.
 * That happens when a device clock is wrong, and "the clock is lying to me"
 * is not a state in which to route a truck to an hours-limited stop.
 */
export function plannedStopIsStale(stop: PlannedStop, nowMs: number): boolean {
  const age = nowMs - stop.plannedAtMs;
  if (age < 0) return true;
  return age > PLANNED_STOP_TTL_MS;
}

/**
 * The shape the Navigator's destination state already speaks.
 *
 * `address` is deliberately empty rather than a guessed street line: the
 * planner holds a directory name and a coordinate, and a fabricated address
 * under a real name is the kind of small invention that gets a driver sent to
 * the wrong entrance.
 *
 * `distanceMi` is null for the same reason — the planner's mileage is measured
 * along the route from the ORIGIN, and the Navigator's field means straight-line
 * distance from the driver's CURRENT position. Reusing the number because both
 * are called miles would be a units bug wearing the right name.
 */
export function plannedStopToDestination(stop: PlannedStop): {
  id: string;
  title: string;
  address: string;
  position: LatLng;
  facility: DestinationFacility;
  distanceMi: number | null;
} {
  return {
    id: stop.id,
    title: stop.name,
    address: '',
    position: stop.position,
    facility: PLANNED_STOP_FACILITY,
    distanceMi: null,
  };
}
