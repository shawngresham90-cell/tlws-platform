/*
 * TP-3 — repeated 30-minute breaks, modeled correctly.
 *
 * The engine used to charge AT MOST ONE break against the non-pausing
 * 14-hour window. On a horizon long enough for a second break (the break
 * timer plus a further 8 driving hours) that undercharged the window —
 * a destination or stop could look reachable when the second break's 30
 * minutes made it not. These scenarios pin the corrected model:
 *
 *   M1  zero breaks — trip ends before one is due; pre-TP-3 result
 *   M2  one break — the existing case, preserved, wrapper-equivalent
 *   M3  two breaks — both charged, both rendered, window down 60
 *   M4  second break flips destination to unreachable
 *   M5  second break rejects a parking candidate
 *   M6  cycle binds first — no phantom second break, label 'cycle'
 *   M7  11-hour binds first — no phantom second break
 *   M8  window binds under repeated breaks — correct labels
 *   M9  via between the breaks — one axis, correct order and dwell
 *   M10 tight-but-legal destination — advisory, never forced parking
 *   M11 timing unavailable — no confident break placement
 *   M12 TP-1 planned-stop invalidation untouched
 *
 * Every route here is a synthetic PROVIDER-SHAPED axis at exactly 60 mph
 * (5-mile / 300-second actions), so route-miles equal minutes and every
 * charge below is hand-checkable. Fixture data plays the provider; the
 * engine never assumes a speed.
 */
import {
  buildTimeAxis,
  routeTimingFromAxis,
  timingUnavailable,
  type RouteTiming,
} from '@/lib/trip-planner/route-time-axis';
import {
  driveWindow,
  nthBreakDueAfterMin,
  requiredBreaksBefore,
} from '@/lib/trip-planner/drive-window';
import { planBreak, planBreakSchedule } from '@/lib/trip-planner/break-plan';
import { reachWithinClocks, selectLastStops } from '@/lib/trip-planner/last-stop';
import { sliceTripLegs } from '@/lib/trip-planner/route-legs';
import { buildTripPlan, type TripPlan, type TripPlanEvent } from '@/lib/trip-planner/trip-plan';
import { planMyDay, type PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import {
  plannedStopFromChoice,
  readPlannedStop,
  sharedInputsFingerprint,
} from '@/lib/trip-planner/planned-stop';
import { resolveRouteRegion } from '@/lib/trip-planner/route-region';
import { HOS, type RemainingClocks, type StopCandidate } from '@/lib/trip-planner/types';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { RouteSection } from '@/lib/trip-planner/providers';

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

const T0 = 1_780_000_000_000;

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
  opts: { bufferMin?: number; candidates?: StopCandidate[]; via?: boolean } = {},
): { plan: PlanMyDay; trip: TripPlan } {
  const bufferMin = opts.bufferMin ?? 60;
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
      via: (opts.via ?? route.legs.length > 1) ? 'Atlanta, GA' : null,
      destination: 'Macon, GA',
    },
    breakSchedule: plan.breakSchedule,
    parking: plan.parking,
  });
  return { plan, trip };
}

const kinds = (t: TripPlan): string =>
  t.status === 'unavailable' ? '(unavailable)' : t.events.map((e) => e.kind).join('>');
const eventsOf = <K extends TripPlanEvent['kind']>(t: TripPlan, kind: K) =>
  t.status === 'unavailable'
    ? []
    : (t.events.filter((e) => e.kind === kind) as Extract<TripPlanEvent, { kind: K }>[]);

/* ============ the primitives — one break-arithmetic truth ============ */
{
  check('primitive: no break at or before the timer', requiredBreaksBefore(100, 100) === 0);
  check('primitive: strictly past the timer owes one', requiredBreaksBefore(101, 100) === 1);
  check(
    'primitive: 8 further driving hours owe the second',
    requiredBreaksBefore(581, 100) === 2 && requiredBreaksBefore(580, 100) === 1,
  );
  check(
    'primitive: the k-th due point is timer + (k−1)·480',
    nthBreakDueAfterMin(100, 1) === 100 && nthBreakDueAfterMin(100, 2) === 580,
  );
  check(
    'primitive: strict at EVERY later boundary too',
    requiredBreaksBefore(1060, 100) === 2 && requiredBreaksBefore(1061, 100) === 3,
  );
}

/* ============ M1 — zero breaks inside the trip ======================= */
{
  const route = syntheticRoute(200, null);
  const { trip } = fullPlan(route, clocks({ untilBreakMin: 480 }), { via: false });
  check('M1: reachable', trip.status === 'reachable');
  check(
    'M1: no break events — the trip ends before one is due',
    eventsOf(trip, 'break').length === 0,
  );
  check('M1: pre-TP-3 shape preserved', kinds(trip) === 'start>destination', kinds(trip));

  // And a horizon that owes NO break at all yields an empty schedule.
  const none = planBreakSchedule({
    clocks: clocks({ drivingMin: 400, untilBreakMin: 480, legalDrivingMin: 400 }),
    usableDriveMin: 400,
    timing: route.timing,
    departAtMs: T0,
  });
  check(
    'M1: an unowed horizon schedules nothing',
    none.problem === null && none.breaks.length === 0,
  );
}

/* ============ M2 — one break, behavior preserved ===================== */
{
  const route = syntheticRoute(200, null);
  const c = clocks();
  const w = driveWindow(c, 60);
  if ('ok' in w) throw new Error('window refused');
  const schedule = planBreakSchedule({
    clocks: c,
    usableDriveMin: w.clockLimitMin,
    timing: route.timing,
    departAtMs: T0,
  });
  const single = planBreak({
    clocks: c,
    usableDriveMin: w.clockLimitMin,
    timing: route.timing,
    departAtMs: T0,
  });
  check(
    'M2: planBreak is the schedule’s first entry — one truth, wrapper-equivalent',
    schedule.problem === null &&
      single.required === true &&
      schedule.breaks[0].targetMin === single.targetMin &&
      schedule.breaks[0].byMs === single.byMs &&
      schedule.breaks[0].targetMile === single.targetMile,
    { schedule, single },
  );
  const { trip } = fullPlan(route, c, { via: false });
  check(
    'M2: single-break trip shape preserved',
    kinds(trip) === 'start>break>destination',
    kinds(trip),
  );
  const brk = eventsOf(trip, 'break')[0];
  check(
    'M2: the break aims 20 minutes early, as before',
    brk !== undefined && brk.targetMin === 80,
  );
}

/* ============ M3 — two breaks, both charged, both rendered =========== */
{
  const route = syntheticRoute(640, 350);
  const c = clocks(); // 660 driving, 840 window, timer 100, cycle 4200
  const w = driveWindow(c, 60);
  if ('ok' in w) throw new Error('window refused');
  check('M3: the drive window charges BOTH breaks', w.requiredBreakCount === 2, w);
  check(
    'M3: the legal limit is still the 11-hour cap',
    w.clockLimitMin === 660 && w.limitedBy === '11-hour',
    w,
  );

  const reach = reachWithinClocks(route.timing, c, route.totalMiles - 0.2, 0);
  check('M3: destination reachable with both breaks charged', reach !== null);
  check(
    'M3: the wall clock carries exactly 60 minutes of break dwell',
    reach !== null && Math.round(reach.wallClockMinutes - reach.driveMinutes) === 60,
    reach,
  );

  const { plan, trip } = fullPlan(route, c);
  check(
    'M3: the schedule holds two breaks at timer and timer+480',
    plan.breakSchedule !== null &&
      plan.breakSchedule.problem === null &&
      plan.breakSchedule.breaks.length === 2 &&
      plan.breakSchedule.breaks[0].dueAfterDrivingMin === 100 &&
      plan.breakSchedule.breaks[1].dueAfterDrivingMin === 580,
    plan.breakSchedule,
  );
  check(
    'M3: both breaks render chronologically around the via',
    kinds(trip) === 'start>break>via>break>destination',
    kinds(trip),
  );
  check(
    'M3: the card notes the further break through the same schedule',
    plan.breakSchedule !== null && plan.breakSchedule.breaks.length > 1,
  );
  const dest = eventsOf(trip, 'destination')[0];
  check(
    'M3: arrival margin subtracts drive AND both breaks from the window',
    dest !== undefined &&
      dest.clockLeftMin === Math.floor(Math.min(660 - 640, 840 - 700, 4200 - 640)),
    dest?.clockLeftMin,
  );
}

/* ============ M4 — the second break flips the destination ============ */
{
  const route = syntheticRoute(640, 350);
  const c = clocks({ windowMin: 685 });
  // The OLD one-break model would have admitted this arrival:
  check('M4: one-break arithmetic would have said reachable', 685 - (640 + 30) >= 0);
  check('M4: two-break arithmetic says it is not', 685 - (640 + 60) < 0);
  const reach = reachWithinClocks(route.timing, c, route.totalMiles - 0.2, 0);
  check('M4: the corrected model refuses the destination', reach === null);

  const { trip } = fullPlan(route, c, { candidates: [candidate('near', 300)] });
  check('M4: status not-reachable', trip.status === 'not-reachable');
  check(
    'M4: the plan ends at parking and the clock-update boundary instead',
    kinds(trip).endsWith('parking>clock-update'),
    kinds(trip),
  );
  check('M4: no destination event is rendered', eventsOf(trip, 'destination').length === 0);
}

/* ============ M5 — the second break rejects a parking candidate ====== */
{
  const route = syntheticRoute(640, null);
  const c = clocks({ windowMin: 705 });
  const far = candidate('far-590', 590); // beyond the second break threshold (580)
  const near = candidate('near-300', 300);

  // Old model: 705 − (590+30) = 85 ≥ 60 → would have been admitted.
  check('M5: one-break arithmetic would have admitted the far stop', 705 - (590 + 30) - 60 >= 0);
  check(
    'M5: the corrected filter refuses it — its second break exhausts the window',
    reachWithinClocks(route.timing, c, 590, 60) === null,
  );
  const stops = selectLastStops({
    timing: route.timing,
    candidates: [far, near],
    clocks: c,
    departAtMs: T0,
    bufferMin: 60,
  });
  check(
    'M5: selection rejects the far stop and keeps the near one',
    stops.eligible.every((e) => e.candidate.id !== 'far-590') &&
      stops.eligible.some((e) => e.candidate.id === 'near-300'),
    stops.eligible.map((e) => e.candidate.id),
  );
}

/* ============ M6 — the cycle binds before a second break ============= */
{
  const c = clocks({ cycleMin: 200, untilBreakMin: 30 });
  const w = driveWindow(c, 60);
  check(
    'M6: the cycle stays the label and no phantom second break is charged',
    !('ok' in w) &&
      w.limitedBy === 'cycle' &&
      w.clockLimitMin === 200 &&
      w.requiredBreakCount === 1,
    w,
  );
}

/* ============ M7 — the 11-hour rule binds before a second break ====== */
{
  const c = clocks({ drivingMin: 300, untilBreakMin: 30, legalDrivingMin: 300 });
  const w = driveWindow(c, 60);
  check(
    'M7: driving stays the label and only the owed break is charged',
    !('ok' in w) &&
      w.limitedBy === '11-hour' &&
      w.clockLimitMin === 300 &&
      w.requiredBreakCount === 1,
    w,
  );
}

/* ============ M8 — the window binds under repeated breaks ============ */
{
  // 660 driving and 4200 cycle both outlast a 700-minute window that must
  // fund two breaks: 640 driving + 60 dwell = 700 exactly.
  const mid = driveWindow(clocks({ windowMin: 700, untilBreakMin: 30 }), 60);
  check(
    'M8: the 14-hour label is kept when the window truly expires mid-drive',
    !('ok' in mid) &&
      mid.limitedBy === '14-hour' &&
      mid.clockLimitMin === 640 &&
      mid.requiredBreakCount === 2,
    mid,
  );
  /*
   * And the break-edge case: a 560-minute window funds driving to the
   * SECOND break threshold (510) but not the break plus more driving —
   * the break requirement itself ends the day, and says so.
   */
  const edge = driveWindow(clocks({ windowMin: 560, untilBreakMin: 30 }), 60);
  check(
    'M8: a limit sitting on a break threshold is labeled 30-minute-break',
    !('ok' in edge) && edge.limitedBy === '30-minute-break' && edge.clockLimitMin === 510,
    edge,
  );
  check(
    'M8: …with exactly the breaks actually taken before it',
    !('ok' in edge) && edge.requiredBreakCount === 1,
    edge,
  );
  check(
    'M8: a break never buys driving beyond the caps',
    !('ok' in mid) && mid.clockLimitMin + HOS.MIN_BREAK_MIN * mid.requiredBreakCount === 700,
  );
}

/* ============ M9 — the via sits between the breaks =================== */
{
  const route = syntheticRoute(640, 350);
  const c = clocks(); // breaks aim at 80 and 560; via passes at 350
  const { trip } = fullPlan(route, c);
  const order = kinds(trip);
  check(
    'M9: chronological across the section boundary',
    order === 'start>break>via>break>destination',
    order,
  );
  const via = eventsOf(trip, 'via')[0];
  check(
    'M9: the via passage time includes the first break’s 30-minute dwell',
    via !== undefined && via.atMs === T0 + (350 * 60 + 30 * 60) * 1000,
    via ? (via.atMs - T0) / 60_000 : via,
  );
  const breaks = eventsOf(trip, 'break');
  check(
    'M9: the second break’s clock time includes the first’s dwell',
    breaks.length === 2 && breaks[1].byMs === T0 + (560 + 30) * 60_000,
    breaks.map((b) => (b.byMs - T0) / 60_000),
  );
}

/* ============ M10 — tight-but-legal stays advisory =================== */
{
  const route = syntheticRoute(640, 350);
  const { trip } = fullPlan(route, clocks({ windowMin: 720 }));
  check('M10: reachable on the legal limit', trip.status === 'reachable');
  const dest = eventsOf(trip, 'destination')[0];
  check(
    'M10: the sub-buffer margin is flagged, not hidden',
    dest !== undefined && dest.withinBuffer === false && dest.clockLeftMin < 60,
    dest?.clockLeftMin,
  );
  check(
    'M10: no parking stop is manufactured',
    eventsOf(trip, 'parking').length === 0 && eventsOf(trip, 'clock-update').length === 0,
  );
}

/* ============ M11 — no timing, no confident break placement ========== */
{
  const schedule = planBreakSchedule({
    clocks: clocks(),
    usableDriveMin: 660,
    timing: timingUnavailable(
      'route is a straight-line estimate; provider travel times unavailable.',
    ),
    departAtMs: T0,
  });
  check(
    'M11: owed breaks without provider timing refuse placement',
    schedule.breaks.length === 0 &&
      schedule.problem !== null &&
      /provider/.test(schedule.problem ?? ''),
    schedule,
  );
}

/* ============ M12 — TP-1 invalidation untouched ====================== */
{
  const fp = sharedInputsFingerprint({
    clocks: {
      drivingMin: 660,
      windowMin: 840,
      untilBreakMin: 100,
      cycleMin: 4200,
      cycleRule: '70/8',
    },
    truck: null,
  });
  const route = syntheticRoute(640, null);
  const c = clocks({ windowMin: 685 });
  const { plan } = fullPlan(route, c, { candidates: [candidate('near', 300)], via: false });
  const choice = plan.parking[0];
  const stop = choice === undefined ? null : plannedStopFromChoice(choice, T0, fp);
  check('M12: a multi-break plan’s stop still becomes a planned stop', stop !== null);
  check(
    'M12: inputs-changed still refuses the record',
    stop !== null && readPlannedStop(stop, T0 + 60_000, fp + '|x').ok === false,
  );
  const stale = stop === null ? null : readPlannedStop(stop, T0 + 13 * 3_600_000, fp);
  check('M12: the 12-hour TTL still backstops', stale !== null && stale.ok === false);
}

console.log(`trip-planner-multi-break: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
