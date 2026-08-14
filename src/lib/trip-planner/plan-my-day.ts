import type { LatLng } from '@/lib/map/bounds';
import type { HereManeuver } from './here-routing';
import type { RemainingClocks, StopCandidate } from './types';
import type { WeatherAlert } from './providers';
import { trafficVerdict, type TrafficVerdict } from './traffic';
import {
  buildTimeAxis,
  routeTimingFromAxis,
  timingUnavailable,
  type RouteTiming,
} from './route-time-axis';
import { clockLimitMarker, type ClockLimitMarker } from './clock-limit-marker';
import { driveWindow, PLANNING_AID_ONLY, type DriveWindow } from './drive-window';
import { planBreak, type BreakPlan } from './break-plan';
import { selectLastStops, TIMING_UNAVAILABLE_NOTICE, type LastStopSlot } from './last-stop';
import {
  relevantWeather,
  type RouteCountry,
  type AlertSource,
  type WeatherRelevance,
} from './route-weather-timing';

/**
 * Plan My Day — everything the results screen renders, assembled once.
 *
 * Pure. No clock, no I/O, no React. The route, the clocks and the
 * candidates come in; a plan comes out.
 *
 * WHY THIS IS ONE FUNCTION. Every number on the results screen has to
 * agree with every other one: the clock-limit marker, the break, the
 * three parking choices and the weather section are all answers to "where
 * will this truck be, and when". Computing them in separate places is how
 * a screen ends up telling a driver their clock dies at 6:40 and offering
 * them a stop at 7:10. So they are derived from ONE axis, built once, and
 * a single `timing` value decides whether each of them can be answered at
 * all.
 *
 * The refusals are the important part of the return type. A caller cannot
 * render a confident plan by accident, because the pieces that could not
 * be computed are absent rather than defaulted.
 */

export const NOT_AN_ELD =
  'Trip Planner is not an ELD. Your ELD remains the authoritative record of your hours.';

export type ParkingChoice = {
  slot: LastStopSlot;
  /** Provider-timed arrival, epoch ms. */
  arriveAtMs: number;
  /** Minutes of clock left on arrival, above the driver's buffer. */
  clockLeftMin: number;
  /** Off-route distance, miles. */
  detourMiles: number;
  detourMinutes: number;
  amenities: string[];
  reservable: boolean;
  /** Where the record came from, for the confidence label. */
  source: string;
};

export type PlanMyDay = {
  traffic: TrafficVerdict;
  /** Null when the clocks were not entered — no HOS-aware plan is made. */
  window: DriveWindow | null;
  /** Why no window, when there is none. */
  windowProblem: string | null;
  clockLimit: ClockLimitMarker;
  stopTarget: ClockLimitMarker;
  breakMarker: ClockLimitMarker | null;
  breakPlan: BreakPlan | null;
  parking: ParkingChoice[];
  parkingProblem: string | null;
  weather: WeatherRelevance;
  /** Always shown. */
  disclaimers: string[];
};

/** How many parking choices the screen promises. */
export const PARKING_CHOICES = 3;

export function planMyDay(input: {
  maneuvers: readonly HereManeuver[];
  positions: readonly LatLng[];
  totalSeconds: number;
  baseSeconds: number | null;
  totalMeters: number;
  departureTimeParam: string | null;
  isEstimate: boolean;
  clocks: RemainingClocks | null;
  bufferMin: number;
  departAtMs: number;
  candidates: StopCandidate[];
  alerts: readonly WeatherAlert[];
  country: RouteCountry;
  alertSource: AlertSource;
}): PlanMyDay {
  const disclaimers = [NOT_AN_ELD, PLANNING_AID_ONLY];

  const traffic = trafficVerdict({
    seconds: input.totalSeconds,
    baseSeconds: input.baseSeconds,
    departureTimeParam: input.departureTimeParam,
  });

  /*
   * ONE AXIS, ONE TIMING VALUE. An estimated route never produces one,
   * which is what keeps HOS markers, break placement, parking eligibility
   * and weather encounter times off a straight-line guess.
   */
  const axis = input.isEstimate
    ? null
    : buildTimeAxis({
        maneuvers: input.maneuvers,
        positions: input.positions,
        totalSeconds: input.totalSeconds,
        totalMeters: input.totalMeters,
      });
  const timing: RouteTiming =
    axis === null
      ? timingUnavailable('route is a straight-line estimate; provider travel times unavailable.')
      : axis.ok
        ? routeTimingFromAxis(axis)
        : timingUnavailable(`provider timing unusable: ${axis.detail}`);

  /*
   * CLOCKS UNSET MEANS NO HOS-AWARE PLAN. Not a default, not a fresh
   * shift — the whole HOS half of the screen is absent and says why.
   */
  let window: DriveWindow | null = null;
  let windowProblem: string | null = null;
  if (input.clocks === null) {
    windowProblem = 'Clocks not set — enter your remaining hours for an HOS-aware plan.';
  } else {
    const w = driveWindow(input.clocks, input.bufferMin);
    if ('ok' in w) windowProblem = w.problem;
    else window = w;
  }

  const marker = (targetMin: number): ClockLimitMarker =>
    clockLimitMarker({
      maneuvers: input.maneuvers,
      positions: input.positions,
      totalSeconds: input.totalSeconds,
      totalMeters: input.totalMeters,
      targetSeconds: targetMin * 60,
    });

  const noMarker: ClockLimitMarker = {
    kind: 'none',
    notice: 'Clock-limit location cannot be mapped safely.',
    detail: windowProblem ?? 'no usable driving window',
  };

  const clockLimit = window === null || axis === null ? noMarker : marker(window.clockLimitMin);
  const stopTarget = window === null || axis === null ? noMarker : marker(window.stopTargetMin);

  /* ---- the break, on the same timing --------------------------------- */
  let breakPlan: BreakPlan | null = null;
  let breakMarker: ClockLimitMarker | null = null;
  if (input.clocks !== null && window !== null) {
    breakPlan = planBreak({
      clocks: input.clocks,
      usableDriveMin: window.clockLimitMin,
      timing,
      departAtMs: input.departAtMs,
    });
    if (breakPlan.required === true) breakMarker = marker(breakPlan.targetMin);
  }

  /* ---- parking, filtered before it is ranked ------------------------- */
  let parking: ParkingChoice[] = [];
  let parkingProblem: string | null = null;
  if (input.clocks === null) {
    parkingProblem = 'Enter your clocks to see parking you can safely reach.';
  } else {
    const stops = selectLastStops({
      timing,
      candidates: input.candidates,
      clocks: input.clocks,
      departAtMs: input.departAtMs,
      bufferMin: input.bufferMin,
    });
    if (!stops.timingAvailable) {
      parkingProblem = TIMING_UNAVAILABLE_NOTICE;
    } else if (stops.slots.length === 0) {
      parkingProblem = 'No parking on this corridor is reachable inside your clock and buffer.';
    }
    parking = stops.slots.slice(0, PARKING_CHOICES).map((slot) => ({
      slot,
      arriveAtMs: slot.arriveAtMs,
      clockLeftMin: slot.hosRemainingMinAtArrival,
      detourMiles: slot.candidate.offRouteMiles,
      detourMinutes: slot.detourMinutesEstimate,
      amenities: slot.candidate.amenities ?? [],
      reservable: Boolean(slot.candidate.reservationUrl),
      source: slot.candidate.coordVerificationStatus ?? 'unverified',
    }));
    /*
     * FEWER THAN THREE IS A REAL ANSWER. The screen promises three
     * CHOICES, not three rows — padding the list with stops that failed
     * the safety filter is exactly the failure the filter exists to
     * prevent, so a short list stays short and says so.
     */
    if (parkingProblem === null && parking.length < PARKING_CHOICES) {
      parkingProblem = `Only ${parking.length} parking option${parking.length === 1 ? '' : 's'} on this corridor is reachable inside your clock and buffer.`;
    }
  }

  const weather = relevantWeather({
    alerts: input.alerts,
    timing,
    departAtMs: input.departAtMs,
    country: input.country,
    source: input.alertSource,
  });

  return {
    traffic,
    window,
    windowProblem,
    clockLimit,
    stopTarget,
    breakMarker,
    breakPlan,
    parking,
    parkingProblem,
    weather,
    disclaimers,
  };
}
