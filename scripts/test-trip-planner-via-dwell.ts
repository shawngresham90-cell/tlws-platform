/*
 * TP-4 — planned dwell at the via, charged honestly.
 *
 * The plan used to treat the via as a point the truck passes through
 * instantly. A driver who plans an hour at their Atlanta stop loses that
 * hour of 14-hour window (and, conservatively, cycle) whether the planner
 * admits it or not — so now it admits it. These scenarios pin the model:
 *
 *   D1  zero dwell — byte-identical to the TP-3 baseline
 *   D2  60-minute non-qualifying dwell — window −60, cycle −60,
 *       driving unchanged, break timer untouched
 *   D3  30-minute qualifying dwell satisfies the break — no duplicate
 *       break event, timer restarts at the via
 *   D4  29 minutes can never qualify, whatever the flag says
 *   D5  60 minutes marked No does not qualify, whatever the duration
 *   D6  a break due BEFORE the via stays due before it
 *   D7  a break due at/after the via is satisfied by a qualifying dwell
 *   D8  dwell flips the destination from reachable to not-reachable
 *   D9  dwell moves the parking cutoff — far stop rejected, near survives
 *   D10 the 14-hour window binds BECAUSE of the dwell — labeled '14-hour'
 *   D11 the cycle binds BECAUSE of the dwell — labeled 'cycle'
 *   D12 changing the dwell invalidates the planned stop
 *   D13 toggling the break claim invalidates the planned stop
 *   D14 downstream times include the dwell EXACTLY once
 *   D15 multiple breaks around a dwelled via keep one honest chronology
 *
 * Every route here is the TP-3 synthetic provider-shaped axis at exactly
 * 60 mph (5-mile / 300-second actions), so route-miles equal minutes and
 * every charge below is hand-checkable. Vias and candidates sit on 5-mile
 * action boundaries, where the worst-case axis time equals the mile.
 *
 * D8/D10/D11/D15 deliberately use raw engine snapshots (stated where they
 * exceed what validated clock entry allows): the pure functions accept
 * any finite clocks and must be correct on all of them.
 */
import { readFileSync } from 'node:fs';
import {
  buildTimeAxis,
  routeTimingFromAxis,
  type RouteTiming,
} from '@/lib/trip-planner/route-time-axis';
import {
  driveWindow,
  effectiveViaDwell,
  requiredBreaksBefore,
  requiredBreaksWithVia,
  viaDwellWallMin,
  VIA_DWELL_MAX_MIN,
  VIA_DWELL_PRESETS,
  type PlannedViaDwell,
} from '@/lib/trip-planner/drive-window';
import { planBreakSchedule } from '@/lib/trip-planner/break-plan';
import { reachWithinClocks, selectLastStops } from '@/lib/trip-planner/last-stop';
import { sliceTripLegs } from '@/lib/trip-planner/route-legs';
import { buildTripPlan, type TripPlan, type TripPlanEvent } from '@/lib/trip-planner/trip-plan';
import { planMyDay, type PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import { composeQuote, quoteRequestSchemaChecked } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
import { resolveRouteRegion } from '@/lib/trip-planner/route-region';
import {
  HOS,
  DEFAULT_TRUCK_PROFILE,
  type RemainingClocks,
  type StopCandidate,
} from '@/lib/trip-planner/types';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { RouteSection } from '@/lib/trip-planner/providers';
import {
  corridorRoute,
  corridorListings,
  corridorRoutingResult,
  DALTON_ORIGIN,
  ATLANTA_VIA,
  MACON_DESTINATION,
} from './fixtures/i75-corridor';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_790_000_000_000;
const MIN = 60_000;

/** A provider-shaped route: mile == minute, 5-mile / 300-second actions. */
function syntheticRoute(
  miles: number,
  viaAtMile: number | null,
): {
  maneuvers: HereManeuver[];
  totalSeconds: number;
  totalMeters: number;
  totalMiles: number;
  sections: RouteSection[];
  timing: RouteTiming;
  legs: ReturnType<typeof sliceTripLegs>;
} {
  const METERS_PER_MILE = 1609.344;
  const maneuvers: HereManeuver[] = [];
  let meters = 0;
  let seconds = 0;
  let viaManeuverEnd = -1;
  let viaMeters = 0;
  let viaSeconds = 0;
  for (let mile = 0; mile < miles; mile += 5) {
    const pieceMiles = Math.min(5, miles - mile);
    maneuvers.push({
      action: 'continue',
      instruction: `mile ${mile}`,
      direction: null,
      severity: null,
      offset: maneuvers.length,
      lengthM: pieceMiles * METERS_PER_MILE,
      durationS: pieceMiles * 60,
    });
    meters += pieceMiles * METERS_PER_MILE;
    seconds += pieceMiles * 60;
    if (viaAtMile !== null && mile + pieceMiles === viaAtMile) {
      viaManeuverEnd = maneuvers.length;
      viaMeters = meters;
      viaSeconds = seconds;
    }
  }
  const sections: RouteSection[] =
    viaAtMile !== null && viaManeuverEnd > 0
      ? [
          {
            endMeters: viaMeters,
            endSeconds: viaSeconds,
            endPositionIndex: 0,
            maneuverStart: 0,
            maneuverEnd: viaManeuverEnd,
          },
          {
            endMeters: meters,
            endSeconds: seconds,
            endPositionIndex: 0,
            maneuverStart: viaManeuverEnd,
            maneuverEnd: maneuvers.length,
          },
        ]
      : [
          {
            endMeters: meters,
            endSeconds: seconds,
            endPositionIndex: 0,
            maneuverStart: 0,
            maneuverEnd: maneuvers.length,
          },
        ];
  const axis = buildTimeAxis({ maneuvers, totalSeconds: seconds, totalMeters: meters });
  if (!axis.ok) throw new Error('synthetic axis failed: ' + axis.detail);
  return {
    maneuvers,
    totalSeconds: seconds,
    totalMeters: meters,
    totalMiles: Number((meters / METERS_PER_MILE).toFixed(1)),
    sections,
    timing: routeTimingFromAxis(axis),
    legs: sliceTripLegs({ maneuvers, sections, totalSeconds: seconds, totalMeters: meters }),
  };
}

const clocks = (over: Partial<RemainingClocks> = {}): RemainingClocks => ({
  drivingMin: 660,
  windowMin: 840,
  untilBreakMin: 100,
  cycleMin: 4200,
  limitedBy: '11-hour',
  legalDrivingMin: 660,
  ...over,
});

/** A via dwell the way composeQuote resolves one: driveMin from the axis. */
function dwellAt(
  route: ReturnType<typeof syntheticRoute>,
  dwellMin: number,
  qualifiesAsBreak: boolean,
): PlannedViaDwell {
  if (route.timing.kind !== 'provider') throw new Error('synthetic timing must be provider');
  const atVia = route.timing.minutesToMile(route.legs[0].endMile);
  if (atVia === null) throw new Error('via mile not on the timed axis');
  const v = effectiveViaDwell({ driveMin: atVia.latestMin, dwellMin, qualifiesAsBreak });
  if (v === null) throw new Error('dwellAt expects a positive dwell');
  return v;
}

const candidate = (
  id: string,
  routeMile: number,
  over: Partial<StopCandidate> = {},
): StopCandidate => ({
  id,
  name: `${id} (fixture)`,
  categorySlug: 'truck-stops',
  position: { lat: 34, lng: -84 },
  routeMile,
  offRouteMiles: 0.5,
  parkingSpaces: 80,
  overnightParking: true,
  overnightStatus: 'confirmed',
  freeParking: true,
  paidParking: null,
  reservationUrl: null,
  amenities: [],
  fuelBrands: [],
  coordVerificationStatus: 'manually-verified',
  state: 'GA',
  interstate: 'I-75',
  exitNumber: null,
  ...over,
});

const region = resolveRouteRegion({
  origin: { lat: 34.77, lng: -84.97 },
  originCountry: 'US',
  destination: { lat: 32.84, lng: -83.63 },
  destinationCountry: 'US',
});

/** planMyDay + buildTripPlan wired exactly as composeQuote wires them. */
function fullPlan(
  route: ReturnType<typeof syntheticRoute>,
  c: RemainingClocks,
  opts: {
    bufferMin?: number;
    candidates?: StopCandidate[];
    viaDwell?: PlannedViaDwell | null;
  } = {},
): { plan: PlanMyDay; trip: TripPlan } {
  const bufferMin = opts.bufferMin ?? 60;
  const viaDwell = opts.viaDwell ?? null;
  const plan = planMyDay({
    maneuvers: route.maneuvers,
    positions: [],
    totalSeconds: route.totalSeconds,
    baseSeconds: route.totalSeconds - 600,
    totalMeters: route.totalMeters,
    departureTimeParam: new Date(T0).toISOString(),
    isEstimate: false,
    clocks: c,
    bufferMin,
    departAtMs: T0,
    candidates: opts.candidates ?? [],
    alerts: [],
    region,
    alertSource: 'nws-us',
    viaDwell,
  });
  const trip = buildTripPlan({
    timing: route.timing,
    clocks: c,
    bufferMin,
    departAtMs: T0,
    totalMiles: route.totalMiles,
    legs: route.legs,
    labels: {
      origin: 'Dalton, GA',
      via: route.legs.length > 1 ? 'Atlanta, GA' : null,
      destination: 'Macon, GA',
    },
    breakSchedule: plan.breakSchedule,
    parking: plan.parking,
    viaDwell,
  });
  return { plan, trip };
}

const kinds = (t: TripPlan): string =>
  t.status === 'unavailable' ? '(unavailable)' : t.events.map((e) => e.kind).join('>');
const eventsOf = <K extends TripPlanEvent['kind']>(t: TripPlan, kind: K) =>
  t.status === 'unavailable'
    ? []
    : (t.events.filter((e) => e.kind === kind) as Extract<TripPlanEvent, { kind: K }>[]);

/* ============ the primitives — one dwell truth ======================= */
{
  const via: PlannedViaDwell = { driveMin: 100, dwellMin: 60, qualifiesAsBreak: false };
  check(
    'primitive: the synthetic axis times a boundary mile at its minute',
    (() => {
      const r = syntheticRoute(400, 100);
      return r.timing.kind === 'provider' && r.timing.minutesToMile(100)?.latestMin === 100;
    })(),
  );
  check(
    'primitive: no dwell charge at or before the via',
    viaDwellWallMin(100, via) === 0 && viaDwellWallMin(60, via) === 0,
  );
  check('primitive: full dwell charge strictly beyond the via', viaDwellWallMin(101, via) === 60);
  check('primitive: no via, no charge', viaDwellWallMin(500, null) === 0);
  check(
    'primitive: a non-qualifying dwell never moves a break threshold',
    requiredBreaksWithVia(400, 100, via) === requiredBreaksBefore(400, 100),
  );
  const qual: PlannedViaDwell = { driveMin: 100, dwellMin: 30, qualifiesAsBreak: true };
  check(
    'primitive: a qualifying dwell restarts the timer at the via',
    requiredBreaksWithVia(580, 100, qual) === 0 && requiredBreaksWithVia(581, 100, qual) === 1,
  );
  check(
    'primitive: a threshold exactly ON the via is satisfied by the dwell',
    requiredBreaksWithVia(101, 100, qual) === 0 && requiredBreaksBefore(101, 100) === 1,
  );
  check(
    'primitive: pre-via thresholds are untouched by qualification (D6 seed)',
    requiredBreaksWithVia(101, 40, { ...qual }) === 1,
  );
  check(
    'primitive: at or before the via the arithmetic is exactly TP-3',
    requiredBreaksWithVia(100, 40, qual) === requiredBreaksBefore(100, 40),
  );
  check(
    'primitive: effectiveViaDwell drops a zero or broken dwell',
    effectiveViaDwell({ driveMin: 100, dwellMin: 0, qualifiesAsBreak: true }) === null &&
      effectiveViaDwell({ driveMin: Number.NaN, dwellMin: 60, qualifiesAsBreak: false }) === null &&
      effectiveViaDwell(null) === null,
  );
  check(
    'primitive: qualification requires 30 minutes, whatever the flag says (D4 seed)',
    effectiveViaDwell({ driveMin: 100, dwellMin: 29, qualifiesAsBreak: true })?.qualifiesAsBreak ===
      false &&
      effectiveViaDwell({ driveMin: 100, dwellMin: 30, qualifiesAsBreak: true })
        ?.qualifiesAsBreak === true,
  );
}

/* ============ D1 — zero dwell is the TP-3 baseline =================== */
{
  const route = syntheticRoute(400, 100);
  const c = clocks();
  const w0 = driveWindow(c, 60);
  const w1 = driveWindow(c, 60, null);
  check(
    'D1: driveWindow with null via is byte-identical',
    JSON.stringify(w0) === JSON.stringify(w1),
  );
  const base = fullPlan(route, c);
  const withNull = fullPlan(route, c, { viaDwell: null });
  check(
    'D1: the whole trip plan is byte-identical with no dwell',
    JSON.stringify(base.trip) === JSON.stringify(withNull.trip),
    kinds(withNull.trip),
  );
  const via = eventsOf(base.trip, 'via')[0];
  check(
    'D1: a dwell-less via renders as a pass-through (0 minutes, no break claim)',
    via !== undefined && via.dwellMin === 0 && via.plannedAsBreak === false,
  );
  // A dwell the legal horizon never reaches changes nothing either.
  const beyond = driveWindow(clocks({ drivingMin: 90 }), 60, {
    driveMin: 100,
    dwellMin: 60,
    qualifiesAsBreak: false,
  });
  check(
    'D1: a dwell beyond the legal horizon changes nothing',
    !('ok' in beyond) &&
      JSON.stringify(beyond) === JSON.stringify(driveWindow(clocks({ drivingMin: 90 }), 60)),
  );
}

/* ============ D2 — 60 minutes, not a break =========================== */
{
  const route = syntheticRoute(400, 100);
  // 500 driving minutes: a plausible entered clock whose horizon holds
  // exactly ONE break threshold (100), so the timer assertions are exact.
  const c = clocks({ drivingMin: 500, legalDrivingMin: 500 });
  const via = dwellAt(route, 60, false);
  check('D2: the resolved via sits at driving minute 100', via.driveMin === 100);

  // 399.8 rather than 400.0: the worst-case axis ends its last window AT
  // the route end, and the exact end mile is off the timed axis — the
  // same reason buildTripPlan probes a fraction short of the summary.
  const plain = reachWithinClocks(route.timing, c, 399.8, 0);
  const dwelled = reachWithinClocks(route.timing, c, 399.8, 0, via);
  check('D2: destination stays legally reachable here', plain !== null && dwelled !== null);
  if (plain !== null && dwelled !== null) {
    check(
      'D2: the dwell adds exactly 60 wall-clock minutes',
      dwelled.wallClockMinutes - plain.wallClockMinutes === 60,
      { plain: plain.wallClockMinutes, dwelled: dwelled.wallClockMinutes },
    );
    check(
      'D2: driving minutes are unchanged — the truck was parked',
      dwelled.driveMinutes === plain.driveMinutes,
    );
    // Window slack: 840 − (400 + 30 + 60) = 350; driving slack 100 is
    // unchanged; cycle slack 4200 − 460 = 3740. The tightest clock at
    // arrival is therefore driving, unchanged at 100 — so the −60 is
    // asserted on the window/cycle legs directly.
    check(
      'D2: window and cycle each carry the 60-minute charge',
      840 - dwelled.wallClockMinutes === 350 && dwelled.hosRemainingMinAtArrival === 100,
      dwelled,
    );
  }

  const { plan } = fullPlan(route, c, { viaDwell: via });
  check(
    'D2: the break timer is untouched — same threshold as without the dwell',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks.length === 1 &&
      plan.breakSchedule.breaks[0].dueAfterDrivingMin === 100,
    plan.breakSchedule,
  );
  check(
    'D2: a pre-via break aim point never carries the dwell',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks[0].byMs === T0 + 80 * MIN,
  );
}

/* ============ D3 — 30 qualifying minutes ARE the break =============== */
{
  const route = syntheticRoute(400, 100);
  // untilBreakMin 100: the break falls due exactly at the via. Driving
  // 500 keeps the legal horizon short of the NEXT fresh-timer threshold
  // (100 + 480 = 580), so a correctly reset timer owes nothing at all.
  const c = clocks({ drivingMin: 500, legalDrivingMin: 500 });
  const via = dwellAt(route, 30, true);
  const { plan, trip } = fullPlan(route, c, { viaDwell: via });
  check(
    'D3: no duplicate break — the schedule is empty inside this horizon',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks.length === 0,
    plan.breakSchedule,
  );
  check('D3: no break event renders in the timeline', kinds(trip) === 'start>via>destination');
  const viaEv = eventsOf(trip, 'via')[0];
  check(
    'D3: the via event shows the dwell and the break claim',
    viaEv !== undefined && viaEv.dwellMin === 30 && viaEv.plannedAsBreak === true,
  );
  check(
    'D3: the timer restarts at the via — next break due 8 driving hours on',
    (() => {
      const w = driveWindow(clocks({ untilBreakMin: 100 }), 60, via);
      if ('ok' in w) return false;
      // Fresh timer from the via: the first owed break (none inside 400
      // driving minutes) would fall at 100 + 480 = 580. Assert through
      // the arithmetic the schedule uses.
      return (
        requiredBreaksWithVia(580, 100, via) === 0 && requiredBreaksWithVia(581, 100, via) === 1
      );
    })(),
  );
  const dest = eventsOf(trip, 'destination')[0];
  check(
    'D3: the window pays the dwell alone, never dwell plus a phantom break',
    dest !== undefined && dest.arriveByMs === T0 + (400 + 30) * MIN,
    dest,
  );
}

/* ============ D4 — 29 minutes cannot satisfy the break =============== */
{
  const route = syntheticRoute(400, 100);
  const via = effectiveViaDwell({ driveMin: 100, dwellMin: 29, qualifiesAsBreak: true });
  check('D4: the claim is normalized away at the gate', via !== null && !via.qualifiesAsBreak);
  const { plan, trip } = fullPlan(route, clocks({ drivingMin: 500, legalDrivingMin: 500 }), {
    viaDwell: via,
  });
  check(
    'D4: the break remains due at the entered timer',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks.length === 1 &&
      plan.breakSchedule.breaks[0].dueAfterDrivingMin === 100,
  );
  const viaEv = eventsOf(trip, 'via')[0];
  check(
    'D4: the via event carries the dwell but never the break claim',
    viaEv !== undefined && viaEv.dwellMin === 29 && viaEv.plannedAsBreak === false,
  );
}

/* ============ D5 — 60 minutes marked No stays a non-break ============ */
{
  const route = syntheticRoute(400, 100);
  const via = dwellAt(route, 60, false);
  const { plan, trip } = fullPlan(route, clocks({ drivingMin: 500, legalDrivingMin: 500 }), {
    viaDwell: via,
  });
  check(
    'D5: duration alone never satisfies the break — it stays due',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks.length === 1 &&
      plan.breakSchedule.breaks[0].dueAfterDrivingMin === 100,
  );
  const viaEv = eventsOf(trip, 'via')[0];
  check(
    'D5: the via event never claims a break the driver declined',
    viaEv !== undefined && viaEv.dwellMin === 60 && viaEv.plannedAsBreak === false,
  );
}

/* ============ D6 — a break due before the via stays due ============== */
{
  const route = syntheticRoute(400, 100);
  const c = clocks({ untilBreakMin: 40 });
  const via = dwellAt(route, 30, true);
  const { plan, trip } = fullPlan(route, c, { viaDwell: via });
  check(
    'D6: the pre-via break is still required — dwell never satisfies it retroactively',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks[0]?.dueAfterDrivingMin === 40,
    plan.breakSchedule,
  );
  check(
    'D6: the timeline keeps the earlier break before the via',
    kinds(trip) === 'start>break>via>destination',
    kinds(trip),
  );
}

/* ============ D7 — a break due at/after the via can be satisfied ===== */
{
  const route = syntheticRoute(400, 100);
  // Due 50 driving minutes past the via; driving 500 keeps the fresh-timer
  // threshold (100 + 480) outside the horizon.
  const c = clocks({ drivingMin: 500, legalDrivingMin: 500, untilBreakMin: 150 });
  const qual = dwellAt(route, 30, true);
  const notQual = dwellAt(route, 30, false);
  const withQual = fullPlan(route, c, { viaDwell: qual });
  const withoutQual = fullPlan(route, c, { viaDwell: notQual });
  check(
    'D7: the qualifying dwell absorbs the break due after the via',
    withQual.plan.breakSchedule !== null &&
      withQual.plan.breakSchedule.problem === null &&
      withQual.plan.breakSchedule.breaks.length === 0,
    withQual.plan.breakSchedule,
  );
  check(
    'D7: without qualification the same break stays due at 150',
    withoutQual.plan.breakSchedule !== null &&
      withoutQual.plan.breakSchedule.problem === null &&
      withoutQual.plan.breakSchedule.breaks[0]?.dueAfterDrivingMin === 150,
  );
  check(
    'D7: the two timelines honestly differ by exactly that break',
    kinds(withQual.trip) === 'start>via>destination' &&
      kinds(withoutQual.trip) === 'start>via>break>destination',
    { qual: kinds(withQual.trip), notQual: kinds(withoutQual.trip) },
  );
}

/* ============ D8 — dwell flips destination reachability ============== */
{
  /*
   * Window 470 covers the 400-minute drive with no break owed (timer
   * 480) — but not the 90-minute dock stop in Atlanta. The no-dwell trip
   * ends at Macon; the dwelled trip must end at parking and the
   * clock-update boundary. Snapshot is raw-engine (timer 480 alongside
   * driving 660 exceeds validated entry, as stated at the top).
   */
  const route = syntheticRoute(400, 100);
  const c = clocks({ windowMin: 470, untilBreakMin: 480 });
  const stops = [candidate('near-a', 300), candidate('far-a', 350)];
  const via = dwellAt(route, 90, false);
  const noDwell = fullPlan(route, c, { candidates: stops });
  const dwelled = fullPlan(route, c, { candidates: stops, viaDwell: via });
  check(
    'D8: without the dwell, Macon is reachable',
    noDwell.trip.status === 'reachable' && kinds(noDwell.trip).endsWith('destination'),
    kinds(noDwell.trip),
  );
  check(
    'D8: with 90 minutes at Atlanta it is not',
    dwelled.trip.status === 'not-reachable',
    kinds(dwelled.trip),
  );
  check(
    'D8: the plan ends at qualified parking and the clock-update boundary',
    kinds(dwelled.trip) === 'start>via>parking>clock-update',
    kinds(dwelled.trip),
  );
  const parkingEv = eventsOf(dwelled.trip, 'parking')[0];
  check(
    'D8: the chosen stop is the top ranked qualified option',
    parkingEv !== undefined &&
      parkingEv.choice.candidate.id === dwelled.plan.parking[0]?.candidate.id,
  );
}

/* ============ D9 — dwell moves the parking cutoff ==================== */
{
  const route = syntheticRoute(400, 100);
  const c = clocks({ windowMin: 470, untilBreakMin: 480 });
  // 298 and 348, not 300 and 350: an exact 5-mile action boundary can
  // land in either adjacent axis window by floating point, and this
  // scenario pins exact arithmetic — so both stops sit mid-window, where
  // the worst-case minute is unambiguously the window's end (300, 350).
  const stops = [candidate('near-b', 298), candidate('far-b', 348)];
  const via = dwellAt(route, 90, false);
  const before = selectLastStops({
    timing: route.timing,
    candidates: stops,
    clocks: c,
    departAtMs: T0,
    bufferMin: 60,
  });
  const after = selectLastStops({
    timing: route.timing,
    candidates: stops,
    clocks: c,
    departAtMs: T0,
    bufferMin: 60,
    via,
  });
  check(
    'D9: both stops clear the cutoff without the dwell',
    before.eligible.some((e) => e.candidate.id === 'far-b') &&
      before.eligible.some((e) => e.candidate.id === 'near-b'),
    before.eligible.map((e) => e.candidate.id),
  );
  check(
    'D9: the dwell rejects the far stop and keeps the near one',
    !after.eligible.some((e) => e.candidate.id === 'far-b') &&
      after.eligible.some((e) => e.candidate.id === 'near-b'),
    after.eligible.map((e) => e.candidate.id),
  );
  const near = after.eligible.find((e) => e.candidate.id === 'near-b');
  check(
    'D9: the surviving stop is priced with the dwell — arrival 90 minutes later',
    near !== undefined && near.arriveAtMs === T0 + (300 + 90) * MIN && near.driveMinutes === 300,
    near,
  );
}

/* ============ D10 — the window binds BECAUSE of the dwell ============ */
{
  const c = clocks({ drivingMin: 400, windowMin: 470, untilBreakMin: 480 });
  const via: PlannedViaDwell = { driveMin: 100, dwellMin: 90, qualifiesAsBreak: false };
  const w0 = driveWindow(c, 60);
  const w1 = driveWindow(c, 60, via);
  check(
    'D10: without the dwell the 11-hour clock binds at 400',
    !('ok' in w0) && w0.clockLimitMin === 400 && w0.limitedBy === '11-hour',
    w0,
  );
  check(
    'D10: with it the window binds — 470 − 100 − 90 leaves 280 past the via',
    !('ok' in w1) && w1.clockLimitMin === 380 && w1.limitedBy === '14-hour',
    w1,
  );
  // The dwell alone exhausting the window ends the day AT the via.
  const w2 = driveWindow(clocks({ drivingMin: 400, windowMin: 150, untilBreakMin: 480 }), 60, via);
  check(
    'D10: a dwell the window cannot fund ends the day at the via',
    !('ok' in w2) && w2.clockLimitMin === 100 && w2.limitedBy === '14-hour',
    w2,
  );
}

/* ============ D11 — the cycle binds BECAUSE of the dwell ============= */
{
  const c = clocks({ drivingMin: 400, windowMin: 840, untilBreakMin: 480, cycleMin: 470 });
  const via: PlannedViaDwell = { driveMin: 100, dwellMin: 90, qualifiesAsBreak: false };
  const w0 = driveWindow(c, 60);
  const w1 = driveWindow(c, 60, via);
  check(
    'D11: without the dwell the 11-hour clock binds at 400',
    !('ok' in w0) && w0.clockLimitMin === 400 && w0.limitedBy === '11-hour',
    w0,
  );
  check(
    'D11: with it the cycle binds — the conservative on-duty charge',
    !('ok' in w1) && w1.clockLimitMin === 380 && w1.limitedBy === 'cycle',
    w1,
  );
  const w2 = driveWindow(clocks({ drivingMin: 400, untilBreakMin: 480, cycleMin: 160 }), 60, via);
  check(
    'D11: a dwell the cycle cannot fund ends the day at the via',
    !('ok' in w2) && w2.clockLimitMin === 100 && w2.limitedBy === 'cycle',
    w2,
  );
  // A qualifying claim never lifts the cycle charge — duty status is
  // unknowable here, and the conservative reading stands.
  const w3 = driveWindow(
    clocks({ drivingMin: 400, windowMin: 840, untilBreakMin: 480, cycleMin: 470 }),
    60,
    { driveMin: 100, dwellMin: 90, qualifiesAsBreak: true },
  );
  check(
    'D11: marking the dwell as a break never restores cycle time',
    !('ok' in w3) && w3.clockLimitMin === 380 && w3.limitedBy === 'cycle',
    w3,
  );
}

/* ============ D12 / D13 — dwell state invalidates the planned stop === */
{
  const app = readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  check(
    'D12: the planning signature carries the dwell minutes',
    app.includes(':dwell:${viaDwellMin}:${'),
  );
  check(
    'D13: the planning signature carries the break claim',
    app.includes("viaDwellCountsAsBreak ? 'break' : 'no-break'"),
  );
  check(
    'D12: the signature effect clears the planned stop when it moves',
    app.includes('clearPlannedStopRecord();') && app.includes('setSentStopId(null);'),
  );
  check(
    'D12: removing the via resets the dwell with it',
    /if \(next === null\) \{\s*setViaDwellMin\(0\);\s*setViaDwellCountsAsBreak\(false\);/.test(app),
  );
  check(
    'D13: shortening the dwell below 30 clears the break claim',
    app.includes('if (nextMin < HOS.MIN_BREAK_MIN) setViaDwellCountsAsBreak(false);'),
  );
  check(
    'UI: the dwell presets render from the one preset list, default 0',
    app.includes('VIA_DWELL_PRESETS.map((preset)') && app.includes('useState(0)'),
  );
  check(
    'UI: the break question only appears from 30 minutes, defaulting to No',
    app.includes('viaDwellMin >= HOS.MIN_BREAK_MIN ? (') &&
      app.includes('data-via-break-question') &&
      /useState\(false\);\n\n  \/\*\* Choose a via/.test(app),
  );
  check(
    'UI: the question is the owner-approved wording with the ELD caveat',
    app.includes('Will this stop count as your 30-minute break?') &&
      app.includes('Only choose Yes if your ELD duty status will satisfy the break requirement.'),
  );
  check(
    // TP-5 moved the quote body onto explicit request inputs (`req.*`) so
    // a resumed trip can be planned without reading half-applied state;
    // the guard's MEANING — dwell fields ride only with a via, and the
    // break claim only when the dwell can honor it — is unchanged.
    'UI: both dwell fields ride the request body, guarded by the via',
    app.includes('viaDwellMin: req.via === null ? 0 : req.viaDwellMin') &&
      app.includes('req.via !== null &&') &&
      app.includes('req.viaDwellMin >= HOS.MIN_BREAK_MIN &&') &&
      app.includes('req.viaDwellCountsAsBreak'),
  );

  const results = readFileSync('src/components/trip-planner/PlanResults.tsx', 'utf8');
  check(
    'UI: a dwelled via renders its planned minutes',
    results.includes('data-via-dwell={event.dwellMin}') &&
      results.includes('Planned stop: {event.dwellMin} min'),
  );
  check(
    'UI: the break claim renders only when the driver chose Yes',
    results.includes('event.plannedAsBreak ? (') && results.includes('data-via-break-credit'),
  );
  check(
    'UI: a dwell-less via keeps the pass-through wording',
    results.includes('without stopping'),
  );
}

/* ============ D14 — the dwell is charged exactly once ================ */
{
  /*
   * RAW ENGINE SNAPSHOT (driving 720 exceeds validated entry, as stated
   * at the top): the 700-minute drive needs more driving time than one
   * validated day holds, and this scenario needs the drive to REACH the
   * destination so every downstream timestamp can be pinned exactly.
   */
  const route = syntheticRoute(700, 100);
  const c = clocks({ drivingMin: 720, windowMin: 900, untilBreakMin: 150, legalDrivingMin: 720 });
  const via = dwellAt(route, 60, false);
  const { plan, trip } = fullPlan(route, c, { viaDwell: via });
  check(
    'D14: horizon sanity — the via, then two breaks, then the destination',
    kinds(trip) === 'start>via>break>break>destination',
    kinds(trip),
  );
  const schedule = plan.breakSchedule;
  check(
    'D14: a post-via break carries the dwell once — 130 driving + 60 dwell',
    schedule !== null &&
      schedule.problem === null &&
      schedule.breaks[0]?.byMs === T0 + (130 + 60) * MIN,
    schedule,
  );
  check(
    'D14: the second break carries dwell AND the first break, each once',
    schedule !== null &&
      schedule.problem === null &&
      schedule.breaks[1]?.byMs === T0 + (610 + 30 + 60) * MIN,
    schedule,
  );
  const viaEv = eventsOf(trip, 'via')[0];
  check(
    'D14: the via event is the ARRIVAL — dwell shown, never pre-added',
    viaEv !== undefined && viaEv.atMs === T0 + 100 * MIN && viaEv.dwellMin === 60,
    viaEv,
  );
  const dest = eventsOf(trip, 'destination')[0];
  check(
    'D14: the destination pays 700 driving + 60 break + 60 dwell, exactly',
    dest !== undefined && dest.arriveByMs === T0 + (700 + 60 + 60) * MIN,
    dest,
  );
}

/* ============ D15 — multiple breaks around a dwelled via ============= */
{
  /*
   * RAW ENGINE SNAPSHOT (driving 720 exceeds validated entry, as in the
   * TP-3 M-scenarios): two breaks and a 60-minute dwell on one axis. The
   * chronology must hold — break, via, break — with every wall-clock
   * time carrying exactly the dwell and breaks already behind it.
   */
  const route = syntheticRoute(700, 100);
  const c = clocks({ drivingMin: 720, windowMin: 900, untilBreakMin: 90, legalDrivingMin: 720 });
  const via = dwellAt(route, 60, false);
  const { trip } = fullPlan(route, c, { viaDwell: via });
  check(
    'D15: the chronology holds — break, via, break, destination',
    kinds(trip) === 'start>break>via>break>destination',
    kinds(trip),
  );
  const breaks = eventsOf(trip, 'break');
  const viaEv = eventsOf(trip, 'via')[0];
  const dest = eventsOf(trip, 'destination')[0];
  check(
    'D15: the first break precedes the via and carries nothing extra',
    breaks[0]?.byMs === T0 + 70 * MIN,
    breaks[0],
  );
  check(
    'D15: the via arrival carries the first break only',
    viaEv !== undefined && viaEv.atMs === T0 + (100 + 30) * MIN,
    viaEv,
  );
  check(
    'D15: the second break carries the first break and the dwell',
    breaks[1]?.byMs === T0 + (550 + 30 + 60) * MIN,
    breaks[1],
  );
  check(
    'D15: the destination carries both breaks and the dwell, once each',
    dest !== undefined && dest.arriveByMs === T0 + (700 + 60 + 60) * MIN,
    dest,
  );
  check(
    'D15: wall-clock order and event order agree',
    trip.status !== 'unavailable' &&
      (() => {
        const times = trip.events
          .map((e) =>
            e.kind === 'start'
              ? e.atMs
              : e.kind === 'break'
                ? e.byMs
                : e.kind === 'via'
                  ? e.atMs
                  : e.kind === 'destination'
                    ? e.arriveByMs
                    : null,
          )
          .filter((t): t is number => t !== null);
        return times.every((t, i) => i === 0 || t >= times[i - 1]);
      })(),
  );
}

/* ============ the wire — schema honesty ============================== */
{
  const base = {
    origin: { label: 'Dalton, GA', position: { lat: 34.77, lng: -84.97 } },
    destination: { label: 'Macon, GA', position: { lat: 32.84, lng: -83.63 } },
    via: { label: 'Atlanta, GA', position: { lat: 33.749, lng: -84.388 } },
    departAtMs: T0,
    clocks: {},
  };
  check(
    'wire: a plain dwell parses',
    quoteRequestSchemaChecked.safeParse({ ...base, viaDwellMin: 60 }).success,
  );
  check(
    'wire: the ceiling parses and one past it is rejected',
    quoteRequestSchemaChecked.safeParse({ ...base, viaDwellMin: VIA_DWELL_MAX_MIN }).success &&
      !quoteRequestSchemaChecked.safeParse({ ...base, viaDwellMin: VIA_DWELL_MAX_MIN + 1 }).success,
  );
  check(
    'wire: negative and fractional dwells are rejected, not repaired',
    !quoteRequestSchemaChecked.safeParse({ ...base, viaDwellMin: -5 }).success &&
      !quoteRequestSchemaChecked.safeParse({ ...base, viaDwellMin: 60.5 }).success,
  );
  check(
    'wire: a dwell without a via is rejected loudly',
    !quoteRequestSchemaChecked.safeParse({ ...base, via: null, viaDwellMin: 60 }).success &&
      quoteRequestSchemaChecked.safeParse({ ...base, via: null, viaDwellMin: 0 }).success,
  );
  check(
    'wire: a break claim under 30 minutes is rejected loudly',
    !quoteRequestSchemaChecked.safeParse({
      ...base,
      viaDwellMin: 29,
      viaDwellQualifiesForBreak: true,
    }).success &&
      quoteRequestSchemaChecked.safeParse({
        ...base,
        viaDwellMin: 30,
        viaDwellQualifiesForBreak: true,
      }).success,
  );
  check(
    'wire: omitted dwell fields default to zero and No',
    (() => {
      const parsed = quoteRequestSchemaChecked.safeParse(base);
      return (
        parsed.success &&
        parsed.data.viaDwellMin === 0 &&
        parsed.data.viaDwellQualifiesForBreak === false
      );
    })(),
  );
  check(
    'wire: the preset list starts at zero and stays inside the ceiling',
    VIA_DWELL_PRESETS[0] === 0 && VIA_DWELL_PRESETS.every((p) => p <= VIA_DWELL_MAX_MIN),
  );
}

/* ============ end to end — composeQuote on the corridor ============== */
async function corridorEndToEnd(): Promise<void> {
  const route = corridorRoute({ via: true });
  const deps = {
    loadListings: async () => corridorListings(),
    weather: nullWeatherPort,
    fuelPrice: async () => null,
    routing: { name: 'fixture', route: async () => corridorRoutingResult(route) },
  };
  const base = {
    origin: DALTON_ORIGIN,
    via: ATLANTA_VIA,
    destination: MACON_DESTINATION,
    departAtMs: T0,
    fuelLevelFraction: 1,
    mpg: DEFAULT_TRUCK_PROFILE.mpg,
    tankGallons: DEFAULT_TRUCK_PROFILE.tankGallons,
    truck: {
      heightFt: DEFAULT_TRUCK_PROFILE.heightFt,
      widthFt: DEFAULT_TRUCK_PROFILE.widthFt,
      lengthFt: DEFAULT_TRUCK_PROFILE.lengthFt,
      grossWeightLbs: DEFAULT_TRUCK_PROFILE.grossWeightLbs,
      axles: DEFAULT_TRUCK_PROFILE.axles,
      hazmatClass: null,
    },
    avoid: [] as never[],
    bufferMin: 60,
    clocks: {
      cycleRule: '70/8',
      drivingUsedMin: 0,
      windowElapsedMin: -1,
      drivingSinceBreakMin: 0,
      cycleUsedMin: 0,
    },
  };
  const noDwell = await composeQuote({ ...base, viaDwellMin: 0 } as never, deps);
  const dwelled = await composeQuote({ ...base, viaDwellMin: 60 } as never, deps);
  check('e2e: both corridor quotes compose', noDwell.ok && dwelled.ok);
  if (noDwell.ok && dwelled.ok) {
    const d0 = noDwell.tripPlan.status !== 'unavailable' ? noDwell.tripPlan : null;
    const d1 = dwelled.tripPlan.status !== 'unavailable' ? dwelled.tripPlan : null;
    const dest0 = d0?.events.find((e) => e.kind === 'destination');
    const dest1 = d1?.events.find((e) => e.kind === 'destination');
    check(
      'e2e: fresh clocks reach Macon with and without the dwell',
      dest0 !== undefined && dest1 !== undefined,
      { s0: d0?.status, s1: d1?.status },
    );
    check(
      'e2e: the dwell shifts the Macon arrival by exactly one hour',
      dest0?.kind === 'destination' &&
        dest1?.kind === 'destination' &&
        dest1.arriveByMs - dest0.arriveByMs === 60 * MIN,
      { d0: dest0, d1: dest1 },
    );
    const via1 = d1?.events.find((e) => e.kind === 'via');
    check(
      'e2e: the via event carries the dwell to the screen',
      via1?.kind === 'via' && via1.dwellMin === 60 && via1.plannedAsBreak === false,
      via1,
    );
  }
}

void corridorEndToEnd().then(() => {
  console.log(`trip-planner-via-dwell: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
