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
import { planMapLayers, type PlanMapLayers } from './plan-map';
import { driveWindow, PLANNING_AID_ONLY, type DriveWindow } from './drive-window';
import { planBreak, type BreakPlan } from './break-plan';
import { selectLastStops, TIMING_UNAVAILABLE_NOTICE } from './last-stop';
import { relevantWeather, type AlertSource, type WeatherRelevance } from './route-weather-timing';
import type { RouteRegion } from './route-region';

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
  candidate: StopCandidate;
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
  /** The heading the list is shown under — chosen by how many qualified. */
  parkingHeadline: string;
  parkingProblem: string | null;
  weather: WeatherRelevance;
  /** Exactly what the results map may draw — nothing that failed a filter. */
  map: PlanMapLayers;
  /** Always shown. */
  disclaimers: string[];
};

/** How many parking choices the screen offers at most. */
export const PARKING_CHOICES = 3;

/**
 * The heading over the parking list, chosen by how many options actually
 * cleared the safety filter.
 *
 * A fixed "Your 3 safest parking options" over a list of one is a promise
 * the data did not keep, and the tempting repair — padding the list back
 * to three — is exactly the failure the filter exists to prevent. So the
 * HEADING moves instead of the list.
 */
export function parkingHeadline(count: number): string {
  switch (count) {
    case 3:
      return 'Your 3 safest parking options';
    case 2:
      return '2 safe parking options found';
    case 1:
      return '1 safe parking option found';
    default:
      return 'No parking option meets your safe stopping window';
  }
}

/** Shown whenever fewer than three qualified, so the gap is never a mystery. */
export const PARKING_SHORTFALL_NOTE =
  'Only locations that fit within your buffered driving window are shown.';

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
  region: RouteRegion;
  alertSource: AlertSource;
}): PlanMyDay {
  const disclaimers = [NOT_AN_ELD, PLANNING_AID_ONLY];

  /*
   * AN ESTIMATE CANNOT HAVE BEEN TRAFFIC-ADJUSTED, whatever the caller
   * passes. A straight-line distance divided by an assumed speed has no
   * free-flow baseline to compare against and no departure time was ever
   * sent, so the two facts `trafficVerdict` reads to justify "Live
   * traffic included" are meaningless here. `composeQuote` already
   * nulls both for an estimate; this makes it impossible for a future
   * caller to reintroduce the claim by forgetting to.
   */
  const traffic = trafficVerdict({
    seconds: input.totalSeconds,
    baseSeconds: input.isEstimate ? null : input.baseSeconds,
    departureTimeParam: input.isEstimate ? null : input.departureTimeParam,
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
    }
    parking = stops.eligible.slice(0, PARKING_CHOICES).map((e) => ({
      candidate: e.candidate,
      arriveAtMs: e.arriveAtMs,
      clockLeftMin: e.hosRemainingMinAtArrival,
      detourMiles: e.candidate.offRouteMiles,
      detourMinutes: e.detourMinutesEstimate,
      amenities: e.candidate.amenities ?? [],
      reservable: Boolean(e.candidate.reservationUrl),
      source: e.candidate.coordVerificationStatus ?? 'unverified',
    }));
    /*
     * THE PROBLEM SENTENCE DESCRIBES THE LIST THE DRIVER SEES (TP-2).
     * It used to key off the named SLOTS, which require a reservable or
     * explicitly-free stop — so a corridor whose only reachable parking
     * was paid-but-unreservable rendered "No parking … is reachable"
     * directly above a list of reachable parking. The screen's list is
     * built from `eligible`, so its emptiness is what the sentence is
     * about.
     *
     * FEWER THAN THREE IS A REAL ANSWER. Padding the list with stops that
     * failed the safety filter is exactly the failure the filter exists
     * to prevent, so the list stays short and the HEADING moves instead.
     */
    if (parkingProblem === null && parking.length === 0) {
      parkingProblem = 'No parking on this corridor is reachable inside your clock and buffer.';
    } else if (parkingProblem === null && parking.length < PARKING_CHOICES) {
      parkingProblem = PARKING_SHORTFALL_NOTE;
    }
  }

  const weather = relevantWeather({
    alerts: input.alerts,
    timing,
    departAtMs: input.departAtMs,
    region: input.region,
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
    parkingHeadline: parkingHeadline(parking.length),
    parkingProblem,
    weather,
    /*
     * The map is built from `parking` — the list that already survived
     * the filter — so a stop the screen refused to offer can never
     * appear as a pin the driver taps anyway.
     */
    map: planMapLayers({
      positions: input.positions,
      isEstimate: input.isEstimate,
      parking,
    }),
    disclaimers,
  };
}
