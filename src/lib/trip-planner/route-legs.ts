import type { HereManeuver } from './here-routing';
import type { RouteSection } from './providers';
import {
  buildTimeAxis,
  routeTimingFromAxis,
  timingUnavailable,
  type RouteTiming,
} from './route-time-axis';

/**
 * Legs over the provider route (TP-2) — a thin slice, not a second engine.
 *
 * Pure. No clock, no I/O.
 *
 * A route with a via waypoint is one continuous drive that the provider
 * reports in SECTIONS, one per leg. This module turns those sections into
 * `TripLeg`s: where each leg starts and ends (miles, seconds) and a
 * leg-local `RouteTiming` for timing questions inside the leg.
 *
 * EVERY NUMBER HERE IS THE PROVIDER'S. Leg boundaries come from the
 * provider's own cumulative section summaries; leg timing is built by the
 * SAME `buildTimeAxis` the whole-route axis uses, fed exactly the actions
 * the provider timed for that leg. There is no straight-line distance, no
 * assumed speed, and no arithmetic that could disagree with the
 * whole-route axis by more than the provider's own rounding.
 *
 * A leg whose actions cannot support an axis (too few timed actions, or
 * timing that disagrees with the section summary) gets an UNAVAILABLE
 * timing — the boundaries are still reported, because they are section
 * facts, but nothing inside that leg can be timed and callers must refuse
 * accordingly.
 */

const METERS_PER_MILE = 1609.344;

export type TripLeg = {
  /** 0-based position in driving order. */
  index: number;
  /** Cumulative route-miles at this leg's start/end (whole-route axis). */
  startMile: number;
  endMile: number;
  /** Cumulative provider seconds at this leg's start/end. */
  startS: number;
  endS: number;
  /** Provider driving minutes for this leg alone. */
  driveMinutes: number;
  /**
   * Leg-local timing: `minutesToMile(m)` answers for mile `m` MEASURED
   * FROM THIS LEG'S START. Unavailable when the provider's actions could
   * not support an axis for this leg.
   */
  timing: RouteTiming;
};

/**
 * Slice the provider route into legs.
 *
 * With no section boundaries (an adapter that predates them, or a cached
 * pre-TP-2 result) the whole route is returned as ONE leg — which is
 * exactly what every route without a via is anyway.
 */
export function sliceTripLegs(input: {
  maneuvers: readonly HereManeuver[];
  sections: readonly RouteSection[] | undefined;
  /** Whole-route summary values (cross-check inputs, as buildTimeAxis). */
  totalSeconds: number;
  totalMeters: number;
}): TripLeg[] {
  const { maneuvers, totalSeconds, totalMeters } = input;
  const sections = input.sections ?? [];

  const wholeRouteLeg = (): TripLeg[] => {
    const axis = buildTimeAxis({ maneuvers, totalSeconds, totalMeters });
    return [
      {
        index: 0,
        startMile: 0,
        endMile: Number((totalMeters / METERS_PER_MILE).toFixed(1)),
        startS: 0,
        endS: totalSeconds,
        driveMinutes: Math.round(totalSeconds / 60),
        timing: axis.ok
          ? routeTimingFromAxis(axis)
          : timingUnavailable(`provider timing unusable: ${axis.detail}`),
      },
    ];
  };

  if (sections.length <= 1) return wholeRouteLeg();

  const legs: TripLeg[] = [];
  let prevMeters = 0;
  let prevSeconds = 0;
  let prevManeuverEnd = 0;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    // A malformed boundary (non-monotonic, non-finite, or maneuver bounds
    // that do not advance) poisons every leg after it; fall back to the
    // one-leg view rather than reporting boundaries that cannot be true.
    if (
      !Number.isFinite(s.endMeters) ||
      !Number.isFinite(s.endSeconds) ||
      s.endMeters < prevMeters ||
      s.endSeconds < prevSeconds ||
      !Number.isInteger(s.maneuverStart) ||
      !Number.isInteger(s.maneuverEnd) ||
      s.maneuverStart < prevManeuverEnd ||
      s.maneuverEnd < s.maneuverStart ||
      s.maneuverEnd > maneuvers.length
    ) {
      return wholeRouteLeg();
    }

    const legSeconds = s.endSeconds - prevSeconds;
    const legMeters = s.endMeters - prevMeters;
    const legManeuvers = maneuvers.slice(s.maneuverStart, s.maneuverEnd);
    const axis = buildTimeAxis({
      maneuvers: legManeuvers,
      totalSeconds: legSeconds,
      totalMeters: legMeters,
    });
    legs.push({
      index: i,
      startMile: Number((prevMeters / METERS_PER_MILE).toFixed(1)),
      endMile: Number((s.endMeters / METERS_PER_MILE).toFixed(1)),
      startS: prevSeconds,
      endS: s.endSeconds,
      driveMinutes: Math.round(legSeconds / 60),
      timing: axis.ok
        ? routeTimingFromAxis(axis)
        : timingUnavailable(`provider timing unusable for this leg: ${axis.detail}`),
    });
    prevMeters = s.endMeters;
    prevSeconds = s.endSeconds;
    prevManeuverEnd = s.maneuverEnd;
  }
  return legs;
}
