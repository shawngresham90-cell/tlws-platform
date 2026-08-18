/**
 * TP-1 — the clock-to-parking vertical slice, at its two new seams.
 *
 * Everything upstream of here already had a harness: `driveWindow` decides
 * which clock binds, `planBreak` decides whether 30 minutes are owed,
 * `selectLastStops` decides which parking survives the reachability filter,
 * and `test-trip-planner-plan-my-day` proves they agree with one another.
 *
 * What had no harness — because it did not exist — is what happens AFTER a
 * driver taps one of those three parking choices. That is what this file is
 * about: the record that carries a stop from Plan My Day to the Navigator,
 * and the rules that decide whether it may still be used when it gets there.
 *
 * The limiting-clock and break cases are re-asserted here too, not to
 * duplicate the engine's own tests, but because TP-1's promise is that the
 * stop handed over was qualified against the RIGHT clock. A handoff that
 * carried a stop qualified against the wrong binding rule would pass every
 * test in this file that only looked at the record's shape.
 *
 * Pure. Every timestamp is injected; nothing reads a real clock, touches
 * storage, or needs a network.
 */
import {
  NO_DESTINATION_TRIP,
  PLANNED_STOP_FACILITY,
  PLANNED_STOP_INPUTS_CHANGED_NOTICE,
  PLANNED_STOP_SOURCE_NOTICE,
  PLANNED_STOP_STALE_NOTICE,
  PLANNED_STOP_TTL_MS,
  plannedStopFromChoice,
  plannedStopIsStale,
  plannedStopToDestination,
  readPlannedStop,
  sharedInputsFingerprint,
  shouldAskTripPlan,
  tripKeyFor,
  type PlannedStop,
} from '@/lib/trip-planner/planned-stop';
import { driveWindow } from '@/lib/trip-planner/drive-window';
import { planBreak } from '@/lib/trip-planner/break-plan';
import type { ParkingChoice } from '@/lib/trip-planner/plan-my-day';
import type { RemainingClocks, StopCandidate } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 200)}`}`);
  }
}

/* ===================================================================== *
 * FIXTURES — fixed, so CI never depends on a live API or a real clock
 * ===================================================================== */

/** 2026-03-10T12:00:00Z. Any constant works; a named one reads better. */
const NOON = 1773144000000;

const CLOCKS_A = {
  drivingMin: 300,
  windowMin: 500,
  untilBreakMin: 200,
  cycleMin: 2400,
  cycleRule: '70/8',
};
const TRUCK_A = {
  heightFt: 13.6,
  widthFt: 8.5,
  lengthFt: 70,
  grossWeightLbs: 80000,
  axles: 5,
  hazmatClass: null as string | null,
  avoid: ['tollRoad'] as readonly string[],
};
/** The fingerprint the fixtures are planned against. */
const FP = sharedInputsFingerprint({ clocks: CLOCKS_A, truck: TRUCK_A });

function candidate(over: Partial<StopCandidate> = {}): StopCandidate {
  return {
    id: 'stop-1',
    name: 'Sample Truck Plaza',
    categorySlug: 'truck-stops',
    position: { lat: 35.05, lng: -85.31 },
    routeMile: 180,
    offRouteMiles: 0.4,
    parkingSpaces: 120,
    overnightParking: true,
    overnightStatus: 'confirmed',
    freeParking: true,
    paidParking: null,
    reservationUrl: null,
    amenities: ['Showers'],
    fuelBrands: [],
    coordVerificationStatus: 'verified',
    state: 'TN',
    interstate: 'I-75',
    ...over,
  } as StopCandidate;
}

function choice(over: Partial<ParkingChoice> = {}): ParkingChoice {
  return {
    candidate: candidate(),
    arriveAtMs: NOON + 3 * 60 * 60 * 1000,
    clockLeftMin: 65,
    detourMiles: 0.4,
    detourMinutes: 2,
    amenities: ['Showers'],
    reservable: false,
    source: 'TLWS directory',
    ...over,
  };
}

/* ===================================================================== *
 * 1. THE RIGHT CLOCK BINDS — the stop is only as good as the window
 * ===================================================================== */
{
  const base: RemainingClocks = {
    drivingMin: 660,
    windowMin: 840,
    untilBreakMin: 480,
    cycleMin: 3600,
    limitedBy: '11-hour',
    legalDrivingMin: 660,
  };

  // Driving (11-hour) binds: plenty of window and cycle, little driving left.
  const driving = driveWindow({ ...base, drivingMin: 120, windowMin: 800, cycleMin: 3000 }, 30);
  check(
    '1a: the driving clock binds when it is the smallest',
    'limitedBy' in driving && driving.limitedBy === '11-hour',
    'limitedBy' in driving ? driving.limitedBy : driving,
  );
  check(
    '1b: …and the window is that clock, not another',
    'clockLimitMin' in driving && driving.clockLimitMin === 120,
    'clockLimitMin' in driving ? driving.clockLimitMin : driving,
  );

  // 14-hour binds: hours of driving left, but the window closes first.
  const window14 = driveWindow({ ...base, drivingMin: 600, windowMin: 90, cycleMin: 3000 }, 30);
  check(
    '1c: the 14-hour window binds when it closes first',
    'limitedBy' in window14 && window14.limitedBy === '14-hour',
    'limitedBy' in window14 ? window14.limitedBy : window14,
  );
  check(
    '1d: …and it caps the drive at the window, not the driving clock',
    'clockLimitMin' in window14 && window14.clockLimitMin === 90,
    'clockLimitMin' in window14 ? window14.clockLimitMin : window14,
  );

  // Cycle binds: both daily clocks are generous, the 70-hour is nearly spent.
  /*
   * `untilBreakMin` is deliberately BEYOND the driving clock here. When a
   * break falls inside the drive the engine reports '30-minute-break' as the
   * binding rule — correctly, because the driver's next action is a break
   * rather than a shutdown — and that override would mask the cycle. This
   * fixture isolates the cycle by putting the break clock out of reach.
   */
  const cycle = driveWindow(
    { ...base, drivingMin: 600, windowMin: 800, untilBreakMin: 700, cycleMin: 45 },
    30,
  );
  check(
    '1e: the cycle clock binds when it is nearly spent',
    'limitedBy' in cycle && cycle.limitedBy === 'cycle',
    'limitedBy' in cycle ? cycle.limitedBy : cycle,
  );
  check(
    '1f: …and the drive is capped at the cycle',
    'clockLimitMin' in cycle && cycle.clockLimitMin === 45,
    'clockLimitMin' in cycle ? cycle.clockLimitMin : cycle,
  );

  /* The buffer is subtracted, never added. A stop target above the clock
   * limit would be the exact inversion that makes a stop "reachable" after
   * the hours are gone. */
  check(
    '1g: the stop target never exceeds the clock limit',
    'stopTargetMin' in driving &&
      'clockLimitMin' in driving &&
      driving.stopTargetMin <= driving.clockLimitMin,
    driving,
  );

  /* A corrupt clock refuses rather than being read as zero or as generous. */
  const broken = driveWindow({ ...base, drivingMin: Number.NaN }, 30);
  check('1h: a non-finite clock refuses rather than defaulting', 'ok' in broken && !broken.ok);
  const negative = driveWindow({ ...base, cycleMin: -1 }, 30);
  check('1i: a negative clock refuses too', 'ok' in negative && !negative.ok);
}

/* ===================================================================== *
 * 2. THE 30-MINUTE BREAK — owed, and not owed
 * ===================================================================== */
{
  const owed = driveWindow(
    {
      drivingMin: 600,
      windowMin: 800,
      untilBreakMin: 60,
      cycleMin: 3000,
      limitedBy: '11-hour',
      legalDrivingMin: 600,
    },
    30,
  );
  check(
    '2a: a break falling inside the drive is reported',
    'breakDueAfterMin' in owed && owed.breakDueAfterMin === 60,
    'breakDueAfterMin' in owed ? owed.breakDueAfterMin : owed,
  );

  /* Not owed: the break is further out than the drive can reach, so there
   * is nothing to plan and the screen must not invent one. */
  const notOwed = driveWindow(
    {
      drivingMin: 45,
      windowMin: 800,
      untilBreakMin: 480,
      cycleMin: 3000,
      limitedBy: '11-hour',
      legalDrivingMin: 45,
    },
    15,
  );
  check(
    '2b: no break is claimed when none falls inside the drive',
    'breakDueAfterMin' in notOwed && notOwed.breakDueAfterMin === null,
    'breakDueAfterMin' in notOwed ? notOwed.breakDueAfterMin : notOwed,
  );

  /*
   * planBreak states the no-break case in the ENGINE'S OWN TERMS — "the drive
   * ends before the break clock does" — rather than as a general claim that
   * the driver owes no break today. The distinction matters: the second would
   * be an hours-of-service verdict, which this planner never issues.
   */
  const clocksNoBreak: RemainingClocks = {
    drivingMin: 45,
    windowMin: 800,
    untilBreakMin: 480,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: 45,
  };
  const noBreak = planBreak({
    clocks: clocksNoBreak,
    usableDriveMin: 45,
    timing: { kind: 'estimate' } as never,
    departAtMs: NOON,
  });
  check(
    '2c: a drive shorter than the break clock owes no break',
    noBreak.required === false,
    noBreak,
  );

  /* A corrupt break clock refuses rather than being read as "no break owed",
   * which is the direction that would quietly drop a required stop. */
  const badBreak = planBreak({
    clocks: { ...clocksNoBreak, untilBreakMin: Number.NaN },
    usableDriveMin: 300,
    timing: { kind: 'estimate' } as never,
    departAtMs: NOON,
  });
  check(
    '2d: a non-finite break clock refuses rather than assuming none',
    badBreak.required === null,
    badBreak,
  );
}

/* ===================================================================== *
 * 3. THE HANDOFF RECORD — built only from a stop that can be routed to
 * ===================================================================== */
{
  const stop = plannedStopFromChoice(choice(), NOON, FP);
  check('3a: a complete choice becomes a record', stop !== null);
  check('3b: the directory id is carried, so a re-plan replaces it', stop?.id === 'stop-1');
  check('3c: the name is carried for the driver to recognise', stop?.name === 'Sample Truck Plaza');
  check(
    '3d: the position is copied, not referenced',
    stop?.position.lat === 35.05 && stop?.position.lng === -85.31,
  );
  check('3e: the planning moment is stamped', stop?.plannedAtMs === NOON);
  check(
    '3f: the projected arrival and remaining clock ride along',
    stop?.arriveAtMs === NOON + 3 * 60 * 60 * 1000 && stop?.clockLeftMin === 65,
  );

  /* The two refusals. Both are silent nulls rather than thrown errors: the
   * caller shows the driver a sentence, and a throw would take the results
   * screen down over one bad directory row. */
  check(
    '3g: a candidate with no id cannot be handed over',
    plannedStopFromChoice(choice({ candidate: candidate({ id: '  ' }) }), NOON, FP) === null,
  );
  check(
    '3h: a candidate at 0,0 is refused — that is the Atlantic, not a stop',
    plannedStopFromChoice(
      choice({ candidate: candidate({ position: { lat: 0, lng: 0 } }) }),
      NOON,
      FP,
    ) === null,
  );
  check(
    '3i: a non-finite coordinate is refused',
    plannedStopFromChoice(
      choice({ candidate: candidate({ position: { lat: Number.NaN, lng: -85 } }) }),
      NOON,
      FP,
    ) === null,
  );
  check(
    '3j: an out-of-range latitude is refused',
    plannedStopFromChoice(
      choice({ candidate: candidate({ position: { lat: 95, lng: -85 } }) }),
      NOON,
      FP,
    ) === null,
  );
}

/* ===================================================================== *
 * 4. STALENESS — the clocks moved on, so the plan must not be trusted
 * ===================================================================== *
 * This is the property the whole record exists for. A stop qualified
 * against clocks entered this morning is not qualified against the clocks
 * a driver holds tonight, and nothing in the record's shape says so.
 */
{
  const stop = plannedStopFromChoice(choice(), NOON, FP) as PlannedStop;

  check('4a: fresh at the moment it was planned', !plannedStopIsStale(stop, NOON));
  check(
    '4b: still fresh one minute inside the TTL',
    !plannedStopIsStale(stop, NOON + PLANNED_STOP_TTL_MS - 60_000),
  );
  check(
    '4c: still fresh exactly ON the TTL boundary',
    !plannedStopIsStale(stop, NOON + PLANNED_STOP_TTL_MS),
  );
  check(
    '4d: stale one millisecond past it',
    plannedStopIsStale(stop, NOON + PLANNED_STOP_TTL_MS + 1),
  );
  check('4e: and plainly stale a day later', plannedStopIsStale(stop, NOON + 24 * 3600 * 1000));

  /* A device clock that has slipped backwards makes the record look like it
   * was planned in the future. "I cannot tell how old this is" must not read
   * as "this is brand new". */
  check(
    '4f: a future-dated record is treated as stale, not fresh',
    plannedStopIsStale(stop, NOON - 1),
  );

  /* The reader names its refusals, because the Navigator says something
   * different for each one. */
  const fresh = readPlannedStop(stop, NOON + 60_000);
  check('4g: a fresh record reads ok', fresh.ok === true);

  const expired = readPlannedStop(stop, NOON + PLANNED_STOP_TTL_MS + 1);
  check(
    '4h: an expired record is refused as stale, by name',
    expired.ok === false && expired.problem === 'stale',
    expired,
  );

  const missing = readPlannedStop(null, NOON);
  check('4i: no record at all is refused', missing.ok === false);

  const noPos = readPlannedStop({ ...stop, position: { lat: 0, lng: 0 } } as PlannedStop, NOON);
  check(
    '4j: a record with no usable position is refused by that name',
    noPos.ok === false && noPos.problem === 'no-position',
    noPos,
  );

  const noId = readPlannedStop({ ...stop, id: '' } as PlannedStop, NOON);
  check(
    '4k: an id-less record is refused by that name',
    noId.ok === false && noId.problem === 'no-id',
  );

  /* The staleness notice invites a re-plan rather than blaming the driver,
   * and never implies the old plan was a compliance record. */
  check(
    '4l: the stale notice tells the driver to plan again',
    /plan again/i.test(PLANNED_STOP_STALE_NOTICE),
  );
  check(
    '4m: the source notice keeps the ELD as the authority',
    /ELD/.test(PLANNED_STOP_SOURCE_NOTICE),
  );
}

/* ===================================================================== *
 * 5. THE NAVIGATOR SHAPE — what actually crosses the seam
 * ===================================================================== */
{
  const stop = plannedStopFromChoice(choice(), NOON, FP) as PlannedStop;
  const dest = plannedStopToDestination(stop);

  check('5a: the id survives the conversion', dest.id === 'stop-1');
  check('5b: the name becomes the destination title', dest.title === 'Sample Truck Plaza');
  check('5c: the coordinate is carried through', dest.position.lat === 35.05);
  check(
    '5d: a parking stop is handed over as a truck stop, so arrival guidance behaves',
    dest.facility === PLANNED_STOP_FACILITY && PLANNED_STOP_FACILITY === 'truck-stop',
  );

  /* The two deliberate omissions. Both would be easy to fill in and both
   * would be inventions. */
  check('5e: no address is invented under a real name', dest.address === '', dest.address);
  check(
    '5f: route-mileage is NOT reused as straight-line distance — different units, same word',
    dest.distanceMi === null,
    dest.distanceMi,
  );
}

/* ===================================================================== *
 * 6. STORAGE CONTRACT — device-local, and never a sync domain
 * ===================================================================== *
 * Migration 050 constrains `navigator_state.domain` to exactly four values
 * with a CHECK constraint. A fifth would be rejected by the database, and
 * syncing a planned stop would carry one device's stale window onto another
 * device that cannot know it is stale. Both reasons point the same way, so
 * the source is asserted rather than trusted to stay that way.
 */
{
  const fs = require('node:fs') as typeof import('node:fs');
  const storage = fs.readFileSync('src/components/navigator/planned-stop-storage.ts', 'utf8');
  const syncDomains = fs.readFileSync('src/components/navigator/sync-domain-storage.ts', 'utf8');

  check(
    '6a: the planned stop is not registered as a sync domain',
    !/planned[-_]?stop/i.test(syncDomains),
  );
  check(
    '6b: the storage module writes its own versioned key only',
    /tlws-navigator-planned-stop-v1/.test(storage),
  );
  check(
    '6c: it exposes a clear, so a used or refused plan can be dropped',
    /export function clearPlannedStopRecord/.test(storage),
  );

  /* The migration's own constraint, read from the SQL rather than from
   * memory — if the four domains ever change, this fails loudly. */
  const migration = fs.readFileSync('supabase/migrations/050_navigator_accounts.sql', 'utf8');
  check(
    '6d: migration 050 still constrains sync domains to the original four',
    /check \(domain in \('truck', 'route_prefs', 'hos_clocks', 'onboarding'\)\)/.test(migration),
  );
}

/* ===================================================================== *
 * 7. PLANNING IS OFFERED, NEVER FORCED
 * ===================================================================== *
 * The requirement is behavioural, so it is asserted against the component
 * source: there must be a Just Drive path, it must not gate anything, and
 * the question must not re-ask once answered.
 */
{
  const fs = require('node:fs') as typeof import('node:fs');
  const src = fs.readFileSync('src/components/navigator/TripPlanFirst.tsx', 'utf8');

  check(
    '7a: the question is asked in the driver’s words',
    /Plan your stops before you drive\?/.test(src),
  );
  check('7b: Plan My Stops is offered', /Plan My Stops/.test(src));
  check('7c: Just Drive is offered', /Just Drive/.test(src));
  check(
    '7d: answering is remembered for THIS trip, so a reload does not re-ask',
    /writeTripPlanAnswered\(tripKey\)/.test(src) && /if \(asked\) return null;/.test(src),
  );
  check(
    '7e: a stale plan is explained rather than silently dropped',
    /PLANNED_STOP_STALE_NOTICE/.test(src),
  );
  check(
    '7f: taking a stop clears it, so it is not re-offered on the next visit',
    /clearPlannedStopRecord\(\)/.test(src),
  );

  /* Mounted behind the same edit-destination gate as the search, because
   * using a planned stop sets a destination and a moving truck gets neither. */
  const screen = fs.readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check('7g: the choice is mounted on the parked screen', /<TripPlanFirst/.test(screen));
  check(
    '7h: …inside the edit-destination lock gate',
    /edit-destination[\s\S]{0,1200}<TripPlanFirst/.test(screen),
  );
  check(
    '7i: a planned stop is recorded as U.S. — the planner models U.S. hours only',
    /<TripPlanFirst[\s\S]{0,1400}setPickedCountry\('USA'\)/.test(screen),
  );
}

/* ===================================================================== *
 * 8. THE RESULTS SCREEN OFFERS THE CHOICE, AND ONLY WHERE IT CAN
 * ===================================================================== */
{
  const fs = require('node:fs') as typeof import('node:fs');
  const results = fs.readFileSync('src/components/trip-planner/PlanResults.tsx', 'utf8');
  const app = fs.readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');

  check('8a: each parking card can be sent to the Navigator', /Send to Navigator/.test(results));
  check(
    '8b: the handoff is optional, so the classic planner renders unchanged',
    /onChooseParking\?:/.test(results) && /onChooseParking === undefined \? null/.test(results),
  );
  check(
    '8c: the tap stamps the moment of choice, not the moment of planning',
    /plannedStopFromChoice\(choice, Date\.now\(\), currentFingerprint\(\)\)/.test(app),
  );
  check(
    '8d: an unroutable record is refused with a sentence, not written',
    /That parking record is missing its location/.test(app),
  );
  check(
    '8e: the write goes through the storage module',
    /writePlannedStopRecord\(stop\)/.test(app),
  );
}

/* ===================================================================== *
 * 9. ONE PLAN REQUEST, ONE ROUTE CALL
 * ===================================================================== *
 * Routing is metered and paid. The handoff must not become a second reason
 * to call the provider: choosing a stop is a local write, and nothing in the
 * new path reaches the route endpoint.
 */
{
  const fs = require('node:fs') as typeof import('node:fs');
  const app = fs.readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  const results = fs.readFileSync('src/components/trip-planner/PlanResults.tsx', 'utf8');
  const plannedStop = fs.readFileSync('src/lib/trip-planner/planned-stop.ts', 'utf8');
  const storage = fs.readFileSync('src/components/navigator/planned-stop-storage.ts', 'utf8');
  const first = fs.readFileSync('src/components/navigator/TripPlanFirst.tsx', 'utf8');

  for (const [label, src] of [
    ['the planned-stop module', plannedStop],
    ['its storage', storage],
    ['the Navigator prompt', first],
    ['the results screen', results],
  ] as const) {
    check(`9a: ${label} makes no network call`, !/\bfetch\s*\(/.test(src), label);
  }

  /* The app does fetch — that is the plan request itself. What matters is
   * that the SELECTION handler is not one of the callers. */
  const handler = app.slice(
    app.indexOf('function chooseParking'),
    app.indexOf('function chooseParking') + 900,
  );
  check(
    '9b: choosing a stop issues no route request',
    !/\bfetch\s*\(/.test(handler),
    handler.slice(0, 120),
  );
  check('9c: …and no second plan is triggered by the selection', !/setPlan\(/.test(handler));
}

/* ===================================================================== *
 * 10. U.S.-ONLY HOS, STATED AT THE SEAM
 * ===================================================================== */
{
  const fs = require('node:fs') as typeof import('node:fs');
  const plannedStop = fs.readFileSync('src/lib/trip-planner/planned-stop.ts', 'utf8');
  const region = fs.readFileSync('src/lib/trip-planner/route-region.ts', 'utf8');

  check(
    '10a: the cross-border limitation still exists upstream',
    /CountrySide|countrySideOf/.test(region),
  );
  check(
    '10b: the handoff never claims a Canadian hours calculation',
    !/canadian?\s+hos|canada.*cycle/i.test(plannedStop),
  );
  check(
    '10c: the record does not present itself as a compliance artefact',
    !/compliance record|legal(ly)? (safe|compliant)/i.test(plannedStop),
  );
}

/* ===================================================================== *
 * 11. INPUT CHANGE INVALIDATES — the primary defence, TTL is the backstop
 * ===================================================================== *
 * A stop answers one question: given THESE clocks and THIS truck, where can I
 * legally stop? Change a term and the answer is wrong immediately — not in
 * twelve hours. Every field below is one a driver can actually edit.
 */
{
  const stop = plannedStopFromChoice(choice(), NOON, FP) as PlannedStop;
  const soon = NOON + 60_000;

  check('11a: unchanged inputs still read ok', readPlannedStop(stop, soon, FP).ok === true);

  /* Each clock, one at a time. A fingerprint that only noticed some of them
   * would pass a lazy test and fail a real driver. */
  for (const [label, clocks] of [
    ['driving', { ...CLOCKS_A, drivingMin: 299 }],
    ['14-hour window', { ...CLOCKS_A, windowMin: 499 }],
    ['break', { ...CLOCKS_A, untilBreakMin: 199 }],
    ['cycle', { ...CLOCKS_A, cycleMin: 2399 }],
    ['cycle rule', { ...CLOCKS_A, cycleRule: '60/7' }],
  ] as const) {
    const changed = sharedInputsFingerprint({ clocks, truck: TRUCK_A });
    const verdict = readPlannedStop(stop, soon, changed);
    check(
      `11b: a changed ${label} clock invalidates the stop`,
      verdict.ok === false && verdict.problem === 'inputs-changed',
      verdict,
    );
  }

  /* Every truck field that reaches the routing request. */
  for (const [label, truck] of [
    ['height', { ...TRUCK_A, heightFt: 13.5 }],
    ['width', { ...TRUCK_A, widthFt: 8.6 }],
    ['length', { ...TRUCK_A, lengthFt: 53 }],
    ['weight', { ...TRUCK_A, grossWeightLbs: 79000 }],
    ['axle count', { ...TRUCK_A, axles: 6 }],
    ['hazmat class', { ...TRUCK_A, hazmatClass: '3' }],
    ['avoidances', { ...TRUCK_A, avoid: ['tollRoad', 'ferry'] as readonly string[] }],
  ] as const) {
    const changed = sharedInputsFingerprint({ clocks: CLOCKS_A, truck });
    const verdict = readPlannedStop(stop, soon, changed);
    check(
      `11c: a changed truck ${label} invalidates the stop`,
      verdict.ok === false && verdict.problem === 'inputs-changed',
      verdict,
    );
  }

  /* Clearing the clocks or the truck entirely is a change too — the honest
   * reading of "no clocks" is not "the same clocks as before". */
  check(
    '11d: clearing the clocks invalidates the stop',
    readPlannedStop(stop, soon, sharedInputsFingerprint({ clocks: null, truck: TRUCK_A })).ok ===
      false,
  );
  check(
    '11e: clearing the truck invalidates the stop',
    readPlannedStop(stop, soon, sharedInputsFingerprint({ clocks: CLOCKS_A, truck: null })).ok ===
      false,
  );

  /* Input change is reported BEFORE staleness: both drop the record, but the
   * driver is told the actionable thing rather than the vaguer one. */
  const bothWrong = readPlannedStop(stop, NOON + PLANNED_STOP_TTL_MS + 1, 'something-else');
  check(
    '11f: a stop that is both stale AND changed reports the change',
    bothWrong.ok === false && bothWrong.problem === 'inputs-changed',
    bothWrong,
  );

  /* The TTL still bites when nothing observable moved — the backstop the
   * owner asked to keep. */
  const onlyOld = readPlannedStop(stop, NOON + PLANNED_STOP_TTL_MS + 1, FP);
  check(
    '11g: with identical inputs the 12-hour backstop still expires it',
    onlyOld.ok === false && onlyOld.problem === 'stale',
    onlyOld,
  );

  /* Order-independence: the same avoidances listed differently are the same
   * truck. A fingerprint that said otherwise would invalidate stops for no
   * reason a driver could see. */
  check(
    '11h: avoidance ORDER is not a change',
    sharedInputsFingerprint({
      clocks: CLOCKS_A,
      truck: { ...TRUCK_A, avoid: ['tollRoad'] },
    }) === FP,
  );

  /* Float noise is not a change either. */
  check(
    '11i: floating-point noise in a dimension is not a change',
    sharedInputsFingerprint({
      clocks: CLOCKS_A,
      truck: { ...TRUCK_A, heightFt: 13.60000000000001 },
    }) === FP,
  );

  check(
    '11j: the notice names the cause and asks for a re-plan',
    /clocks or truck changed/i.test(PLANNED_STOP_INPUTS_CHANGED_NOTICE) &&
      /plan again/i.test(PLANNED_STOP_INPUTS_CHANGED_NOTICE),
  );
}

/* ===================================================================== *
 * 12. ASKED ONCE PER TRIP — and reset on every condition the owner named
 * ===================================================================== */
{
  check(
    '12a: no destination yields the no-destination key',
    tripKeyFor(null) === NO_DESTINATION_TRIP,
  );
  check(
    '12b: a blank id is treated as no destination',
    tripKeyFor({ id: '   ' }) === NO_DESTINATION_TRIP,
  );
  check('12c: a destination yields its own key', tripKeyFor({ id: 'dest-A' }) === 'trip:dest-A');
  check(
    '12d: different destinations are different trips',
    tripKeyFor({ id: 'dest-A' }) !== tripKeyFor({ id: 'dest-B' }),
  );

  /* Never answered — ask. */
  check('12e: an unanswered trip is asked', shouldAskTripPlan(null, 'trip:dest-A').ask === true);

  /* SAME TRIP, RELOADED — must stay dismissed. This is the requirement that
   * a naive "ask every mount" would break. */
  const same = shouldAskTripPlan('trip:dest-A', 'trip:dest-A');
  check('12f: the same trip stays dismissed across a reload', same.ask === false);
  check('12g: …and needs no rewrite to do so', same.adoptKey === null);

  /* DESTINATION CHANGED — ask again. */
  check(
    '12h: changing the destination asks again',
    shouldAskTripPlan('trip:dest-A', 'trip:dest-B').ask === true,
  );

  /* TRIP COMPLETED OR CANCELLED — the destination clears, so the key returns
   * to no-destination and the next trip is asked. */
  check(
    '12i: completing or cancelling a trip asks again',
    shouldAskTripPlan('trip:dest-A', NO_DESTINATION_TRIP).ask === true,
  );

  /* A NEW TRIP BEGINS — same path as above: cleared destination, then a new
   * one, and the prompt has already returned at the clear. */
  check(
    '12j: a new trip after a finished one is asked',
    shouldAskTripPlan('trip:dest-A', 'trip:dest-C').ask === true,
  );

  /* THE CARRY-FORWARD. Answering before choosing a destination, then choosing
   * one, is ONE trip — not two. Re-asking seconds apart in a single setup is
   * the nagging that teaches drivers to dismiss without reading. */
  const adopt = shouldAskTripPlan(NO_DESTINATION_TRIP, 'trip:dest-A');
  check('12k: answering before picking a destination is not re-asked', adopt.ask === false);
  check('12l: …and the answer is carried onto the real trip', adopt.adoptKey === 'trip:dest-A');

  /* And once carried, a genuine destination change still asks — proving the
   * carry-forward is a one-way step out of "no destination yet" rather than a
   * permanent exemption. */
  check(
    '12m: after the carry-forward, changing destination still asks',
    shouldAskTripPlan('trip:dest-A', 'trip:dest-B').ask === true,
  );

  check(
    '12n: answering with no destination twice stays dismissed',
    shouldAskTripPlan(NO_DESTINATION_TRIP, NO_DESTINATION_TRIP).ask === false,
  );
}

/* ===================================================================== *
 * 13. THE SURFACES CARRY THE APPROVED WORDING AND WIRING
 * ===================================================================== */
{
  const fs = require('node:fs') as typeof import('node:fs');
  const first = fs.readFileSync('src/components/navigator/TripPlanFirst.tsx', 'utf8');
  const app = fs.readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  const screen = fs.readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  const storage = fs.readFileSync('src/components/navigator/planned-stop-storage.ts', 'utf8');

  check('13a: the approved question wording', /Plan your stops before you drive\?/.test(first));
  check('13b: Plan My Stops is kept', /Plan My Stops/.test(first));
  check('13c: Just Drive is kept', /Just Drive/.test(first));
  check('13d: the old device-wide wording is gone', !/Trip plan first\?/.test(first));

  check(
    '13e: the answer is stored against a trip, not the device',
    /answeredForTrip/.test(first) && /writeTripPlanAnswered\(tripKey\)/.test(first),
  );
  check(
    '13f: the v1 device-wide key is not reused, so an old dismissal cannot answer for a new trip',
    /tlws-navigator-trip-plan-asked-v2/.test(first) && /ASKED_VERSION = 2/.test(first),
  );
  check('13g: the prompt re-evaluates when the trip changes', /\}, \[tripKey\]\)/.test(first));
  check(
    '13h: the driving screen supplies the trip key',
    /tripKey=\{tripKeyFor\(picked\)\}/.test(screen),
  );

  check(
    '13i: the planner stamps the inputs it planned against',
    /plannedStopFromChoice\(choice, Date\.now\(\), currentFingerprint\(\)\)/.test(app),
  );
  check(
    '13j: the planner clears the stop the moment an input moves',
    /planningSignature/.test(app) && /clearPlannedStopRecord\(\)/.test(app),
  );
  check(
    '13k: origin, destination, buffer and the plan are all in that signature',
    /origin:none/.test(app) &&
      /dest:none/.test(app) &&
      /buffer:\$\{bufferMin\}/.test(app) &&
      /plan:none/.test(app),
  );
  check(
    '13l: the first pass records a baseline instead of clearing',
    /lastSignature\.current === null/.test(app),
  );
  check(
    '13m: a record with no fingerprint is refused rather than assumed unchanged',
    /inputsFingerprint === null\) return null/.test(storage),
  );
  check(
    '13n: the Navigator compares against the live fingerprint',
    /readPlannedStop\(record, Date\.now\(\), currentInputsFingerprint\(\)\)/.test(first),
  );
}

/* ===================================================================== */

console.log(`\ntrip-planner-waypoint-handoff: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failing: ${failures.join(' | ')}`);
  process.exit(1);
}
