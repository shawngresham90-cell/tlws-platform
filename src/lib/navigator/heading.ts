/**
 * The heading controller (MapLibre heading-up milestone).
 *
 * What the driving map needs is not "the last GPS course value". It is a
 * SCREEN ORIENTATION that a driver can trust: it must point where the
 * truck is actually going, turn as fast as the truck turns, ignore the
 * jitter a phone receiver produces at every stoplight, refuse to spin the
 * world around because one sample came back backwards, and — when there
 * is no honest evidence at all — hold still rather than invent a
 * direction.
 *
 * So the rules live here, as pure functions over an explicit state, and
 * the component supplies the samples and the clock. Nothing in this file
 * touches the DOM, the map, or time.
 *
 * THE EVIDENCE LADDER (in order, best first):
 *   1. the GPS course, while the truck is genuinely moving — the only
 *      direct measurement of where the vehicle is pointed;
 *   2. the ROUTE's forward bearing at the truck's matched position, when
 *      the receiver publishes no course (common on cheap Android
 *      hardware and immediately after a cold fix) — the truck is on the
 *      route, so the route's direction is a fair statement of its own;
 *   3. the last heading that was reliable, whenever neither of the above
 *      is available (stopped at a light, brief GPS loss);
 *   4. nothing. A parked truck at a cold start has produced no travel
 *      evidence, and an invented "north" would be a lie the whole screen
 *      then rotates around.
 */

import type { LatLng } from '@/lib/map/bounds';

/**
 * Below this the GPS course is noise, not direction: a stationary
 * receiver publishes a course that wanders the full circle, and a phone
 * carried across a yard is not a truck heading anywhere.
 */
export const MOVING_MIN_MPH = 3;

/**
 * A change larger than this in ONE sample is not a truck turning — a
 * combination at road speed cannot swing 120° between fixes. It is a
 * multipath reflection, a receiver reset, or a bad course field, and
 * accepting it would swing the entire map around the driver.
 */
export const REVERSAL_DEG = 120;

/**
 * How many consecutive samples must agree before a suspected reversal is
 * believed. Two, because one is the bad-sample case this exists to
 * refuse, and three would make a genuine U-turn wait long enough for the
 * driver to notice the map disagreeing with the road.
 */
export const REVERSAL_CONFIRM_SAMPLES = 2;

/** How close consecutive reversal candidates must be to count as agreeing. */
export const REVERSAL_AGREE_DEG = 45;

/**
 * Smoothing. Two rates, because one rate cannot serve both jobs: small
 * deltas are mostly receiver noise and get damped hard, while a real turn
 * produces sustained large deltas and must arrive on screen while the
 * driver is still in it.
 */
export const SMOOTH_ALPHA_NOISE = 0.25;
export const SMOOTH_ALPHA_TURN = 0.55;
/** Above this, a delta is treated as a real turn rather than jitter. */
export const TURN_DEG = 20;

/** Normalize any angle to [0, 360). NaN/±Infinity are not headings. */
export function normalizeHeading(deg: number): number | null {
  if (!Number.isFinite(deg)) return null;
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * The signed shortest rotation from `a` to `b`, in (-180, 180].
 * This is the 359°→0° rule in one place: 359 → 1 is +2, not -358.
 */
export function shortestDelta(a: number, b: number): number {
  const from = normalizeHeading(a);
  const to = normalizeHeading(b);
  if (from === null || to === null) return 0;
  let d = ((to - from + 540) % 360) - 180;
  // (-180, 180]: exactly-opposite resolves to +180 rather than -180 so
  // the value is stable rather than sign-flipping on float noise.
  if (d <= -180) d += 360;
  return d;
}

/** Interpolate from `a` toward `b` by t∈[0,1] along the SHORTEST arc. */
export function interpolateHeading(a: number, b: number, t: number): number | null {
  const from = normalizeHeading(a);
  if (from === null || normalizeHeading(b) === null || !Number.isFinite(t)) return null;
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return normalizeHeading(from + shortestDelta(a, b) * clamped);
}

/** True-north bearing from one coordinate to another, in [0, 360). */
export function bearingBetween(from: LatLng, to: LatLng): number | null {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  if (y === 0 && x === 0) return null; // identical points carry no bearing
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

/**
 * The route's FORWARD bearing near a position — evidence rung 2.
 *
 * It finds the closest point on the polyline and looks AHEAD by at least
 * `lookaheadMi`, so the answer is the direction the road is going rather
 * than the direction between two points a few feet apart (which is pure
 * quantization noise at provider resolution). Returns null for a route
 * too short, a position nowhere near it, or a truck already at the end.
 */
export function routeBearingAt(
  geometry: readonly LatLng[],
  position: LatLng,
  lookaheadMi = 0.05,
  maxOffRouteMi = 0.5,
): number | null {
  if (geometry.length < 2) return null;
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  // Equirectangular distances: this runs once per fix over polylines that
  // can carry tens of thousands of points, and at these ranges it agrees
  // with haversine far inside the tolerance that "which point is nearest"
  // and "how far ahead" actually need. No allocation per fix.
  let bestIdx = -1;
  let bestSq = Infinity;
  for (let i = 0; i < geometry.length; i++) {
    const dLat = (geometry[i].lat - position.lat) * 69.0937;
    const dLng = (geometry[i].lng - position.lng) * 69.0937 * cosLat;
    const sq = dLat * dLat + dLng * dLng;
    if (sq < bestSq) {
      bestSq = sq;
      bestIdx = i;
    }
  }
  if (bestIdx < 0 || Math.sqrt(bestSq) > maxOffRouteMi) return null;
  if (bestIdx === geometry.length - 1) return null; // no road ahead to read

  // Walk FORWARD accumulating distance until the lookahead window is
  // covered. Reading only the next point would measure provider
  // quantization (points can be inches apart), not the road's direction.
  let travelled = 0;
  for (let i = bestIdx + 1; i < geometry.length; i++) {
    const dLat = (geometry[i].lat - geometry[i - 1].lat) * 69.0937;
    const dLng =
      (geometry[i].lng - geometry[i - 1].lng) *
      69.0937 *
      Math.cos((geometry[i - 1].lat * Math.PI) / 180);
    travelled += Math.sqrt(dLat * dLat + dLng * dLng);
    if (travelled >= lookaheadMi) return bearingBetween(geometry[bestIdx], geometry[i]);
  }
  // Inside the last lookahead window: the final point still states the
  // route's closing direction, which beats answering nothing near the end.
  return bearingBetween(geometry[bestIdx], geometry[geometry.length - 1]);
}

/**
 * The controller's state. `heading` is what the map should be rotated
 * to; null means NO trustworthy evidence has ever arrived and the map
 * must stay north-up rather than guess.
 */
export type HeadingState = {
  /** Smoothed screen orientation in [0,360), or null when unknown. */
  heading: number | null;
  /** The raw candidate last accepted — what smoothing is heading toward. */
  target: number | null;
  /** A suspected reversal awaiting confirmation, and how many agreed. */
  pending: { deg: number; count: number } | null;
  /** Where the accepted heading came from, for tests and diagnostics. */
  source: 'none' | 'gps' | 'route' | 'held';
  lastAcceptedMs: number | null;
};

export const INITIAL_HEADING_STATE: HeadingState = Object.freeze({
  heading: null,
  target: null,
  pending: null,
  source: 'none',
  lastAcceptedMs: null,
});

export type HeadingSample = {
  /** The receiver's course, or null when it publishes none. */
  gpsHeadingDeg: number | null;
  /** Ground speed; below MOVING_MIN_MPH the course is not evidence. */
  speedMph: number | null;
  /** The route's forward bearing at the matched position, or null. */
  routeBearingDeg: number | null;
  tMs: number;
};

/**
 * One step of the controller. Pure: state + sample in, state out.
 *
 * The order below IS the evidence ladder, and each rung is a rule the
 * road test can name:
 *   - no candidate at all → hold whatever was last reliable (or nothing);
 *   - first candidate ever → adopt it exactly, no smoothing (the map must
 *     not sweep from an imaginary north to the truth);
 *   - implausible one-sample swing → REFUSE it, and remember it; only a
 *     second, agreeing sample makes it real;
 *   - ordinary change → move a fraction of the way, faster for a real
 *     turn than for jitter.
 */
export function headingStep(state: HeadingState, sample: HeadingSample): HeadingState {
  const moving = sample.speedMph !== null && sample.speedMph >= MOVING_MIN_MPH;
  const gps = sample.gpsHeadingDeg === null ? null : normalizeHeading(sample.gpsHeadingDeg);
  const route = sample.routeBearingDeg === null ? null : normalizeHeading(sample.routeBearingDeg);

  // Rung 1 and 2. Both require MOVEMENT: a parked truck's course is noise,
  // and a parked truck sitting on a route is not travelling along it.
  const candidate: number | null = moving ? (gps ?? route) : null;
  const source: 'gps' | 'route' = moving && gps !== null ? 'gps' : 'route';

  if (candidate === null) {
    // Rungs 3 and 4: hold the last reliable heading, or stay unknown.
    // The pending reversal is dropped — evidence that never got confirmed
    // must not survive a stop to be "confirmed" by an unrelated sample.
    return {
      ...state,
      pending: null,
      source: state.heading === null ? 'none' : 'held',
    };
  }

  if (state.heading === null) {
    return {
      heading: candidate,
      target: candidate,
      pending: null,
      source,
      lastAcceptedMs: sample.tMs,
    };
  }

  const delta = shortestDelta(state.heading, candidate);
  if (Math.abs(delta) >= REVERSAL_DEG) {
    const agreeing =
      state.pending !== null &&
      Math.abs(shortestDelta(state.pending.deg, candidate)) <= REVERSAL_AGREE_DEG;
    const count = agreeing ? state.pending!.count + 1 : 1;
    if (count < REVERSAL_CONFIRM_SAMPLES) {
      // The map does NOT move. One bad reading cannot flip the world;
      // a genuine U-turn simply arrives one sample later.
      return { ...state, pending: { deg: candidate, count }, source: 'held' };
    }
    // Sustained: the truck really did reverse. Accept it outright rather
    // than sweeping through 120° of intermediate orientations.
    return {
      heading: candidate,
      target: candidate,
      pending: null,
      source,
      lastAcceptedMs: sample.tMs,
    };
  }

  const alpha = Math.abs(delta) >= TURN_DEG ? SMOOTH_ALPHA_TURN : SMOOTH_ALPHA_NOISE;
  const next = normalizeHeading(state.heading + delta * alpha);
  return {
    heading: next,
    target: candidate,
    pending: null,
    source,
    lastAcceptedMs: sample.tMs,
  };
}

/**
 * A trip that genuinely ended takes its heading with it. The next trip
 * must earn its own orientation from its own travel evidence — carrying
 * yesterday's heading into a cold start is exactly the invented bearing
 * this module refuses to produce.
 */
export function resetHeading(): HeadingState {
  return { ...INITIAL_HEADING_STATE };
}

/**
 * The bearing the CAMERA should use. Heading-up only while guidance is
 * live and the controller has real evidence; every other state is
 * north-up, which is the honest default for a parked map, a briefing, or
 * a route overview.
 */
export function cameraBearing(state: HeadingState, navigating: boolean): number {
  if (!navigating) return 0;
  return state.heading ?? 0;
}

/**
 * Where the truck sits in the viewport, expressed as MapLibre padding.
 *
 * The camera centers itself inside the padded box, so padding the TOP
 * pushes that center downward: the truck rides the lower middle and the
 * screen above it belongs to the road ahead. Measured against the
 * milestone's requirement that more upcoming road is visible than
 * travelled road — at 0.42 the truck sits at ~71% of the viewport
 * height, giving roughly 2.4× as much road ahead as behind.
 *
 * Parked or in overview there is no direction of travel to favor, so the
 * padding goes away and the map centers normally.
 */
export const FOLLOW_TOP_PADDING_FRACTION = 0.42;

/**
 * How much of the bottom belongs to the cockpit's own overlay band —
 * the trip strip, the compact HOS clocks and the Stop/voice row.
 *
 * Measured on the driving surface: 64 px trip strip + ~70 px HOS strip +
 * 64 px control row + gaps. The truck must never be pushed underneath
 * it, which is exactly what an unconditional 0.42 does on a short
 * screen: at 568 px tall the "lower middle" lands at 403 px, and the
 * band starts around 360 px. Measured in Chromium at 320x568 and
 * 932x430 — the obstruction check failed on both.
 */
export const FOLLOW_BOTTOM_RESERVED_PX = 220;

/** Gap between the truck and the band above which it must stay. */
export const FOLLOW_CLEARANCE_PX = 24;

/**
 * Where the truck sits in the viewport, expressed as MapLibre padding.
 *
 * The camera centers itself inside the padded box, so padding the TOP
 * pushes that center downward: the truck rides the lower middle and the
 * screen above it belongs to the road ahead. On a tall phone that puts
 * the truck at ~71% of the height — roughly 2.4x as much road ahead as
 * behind.
 *
 * On a SHORT screen the same fraction would bury the truck under the
 * cockpit's bottom band, so the target is clamped to stay above it —
 * and on a screen short enough that the band reaches past the middle
 * (a 390 px-tall landscape phone), the padding flips to the BOTTOM and
 * lifts the truck above the band instead. Measured in Chromium: the
 * band is ~230 px on a tall phone and ~195 px at 844x390, and the truck
 * was covered by the trip strip at 360x740, 1280x800 and 844x390 until
 * the reserve was fed in from the layout rather than guessed here.
 *
 * Parked or in overview there is no direction of travel to favor, so the
 * padding goes away and the map centers normally.
 */
export function followPadding(
  heightPx: number,
  navigating: boolean,
  reservedBottomPx: number = FOLLOW_BOTTOM_RESERVED_PX,
): { top: number; bottom: number; left: number; right: number } {
  const none = { top: 0, bottom: 0, left: 0, right: 0 };
  if (!navigating || !Number.isFinite(heightPx) || heightPx <= 0) return none;
  const reserved = Number.isFinite(reservedBottomPx) ? Math.max(0, reservedBottomPx) : 0;
  // A margin so the truck clears the band's edge rather than touching it.
  const clear = heightPx - reserved - FOLLOW_CLEARANCE_PX;
  const target = Math.min(heightPx * (1 - (1 - FOLLOW_TOP_PADDING_FRACTION) / 2), clear);
  // center = (height + top - bottom) / 2
  const delta = Math.round(2 * target - heightPx);
  if (delta === 0) return none;
  return delta > 0
    ? { top: delta, bottom: 0, left: 0, right: 0 }
    : { top: 0, bottom: -delta, left: 0, right: 0 };
}

/**
 * Where the truck ends up, as a fraction of the viewport height, for a
 * given padding. Exported so the layout claim can be tested directly
 * rather than re-derived in three places.
 */
export function truckScreenFraction(
  heightPx: number,
  topPaddingPx: number,
  bottomPaddingPx = 0,
): number {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return 0.5;
  return (heightPx + topPaddingPx - bottomPaddingPx) / 2 / heightPx;
}

/**
 * Where a world point lands on screen once the camera is rotated —
 * screen-space geometry in the pure layer, so "a left turn branches
 * LEFT" is a testable claim and not only a screenshot.
 *
 * Returns offsets in SCREEN axes relative to the truck: +x right, +y
 * DOWN (the browser's axis), for a map rotated so `bearing` points up.
 * Units are arbitrary-but-consistent (miles), because only the SIGN and
 * the ratio matter to the claims being made.
 */
export function screenOffsetOf(
  truck: LatLng,
  point: LatLng,
  bearingDeg: number,
): { x: number; y: number } {
  const north = (point.lat - truck.lat) * 69.0937;
  const east = (point.lng - truck.lng) * 69.0937 * Math.cos((truck.lat * Math.PI) / 180);
  const θ = ((normalizeHeading(bearingDeg) ?? 0) * Math.PI) / 180;
  // Rotating the world by -bearing puts the travel direction on +y_up.
  const forward = north * Math.cos(θ) + east * Math.sin(θ);
  const right = east * Math.cos(θ) - north * Math.sin(θ);
  return { x: right, y: -forward };
}

/**
 * Which way the road visibly branches at a maneuver, once the map is
 * rotated. 'left' / 'right' / 'straight' — the screen-space claim that
 * must agree with the spoken instruction.
 */
export function branchSide(
  truck: LatLng,
  afterManeuver: LatLng,
  bearingDeg: number,
  deadZone = 0.02,
): 'left' | 'right' | 'straight' {
  const { x } = screenOffsetOf(truck, afterManeuver, bearingDeg);
  if (Math.abs(x) < deadZone) return 'straight';
  return x > 0 ? 'right' : 'left';
}
