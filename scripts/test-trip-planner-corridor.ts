/*
 * TP-2 — the I-75 HOS-aware leg planner, proven on the Dalton → Atlanta →
 * Macon corridor fixture.
 *
 * Scenarios A–L from the milestone brief, each pinned deterministically:
 *
 *   A  destination reachable — terminal event, no invented parking
 *   B  driving clock binds — correct label, parking inside the cutoff
 *   C  14-hour window binds — correct cutoff
 *   D  cycle binds — correct label, cycle gates parking, no replenishment
 *   E  30-minute break — chronological event via existing planBreak
 *   F  via stop — waypoint seam + correct leg boundaries
 *   G  clock-update boundary — no invented future clocks
 *   H  fewer parking choices — honest short list, never padded
 *   I  prohibited overnight parking is never offered
 *   J  timing unavailable — no confident itinerary
 *   K  TP-1 planned-stop invalidation intact from a corridor choice
 *   L  the 60-minute buffer is explicit, never the 30 fallback
 *
 * The fixture drives at exactly 60 mph, so route-miles equal minutes and
 * every cutoff below can be checked by eye. All values are provider-shaped
 * fixture data; the engine never assumes a speed.
 */
import {
  corridorRoute,
  corridorCandidates,
  corridorListings,
  corridorRoutingResult,
  DALTON_ORIGIN,
  ATLANTA_VIA,
  MACON_DESTINATION,
} from './fixtures/i75-corridor';
import {
  buildTimeAxis,
  routeTimingFromAxis,
  timingUnavailable,
} from '@/lib/trip-planner/route-time-axis';
import { sliceTripLegs } from '@/lib/trip-planner/route-legs';
import {
  buildTripPlan,
  CLOCK_UPDATE_NOTICE,
  NO_PARKING_BEFORE_CUTOFF_NOTICE,
  type TripPlan,
  type TripPlanEvent,
} from '@/lib/trip-planner/trip-plan';
import { planMyDay, PARKING_SHORTFALL_NOTE, type PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import { driveWindow } from '@/lib/trip-planner/drive-window';
import { reachWithinClocks, selectLastStops } from '@/lib/trip-planner/last-stop';
import { rankCandidates } from '@/lib/trip-planner/directory-layer';
import { composeQuote, type QuoteResult } from '@/lib/trip-planner/compose-quote';
import { parseHereResponse, buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import { nullWeatherPort, type RoutingRequest } from '@/lib/trip-planner/providers';
import {
  plannedStopFromChoice,
  readPlannedStop,
  sharedInputsFingerprint,
} from '@/lib/trip-planner/planned-stop';
import {
  DEFAULT_TRUCK_PROFILE,
  type RemainingClocks,
  type StopCandidate,
} from '@/lib/trip-planner/types';
import { resolveRouteRegion } from '@/lib/trip-planner/route-region';

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

const T0 = 1_770_000_000_000;

const route = corridorRoute({ via: true });
const routeNoVia = corridorRoute({ via: false });
const candidates = corridorCandidates(route);
const axis = buildTimeAxis({
  maneuvers: route.maneuvers,
  positions: route.positions,
  totalSeconds: route.totalSeconds,
  totalMeters: route.totalMeters,
});
if (!axis.ok) throw new Error('fixture axis failed: ' + axis.detail);
const timing = routeTimingFromAxis(axis);
const legs = sliceTripLegs({
  maneuvers: route.maneuvers,
  sections: route.sections,
  totalSeconds: route.totalSeconds,
  totalMeters: route.totalMeters,
});
const region = resolveRouteRegion({
  origin: DALTON_ORIGIN.position,
  originCountry: 'US',
  destination: MACON_DESTINATION.position,
  destinationCountry: 'US',
});

const clocks = (over: Partial<RemainingClocks> = {}): RemainingClocks => ({
  drivingMin: 600,
  windowMin: 780,
  untilBreakMin: 480,
  cycleMin: 3000,
  limitedBy: '11-hour',
  legalDrivingMin: 600,
  ...over,
});

/** The full assembly, exactly as composeQuote wires it. */
function corridorPlan(
  c: RemainingClocks | null,
  opts: { bufferMin?: number; withVia?: boolean; candidateSet?: StopCandidate[] } = {},
): { plan: PlanMyDay; trip: TripPlan } {
  const bufferMin = opts.bufferMin ?? 60;
  const withVia = opts.withVia ?? true;
  const plan = planMyDay({
    maneuvers: route.maneuvers,
    positions: route.positions,
    totalSeconds: route.totalSeconds,
    baseSeconds: route.totalSeconds - 600,
    totalMeters: route.totalMeters,
    departureTimeParam: new Date(T0).toISOString(),
    isEstimate: false,
    clocks: c,
    bufferMin,
    departAtMs: T0,
    candidates: opts.candidateSet ?? candidates,
    alerts: [],
    region,
    alertSource: 'nws-us',
  });
  const trip = buildTripPlan({
    timing,
    clocks: c,
    bufferMin,
    departAtMs: T0,
    totalMiles: route.totalMiles,
    legs,
    labels: {
      origin: DALTON_ORIGIN.label,
      via: withVia ? ATLANTA_VIA.label : null,
      destination: MACON_DESTINATION.label,
    },
    breakSchedule: plan.breakSchedule,
    parking: plan.parking,
  });
  return { plan, trip };
}

const kinds = (t: TripPlan): string =>
  t.status === 'unavailable' ? '(unavailable)' : t.events.map((e) => e.kind).join('>');
const eventOf = <K extends TripPlanEvent['kind']>(
  t: TripPlan,
  kind: K,
): Extract<TripPlanEvent, { kind: K }> | undefined =>
  t.status === 'unavailable'
    ? undefined
    : (t.events.find((e) => e.kind === kind) as Extract<TripPlanEvent, { kind: K }> | undefined);

/* ============ fixture sanity — the corridor is what the tests assume == */
{
  check('fixture: ~161 corridor miles', Math.abs(route.totalMiles - 161) < 3, route.totalMiles);
  check(
    'fixture: mile==minute (60 mph provider)',
    Math.abs(route.totalSeconds / 60 - route.totalMiles) < 0.5,
    route.totalSeconds / 60,
  );
  check('fixture: Atlanta boundary near mile 83', Math.abs(route.atlantaMile - 82.6) < 2);
  check(
    'fixture: Dalton, Cartersville, Jackson and weigh-station rows all project on-route',
    ['fx-one9-319', 'fx-pilot-67', 'fx-ta-268', 'fx-weigh-12'].every((id) =>
      candidates.some((c) => c.id === id),
    ),
    candidates.map((c) => c.id),
  );
  const macon = candidates.find((c) => c.id === 'fx-loves-698');
  check(
    'fixture: the off-corridor Macon lot is dropped by projection, never force-fit',
    macon === undefined,
    macon?.routeMile,
  );
  const weigh = candidates.find((c) => c.id === 'fx-weigh-12');
  check(
    'fixture: weigh station projects (mid-leg-2)',
    weigh !== undefined && weigh.routeMile > 120,
  );
}

/* ============ A — destination reachable ============================== */
{
  const { trip } = corridorPlan(clocks());
  check('A: status reachable', trip.status === 'reachable', trip.status);
  check('A: events are start → via → destination', kinds(trip) === 'start>via>destination');
  const dest = eventOf(trip, 'destination');
  check('A: destination is Macon', dest?.label === MACON_DESTINATION.label, dest?.label);
  check(
    'A: no parking stop is invented for a reachable drive',
    eventOf(trip, 'parking') === undefined && eventOf(trip, 'no-parking') === undefined,
  );
  check(
    'A: no clock-update boundary on a finishable drive',
    eventOf(trip, 'clock-update') === undefined,
  );
  check(
    'A: arrival margin is subtraction from entered clocks',
    dest !== undefined && dest.clockLeftMin > 0 && dest.clockLeftMin <= 600 - route.totalMiles + 1,
    dest?.clockLeftMin,
  );
  check('A: margin clears the 60-minute buffer', dest?.withinBuffer === true);

  /*
   * OWNER-APPROVED: the legal limit decides reachability; the buffer only
   * warns. 200 driving minutes cover the ~165-minute worst-case corridor
   * legally, but the ~35-minute margin sits inside the 60 buffer — the
   * destination stays the terminal event, flagged, with no parking stop
   * manufactured and no false "not reachable".
   */
  const tight = corridorPlan(clocks({ drivingMin: 200, legalDrivingMin: 200 }));
  check(
    'A: a legally-coverable drive stays reachable inside the buffer',
    tight.trip.status === 'reachable',
  );
  const tightDest = eventOf(tight.trip, 'destination');
  check(
    'A: the tight arrival is flagged, not hidden',
    tightDest !== undefined && tightDest.withinBuffer === false && tightDest.clockLeftMin < 60,
    tightDest,
  );
  check(
    'A: no parking stop is manufactured for a tight-but-legal arrival',
    eventOf(tight.trip, 'parking') === undefined &&
      eventOf(tight.trip, 'clock-update') === undefined,
    kinds(tight.trip),
  );
  check(
    'A: worst-case provider arrival, minutes after departure ≈ corridor minutes',
    dest !== undefined &&
      dest.arriveByMs > T0 + (route.totalMiles - 5) * 60_000 &&
      dest.arriveByMs < T0 + (route.totalMiles + 10) * 60_000,
  );
}

/* ============ B — the driving clock binds ============================ */
{
  const { plan, trip } = corridorPlan(clocks({ drivingMin: 120, legalDrivingMin: 120 }));
  check('B: status not-reachable', trip.status === 'not-reachable', trip.status);
  check(
    'B: the limiting clock is the 11-hour rule',
    trip.status !== 'unavailable' && trip.limitedBy === '11-hour',
  );
  // 120 driving − 60 buffer: only stops at ≤ mile 60 qualify (mile==minute).
  check(
    'B: every offered stop fits inside the buffered cutoff',
    plan.parking.length > 0 && plan.parking.every((p) => p.candidate.routeMile <= 60),
    plan.parking.map((p) => `${p.candidate.id}@${p.candidate.routeMile}`),
  );
  check(
    'B: parking beyond the clock is rejected (Jackson at mile ~125)',
    plan.parking.every((p) => p.candidate.id !== 'fx-loves-307' && p.candidate.id !== 'fx-ta-268'),
  );
  const pk = eventOf(trip, 'parking');
  check(
    'B: the timeline carries the top qualified stop',
    pk !== undefined && pk.choice.candidate.routeMile <= 60,
  );
  check(
    'B: the timeline stop IS the first parking card — one selection, no disagreement',
    pk !== undefined &&
      plan.parking[0] !== undefined &&
      pk.choice.candidate.id === plan.parking[0].candidate.id,
  );
  check(
    'B: every choice arrives with at least the buffer in hand',
    plan.parking.every((p) => p.clockLeftMin >= 60),
    plan.parking.map((p) => p.clockLeftMin),
  );
  check('B: plan ends at the clock-update boundary', kinds(trip).endsWith('parking>clock-update'));
}

/* ============ C — the 14-hour window binds =========================== */
{
  const { plan, trip } = corridorPlan(
    clocks({ windowMin: 150, untilBreakMin: 480, limitedBy: '14-hour', legalDrivingMin: 150 }),
  );
  check('C: status not-reachable', trip.status === 'not-reachable');
  check(
    'C: the limiting clock is the 14-hour window',
    trip.status !== 'unavailable' && trip.limitedBy === '14-hour',
    trip.status !== 'unavailable' ? trip.limitedBy : trip,
  );
  // 150 window − 60 buffer → stops at ≤ mile 90 (no break owed en route).
  check(
    'C: offered stops respect the window cutoff',
    plan.parking.length > 0 && plan.parking.every((p) => p.candidate.routeMile <= 90),
    plan.parking.map((p) => p.candidate.routeMile),
  );
}

/* ============ D — the cycle binds, and gates parking ================= */
{
  const w = driveWindow(clocks({ cycleMin: 90 }), 60);
  check(
    'D: driveWindow labels the cycle, not the break',
    !('ok' in w) && w.limitedBy === 'cycle',
    w,
  );
  check('D: the cycle IS the limit value', !('ok' in w) && w.clockLimitMin === 90);

  // The relabel that hid this still fires where it is true: window binds
  // with the break inside the drive.
  const wWindow = driveWindow(clocks({ windowMin: 500 }), 60);
  check(
    'D: window-bound-with-break still reads 30-minute-break',
    !('ok' in wWindow) && wWindow.limitedBy === '30-minute-break',
    wWindow,
  );

  const { plan, trip } = corridorPlan(clocks({ cycleMin: 90 }));
  check('D: status not-reachable', trip.status === 'not-reachable');
  check(
    'D: the limiting clock is the cycle',
    trip.status !== 'unavailable' && trip.limitedBy === 'cycle',
    trip.status !== 'unavailable' ? trip.limitedBy : trip,
  );
  // 90 cycle − 60 buffer → only stops at ≤ mile 30 qualify.
  check(
    'D: the cycle gates parking reachability (≤ mile 30)',
    plan.parking.length > 0 && plan.parking.every((p) => p.candidate.routeMile <= 30),
    plan.parking.map((p) => `${p.candidate.id}@${p.candidate.routeMile}`),
  );
  check(
    'D: a stop fine on driving/window but beyond the cycle is refused',
    reachWithinClocks(timing, clocks({ cycleMin: 90 }), 48.2, 60) === null,
  );
  check(
    'D: the same stop is reachable when the cycle is not the constraint',
    reachWithinClocks(timing, clocks(), 48.2, 60) !== null,
  );
  check(
    'D: no cycle replenishment — nothing after the boundary',
    trip.status !== 'unavailable' && trip.events[trip.events.length - 1].kind === 'clock-update',
    kinds(trip),
  );
}

/* ============ E — the 30-minute break, chronologically =============== */
{
  const early = corridorPlan(clocks({ untilBreakMin: 100 }));
  check('E: reachable with a break owed', early.trip.status === 'reachable');
  check(
    'E: break appears BEFORE the via it precedes (target 80 < Atlanta 83)',
    kinds(early.trip) === 'start>break>via>destination',
    kinds(early.trip),
  );
  const brk = eventOf(early.trip, 'break');
  check('E: break aims 20 minutes early (existing BREAK_LEAD_MIN)', brk?.targetMin === 80);
  check(
    'E: break is placed by provider timing, near mile 80',
    brk !== undefined && brk.targetMile !== null && Math.abs(brk.targetMile - 80) < 6,
    brk?.targetMile,
  );

  const late = corridorPlan(clocks({ untilBreakMin: 120 }));
  check(
    'E: a later break sorts AFTER the via (target 100 > Atlanta 83)',
    kinds(late.trip) === 'start>via>break>destination',
    kinds(late.trip),
  );
  const pastEnd = corridorPlan(clocks({ untilBreakMin: 200 }));
  check(
    'E: a break clock that outlasts the drive earns no event (target 180 > 161-minute route)',
    eventOf(pastEnd.trip, 'break') === undefined,
    kinds(pastEnd.trip),
  );

  const none = corridorPlan(clocks({ untilBreakMin: 480 }));
  check(
    'E: no break event when the drive ends before the break clock',
    eventOf(none.trip, 'break') === undefined,
  );
}

/* ============ F — the via stop and its leg boundaries ================ */
{
  check('F: two legs with a via', legs.length === 2);
  check(
    'F: leg boundaries meet exactly at Atlanta',
    legs[0].endMile === route.atlantaMile && legs[1].startMile === route.atlantaMile,
    [legs[0].endMile, legs[1].startMile],
  );
  check('F: leg 1 spans 0 → Atlanta', legs[0].startMile === 0 && legs[0].endS > 0);
  check(
    'F: leg minutes are the provider section sums',
    Math.abs(legs[0].driveMinutes - route.atlantaMile) < 2 &&
      Math.abs(legs[1].driveMinutes - (route.totalMiles - route.atlantaMile)) < 2,
    [legs[0].driveMinutes, legs[1].driveMinutes],
  );
  check(
    'F: both legs carry provider-derived timing',
    legs.every((l) => l.timing.kind === 'provider'),
  );
  // Leg-local timing measures from the LEG's start: mile 10 of leg 2 is
  // provider-timed ~10 minutes after Atlanta, not after Dalton.
  const leg2 = legs[1].timing;
  const w = leg2.kind === 'provider' ? leg2.minutesToMile(10) : null;
  check(
    'F: leg-local timing is leg-relative',
    w !== null && w.latestMin > 5 && w.latestMin < 20,
    w,
  );

  const single = sliceTripLegs({
    maneuvers: routeNoVia.maneuvers,
    sections: routeNoVia.sections,
    totalSeconds: routeNoVia.totalSeconds,
    totalMeters: routeNoVia.totalMeters,
  });
  check('F: no via → one leg covering the route', single.length === 1 && single[0].startMile === 0);
  const noSections = sliceTripLegs({
    maneuvers: route.maneuvers,
    sections: undefined,
    totalSeconds: route.totalSeconds,
    totalMeters: route.totalMeters,
  });
  check('F: missing boundaries degrade to one honest leg', noSections.length === 1);

  const { trip } = corridorPlan(clocks());
  const via = eventOf(trip, 'via');
  check('F: via event at the boundary mile', via !== undefined && via.mile === route.atlantaMile);
  check(
    'F: via passage time is the exact section sum',
    via !== undefined && via.atMs === T0 + legs[0].endS * 1000,
  );
  check(
    'F: leg summaries carry the corridor labels',
    trip.status !== 'unavailable' &&
      trip.legs.length === 2 &&
      trip.legs[0].fromLabel === DALTON_ORIGIN.label &&
      trip.legs[0].toLabel === ATLANTA_VIA.label &&
      trip.legs[1].fromLabel === ATLANTA_VIA.label &&
      trip.legs[1].toLabel === MACON_DESTINATION.label,
    trip.status !== 'unavailable' ? trip.legs : trip,
  );

  // The wire seam: one via rides RoutingRequest.waypoints into HERE's via=.
  const url = buildHereRouteUrl(
    {
      origin: DALTON_ORIGIN.position,
      destination: MACON_DESTINATION.position,
      waypoints: [ATLANTA_VIA.position],
      truck: DEFAULT_TRUCK_PROFILE,
      departAtMs: T0,
    },
    'test-key-not-a-secret',
  );
  check(
    'F: the HERE URL carries the via',
    url.includes('via=33.749000%2C-84.388000'),
    url.slice(0, 0),
  );

  // The parser preserves section boundaries, cumulatively. Two sections,
  // each carrying the flexible-polyline spec's 3-point sample.
  const SPEC_POLYLINE = 'BFoz5xJ67i1B1B7PzIhaxL7Y';
  const parsed = parseHereResponse({
    routes: [
      {
        sections: [
          {
            summary: { length: 5000, duration: 300, baseDuration: 280 },
            polyline: SPEC_POLYLINE,
            actions: [
              { action: 'depart', instruction: 'Go', offset: 0, length: 5000, duration: 300 },
            ],
          },
          {
            summary: { length: 7000, duration: 400, baseDuration: 380 },
            polyline: SPEC_POLYLINE,
            actions: [
              {
                action: 'continue',
                instruction: 'Keep on',
                offset: 0,
                length: 7000,
                duration: 400,
              },
              { action: 'arrive', instruction: 'Arrive', offset: 2, length: 0, duration: 0 },
            ],
          },
        ],
      },
    ],
  });
  check('F: a two-section payload still parses', parsed !== null);
  check(
    'F: section boundaries are cumulative in every unit',
    parsed !== null &&
      parsed.sections.length === 2 &&
      parsed.sections[0].endMeters === 5000 &&
      parsed.sections[0].endSeconds === 300 &&
      parsed.sections[1].endMeters === 12000 &&
      parsed.sections[1].endSeconds === 700,
    parsed?.sections,
  );
  check(
    'F: maneuver bounds slice the concatenated list per section',
    parsed !== null &&
      parsed.sections[0].maneuverStart === 0 &&
      parsed.sections[0].maneuverEnd === 1 &&
      parsed.sections[1].maneuverStart === 1 &&
      parsed.sections[1].maneuverEnd === 3,
    parsed?.sections,
  );
  check(
    'F: the second section geometry index sits past the first',
    parsed !== null &&
      parsed.sections[0].endPositionIndex === 3 &&
      parsed.sections[1].endPositionIndex === 7,
    parsed?.sections,
  );
  const rr = corridorRoutingResult(route);
  check(
    'F: fixture RoutingResult exposes cumulative section boundaries',
    rr.summary?.sections?.length === 2 &&
      rr.summary.sections[1].endSeconds === route.totalSeconds &&
      rr.summary.sections[0].endSeconds < route.totalSeconds &&
      rr.summary.sections[0].maneuverEnd > 0,
  );
}

/* ============ G — the clock-update boundary ========================== */
{
  const { trip } = corridorPlan(clocks({ drivingMin: 120, legalDrivingMin: 120 }));
  const boundary = eventOf(trip, 'clock-update');
  check('G: boundary present after the stop', boundary !== undefined);
  check(
    'G: boundary is the LAST event — nothing is planned past it',
    kinds(trip).endsWith('clock-update'),
  );
  check(
    'G: boundary wording is the approved sentence',
    boundary?.notice === CLOCK_UPDATE_NOTICE,
    boundary?.notice,
  );
  check(
    'G: the refusal to project is stated, not implied',
    boundary !== undefined && /no 10-hour reset or recap is assumed/i.test(boundary.detail),
    boundary?.detail,
  );
  check(
    'G: no destination event — future legs are never shown as confirmed',
    eventOf(trip, 'destination') === undefined,
  );
  check(
    'G: no invented future clocks anywhere in the events',
    trip.status !== 'unavailable' && trip.events.every((e) => e.kind !== 'destination'),
  );
}

/* ============ H — fewer choices stays honest ========================= */
{
  // Worst-case action ends: ONE9 8.4 min, Pilot Dalton 11.3 min. At 69
  // driving minutes minus the 60 buffer only ONE9 clears (69−8.4 ≥ 60).
  const one = corridorPlan(clocks({ drivingMin: 69, legalDrivingMin: 69 }));
  check('H: exactly one qualified stop is offered alone', one.plan.parking.length === 1);
  check(
    'H: under the honest single-option heading',
    one.plan.parkingHeadline === '1 safe parking option found',
    one.plan.parkingHeadline,
  );
  const pk = eventOf(one.trip, 'parking');
  check('H: the timeline says zero alternatives', pk !== undefined && pk.alternatives === 0);

  // 63 driving − 60 buffer → mile 3: nothing fits.
  const none = corridorPlan(clocks({ drivingMin: 63, legalDrivingMin: 63 }));
  check('H: zero choices renders zero cards', none.plan.parking.length === 0);
  check(
    'H: and the no-parking event says so instead of padding',
    eventOf(none.trip, 'no-parking')?.notice === NO_PARKING_BEFORE_CUTOFF_NOTICE,
    kinds(none.trip),
  );

  // The messaging fix (finding 10b): a corridor whose only reachable
  // parking is paid-but-unreservable used to say "No parking … is
  // reachable" ABOVE a rendered list. The sentence now follows the list.
  const paidOnly: StopCandidate = {
    ...candidates.find((c) => c.id === 'fx-one9-319')!,
    id: 'fx-paid-only',
    name: 'Paid-only lot (fixture)',
    freeParking: null,
    paidParking: true,
    reservationUrl: null,
  };
  const contradiction = corridorPlan(clocks({ drivingMin: 120, legalDrivingMin: 120 }), {
    candidateSet: [paidOnly],
  });
  check(
    'H: paid-only reachable parking renders a card',
    contradiction.plan.parking.length === 1,
    contradiction.plan.parking.length,
  );
  check(
    'H: …with the shortfall note, never "no parking is reachable"',
    contradiction.plan.parkingProblem === PARKING_SHORTFALL_NOTE,
    contradiction.plan.parkingProblem,
  );
}

/* ============ I — prohibited overnight parking ======================= */
{
  const prohibited: StopCandidate = {
    ...candidates.find((c) => c.id === 'fx-one9-319')!,
    id: 'fx-prohibited',
    name: 'No-overnight lot (fixture)',
    overnightStatus: 'prohibited',
    parkingSpaces: 400,
    offRouteMiles: 0,
    reservationUrl: 'https://example.test/reserve/fx-prohibited',
  };
  const set = [...candidates, prohibited];
  const { plan, trip } = corridorPlan(clocks({ drivingMin: 120, legalDrivingMin: 120 }), {
    candidateSet: set,
  });
  check(
    'I: a prohibited lot never reaches the parking cards',
    plan.parking.every((p) => p.candidate.id !== 'fx-prohibited'),
    plan.parking.map((p) => p.candidate.id),
  );
  const pk = eventOf(trip, 'parking');
  check('I: nor the timeline', pk !== undefined && pk.choice.candidate.id !== 'fx-prohibited');
  const slots = selectLastStops({
    timing,
    candidates: set,
    clocks: clocks({ drivingMin: 120, legalDrivingMin: 120 }),
    departAtMs: T0,
    bufferMin: 60,
  });
  check(
    'I: nor any named slot or the eligible list',
    slots.slots.every((s) => s.candidate.id !== 'fx-prohibited') &&
      slots.eligible.every((e) => e.candidate.id !== 'fx-prohibited'),
  );
  check(
    'I: unified with rankCandidates — the paths agree',
    rankCandidates(set, 'overnight', { fromMile: 0, toMile: 200 }).every(
      (r) => r.candidate.id !== 'fx-prohibited',
    ),
  );
  check(
    'I: an unknown status is still admitted (only PROHIBITED is excluded)',
    slots.eligible.some((e) => e.candidate.id === 'fx-one9-319'),
  );
}

/* ============ J — timing unavailable ================================= */
{
  const trip = buildTripPlan({
    timing: timingUnavailable(
      'route is a straight-line estimate; provider travel times unavailable.',
    ),
    clocks: clocks(),
    bufferMin: 60,
    departAtMs: T0,
    totalMiles: route.totalMiles,
    legs,
    labels: { origin: DALTON_ORIGIN.label, via: null, destination: MACON_DESTINATION.label },
    breakSchedule: null,
    parking: [],
  });
  check('J: no confident itinerary without provider timing', trip.status === 'unavailable');
  check(
    'J: and it says why',
    trip.status === 'unavailable' &&
      trip.why === 'timing-unavailable' &&
      /estimate/.test(trip.reason),
  );
  const noClocks = corridorPlan(null);
  check(
    'J: clocks unset is its own honest refusal',
    noClocks.trip.status === 'unavailable' &&
      (noClocks.trip.status === 'unavailable' ? noClocks.trip.why : '') === 'clocks-not-set',
  );
}

/* ============ K — TP-1 handoff intact from a corridor choice ========= */
{
  const { plan } = corridorPlan(clocks({ drivingMin: 120, legalDrivingMin: 120 }));
  const choice = plan.parking[0];
  const fp = sharedInputsFingerprint({
    clocks: {
      drivingMin: 120,
      windowMin: 780,
      untilBreakMin: 480,
      cycleMin: 3000,
      cycleRule: '70/8',
    },
    truck: null,
  });
  const stop = plannedStopFromChoice(choice, T0, fp);
  check('K: a corridor parking choice becomes a planned stop', stop !== null);
  const fresh = stop === null ? null : readPlannedStop(stop, T0 + 60_000, fp);
  check('K: readable while inputs are unchanged', fresh !== null && fresh.ok === true);
  const changed = stop === null ? null : readPlannedStop(stop, T0 + 60_000, fp + '|changed');
  check(
    'K: refused as inputs-changed the moment clocks move',
    changed !== null && changed.ok === false && changed.problem === 'inputs-changed',
    changed,
  );
  const stale = stop === null ? null : readPlannedStop(stop, T0 + 13 * 3_600_000, fp);
  check(
    'K: the 12-hour TTL still backstops an unchanged record',
    stale !== null && stale.ok === false && stale.problem === 'stale',
    stale,
  );
}

/* ============ L — sixty, explicitly, never the fallback ============== */
{
  const { trip } = corridorPlan(clocks({ drivingMin: 120, legalDrivingMin: 120 }), {
    bufferMin: 60,
  });
  check(
    'L: the trip plan carries the 60 it was given',
    trip.status !== 'unavailable' && trip.bufferMin === 60,
  );

  // A stop 65 fixture-minutes out: fine under a 30 buffer, refused at 60.
  const between: StopCandidate = {
    ...candidates.find((c) => c.id === 'fx-one9-319')!,
    id: 'fx-mile-65',
    name: 'Mile 65 lot (fixture)',
    routeMile: 65,
  };
  const at60 = selectLastStops({
    timing,
    candidates: [between],
    clocks: clocks({ drivingMin: 120, legalDrivingMin: 120 }),
    departAtMs: T0,
    bufferMin: 60,
  });
  const at30 = selectLastStops({
    timing,
    candidates: [between],
    clocks: clocks({ drivingMin: 120, legalDrivingMin: 120 }),
    departAtMs: T0,
    bufferMin: 30,
  });
  check('L: 60 refuses the mile-65 stop', at60.eligible.length === 0);
  check(
    'L: 30 would have admitted it — the buffers differ where it matters',
    at30.eligible.length === 1,
  );
  check(
    'L: selectLastStops reports the buffer it was given',
    at60.bufferMin === 60 && at30.bufferMin === 30,
  );
}

/* ============ UI wiring — source-level, like TP-1's own checks ======= */
{
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const app = readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  check(
    'UI: the app holds one optional via',
    /const \[via, setVia\] = useState<ChosenPlace \| null>/.test(app),
  );
  check(
    'UI: the via rides the request body',
    /via:\s*\n?\s*via === null/.test(app) || app.includes('via === null\n              ? null'),
  );
  check(
    // TP-4 widened this pin's target: the signature's via term now also
    // carries the planned dwell and its break claim, so the one string
    // invalidates the stop on ANY of the three changes. The original
    // intent — moving the via kills the planned stop — is unchanged and
    // still asserted by the same coordinate fragment.
    'UI: changing the via invalidates the planned stop (signature)',
    app.includes("? 'via:none'") &&
      app.includes('`via:${via.position.lat.toFixed(4)}') &&
      app.includes(':dwell:${viaDwellMin}:${'),
  );
  check('UI: the via can be removed', app.includes('data-remove-via'));
  check('UI: the trip plan reaches the results screen', app.includes('tripPlan={tripPlan}'));

  const results = readFileSync('src/components/trip-planner/PlanResults.tsx', 'utf8');
  check(
    'UI: results render a Your Trip Plan section',
    results.includes('Your Trip Plan') && results.includes('data-trip-plan=""'),
  );
  check(
    'UI: every event kind renders',
    ['data-trip-event', 'data-trip-clock-update', 'data-trip-no-parking'].every((d) =>
      results.includes(d),
    ),
  );
  check(
    'UI: the boundary wording is the approved sentence, rendered verbatim',
    results.includes('{event.notice}') && results.includes('{event.detail}'),
  );
  check(
    'UI: the tight-arrival advisory is the engine sentence, single-sourced',
    results.includes('{TIGHT_ARRIVAL_NOTICE}') && results.includes('data-trip-tight-arrival'),
  );
  check(
    'UI: the classic planner is untouched — tripPlan is optional and defaulted',
    results.includes('tripPlan = null'),
  );
}

/* ============ E2E — composeQuote threads all of it =================== */
{
  const captured: RoutingRequest[] = [];
  const deps = {
    loadListings: async () => corridorListings(),
    weather: nullWeatherPort,
    fuelPrice: async () => null,
    routing: {
      name: 'fixture',
      route: async (req: RoutingRequest) => {
        captured.push(req);
        // Answer the request that was actually made: a via request gets
        // the two-section route, a plain one the single-section route.
        return corridorRoutingResult(req.waypoints.length > 0 ? route : routeNoVia);
      },
    },
  };
  const freshClocks = {
    cycleRule: '70/8' as const,
    drivingUsedMin: 0,
    windowElapsedMin: -1,
    drivingSinceBreakMin: 0,
    cycleUsedMin: 0,
  };

  const run = (body: Record<string, unknown>) =>
    composeQuote(
      {
        origin: DALTON_ORIGIN,
        destination: MACON_DESTINATION,
        departAtMs: T0,
        clocks: freshClocks,
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
        avoid: [],
        bufferMin: 60,
        via: null,
        ...body,
      } as never,
      deps,
    );

  void (async () => {
    const withVia = (await run({ via: ATLANTA_VIA })) as QuoteResult;
    check('E2E: quote succeeds', withVia.ok === true);
    check(
      'E2E: the via rides RoutingRequest.waypoints',
      captured.length === 1 &&
        captured[0].waypoints.length === 1 &&
        captured[0].waypoints[0].lat === ATLANTA_VIA.position.lat,
      captured[0]?.waypoints,
    );
    check(
      'E2E: fresh clocks reach Macon — trip plan says so',
      withVia.tripPlan.status === 'reachable',
      withVia.tripPlan.status === 'unavailable' ? withVia.tripPlan : withVia.tripPlan.status,
    );
    check(
      'E2E: two legs with the Atlanta boundary',
      withVia.tripPlan.status !== 'unavailable' && withVia.tripPlan.legs.length === 2,
    );
    check(
      'E2E: the trip plan runs on the request buffer (60)',
      withVia.tripPlan.status !== 'unavailable' && withVia.tripPlan.bufferMin === 60,
    );

    const noVia = (await run({ via: null })) as QuoteResult;
    check(
      'E2E: no via → no waypoint on the wire',
      captured.length === 2 && captured[1].waypoints.length === 0,
    );
    check(
      'E2E: no via → one leg',
      noVia.ok === true &&
        noVia.tripPlan.status !== 'unavailable' &&
        noVia.tripPlan.legs.length === 1,
    );

    const classic = (await run({ bufferMin: undefined })) as QuoteResult;
    check(
      'E2E: an omitted buffer still resolves to the classic 30 — untouched',
      classic.ok === true && classic.lastStop.bufferMin === 30,
      classic.ok === true ? classic.lastStop.bufferMin : classic,
    );

    console.log(`trip-planner-corridor: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })();
}
