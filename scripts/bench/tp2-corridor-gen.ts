/*
 * TP-2 bench generator — canned /api/trip-planner/quote responses for the
 * corridor viewport bench, computed by the REAL composeQuote against the
 * deterministic I-75 fixture (no network, no providers).
 *
 * CLI: node <bundled> <out.json>. Writes:
 *   { limited:   { quote, expectedKinds },     — cycle-limited, with via
 *     reachable: { quote, expectedKinds } }    — fresh clocks, with via
 *
 * `expectedKinds` is read FROM the generated plan, so the bench asserts
 * what this build actually produces rather than a hand-typed list that
 * could drift.
 */
import { writeFileSync } from 'node:fs';
import {
  corridorRoute,
  corridorListings,
  corridorRoutingResult,
  DALTON_ORIGIN,
  ATLANTA_VIA,
  MACON_DESTINATION,
} from '../fixtures/i75-corridor';
import { composeQuote } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
import { DEFAULT_TRUCK_PROFILE, type RemainingClocks } from '@/lib/trip-planner/types';
import { planMyDay } from '@/lib/trip-planner/plan-my-day';
import { buildTripPlan } from '@/lib/trip-planner/trip-plan';
import { sliceTripLegs } from '@/lib/trip-planner/route-legs';
import { resolveRouteRegion } from '@/lib/trip-planner/route-region';
import { toStopCandidates } from '@/lib/trip-planner/directory-layer';
import { buildTimeAxis, routeTimingFromAxis } from '@/lib/trip-planner/route-time-axis';

const out = process.argv[2];
if (!out) {
  console.error('usage: tp2-corridor-gen <out.json>');
  process.exit(2);
}

const route = corridorRoute({ via: true });
const deps = {
  loadListings: async () => corridorListings(),
  weather: nullWeatherPort,
  fuelPrice: async () => null,
  routing: { name: 'fixture', route: async () => corridorRoutingResult(route) },
};

/*
 * TP-3, THE TWO-BREAK SCENARIO — BUILT BY DIRECT ENGINE CALLS.
 *
 * Under mutually-consistent entered clocks a second required break cannot
 * arise inside one legal driving horizon: every validated entry path
 * enforces driving-since-break ≤ driving-used, so the break timer is at
 * least drivingMin − 180, which puts the SECOND break threshold at least
 * 300 minutes past the 11-hour cap. The wire (clockStateFromSimple)
 * clamps accordingly — no composeQuote request can produce two breaks.
 *
 * The multi-break engine still matters (the pure functions accept any
 * snapshot, and the bracket walk also fixed a real one-break edge), and
 * the timeline must render such a plan correctly wherever it arises. So
 * this scenario feeds the engine DIRECTLY with a raw snapshot on the
 * slow corridor (18 mph ≈ 537 driving minutes; timer 100 → breaks at 100
 * and 580… clamped horizon: breaks at 100 and 580 with a 640-min-capable
 * snapshot), and emits only the fields the UI reads.
 */
function buildTwoBreakPayload() {
  const slowRoute = corridorRoute({ via: true, speedMph: 15 });
  const clocks: RemainingClocks = {
    drivingMin: 660,
    windowMin: 840,
    untilBreakMin: 100,
    cycleMin: 4200,
    limitedBy: '11-hour',
    legalDrivingMin: 660,
  };
  const region = resolveRouteRegion({
    origin: DALTON_ORIGIN.position,
    originCountry: 'US',
    destination: MACON_DESTINATION.position,
    destinationCountry: 'US',
  });
  const plan = planMyDay({
    maneuvers: slowRoute.maneuvers,
    positions: slowRoute.positions,
    totalSeconds: slowRoute.totalSeconds,
    baseSeconds: slowRoute.totalSeconds - 600,
    totalMeters: slowRoute.totalMeters,
    departureTimeParam: new Date(base.departAtMs).toISOString(),
    isEstimate: false,
    clocks,
    bufferMin: 60,
    departAtMs: base.departAtMs,
    candidates: toStopCandidates(corridorListings(), slowRoute.routePoints, 5),
    alerts: [],
    region,
    alertSource: 'nws-us',
  });
  const axis = buildTimeAxis({
    maneuvers: slowRoute.maneuvers,
    positions: slowRoute.positions,
    totalSeconds: slowRoute.totalSeconds,
    totalMeters: slowRoute.totalMeters,
  });
  if (!axis.ok) throw new Error('slow-route axis failed: ' + axis.detail);
  const tripPlan = buildTripPlan({
    timing: routeTimingFromAxis(axis),
    clocks,
    bufferMin: 60,
    departAtMs: base.departAtMs,
    totalMiles: slowRoute.totalMiles,
    legs: sliceTripLegs({
      maneuvers: slowRoute.maneuvers,
      sections: slowRoute.sections,
      totalSeconds: slowRoute.totalSeconds,
      totalMeters: slowRoute.totalMeters,
    }),
    labels: {
      origin: DALTON_ORIGIN.label,
      via: ATLANTA_VIA.label,
      destination: MACON_DESTINATION.label,
    },
    breakSchedule: plan.breakSchedule,
    parking: plan.parking,
  });
  return { ok: true as const, plan, tripPlan };
}

const base = {
  origin: DALTON_ORIGIN,
  via: ATLANTA_VIA,
  destination: MACON_DESTINATION,
  departAtMs: 1_770_000_000_000,
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
};

async function main() {
  // Fresh clocks: the whole corridor is legally coverable.
  const reachable = await composeQuote(
    {
      ...base,
      clocks: {
        cycleRule: '70/8',
        drivingUsedMin: 0,
        windowElapsedMin: -1,
        drivingSinceBreakMin: 0,
        cycleUsedMin: 0,
      },
    } as never,
    deps,
  );
  // A worn cycle: 4200 − 4110 = 90 minutes left. The cycle binds and the
  // plan must end at a parking stop with the clock-update boundary.
  const limited = await composeQuote(
    {
      ...base,
      clocks: {
        cycleRule: '70/8',
        drivingUsedMin: 60,
        windowElapsedMin: 120,
        drivingSinceBreakMin: 60,
        cycleUsedMin: 4110,
      },
    } as never,
    deps,
  );

  const twoBreaks = buildTwoBreakPayload();

  if (!reachable.ok || !limited.ok || !twoBreaks.ok) {
    console.error('generator: composeQuote failed', reachable, limited, twoBreaks);
    process.exit(1);
  }
  const kinds = (q: {
    ok: boolean;
    tripPlan?: import('@/lib/trip-planner/trip-plan').TripPlan;
  }): string[] =>
    q.ok && q.tripPlan !== undefined && q.tripPlan.status !== 'unavailable'
      ? q.tripPlan.events.map((e) => e.kind)
      : [];

  const reachKinds = kinds(reachable);
  const limitedKinds = kinds(limited);
  const twoBreakKinds = kinds(twoBreaks);
  if (
    !reachKinds.includes('destination') ||
    !limitedKinds.includes('clock-update') ||
    twoBreakKinds.filter((k) => k === 'break').length < 2
  ) {
    console.error('generator: scenarios did not produce the expected shapes', {
      reachKinds,
      limitedKinds,
      twoBreakKinds,
    });
    process.exit(1);
  }

  writeFileSync(
    out,
    JSON.stringify({
      reachable: { quote: reachable, expectedKinds: reachKinds },
      limited: { quote: limited, expectedKinds: limitedKinds },
      twoBreaks: { quote: twoBreaks, expectedKinds: twoBreakKinds },
    }),
  );
  console.log(
    `tp2-corridor-gen: reachable=[${reachKinds}] limited=[${limitedKinds}] twoBreaks=[${twoBreakKinds}]`,
  );
}

void main();
