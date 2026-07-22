/**
 * Phase 3 unit tests: HOS engine, cost engine, directory layer, route
 * optimizer, ETA math, API contracts, edge cases, and validation failures.
 * Pure logic only — no network, no database. The offline provider registry
 * (all null adapters) is exercised to prove the engine needs no provider.
 *
 * Run:
 *   npx esbuild scripts/test-trip-planner.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-trip-planner.cjs \
 *   && node /tmp/test-trip-planner.cjs
 */
import {
  freshClockState,
  advance,
  remainingClocks,
  legalDrivingMin,
  planDrive,
  earliestArrivalMs,
  validateClockState,
  cycleUsedMin,
} from '@/lib/trip-planner/hos-engine';
import {
  buildRoute,
  DEFAULT_PLANNER_OPTIONS,
  DEFAULT_TRUCK_PROFILE,
  HOS,
  type ClockState,
  type CostInputs,
  type RouteLeg,
  type StopCandidate,
  type TripRequest,
} from '@/lib/trip-planner/types';
import {
  fuelGallons,
  estimateTripCost,
  dailyCosts,
  costPerMileCents,
  validateCostInputs,
} from '@/lib/trip-planner/cost-engine';
import {
  projectOntoRoute,
  toStopCandidates,
  scoreCandidate,
  rankCandidates,
  recommendFuelStops,
  recommendParking,
  type DirectoryListing,
  type RoutePoint,
} from '@/lib/trip-planner/directory-layer';
import { planTrip, quickEta, driveMinutesBetween } from '@/lib/trip-planner/optimizer';
import { offlineProviders } from '@/lib/trip-planner/providers';
import {
  planTripRequestSchema,
  clockStateSchema,
  routeSchema,
  stopSearchRequestSchema,
  hosSimulateRequestSchema,
} from '@/lib/trip-planner/api-contracts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const T0 = 1_750_000_000_000; // fixed epoch base for determinism

/* ================================================================ HOS engine */

// Fresh state basics.
const fresh = freshClockState(T0);
check('hos: fresh has full 11', remainingClocks(fresh).drivingMin === HOS.MAX_DRIVING_MIN);
check('hos: fresh has full 14 window', remainingClocks(fresh).windowMin === HOS.MAX_WINDOW_MIN);
check(
  'hos: fresh has full break clock',
  remainingClocks(fresh).untilBreakMin === HOS.BREAK_AFTER_DRIVING_MIN,
);
check('hos: fresh 70-cycle full', remainingClocks(fresh).cycleMin === HOS.CYCLE_70_MIN);
check(
  'hos: fresh legal driving = 8h (break clock binds first)',
  legalDrivingMin(fresh) === HOS.BREAK_AFTER_DRIVING_MIN,
);
check(
  'hos: fresh 60/7 cycle',
  remainingClocks(freshClockState(T0, '60/7')).cycleMin === HOS.CYCLE_60_MIN,
);

// 11-hour rule.
{
  let s = fresh;
  s = advance(s, 'driving', 8 * 60).state; // to break limit
  s = advance(s, 'off-duty', 30).state; // break
  const r1 = remainingClocks(s);
  check('hos: after 8h drive + break, 3h driving left', r1.drivingMin === 3 * 60);
  const step = advance(s, 'driving', 3 * 60);
  check('hos: driving exactly to 11h is legal', step.violations.length === 0);
  const over = advance(step.state, 'driving', 10);
  check(
    'hos: driving past 11h violates',
    over.violations.some((v) => v.rule === '11-hour'),
  );
}

// 14-hour window is wall-clock: breaks never pause it.
{
  let s = fresh;
  s = advance(s, 'driving', 4 * 60).state;
  s = advance(s, 'off-duty', 5 * 60).state; // long lunch (< 10h, no reset)
  check(
    'hos: off-duty consumes the open 14h window',
    s.windowElapsedMin === 9 * 60,
    s.windowElapsedMin,
  );
  const rc = remainingClocks(s);
  check(
    'hos: window binds after long lunch (5h left, not 7h)',
    rc.windowMin === 5 * 60 && rc.limitedBy === '14-hour',
    rc,
  );
  // Window fully spent by dwell alone: driving afterwards violates.
  const spent = advance(s, 'off-duty', 6 * 60).state; // 15h since start, no reset (streak 11h? no — 5h+6h=11h ≥10h → reset!)
  check(
    'hos: 11h continuous rest actually resets instead',
    remainingClocks(spent).windowMin === HOS.MAX_WINDOW_MIN,
  );
  // Interrupted dwell: 5h off, 1m on-duty, 5h off → no reset, window exhausted.
  let w = advance(s, 'on-duty', 1).state;
  w = advance(w, 'off-duty', 5 * 60).state;
  const rcw = remainingClocks(w);
  check(
    'hos: fragmented 14h+ day exhausts window',
    rcw.windowMin === 0 && rcw.legalDrivingMin === 0,
    rcw,
  );
  const drive = advance(w, 'driving', 10);
  check(
    'hos: driving after window exhausted violates',
    drive.violations.some((v) => v.rule === '14-hour'),
  );
}

// 30-minute break rule.
{
  let s = fresh;
  const to8h = advance(s, 'driving', 8 * 60);
  check('hos: exactly 8h driving legal', to8h.violations.length === 0);
  const past = advance(to8h.state, 'driving', 1);
  check(
    'hos: 8h+1min without break violates',
    past.violations.some((v) => v.rule === '30-minute-break'),
  );
  const short = advance(to8h.state, 'off-duty', 29).state;
  check('hos: 29-min break does NOT clear break clock', remainingClocks(short).untilBreakMin === 0);
  const okBreak = advance(to8h.state, 'off-duty', 30).state;
  check(
    'hos: 30-min break clears break clock',
    remainingClocks(okBreak).untilBreakMin === HOS.BREAK_AFTER_DRIVING_MIN,
  );
  // 2020 rule (§395.3(a)(3)(ii) as amended): ANY ≥30-min non-driving period
  // satisfies the break, including on-duty-not-driving (fueling, loading).
  const onDutyBreak = advance(to8h.state, 'on-duty', 30).state;
  check(
    'hos: 30-min ON-DUTY period satisfies the break (2020 rule)',
    remainingClocks(onDutyBreak).untilBreakMin === HOS.BREAK_AFTER_DRIVING_MIN,
  );
}

// 10-hour reset.
{
  let s = fresh;
  s = advance(s, 'driving', 8 * 60).state;
  s = advance(s, 'off-duty', 30).state;
  s = advance(s, 'driving', 3 * 60).state; // 11h used
  check('hos: 11h exhausted', remainingClocks(s).drivingMin === 0);
  const partRest = advance(s, 'sleeper', 9 * 60).state;
  check('hos: 9h rest does not reset 11', remainingClocks(partRest).drivingMin === 0);
  const rested = advance(partRest, 'sleeper', 60).state; // total 10h continuous
  check(
    'hos: split 9+1 continuous rest sums to reset',
    remainingClocks(rested).drivingMin === HOS.MAX_DRIVING_MIN,
  );
  check('hos: reset reopens 14 window', remainingClocks(rested).windowMin === HOS.MAX_WINDOW_MIN);
  const broken = advance(advance(s, 'sleeper', 9 * 60).state, 'driving', 1).state;
  check(
    'hos: driving breaks the rest streak',
    remainingClocks(advance(broken, 'sleeper', 9 * 60 + 59).state).drivingMin === 0,
  );
}

// 60/70-hour cycle + 34-hour restart.
{
  let s = freshClockState(T0, '70/8');
  // 5 days of 13h on-duty (8 drive + break + more drive pattern approximated as on-duty)
  for (let d = 0; d < 5; d++) {
    s = advance(s, 'driving', 8 * 60).state;
    s = advance(s, 'off-duty', 30).state;
    s = advance(s, 'driving', 3 * 60).state;
    s = advance(s, 'on-duty', 90).state; // 12.5h on-duty/day
    s = advance(s, 'sleeper', 10 * 60).state;
  }
  const used = cycleUsedMin(s);
  check('hos: 5 days × 12.5h ≈ 62.5h cycle used', approx(used, 62.5 * 60, 30), used);
  const rc = remainingClocks(s);
  check('hos: cycle remaining ≈ 7.5h and binds', approx(rc.cycleMin, 7.5 * 60, 30));
  // Drive past the cycle: violation.
  let s2 = s;
  s2 = advance(s2, 'driving', 8 * 60).state;
  const overCycle = advance(advance(s2, 'off-duty', 30).state, 'driving', 60);
  check(
    'hos: driving over 70h cycle violates',
    overCycle.violations.some((v) => v.rule === '70-hour'),
  );
  // 34-hour restart clears the cycle.
  const restarted = advance(s, 'sleeper', HOS.RESTART_MIN).state;
  check('hos: 34-hour restart zeroes cycle', cycleUsedMin(restarted) === 0);
  check(
    'hos: restart also resets 11/14',
    remainingClocks(restarted).drivingMin === HOS.MAX_DRIVING_MIN,
  );
}

// planDrive arrival-time calculations.
{
  const p1 = planDrive(fresh, 6 * 60);
  check('eta: 6h drive needs no rest', p1.rests.length === 0 && p1.totalMinutes === 6 * 60);
  const p2 = planDrive(fresh, 10 * 60);
  check(
    'eta: 10h drive inserts exactly one 30-min break',
    p2.rests.length === 1 && p2.rests[0].kind === '30-minute-break',
  );
  check('eta: 10h drive total = 10h + 30m', p2.totalMinutes === 10 * 60 + 30);
  check('eta: break lands at the 8h mark', p2.rests[0].startOffsetMin === 8 * 60);
  const p3 = planDrive(fresh, 20 * 60);
  check(
    'eta: 20h drive includes a 10-hour reset',
    p3.rests.some((r) => r.kind === '10-hour-reset'),
  );
  check(
    'eta: 20h drive total accounts breaks+reset',
    p3.totalMinutes === 20 * 60 + 30 + 10 * 60 + 30,
    p3.totalMinutes,
  );
  check('eta: plan segments drive time sums to request', p3.driveMinutes === 20 * 60);
  check(
    'eta: earliestArrivalMs consistent',
    earliestArrivalMs(fresh, 20 * 60) === T0 + p3.totalMinutes * 60_000,
  );
  const p0 = planDrive(fresh, 0);
  check('eta: zero drive = zero plan', p0.totalMinutes === 0 && p0.rests.length === 0);
}

// validateClockState failures.
{
  check('validate: fresh state valid', validateClockState(fresh).length === 0);
  check(
    'validate: negative driving rejected',
    validateClockState({ ...fresh, drivingUsedMin: -1 }).length > 0,
  );
  check(
    'validate: driving without window rejected',
    validateClockState({ ...fresh, drivingUsedMin: 60, windowElapsedMin: -1 }).length > 0,
  );
  check(
    'validate: break > driving rejected',
    validateClockState({
      ...fresh,
      drivingUsedMin: 30,
      windowElapsedMin: 30,
      drivingSinceBreakMin: 60,
    }).length > 0,
  );
  check(
    'validate: bad cycle rule rejected',
    validateClockState({ ...fresh, cycleRule: 'bogus' as never }).length > 0,
  );
  check(
    'validate: empty day buckets rejected',
    validateClockState({ ...fresh, onDutyByDayMin: [] }).length > 0,
  );
}

/* ================================================================ cost engine */

const LEGS: RouteLeg[] = [
  {
    seq: 0,
    from: { label: 'Atlanta', position: { lat: 33.749, lng: -84.388 } },
    to: { label: 'Chattanooga', position: { lat: 35.0456, lng: -85.3097 } },
    distanceMiles: 118,
    avgSpeedMph: 59,
    perStateMiles: { GA: 111, TN: 7 },
  },
  {
    seq: 1,
    from: { label: 'Chattanooga', position: { lat: 35.0456, lng: -85.3097 } },
    to: { label: 'Knoxville', position: { lat: 35.9606, lng: -83.9207 } },
    distanceMiles: 112,
    avgSpeedMph: 56,
    perStateMiles: { TN: 112 },
  },
];
const ROUTE = buildRoute(LEGS);
check(
  'route: totals computed',
  ROUTE.totalMiles === 230 && ROUTE.driveMinutes === Math.round((118 / 59 + 112 / 56) * 60),
);

const COST_INPUTS: CostInputs = {
  fuelPricePerGallonCents: 389,
  tollTotalCents: null,
  tollPerMileCents: 0,
  parkingPerNightCents: 1500,
  fixedDailyCents: 5000,
  driverPayPerMileCents: 60,
};
{
  check('cost: gallons math', fuelGallons(650, DEFAULT_TRUCK_PROFILE) === 100);
  const it = { totalMinutes: 5 * 60, stops: [] };
  const est = estimateTripCost(ROUTE, it, DEFAULT_TRUCK_PROFILE, COST_INPUTS);
  check(
    'cost: fuel = gallons × price (1-dp gallons)',
    est.fuelCents === Math.round(fuelGallons(230, DEFAULT_TRUCK_PROFILE) * 389),
    est.fuelCents,
  );
  check(
    'cost: unknown tolls keep total null with note',
    est.totalCents === null && est.notes.some((n) => n.includes('tolls unknown')),
  );
  const est2 = estimateTripCost(ROUTE, it, DEFAULT_TRUCK_PROFILE, {
    ...COST_INPUTS,
    tollTotalCents: 2500,
  });
  check(
    'cost: all-known total sums',
    est2.totalCents === est2.fuelCents! + 2500 + 0 + 5000 + Math.round(230 * 60),
  );
  check(
    'cost: per-mile derived',
    est2.perMileCents === Number(((est2.totalCents ?? 0) / 230).toFixed(1)),
  );
  check('cost: single day trip', est2.days === 1 && est2.perDayCents === est2.totalCents);
  const estNoFuel = estimateTripCost(ROUTE, it, DEFAULT_TRUCK_PROFILE, {
    ...COST_INPUTS,
    fuelPricePerGallonCents: null,
    tollTotalCents: 0,
  });
  check(
    'cost: null fuel price → null fuel and total, note present',
    estNoFuel.fuelCents === null &&
      estNoFuel.totalCents === null &&
      estNoFuel.notes.some((n) => n.includes('fuel price unknown')),
  );
  const overnightIt = {
    totalMinutes: 30 * 60,
    stops: [{ kind: 'overnight' } as never, { kind: 'break' } as never],
  };
  const est3 = estimateTripCost(ROUTE, overnightIt, DEFAULT_TRUCK_PROFILE, {
    ...COST_INPUTS,
    tollTotalCents: 0,
  });
  check('cost: overnight parking charged once', est3.parkingCents === 1500);
  check('cost: 30h trip = 2 days fixed', est3.days === 2 && est3.fixedCents === 10000);
  check('cost: daily breakdown length', dailyCosts(est3).length === 2);
  check('cost: cpm helper', costPerMileCents(23000, 230) === 100);
  check(
    'cost: validation catches negatives',
    validateCostInputs({ ...COST_INPUTS, tollPerMileCents: -1 }).length === 1,
  );
  check('cost: validation passes clean inputs', validateCostInputs(COST_INPUTS).length === 0);
  let threw = false;
  try {
    estimateTripCost(ROUTE, it, DEFAULT_TRUCK_PROFILE, {
      ...COST_INPUTS,
      fuelPricePerGallonCents: 0,
    });
  } catch {
    threw = true;
  }
  check('cost: zero price throws', threw);
}

/* ============================================================ directory layer */

// Straight synthetic corridor: 600 route-miles north along a meridian,
// ~1 mile ≈ 1/69 degree latitude. Route points every 10 miles.
const MILE_DEG = 1 / 69;
const routePoints: RoutePoint[] = Array.from({ length: 61 }, (_, i) => ({
  position: { lat: 32 + i * 10 * MILE_DEG, lng: -84 },
  routeMile: i * 10,
}));
const mkListing = (over: Partial<DirectoryListing>): DirectoryListing => ({
  id: over.id ?? 'x',
  name: over.name ?? 'Stop',
  categorySlug: 'truck-stops',
  lat: 32,
  lng: -84,
  city: null,
  state: 'GA',
  interstate: 'I-75',
  exitNumber: null,
  parkingSpaces: 60,
  overnightParking: true,
  freeParking: null,
  paidParking: null,
  reservationUrl: null,
  amenities: ['fuel', 'showers', 'food', 'restrooms'],
  fuelBrands: ["love's"],
  coordVerificationStatus: 'manually-verified',
  ...over,
});
const atMile = (m: number) => ({ lat: 32 + m * MILE_DEG, lng: -84 });

{
  const proj = projectOntoRoute(atMile(105), routePoints, 6);
  check(
    'dir: projection snaps to nearest sampled point',
    proj !== null && (proj.routeMile === 100 || proj.routeMile === 110),
    proj,
  );
  check(
    'dir: far point rejected',
    projectOntoRoute({ lat: 40, lng: -100 }, routePoints, 5) === null,
  );

  const listings: DirectoryListing[] = [
    mkListing({ id: 'a', name: 'Alpha Travel Center', ...atMile(100) }),
    mkListing({ id: 'b', name: 'Bravo Stop', ...atMile(200), coordVerificationStatus: null }),
    mkListing({ id: 'nocoords', lat: null, lng: null }),
    mkListing({ id: 'far', lat: 45, lng: -100 }),
  ];
  const cands = toStopCandidates(listings, routePoints, 5);
  check(
    'dir: drops no-coords and off-route listings',
    cands.length === 2 && cands.map((c) => c.id).join(',') === 'a,b',
  );
  check('dir: sorted by route mile', cands[0].routeMile <= cands[1].routeMile);

  const sVerified = scoreCandidate(cands[0], 'overnight');
  const sUnverified = scoreCandidate(cands[1], 'overnight');
  check('dir: verified coordinates outrank unverified', sVerified.total > sUnverified.total);

  const brandy = { ...cands[0], fuelBrands: ['pilot'] };
  const noBrand = { ...cands[0], fuelBrands: ['other'] };
  check(
    'dir: preferred brand boost',
    scoreCandidate(brandy, 'fuel', { preferredFuelBrands: ['Pilot'] }).total >
      scoreCandidate(noBrand, 'fuel', { preferredFuelBrands: ['Pilot'] }).total,
  );

  const near = { ...cands[0], offRouteMiles: 0 };
  const off = { ...cands[0], offRouteMiles: 4 };
  check(
    'dir: off-route penalty applies',
    scoreCandidate(near, 'break').total > scoreCandidate(off, 'break').total,
  );

  const bigLot = { ...cands[0], parkingSpaces: 150 };
  const noLot = { ...cands[0], parkingSpaces: 0, overnightParking: false };
  check(
    'dir: parking capacity matters for overnight',
    scoreCandidate(bigLot, 'overnight').total > scoreCandidate(noLot, 'overnight').total,
  );

  const ranked = rankCandidates(cands, 'overnight', { fromMile: 0, toMile: 600 });
  check('dir: ranking is best-first', ranked.length === 2 && ranked[0].candidate.id === 'a');
  check(
    'dir: window filter works',
    rankCandidates(cands, 'overnight', { fromMile: 150, toMile: 600 }).length === 1,
  );
  check(
    'dir: fuel recommendations capped',
    recommendFuelStops(cands, { fromMile: 0, toMile: 600 }, [], 1).length === 1,
  );
  check(
    'dir: parking recommendations exist',
    recommendParking(cands, { fromMile: 0, toMile: 600 }).length === 2,
  );
}

/* ================================================================= optimizer */

// 1,100-mile corridor at a constant 55 mph with rich candidates every 50 mi.
const longLegs: RouteLeg[] = [
  {
    seq: 0,
    from: { label: 'Start', position: atMile(0) },
    to: { label: 'End', position: { lat: 32 + 1100 * MILE_DEG, lng: -84 } },
    distanceMiles: 1100,
    avgSpeedMph: 55,
  },
];
const longRoute = buildRoute(longLegs);
const longPoints: RoutePoint[] = Array.from({ length: 111 }, (_, i) => ({
  position: atMile(i * 10),
  routeMile: i * 10,
}));
const richListings: DirectoryListing[] = Array.from({ length: 22 }, (_, i) =>
  mkListing({ id: `stop-${i}`, name: `Corridor Stop ${i}`, ...atMile(50 * i) }),
);
const richCands = toStopCandidates(richListings, longPoints, 5);

const baseRequest: TripRequest = {
  title: 'Test 1100',
  departAtMs: T0,
  truck: DEFAULT_TRUCK_PROFILE,
  clocks: freshClockState(T0),
  route: longRoute,
  candidates: richCands,
  fuelLevelFraction: 1,
  options: { ...DEFAULT_PLANNER_OPTIONS },
};

{
  const it = planTrip(baseRequest);
  check('plan: zero violations', it.violations.length === 0, it.violations);
  check(
    'plan: reaches destination',
    it.stops[it.stops.length - 1].kind === 'destination' &&
      approx(it.stops[it.stops.length - 1].routeMile, 1100, 0.5),
  );
  check('plan: drive time = route drive time', approx(it.driveMinutes, longRoute.driveMinutes, 3), {
    got: it.driveMinutes,
    want: longRoute.driveMinutes,
  });
  const kinds = it.stops.map((s) => s.kind);
  check('plan: includes at least one overnight', kinds.includes('overnight'));
  check('plan: includes fuel stop(s)', kinds.includes('fuel'), kinds);
  check('plan: no warnings on a rich corridor', it.warnings.length === 0, it.warnings);
  check(
    'plan: every mid stop has a real candidate',
    it.stops
      .filter((s) => ['fuel', 'break', 'overnight'].includes(s.kind))
      .every((s) => s.candidate !== null),
  );
  check(
    'plan: alternates recorded',
    it.stops.some((s) => s.alternates.length > 0),
  );
  // 1100 mi @55 = 20h drive → at least one overnight; ETA = departure + total.
  check('plan: arrival = departure + total', it.arriveAtMs === T0 + it.totalMinutes * 60_000);
  check('plan: total = drive + rest', it.totalMinutes === it.driveMinutes + it.restMinutes);
  // Fuel: 200gal × 6.5mpg × 0.75 = 975mi safety range → first fuel stop before 975.
  const firstFuel = it.stops.find((s) => s.kind === 'fuel');
  check(
    'plan: fuel stop before safety range',
    firstFuel !== undefined && firstFuel.routeMile <= 975,
    firstFuel?.routeMile,
  );
  // A ≥30-min fuel stop doubles as the 8-hour break when it lands first;
  // whichever way, no violation and stops are ordered.
  const miles = it.stops.map((s) => s.routeMile);
  check(
    'plan: stops ordered by mile',
    miles.every((m, i) => i === 0 || m >= miles[i - 1] - 0.01),
  );
  // Determinism.
  const again = planTrip(baseRequest);
  check('plan: deterministic', JSON.stringify(again) === JSON.stringify(it));
}

// Thin corridor: no candidates at all → virtual stops + warnings, still legal.
{
  const it = planTrip({ ...baseRequest, candidates: [] });
  check('plan: empty corridor still violation-free', it.violations.length === 0);
  check('plan: empty corridor warns', it.warnings.length > 0);
  check(
    'plan: virtual stops used',
    it.stops
      .filter((s) => ['fuel', 'break', 'overnight'].includes(s.kind))
      .every((s) => s.candidate === null),
  );
  check('plan: still arrives', it.stops[it.stops.length - 1].kind === 'destination');
}

// Nearly exhausted clocks at departure → overnight almost immediately.
{
  let tired = freshClockState(T0);
  tired = advance(tired, 'driving', 8 * 60).state;
  tired = advance(tired, 'off-duty', 30).state;
  tired = advance(tired, 'driving', 170).state; // 10h50m driving used
  const it = planTrip({ ...baseRequest, clocks: tired, departAtMs: tired.atMs });
  check(
    'plan: tired driver overnights early',
    (() => {
      const firstRest = it.stops.find((s) => s.kind === 'overnight');
      return firstRest !== undefined && firstRest.routeMile < 30;
    })(),
    it.stops.slice(0, 3),
  );
  check('plan: tired driver plan still legal', it.violations.length === 0);
}

// Empty tank at departure → immediate fuel need.
{
  const it = planTrip({ ...baseRequest, fuelLevelFraction: 0.05 });
  const firstFuel = it.stops.find((s) => s.kind === 'fuel');
  check(
    'plan: low tank fuels immediately',
    firstFuel !== undefined && firstFuel.routeMile <= 50,
    firstFuel?.routeMile,
  );
  check('plan: low-tank plan legal', it.violations.length === 0);
}

// Short trip: no stops at all.
{
  const shortIt = planTrip({ ...baseRequest, route: ROUTE, candidates: [] });
  check(
    'plan: short trip has only origin+destination',
    shortIt.stops.length === 2,
    shortIt.stops.map((s) => s.kind),
  );
  check('plan: short trip no warnings', shortIt.warnings.length === 0);
}

// driveMinutesBetween respects per-leg speeds.
{
  const req = { ...baseRequest, route: ROUTE };
  check(
    'eta: leg-speed integration',
    driveMinutesBetween(req, 0, 118) === Math.round((118 / 59) * 60),
  );
  check(
    'eta: cross-leg integration',
    driveMinutesBetween(req, 100, 150) === Math.round((18 / 59 + 32 / 56) * 60),
  );
  check('eta: zero for backwards range', driveMinutesBetween(req, 50, 40) === 0);
}

// quickEta consistency with planDrive.
{
  const q = quickEta(baseRequest);
  const p = planDrive(freshClockState(T0), longRoute.driveMinutes, {
    breakMinutes: DEFAULT_PLANNER_OPTIONS.breakMinutes,
    resetMinutes: DEFAULT_PLANNER_OPTIONS.overnightMinutes,
  });
  check(
    'eta: quickEta matches planDrive',
    q.totalMinutes === p.totalMinutes && q.arriveAtMs === T0 + p.totalMinutes * 60_000,
  );
  check('eta: quickEta counts rests', q.rests === p.rests.length && q.rests >= 2);
}

// Offline provider registry: all null adapters answer without network.
{
  void (async () => {
    const r = await offlineProviders.routing.route({
      origin: atMile(0),
      destination: atMile(100),
      waypoints: [],
      truck: DEFAULT_TRUCK_PROFILE,
      departAtMs: T0,
    });
    const w = await offlineProviders.weather.alongRoute(longPoints, T0);
    const f = await offlineProviders.fuelPrice.dieselCentsPerGallon('GA');
    check('providers: null routing returns null', r === null);
    check('providers: null weather returns empty', w.bands.length === 0 && w.alerts.length === 0);
    check('providers: null fuel price returns null', f === null);
    finish();
  })();
}

/* ============================================================= API contracts */

{
  const validPlan = {
    title: 'ATL→KNX',
    departAtMs: T0,
    truck: DEFAULT_TRUCK_PROFILE,
    clocks: freshClockState(T0),
    route: ROUTE,
    candidates: richCands.slice(0, 3),
    fuelLevelFraction: 0.8,
    options: DEFAULT_PLANNER_OPTIONS,
    cost: COST_INPUTS,
  };
  check('api: valid plan request parses', planTripRequestSchema.safeParse(validPlan).success);
  check(
    'api: bad latitude rejected',
    !planTripRequestSchema.safeParse({
      ...validPlan,
      route: {
        ...ROUTE,
        legs: [{ ...ROUTE.legs[0], from: { label: 'x', position: { lat: 99, lng: 0 } } }],
      },
    }).success,
  );
  check(
    'api: fuel fraction >1 rejected',
    !planTripRequestSchema.safeParse({ ...validPlan, fuelLevelFraction: 1.5 }).success,
  );
  check(
    'api: empty title rejected',
    !planTripRequestSchema.safeParse({ ...validPlan, title: '' }).success,
  );
  check(
    'api: clock schema round-trips engine state',
    clockStateSchema.safeParse(freshClockState(T0)).success,
  );
  check(
    'api: clock schema rejects 15h window',
    !clockStateSchema.safeParse({ ...freshClockState(T0), windowElapsedMin: 15 * 60 }).success,
  );
  check(
    'api: route schema rejects zero legs',
    !routeSchema.safeParse({ legs: [], totalMiles: 1, driveMinutes: 1 }).success,
  );
  check(
    'api: stop search defaults apply',
    (() => {
      const r = stopSearchRequestSchema.safeParse({
        need: 'fuel',
        candidates: [],
        window: { fromMile: 0, toMile: 100 },
      });
      return r.success && r.data.limit === 5 && r.data.preferredFuelBrands.length === 0;
    })(),
  );
  check(
    'api: hos simulate rejects empty segments',
    !hosSimulateRequestSchema.safeParse({ clocks: freshClockState(T0), segments: [] }).success,
  );
  check(
    'api: hos simulate accepts valid',
    hosSimulateRequestSchema.safeParse({
      clocks: freshClockState(T0),
      segments: [{ status: 'driving', minutes: 60 }],
    }).success,
  );
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
