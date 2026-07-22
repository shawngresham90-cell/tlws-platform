/**
 * Last Stop selection tests (Phase 1). Pure logic — no network, no database.
 * The release-blocking property: NO slot may ever contain a stop whose
 * projected arrival falls outside min(driving, window) − buffer. Commission
 * cannot outrank safety by construction, and these tests are the construction
 * proof.
 *
 * Run:
 *   npx esbuild scripts/test-last-stop.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-last-stop.cjs \
 *   && node /tmp/test-last-stop.cjs
 */
import {
  selectLastStops,
  reachWithinClocks,
  driveMinutesToMile,
  DEFAULT_SAFETY_BUFFER_MIN,
} from '@/lib/trip-planner/last-stop';
import { buildRoute, type RemainingClocks, type StopCandidate } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const T0 = 1_750_000_000_000;

/** 600-mile single-leg route at a steady 60 mph → 1 mile per minute. */
const route = buildRoute([
  {
    seq: 0,
    from: { label: 'A', position: { lat: 32, lng: -84 } },
    to: { label: 'B', position: { lat: 41, lng: -84 } },
    distanceMiles: 600,
    avgSpeedMph: 60,
  },
]);

const clocks = (over: Partial<RemainingClocks> = {}): RemainingClocks => ({
  drivingMin: 11 * 60,
  windowMin: 14 * 60,
  untilBreakMin: 8 * 60,
  cycleMin: 60 * 60,
  legalDrivingMin: 11 * 60,
  limitedBy: '11-hour',
  ...over,
});

const mkCandidate = (over: Partial<StopCandidate>): StopCandidate => ({
  id: over.id ?? 'c1',
  name: over.name ?? 'Stop',
  categorySlug: 'truck-stops',
  position: { lat: 32, lng: -84 },
  routeMile: 100,
  offRouteMiles: 1,
  parkingSpaces: 80,
  overnightParking: true,
  freeParking: null,
  paidParking: null,
  reservationUrl: null,
  amenities: ['showers'],
  fuelBrands: [],
  coordVerificationStatus: 'manually-verified',
  state: 'GA',
  interstate: 'I-75',
  exitNumber: '341',
  ...over,
});

/* ------------------------------------------------------------ drive minutes */
check('driveMinutesToMile: 1 mi/min route', driveMinutesToMile(route, 120) === 120);
check('driveMinutesToMile: beyond route end caps at total', driveMinutesToMile(route, 900) === 600);

/* ------------------------------------------------------------- reachability */
{
  // 4h15 driving left, buffer 30 → stops beyond 225 min drive are out.
  const rc = clocks({ drivingMin: 255, windowMin: 300, untilBreakMin: 480 });
  check('reachable inside clocks', reachWithinClocks(route, rc, 200, 30) !== null);
  check('unreachable past driving clock', reachWithinClocks(route, rc, 226, 30) === null);
  // Window is the binding clock when tighter than driving.
  const rcWin = clocks({ drivingMin: 600, windowMin: 200, untilBreakMin: 480 });
  check('window binds when tighter', reachWithinClocks(route, rcWin, 171, 30) === null);
  check('window allows inside', reachWithinClocks(route, rcWin, 170, 30) !== null);
}
{
  // Break-burns-window trap: drive 300 min with break due at 240 → wall
  // clock 330; window 350 leaves only 20 < buffer → unreachable.
  const rc = clocks({ drivingMin: 400, windowMin: 350, untilBreakMin: 240 });
  check('30-min break burns the window', reachWithinClocks(route, rc, 300, 30) === null);
  // Same stop with window 400 → reachable, arrival includes the break.
  const ok = reachWithinClocks(
    route,
    clocks({ drivingMin: 400, windowMin: 400, untilBreakMin: 240 }),
    300,
    30,
  );
  check('break included in wall clock', ok !== null && ok.wallClockMinutes === 330);
}

/* ------------------------------------------------- the safety property test */
{
  // Sweep candidates across the whole route at every 10 miles, all
  // reservable, against tight clocks — no selected slot may violate the
  // buffer, no matter how "valuable" a far stop would be.
  const rc = clocks({ drivingMin: 255, windowMin: 300, untilBreakMin: 120 });
  const candidates = Array.from({ length: 60 }, (_, i) =>
    mkCandidate({
      id: `r${i}`,
      routeMile: (i + 1) * 10,
      reservationUrl: 'https://truckparkingclub.com/x',
      categorySlug: 'parking',
    }),
  );
  const res = selectLastStops({ route, candidates, clocks: rc, departAtMs: T0 });
  check('slots found under tight clocks', res.slots.length > 0);
  for (const slot of res.slots) {
    const reach = reachWithinClocks(route, rc, slot.candidate.routeMile, res.bufferMin);
    check(`SAFETY ${slot.label} within clocks−buffer`, reach !== null, slot);
    check(
      `SAFETY ${slot.label} hos-at-arrival ≥ buffer`,
      slot.hosRemainingMinAtArrival >= res.bufferMin,
      slot,
    );
  }
}

/* ------------------------------------------------------------ slot semantics */
{
  const rc = clocks(); // full clocks
  const candidates = [
    mkCandidate({
      id: 'near',
      routeMile: 100,
      reservationUrl: 'https://truckparkingclub.com/a',
      parkingSpaces: 150,
      categorySlug: 'parking',
    }),
    mkCandidate({
      id: 'mid',
      routeMile: 300,
      reservationUrl: 'https://truckparkingclub.com/b',
      parkingSpaces: 20,
      categorySlug: 'parking',
    }),
    mkCandidate({
      id: 'far',
      routeMile: 590,
      reservationUrl: 'https://truckparkingclub.com/c',
      parkingSpaces: 40,
      categorySlug: 'parking',
    }),
    mkCandidate({ id: 'free1', routeMile: 400, freeParking: true, categorySlug: 'rest-areas' }),
    mkCandidate({ id: 'unknown', routeMile: 450, categorySlug: 'parking' }), // unknown ≠ free
  ];
  const res = selectLastStops({ route, candidates, clocks: rc, departAtMs: T0 });
  const byLabel = Object.fromEntries(res.slots.map((s) => [s.label, s]));
  check('last-reservable = furthest reachable', byLabel['last-reservable']?.candidate.id === 'far');
  check('best-reservable is scored pick', byLabel['best-reservable']?.candidate.id === 'near');
  check('last-free = explicit free flag only', byLabel['last-free']?.candidate.id === 'free1');
  check(
    'unknown never counted free',
    res.slots.every((s) => s.candidate.id !== 'unknown'),
  );
  check(
    'no candidate in two slots',
    new Set(res.slots.map((s) => s.candidate.id)).size === res.slots.length,
  );
  check(
    'reason strings templated',
    res.slots.every((s) => s.reason.length > 10),
  );
  check('corridor has reservable', res.noReservableOnCorridor === false);
}
{
  // Zero reservable candidates → honest flag, no fabricated slots.
  const res = selectLastStops({
    route,
    candidates: [mkCandidate({ id: 'plain', routeMile: 200 })],
    clocks: clocks(),
    departAtMs: T0,
  });
  check('noReservableOnCorridor honest', res.noReservableOnCorridor === true);
  check(
    'no reservable slots fabricated',
    res.slots.every((s) => !s.label.includes('reservable')),
  );
}
{
  // Zero-hours input → zero slots, never a stop "behind" the driver.
  const res = selectLastStops({
    route,
    candidates: [
      mkCandidate({
        id: 'a',
        routeMile: 10,
        reservationUrl: 'https://truckparkingclub.com/a',
        categorySlug: 'parking',
      }),
    ],
    clocks: clocks({ drivingMin: 0, windowMin: 0 }),
    departAtMs: T0,
  });
  check('zero clocks → zero slots', res.slots.length === 0);
  check('zero clocks → usableDriveMin 0', res.usableDriveMin === 0);
}
{
  // Backup slot: 15–45 min before the last reservable, deduped.
  const rc = clocks();
  const candidates = [
    // Clear best-scored pick in the BACK HALF of the window (the recommended
    // slot prefers it) but outside the 15–45 min backup band, so
    // 'best-reservable' never consumes the band candidate.
    mkCandidate({
      id: 'best',
      routeMile: 350,
      reservationUrl: 'https://truckparkingclub.com/best',
      categorySlug: 'parking',
      parkingSpaces: 300,
      amenities: ['showers', 'security'],
    }),
    mkCandidate({
      id: 'last',
      routeMile: 500,
      reservationUrl: 'https://truckparkingclub.com/l',
      categorySlug: 'parking',
      parkingSpaces: 10,
    }),
    mkCandidate({
      id: 'backup',
      routeMile: 470,
      reservationUrl: 'https://truckparkingclub.com/b',
      categorySlug: 'parking',
      parkingSpaces: 200,
    }),
    mkCandidate({
      id: 'tooClose',
      routeMile: 495,
      reservationUrl: 'https://truckparkingclub.com/t',
      categorySlug: 'parking',
    }),
  ];
  const res = selectLastStops({ route, candidates, clocks: rc, departAtMs: T0 });
  const backup = res.slots.find((s) => s.label === 'backup-reservable');
  check('backup lands in 15–45 min band', backup?.candidate.id === 'backup', res.slots);
}

{
  // Fail-closed on corrupted clocks: NaN must never read as "reachable".
  const bad = clocks({ drivingMin: NaN as unknown as number });
  check('NaN clocks fail closed', reachWithinClocks(route, bad, 100, 30) === null);
  const res = selectLastStops({
    route,
    candidates: [
      mkCandidate({
        id: 'x',
        routeMile: 50,
        reservationUrl: 'https://truckparkingclub.com/x',
        categorySlug: 'parking',
      }),
    ],
    clocks: bad,
    departAtMs: T0,
  });
  check('NaN clocks → zero slots', res.slots.length === 0);
  check('NaN clocks → usableDriveMin 0', res.usableDriveMin === 0);
}

check('default buffer is 30', DEFAULT_SAFETY_BUFFER_MIN === 30);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
