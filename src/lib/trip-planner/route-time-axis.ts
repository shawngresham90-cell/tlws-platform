import type { LatLng } from '@/lib/map/bounds';
import type { HereManeuver } from './here-routing';

/**
 * Time → position on the route, using the PROVIDER'S OWN timings.
 *
 * Pure. No clock, no I/O, no React.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE: a driver is told "your clock
 * runs out about here". That sentence is only worth saying if the "here"
 * came from the provider's travel times. Distance ÷ an assumed 55 mph
 * produces a confident-looking pin that is wrong by tens of miles on any
 * route with grades, cities or congestion — and wrong in the dangerous
 * direction whenever traffic is bad, because it puts the pin FURTHER
 * along than the truck will actually get.
 *
 * So this module either builds the axis from provider data or REFUSES.
 * There is no average-speed fallback anywhere in it, and a caller cannot
 * accidentally get one: the failure case is a typed refusal carrying the
 * reason, not a number.
 *
 * WHAT THE PROVIDER GIVES US. HERE returns `actions`, each with a
 * `duration` (seconds spent traversing that action), a `length` (metres)
 * and an `offset` (index into the route polyline where the action
 * begins). Walking them yields a piecewise time axis over the geometry.
 *
 * WHAT IT DOES NOT GIVE US. Sub-action resolution. On an interstate a
 * single action can cover 60 miles, and inside that action this module
 * has no information about where the truck slows down. It therefore
 * reports the containing action as a WINDOW alongside the interpolated
 * point, and marks the projection `coarse` when that window is wide.
 * Interpolating inside one action is the one unavoidable assumption, and
 * naming it in the return value is what keeps it from being a lie: a
 * caller can render a stop ZONE rather than a false pin.
 */

/** Why an axis could not be built, or a target could not be projected. */
export type TimeAxisRefusalReason =
  /** Fewer than two actions carried usable timing. */
  | 'no-provider-timing'
  /** Action durations disagree with the route total beyond tolerance. */
  | 'timing-inconsistent'
  /** The polyline is too short to place anything on. */
  | 'no-geometry'
  /** The requested time is past the end of the route. */
  | 'beyond-route-end';

export type TimeAxisRefusal = {
  ok: false;
  reason: TimeAxisRefusalReason;
  /** Plain sentence for an operations document or a bench report. */
  detail: string;
};

/**
 * Action-level timing disagreeing with the route summary by more than
 * this fraction means the two describe different things, and the axis
 * cannot be trusted to place a legal-adjacent marker. 2% absorbs ordinary
 * per-action rounding without absorbing a real mismatch.
 */
export const TIMING_TOLERANCE = 0.02;

/**
 * A window longer than this is reported as `coarse`: 10 minutes of
 * interstate is roughly 10 miles, which is the difference between one
 * truck stop and the next. Callers render a zone, not a point.
 */
export const COARSE_WINDOW_S = 600;

export type TimeAxis = {
  ok: true;
  /** Cumulative seconds at the START of each step, ascending from 0. */
  steps: {
    startS: number;
    durationS: number;
    startIndex: number;
    endIndex: number;
    lengthM: number;
  }[];
  /** Total seconds the axis covers (the sum of its steps). */
  totalS: number;
  totalMeters: number;
};

export type TimeProjection = {
  ok: true;
  /** Best estimate of the position at the requested time. */
  position: LatLng;
  /** Nearest polyline index at or before the estimate. */
  polylineIndex: number;
  /** Metres travelled at the requested time, from the axis. */
  metersFromStart: number;
  /**
   * The provider action containing the requested time. Everything inside
   * it is interpolation — this is the honest extent of the answer.
   */
  window: {
    startS: number;
    endS: number;
    startPosition: LatLng;
    endPosition: LatLng;
    lengthM: number;
  };
  /**
   * `tight` — the containing action is short enough to speak of a point.
   * `coarse` — render a zone; a pin would claim precision we do not have.
   */
  precision: 'tight' | 'coarse';
};

/**
 * Build the time axis from parsed maneuvers and the route polyline.
 *
 * `totalSeconds` and `totalMeters` are the route summary values, used to
 * cross-check the action timings rather than to fill them in.
 */
export function buildTimeAxis(input: {
  maneuvers: readonly HereManeuver[];
  positions: readonly LatLng[];
  totalSeconds: number;
  totalMeters: number;
}): TimeAxis | TimeAxisRefusal {
  const { maneuvers, positions, totalSeconds, totalMeters } = input;

  if (positions.length < 2) {
    return {
      ok: false,
      reason: 'no-geometry',
      detail: `route polyline has ${positions.length} point(s); at least 2 are required.`,
    };
  }

  // Only actions that carry BOTH a duration and a usable offset can
  // contribute. A partial list is not patched with estimates — it is
  // counted, and if too little survives the whole axis is refused.
  const timed = maneuvers
    .filter(
      (m) =>
        typeof m.durationS === 'number' &&
        Number.isFinite(m.durationS) &&
        m.durationS >= 0 &&
        Number.isInteger(m.offset) &&
        m.offset >= 0 &&
        m.offset < positions.length,
    )
    .sort((a, b) => a.offset - b.offset);

  if (timed.length < 2) {
    return {
      ok: false,
      reason: 'no-provider-timing',
      detail: `only ${timed.length} of ${maneuvers.length} action(s) carried both a duration and an offset; a time axis needs at least 2.`,
    };
  }

  const steps: TimeAxis['steps'] = [];
  let startS = 0;
  let meters = 0;
  for (let i = 0; i < timed.length; i++) {
    const m = timed[i];
    const durationS = m.durationS as number;
    // The action runs from its own offset to the NEXT action's offset;
    // the final action runs to the end of the geometry.
    const endIndex = i + 1 < timed.length ? timed[i + 1].offset : positions.length - 1;
    if (endIndex <= m.offset) continue; // zero-length action: no span to place time on
    const lengthM = typeof m.lengthM === 'number' && m.lengthM >= 0 ? m.lengthM : 0;
    steps.push({ startS, durationS, startIndex: m.offset, endIndex, lengthM });
    startS += durationS;
    meters += lengthM;
  }

  if (steps.length === 0) {
    return {
      ok: false,
      reason: 'no-provider-timing',
      detail: 'no action described a non-empty span of the route geometry.',
    };
  }

  /*
   * CROSS-CHECK against the route summary. If the actions sum to a
   * materially different duration than the route claims, they are not a
   * decomposition of this route and must not be used to place a marker
   * on it. Reported, never silently scaled — scaling would manufacture
   * agreement out of a contradiction.
   */
  const axisTotal = startS;
  if (totalSeconds > 0) {
    const drift = Math.abs(axisTotal - totalSeconds) / totalSeconds;
    if (drift > TIMING_TOLERANCE) {
      return {
        ok: false,
        reason: 'timing-inconsistent',
        detail: `action durations sum to ${Math.round(axisTotal)}s but the route summary says ${Math.round(totalSeconds)}s (${(drift * 100).toFixed(1)}% apart, tolerance ${(TIMING_TOLERANCE * 100).toFixed(0)}%).`,
      };
    }
  }

  return {
    ok: true,
    steps,
    totalS: axisTotal,
    totalMeters: meters > 0 ? meters : totalMeters,
  };
}

/** Linear interpolation between two polyline points. */
function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Where is the truck after `targetSeconds` of driving?
 *
 * Returns a refusal — never a guess — when the target is past the end of
 * the route. "Your clock outlasts this trip" is a different, better
 * answer than a pin at the destination, and the caller must be able to
 * tell those apart.
 */
export function projectAtSeconds(
  axis: TimeAxis,
  positions: readonly LatLng[],
  targetSeconds: number,
): TimeProjection | TimeAxisRefusal {
  if (!Number.isFinite(targetSeconds) || targetSeconds < 0) {
    return {
      ok: false,
      reason: 'no-provider-timing',
      detail: `target of ${targetSeconds}s is not a usable duration.`,
    };
  }
  if (targetSeconds > axis.totalS) {
    return {
      ok: false,
      reason: 'beyond-route-end',
      detail: `target of ${Math.round(targetSeconds)}s is past the route's ${Math.round(axis.totalS)}s.`,
    };
  }

  let metersBefore = 0;
  for (const step of axis.steps) {
    const endS = step.startS + step.durationS;
    if (targetSeconds > endS) {
      metersBefore += step.lengthM;
      continue;
    }

    // Inside this action. `t` is the ONLY interpolation in the module,
    // and `precision` below is what stops it being read as certainty.
    const t = step.durationS > 0 ? (targetSeconds - step.startS) / step.durationS : 0;
    const clamped = Math.min(1, Math.max(0, t));

    const startPosition = positions[step.startIndex];
    const endPosition = positions[step.endIndex];
    // Walk the geometry inside the action so the point follows the ROAD
    // rather than cutting the chord between the action's endpoints.
    const span = step.endIndex - step.startIndex;
    const exact = step.startIndex + span * clamped;
    const lower = Math.min(Math.floor(exact), step.endIndex - 1);
    const frac = exact - lower;
    const position = lerp(positions[lower], positions[lower + 1], frac);

    return {
      ok: true,
      position,
      polylineIndex: lower,
      metersFromStart: metersBefore + step.lengthM * clamped,
      window: {
        startS: step.startS,
        endS,
        startPosition,
        endPosition,
        lengthM: step.lengthM,
      },
      precision: step.durationS > COARSE_WINDOW_S ? 'coarse' : 'tight',
    };
  }

  return {
    ok: false,
    reason: 'beyond-route-end',
    detail: `target of ${Math.round(targetSeconds)}s fell past every step of the axis.`,
  };
}
