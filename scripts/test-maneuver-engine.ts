/**
 * N5 ManeuverEngine — next/following maneuver and distance-to from the
 * tracker's route-mile, including completion, malformed, and empty
 * routes. Pure engine, real inputs.
 *
 * Run:
 *   npx esbuild scripts/test-maneuver-engine.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-maneuver-engine.cjs \
 *   && node /tmp/test-maneuver-engine.cjs
 */
import { createManeuverEngine, PASSED_TOLERANCE_MI } from '@/lib/navigator/maneuver-engine';
import {
  createNavigationController,
  ARRIVAL_TOLERANCE_MI,
} from '@/lib/navigator/navigation-controller';
import { createRouteTracker } from '@/lib/navigator/route-tracker';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { PositionState } from '@/lib/navigator/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const man = (offset: number, instruction: string, action = 'turn'): HereManeuver => ({
  action,
  instruction,
  direction: null,
  severity: null,
  offset,
  lengthM: null,
  durationS: null,
});

// 11 geometry points, 0.5 mi apart → miles 0..5.
const MILES = Array.from({ length: 11 }, (_, i) => i * 0.5);
const MANEUVERS = [
  man(0, 'Depart', 'depart'),
  man(4, 'Take exit 369 toward Watt Rd', 'exit'),
  man(10, 'Arrive', 'arrive'),
];

{
  const eng = createManeuverEngine(MANEUVERS, MILES);
  check('all maneuvers ingested', eng.count() === 3);
  const atStart = eng.view(0);
  check(
    'at mile 0 the next maneuver is Depart at 0.0',
    atStart.next?.instruction === 'Depart' && atStart.distanceMi === 0,
  );
  const mid = eng.view(1.0);
  check(
    'past Depart, next is the exit at mile 2.0',
    mid.next?.instruction.startsWith('Take exit') === true,
  );
  check('distance to maneuver is mile-accurate', Math.abs((mid.distanceMi ?? -1) - 1.0) < 1e-9);
  check('following preview is Arrive', mid.following?.instruction === 'Arrive');
  const nearExit = eng.view(2.0 - PASSED_TOLERANCE_MI / 2);
  check(
    'within the passed-tolerance the exit still shows',
    nearExit.next?.instruction.startsWith('Take exit') === true,
  );
  const past = eng.view(2.2);
  check('after passing, next advances to Arrive', past.next?.instruction === 'Arrive');
  const done = eng.view(5.1);
  check(
    'past the last maneuver: none (completion)',
    done.next === null && done.distanceMi === null,
  );
}

{
  // Malformed inputs: out-of-range offsets clamp; empty instruction dropped;
  // empty geometry yields an engine with nothing (screen: route unavailable).
  const eng = createManeuverEngine([man(99, 'Clamped'), man(2, ''), man(-3, 'Floor')], MILES);
  check('out-of-range offset clamps to route end', eng.view(4.9).next?.instruction === 'Clamped');
  check('negative offset clamps to start', eng.view(0).next?.instruction === 'Floor');
  check('empty instruction dropped', eng.count() === 2);
  const empty = createManeuverEngine(MANEUVERS, []);
  check(
    'empty geometry → no maneuvers, no throw',
    empty.count() === 0 && empty.view(0).next === null,
  );
}

/* --------------------- controller: states incl. arrival and route-unavail */

const T0 = 1_754_000_000_000;
function posAt(lat: number, tMs: number, over: Partial<PositionState> = {}): PositionState {
  return {
    fix: { lat, lng: -84, accuracyM: 8, tMs, speedMph: 50, headingDeg: 180 },
    health: 'good',
    lastFixMs: tMs,
    accuracyM: 8,
    speedMph: 50,
    headingDeg: 180,
    deadReckoning: false,
    ...over,
  };
}

// Straight north–south line, ~0.5 mi per 0.00724° of latitude.
const ROUTE = Array.from({ length: 11 }, (_, i) => ({
  position: { lat: 36 - i * 0.00724, lng: -84 },
  routeMile: i * 0.5,
}));

{
  const controller = createNavigationController({
    tracker: createRouteTracker(ROUTE),
    engine: createManeuverEngine(MANEUVERS, MILES),
    totalMi: 5,
  });
  const v0 = controller.update(posAt(36, T0));
  check('navigating with a route and a good fix', v0.status === 'navigating');
  check('route progress starts at 0', v0.routeMile === 0 && v0.remainingMi === 5);
  const v1 = controller.update(posAt(36 - 0.00724 * 4, T0 + 240_000));
  check('progress advances with movement', (v1.routeMile ?? 0) > 1.5, v1.routeMile);
  check(
    'maneuver view rides along',
    v1.maneuvers?.next?.instruction.startsWith('Take exit') === true,
  );
  const lost = controller.update(posAt(36, T0 + 300_000, { health: 'lost' }));
  check(
    'lost → position-lost, last known, mile HELD',
    lost.status === 'position-lost' && lost.lastKnown && lost.routeMile === v1.routeMile,
  );
  const denied = controller.update(posAt(36, T0 + 301_000, { health: 'denied', fix: null }));
  check('denied → denied state', denied.status === 'denied');
  const unavailable = controller.update(
    posAt(36, T0 + 302_000, { health: 'unavailable', fix: null }),
  );
  check(
    'unavailable (no fix) → position-unavailable',
    unavailable.status === 'position-unavailable',
  );
  const degraded = controller.update(posAt(36 - 0.00724 * 4, T0 + 303_000, { health: 'degraded' }));
  check(
    'degraded → position-degraded (guidance continues)',
    degraded.status === 'position-degraded',
  );
  const arrivePos = posAt(36 - 0.00724 * 10, T0 + 600_000);
  const arrived = controller.update(arrivePos);
  check(
    `arrived within ${ARRIVAL_TOLERANCE_MI} mi of route end`,
    arrived.status === 'arrived' && (arrived.remainingMi ?? 1) <= ARRIVAL_TOLERANCE_MI,
    arrived,
  );
}

{
  const controller = createNavigationController(null);
  const v = controller.update(posAt(36, T0));
  check('no route source → route-unavailable state (AD-8)', v.status === 'no-route');
  check('no fabricated progress without a route', v.routeMile === null && v.remainingMi === null);
}

console.log(`maneuver-engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
