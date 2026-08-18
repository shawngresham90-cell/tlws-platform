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
 *
 * THE TTL IS THE BACKSTOP, NOT THE PRIMARY DEFENCE. It catches the case where
 * nothing observable changed and time simply passed. The faster and more
 * common invalidation is INPUT CHANGE: the moment the clocks, the truck, the
 * origin, the destination or the plan itself moves, the stop was qualified
 * against a world that no longer exists, and twelve hours is far too generous
 * a window in which to keep offering it. `sharedInputsFingerprint` is what
 * makes that survive a reload — an eager clear on the planner side cannot,
 * because the driver may edit their clocks in the Navigator instead.
 */

/** How long a planned stop may be trusted before it must be re-planned. */
export const PLANNED_STOP_TTL_MS = 12 * 60 * 60 * 1000;

/** Shown when a driver arrives at the Navigator carrying an expired plan. */
export const PLANNED_STOP_STALE_NOTICE =
  'Your planned stop was worked out more than 12 hours ago, so your clocks have moved on. Plan again to get a stop that fits the hours you have now.';

/** Shown beside a live planned stop, so its origin is never a mystery. */
export const PLANNED_STOP_SOURCE_NOTICE =
  'Planned in Trip Planner from the clocks you entered. Verify against your ELD before you rely on it.';

/** Shown when the inputs the stop was qualified against have since moved. */
export const PLANNED_STOP_INPUTS_CHANGED_NOTICE =
  'Your clocks or truck changed after this stop was worked out, so it no longer matches the hours you have now. Plan again to get a stop that does.';

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
  /**
   * The clocks and truck this stop was qualified against, reduced to one
   * comparable string. A reader recomputes it from live storage and refuses
   * the stop when it differs — which is how a clock edit made in the
   * Navigator, after the plan was written, invalidates the stop without the
   * planner being open to notice.
   */
  inputsFingerprint: string;
};

/* ===================================================================== *
 * INPUT FINGERPRINTS — what the stop was qualified against
 * ===================================================================== */

/**
 * A stable, comparable summary of the inputs BOTH surfaces can see.
 *
 * Deliberately only the clocks and the truck. Origin, destination and the
 * plan itself are planner-side state the Navigator has no view of, so they
 * are handled by an eager clear at the moment they change rather than by a
 * comparison that one side could never perform.
 *
 * Numbers are rounded before hashing so that a re-render producing
 * `13.000000000000002` does not read as a truck that changed shape. Rounding
 * is to a tenth of a foot and a whole pound — finer than any real edit, so a
 * genuine change can never round away.
 */
export function sharedInputsFingerprint(input: {
  /**
   * The clocks AS THE DRIVER ENTERED THEM, including the cycle rule.
   * Fingerprinting the raw entry means the comparison needs no conversion,
   * and therefore cannot disagree with whatever conversion the planner
   * happened to apply on its side.
   */
  clocks: {
    drivingMin: number;
    windowMin: number;
    untilBreakMin: number;
    cycleMin: number;
    cycleRule: string;
  } | null;
  truck: {
    heightFt: number;
    widthFt: number;
    lengthFt: number;
    grossWeightLbs: number;
    axles: number;
    hazmatClass: string | null;
    avoid: readonly string[];
  } | null;
}): string {
  const c = input.clocks;
  const t = input.truck;
  const clockPart =
    c === null
      ? 'clocks:none'
      : `clocks:${Math.round(c.drivingMin)},${Math.round(c.windowMin)},${Math.round(
          c.untilBreakMin,
        )},${Math.round(c.cycleMin)},${c.cycleRule}`;
  const truckPart =
    t === null
      ? 'truck:none'
      : `truck:${(Math.round(t.heightFt * 10) / 10).toFixed(1)},${(
          Math.round(t.widthFt * 10) / 10
        ).toFixed(1)},${(Math.round(t.lengthFt * 10) / 10).toFixed(1)},${Math.round(
          t.grossWeightLbs,
        )},${Math.round(t.axles)},${t.hazmatClass ?? 'none'},${[...t.avoid].sort().join('+')}`;
  return `${clockPart}|${truckPart}`;
}

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
  | 'stale'
  /** The clocks or truck moved after the stop was qualified. */
  | 'inputs-changed';

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
  inputsFingerprint: string,
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
    inputsFingerprint,
  };
}

/* ===================================================================== *
 * ASKING ONCE PER TRIP — not once per device
 * ===================================================================== *
 * "Plan your stops before you drive?" belongs to a TRIP, not to a phone. A
 * driver who said Just Drive this morning is not answering for tonight's run,
 * and a device-wide dismissal would silently make that decision for them.
 *
 * A trip is identified by where it is going. That is the only identity the
 * parked screen actually holds, and it moves exactly when the requirement says
 * the prompt must come back: the destination changes, the trip ends (the
 * destination clears), or a new one begins.
 */

/** The key used before a destination has been chosen. */
export const NO_DESTINATION_TRIP = 'trip:none';

export function tripKeyFor(destination: { id?: string | null } | null): string {
  if (destination === null || destination === undefined) return NO_DESTINATION_TRIP;
  const id = typeof destination.id === 'string' ? destination.id.trim() : '';
  return id === '' ? NO_DESTINATION_TRIP : `trip:${id}`;
}

export type AskDecision = {
  /** Show the prompt. */
  ask: boolean;
  /**
   * Carry an existing dismissal onto this trip key, when non-null. Written by
   * the caller so the decision stays pure.
   */
  adoptKey: string | null;
};

/**
 * Decide whether to ask, given what was answered before and which trip this is.
 *
 * The rule that needs explaining is the third one. A driver who taps Just
 * Drive BEFORE choosing a destination has answered for the trip they are
 * setting up, and then chooses where they are going — which changes the key.
 * Re-asking there would mean the prompt appears twice in one setup, seconds
 * apart, which reads as a bug and is exactly the nagging that teaches people
 * to dismiss without reading. So the dismissal is carried forward onto the
 * real key.
 *
 * The carry-forward is a one-way step out of "no destination yet". Once the
 * answer is attached to a real destination, changing to a DIFFERENT
 * destination asks again, which is the requirement.
 */
export function shouldAskTripPlan(
  answeredForTrip: string | null,
  currentTrip: string,
): AskDecision {
  if (answeredForTrip === null) return { ask: true, adoptKey: null };
  if (answeredForTrip === currentTrip) return { ask: false, adoptKey: null };
  if (answeredForTrip === NO_DESTINATION_TRIP && currentTrip !== NO_DESTINATION_TRIP) {
    return { ask: false, adoptKey: currentTrip };
  }
  return { ask: true, adoptKey: null };
}

/**
 * Decide whether a stored record may be used right now.
 *
 * Every refusal is named, because the Navigator says different things for
 * each: a stale plan invites a re-plan, while a malformed one is a bug the
 * driver can do nothing about and should simply be dropped.
 */
export function readPlannedStop(
  stop: PlannedStop | null,
  nowMs: number,
  /**
   * The fingerprint of the clocks and truck AS THEY ARE NOW. Omitted only by
   * callers that genuinely have no view of them; when omitted the input check
   * is skipped and the TTL is the only age defence, which is why every real
   * caller passes it.
   */
  currentFingerprint?: string,
): PlannedStopRead {
  if (stop === null) return { ok: false, problem: 'no-id' };
  if (typeof stop.id !== 'string' || stop.id.trim() === '') {
    return { ok: false, problem: 'no-id' };
  }
  if (!isUsablePosition(stop.position)) return { ok: false, problem: 'no-position' };
  /*
   * Input change is checked BEFORE the TTL. Both refusals drop the record, but
   * they tell the driver different things — "your clocks changed" is
   * actionable and specific, "this aged out" is neither — and a stop whose
   * clocks moved an hour ago is wrong for that reason, not because twelve
   * hours passed.
   */
  if (currentFingerprint !== undefined && stop.inputsFingerprint !== currentFingerprint) {
    return { ok: false, problem: 'inputs-changed' };
  }
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
