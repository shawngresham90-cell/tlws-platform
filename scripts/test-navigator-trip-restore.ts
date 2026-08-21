/**
 * Trip restore (pilot round 3, item 4): a reload mid-drive must put the
 * active trip back — through the lifecycle's own front door — and must
 * never persist anything about the DRIVER. This harness proves the pure
 * module end to end (strict parsing, refusal of damage and staleness,
 * the port and capture seams), runs a real lifecycle through a restore,
 * and pins the driving screen's wiring: what is written, when it is
 * cleared, and the permission rail the GPS restart honors.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-trip-restore.ts --bundle \
 *     --platform=node --format=cjs --jsx=automatic --loader:.css=empty \
 *     --alias:@=./src --outfile=/tmp/test-trip-restore.cjs \
 *     && node /tmp/test-trip-restore.cjs
 */
import { readFileSync } from 'node:fs';
import {
  createRestorablePlanPort,
  parseTripSnapshot,
  serializeTripSnapshot,
  withPlanCapture,
  MAX_GEOMETRY_POINTS,
  RESTORE_FUTURE_SKEW_MS,
  RESTORE_REFRESH_MS,
  RESTORE_WINDOW_MS,
  TRIP_RESTORE_KEY,
  type RestorableTrip,
  type RouteMaterial,
} from '@/lib/navigator/trip-restore';
import {
  createNavigationLifecycle,
  type NavigationLifecycle,
  type PlanFetchResult,
  type PlanRequest,
} from '@/lib/navigator/navigation-lifecycle';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import { freshClockState } from '@/lib/trip-planner/hos-engine';
import type { LatLng } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 220)}`}`);
  }
}

/* ------------------------------------------------------------ fixtures */

const T0 = 1_754_000_000_000;
const LINE: LatLng[] = Array.from({ length: 400 }, (_, i) => ({ lat: 35 + i * 0.001, lng: -85 }));
const DEST = LINE[LINE.length - 1];

const ROUTE: RouteMaterial = {
  kind: 'route',
  routeId: 'restore-test-route',
  positions: LINE,
  distanceMiles: 27.6,
  durationSeconds: 1800,
  maneuvers: [
    { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
    {
      action: 'turn',
      instruction: 'Turn right onto Old Mill Road.',
      direction: 'right',
      offset: 150,
    },
    {
      action: 'arrive',
      instruction: 'Arrive at the receiving gate.',
      direction: null,
      offset: 399,
    },
  ],
  validationState: 'valid',
  warnings: ['One warning survived validation.'],
};

/**
 * The origin is a raw-fix-like point deliberately OFF the route's first
 * coordinate: PilotTripControls builds the real one from the live GPS
 * fix. The snapshot must never carry it, and the restored origin must
 * be the route's own road-snapped start instead — provable only
 * because the two differ.
 */
const RAW_FIX_ORIGIN = { lat: 35.0000731, lng: -85.0000442 };
const REQUEST: PlanRequest = {
  origin: RAW_FIX_ORIGIN,
  destination: DEST,
  truck: DEFAULT_TRUCK_PROFILE,
  departAtMs: T0,
};

const DESTINATION: DestinationInfo = {
  position: DEST,
  facility: 'truck-stop',
  positionSource: 'geocode',
  entrances: [{ position: DEST, kind: 'verified', label: 'North gate' }],
};

const NOW = T0 + 5 * 60 * 1000; // parsed five minutes after the save
function snapshot(mutate?: (snap: Record<string, unknown>) => void): string {
  const parsed = JSON.parse(
    serializeTripSnapshot({
      route: ROUTE,
      request: REQUEST,
      destination: DESTINATION,
      savedAtMs: T0,
    }),
  ) as Record<string, unknown>;
  if (mutate) mutate(parsed);
  return JSON.stringify(parsed);
}

/* ================= 1. round trip: what was saved comes back ============ */
{
  const trip = parseTripSnapshot(snapshot(), NOW);
  check('1. a fresh snapshot parses', trip !== null);
  if (trip) {
    check('1. route id survives', trip.route.routeId === ROUTE.routeId);
    check('1. geometry survives point for point', trip.route.positions.length === LINE.length);
    check(
      '1. geometry precision is untouched',
      trip.route.positions[123].lat === LINE[123].lat &&
        trip.route.positions[123].lng === LINE[123].lng,
    );
    check(
      '1. maneuvers survive with offsets',
      trip.route.maneuvers.length === 3 && trip.route.maneuvers[1].offset === 150,
    );
    check(
      '1. validation state + warnings survive',
      trip.route.validationState === 'valid' && trip.route.warnings?.length === 1,
    );
    check(
      '1. the plan request survives',
      trip.request.truck.heightFt === DEFAULT_TRUCK_PROFILE.heightFt &&
        trip.request.departAtMs === T0,
    );
    // The origin rail, both directions: the serialization carries no
    // origin at all, and the restored request's origin is the VALIDATED
    // route's first coordinate — never the raw fix the plan was made
    // with, which here deliberately differs so the reconstruction is
    // provable.
    const rawJson = snapshot();
    check('1. the serialized JSON has no request.origin', !/"origin"/.test(rawJson));
    check(
      '1. the stored request carries only destination, truck, departAtMs',
      Object.keys((JSON.parse(rawJson) as { request: object }).request)
        .sort()
        .join(',') === 'departAtMs,destination,truck',
    );
    check(
      "1. the restored origin is the route's own first coordinate",
      trip.request.origin.lat === LINE[0].lat && trip.request.origin.lng === LINE[0].lng,
    );
    check(
      '1. the restored origin is NOT the raw fix the plan was made with',
      trip.request.origin.lat !== RAW_FIX_ORIGIN.lat &&
        trip.request.origin.lng !== RAW_FIX_ORIGIN.lng,
    );
    check(
      '1. arrival context survives: facility, provenance, entrance',
      trip.destination.facility === 'truck-stop' &&
        trip.destination.positionSource === 'geocode' &&
        trip.destination.entrances?.length === 1 &&
        trip.destination.entrances[0].kind === 'verified',
    );
    check('1. savedAt survives', trip.savedAtMs === T0);
  }
}

/* ================= 2. staleness: the freshness window is a wall ======== */
{
  check(
    '2. inside the window restores',
    parseTripSnapshot(snapshot(), T0 + RESTORE_WINDOW_MS) !== null,
  );
  check(
    '2. one ms past the window refuses',
    parseTripSnapshot(snapshot(), T0 + RESTORE_WINDOW_MS + 1) === null,
  );
  check(
    '2. saved "in the future" within clock skew tolerated',
    parseTripSnapshot(snapshot(), T0 - RESTORE_FUTURE_SKEW_MS + 1) !== null,
  );
  check(
    '2. saved beyond the skew refused (clock went backwards)',
    parseTripSnapshot(snapshot(), T0 - RESTORE_FUTURE_SKEW_MS - 1) === null,
  );
  check(
    '2. the refresh cadence is far shorter than the window',
    RESTORE_REFRESH_MS * 5 < RESTORE_WINDOW_MS,
  );
}

/* ================= 3. damage: refused whole, never partially trusted === */
{
  const cases: [string, string | null][] = [
    ['null storage', null],
    ['empty string', ''],
    ['garbage', '{not json'],
    ['wrong version', snapshot((s) => void (s.v = 2))],
    ['missing route', snapshot((s) => void delete s.route)],
    [
      'route not a route',
      snapshot((s) => void ((s.route as Record<string, unknown>).kind = 'failure')),
    ],
    ['empty route id', snapshot((s) => void ((s.route as Record<string, unknown>).routeId = ''))],
    [
      'non-finite latitude',
      snapshot(
        (s) => void ((s.route as { positions: { lat: number }[] }).positions[3].lat = Number.NaN),
      ),
    ],
    [
      'latitude out of range',
      snapshot((s) => void ((s.route as { positions: { lat: number }[] }).positions[3].lat = 91)),
    ],
    [
      'one-point geometry',
      snapshot((s) => void ((s.route as Record<string, unknown>).positions = [LINE[0]])),
    ],
    [
      'maneuver offset past the geometry',
      snapshot(
        (s) => void ((s.route as { maneuvers: { offset: number }[] }).maneuvers[1].offset = 400),
      ),
    ],
    [
      'fractional maneuver offset',
      snapshot(
        (s) => void ((s.route as { maneuvers: { offset: number }[] }).maneuvers[1].offset = 1.5),
      ),
    ],
    [
      'instruction past the text bound',
      snapshot(
        (s) =>
          void ((s.route as { maneuvers: { instruction: string }[] }).maneuvers[0].instruction =
            'x'.repeat(501)),
      ),
    ],
    [
      'negative duration',
      snapshot((s) => void ((s.route as Record<string, unknown>).durationSeconds = -1)),
    ],
    [
      'truck with zero height',
      snapshot((s) => void ((s.request as { truck: { heightFt: number } }).truck.heightFt = 0)),
    ],
    [
      'a stored request.origin — injected origins are never trusted',
      snapshot((s) => void ((s.request as Record<string, unknown>).origin = RAW_FIX_ORIGIN)),
    ],
    [
      'truck without fuelSafetyFactor',
      snapshot(
        (s) => void delete (s.request as { truck: Record<string, unknown> }).truck.fuelSafetyFactor,
      ),
    ],
    [
      'truck with zero fuelSafetyFactor',
      snapshot(
        (s) =>
          void ((s.request as { truck: { fuelSafetyFactor: number } }).truck.fuelSafetyFactor = 0),
      ),
    ],
    [
      'truck with non-finite fuelSafetyFactor',
      snapshot(
        (s) =>
          void ((s.request as { truck: { fuelSafetyFactor: number } }).truck.fuelSafetyFactor =
            Number.NaN),
      ),
    ],
    [
      'truck with fuelSafetyFactor above 1 (more range than the tank has)',
      snapshot(
        (s) =>
          void ((s.request as { truck: { fuelSafetyFactor: number } }).truck.fuelSafetyFactor =
            1.01),
      ),
    ],
    [
      'destination without position',
      snapshot((s) => void delete (s.destination as Record<string, unknown>).position),
    ],
    [
      'warnings not strings',
      snapshot((s) => void ((s.route as Record<string, unknown>).warnings = [7])),
    ],
  ];
  for (const [name, raw] of cases) {
    check(`3. refused: ${name}`, parseTripSnapshot(raw, NOW) === null);
  }
  const big = snapshot((s) => {
    (s.route as Record<string, unknown>).positions = Array.from(
      { length: MAX_GEOMETRY_POINTS + 1 },
      () => ({ lat: 35, lng: -85 }),
    );
    (s.route as Record<string, unknown>).maneuvers = [];
  });
  check('3. refused: geometry past the structural bound', parseTripSnapshot(big, NOW) === null);
  check('3. parse never throws', true); // reaching here IS the assertion
}

/* ================= 4. forgiveness: optional enrichment only ============ */
{
  const oddFacility = parseTripSnapshot(
    snapshot((s) => void ((s.destination as Record<string, unknown>).facility = 'spaceport')),
    NOW,
  );
  check(
    '4. unknown facility coerces to unknown, not refusal',
    oddFacility?.destination.facility === 'unknown',
  );
  const oddSource = parseTripSnapshot(
    snapshot((s) => void ((s.destination as Record<string, unknown>).positionSource = 'psychic')),
    NOW,
  );
  check(
    '4. unknown provenance coerces to unknown',
    oddSource?.destination.positionSource === 'unknown',
  );
  const oddEntrance = parseTripSnapshot(
    snapshot(
      (s) =>
        void ((s.destination as Record<string, unknown>).entrances = [
          { position: DEST, kind: 'verified' },
          { position: { lat: 999, lng: 0 }, kind: 'verified' },
          { position: DEST, kind: 'imagined' },
        ]),
    ),
    NOW,
  );
  check(
    '4. invalid entrances are filtered, valid kept',
    oddEntrance?.destination.entrances?.length === 1,
  );
  const oddAvoid = parseTripSnapshot(
    snapshot((s) => void ((s.request as Record<string, unknown>).avoid = ['ferry', 'blackHoles'])),
    NOW,
  );
  check(
    '4. unknown avoidances dropped, known kept',
    oddAvoid !== null &&
      oddAvoid.request.avoid?.length === 1 &&
      oddAvoid.request.avoid[0] === 'ferry',
  );
}

/* ================= 5. privacy: the snapshot is the ROUTE, full stop ==== */
{
  const raw = snapshot();
  const keys = Object.keys(JSON.parse(raw) as Record<string, unknown>).sort();
  check(
    '5. exactly five top-level keys, all route-shaped',
    keys.join(',') === 'destination,request,route,savedAtMs,v',
    keys,
  );
  check('5. no driver name anywhere in the serialization', !/firstName|driverName/i.test(raw));
  /*
   * HOS CLOCKS ARE NOW A SANCTIONED SIXTH KEY (pilot round 3, compact
   * HOS). The old pin here said "no HOS state anywhere", written when
   * the only thing clocks could add was risk. What changed is the
   * measured consequence of leaving them out: a reload mid-shift
   * restored the trip and reset the clocks to a fresh eleven hours,
   * which is a wrong number in the one place a wrong number is
   * dangerous. Clocks are duty COUNTERS — no position, no identity, no
   * trail — so the privacy rail this section exists to protect is
   * unchanged, and the pin now says exactly that: clocks may appear,
   * and only as counters.
   */
  const withClocks = JSON.parse(
    serializeTripSnapshot({
      route: ROUTE,
      request: REQUEST,
      destination: DESTINATION,
      savedAtMs: T0,
      clocks: freshClockState(T0),
    }),
  ) as Record<string, unknown>;
  check(
    '5. clocks are the ONLY sanctioned addition to the snapshot',
    Object.keys(withClocks).sort().join(',') === 'clocks,destination,request,route,savedAtMs,v',
    Object.keys(withClocks).sort(),
  );
  check(
    '5. the persisted clocks carry counters only — never a position or a trail',
    !/lat|lng|position|firstName|speed|heading/i.test(JSON.stringify(withClocks.clocks)),
    withClocks.clocks,
  );
  const lib = readFileSync('src/lib/navigator/trip-restore.ts', 'utf8');
  check('5. the pure module touches no storage API', !/sessionStorage\.|localStorage\./.test(lib));
  check('5. the pure module reads no clock', !/Date\.now\(\)/.test(lib));
  // The word appears in prose (the name-ephemerality comment); what must
  // never appear is a CALL.
  check(
    '5. localStorage is never called anywhere in the restore path',
    !/localStorage\./.test(lib) &&
      !/localStorage\./.test(readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8')),
  );
}

/* ================= 6. the restorable port ============================== */
{
  const calls: string[] = [];
  let armed: RouteMaterial | null = ROUTE;
  const routed: string[] = [];
  const port = createRestorablePlanPort(
    async () => {
      calls.push('network');
      return { kind: 'failure', reason: 'should-not-run' } as PlanFetchResult;
    },
    () => {
      const p = armed;
      armed = null;
      return p;
    },
    (_req, route) => routed.push(route.routeId),
  );
  void (async () => {
    const first = await port(REQUEST);
    check(
      '6. an armed payload is served instead of the network',
      first.kind === 'route' && calls.length === 0,
    );
    const second = await port(REQUEST);
    check(
      '6. the payload is consumed by exactly one call',
      second.kind === 'failure' && calls.length === 1,
    );
    check(
      '6. onRoute observed the restored route (and only it)',
      routed.length === 1 && routed[0] === ROUTE.routeId,
    );
  })();
}

/* ================= 7. plan capture ===================================== */
{
  const seen: { req: PlanRequest; destination: DestinationInfo }[] = [];
  const inner = {
    state: () => 'idle',
    plan: async () => ({ ok: false, reason: 'stub', refused: true }),
  } as unknown as NavigationLifecycle;
  const wrapped = withPlanCapture(inner, (req, destination) => seen.push({ req, destination }));
  void wrapped.plan(REQUEST, DESTINATION, T0);
  check(
    '7. plan capture sees the request and the arrival context',
    seen.length === 1 && seen[0].destination.facility === 'truck-stop',
  );
  check('7. every other method passes through untouched', wrapped.state() === 'idle');
}

/* ================= 8. a real lifecycle restores through the front door = */
void (async () => {
  const trip = parseTripSnapshot(snapshot(), NOW) as RestorableTrip;
  let armed: RouteMaterial | null = trip.route;
  const lc = createNavigationLifecycle({
    planPort: createRestorablePlanPort(
      async () => ({ kind: 'failure', reason: 'network-must-not-run' }),
      () => {
        const p = armed;
        armed = null;
        return p;
      },
    ),
    replacementPort: async () => ({ kind: 'failure', reason: 'no-reroute-in-this-test' }),
  });
  const outcome = await lc.plan(trip.request, trip.destination, NOW);
  check('8. the restored plan is accepted', outcome.ok === true);
  check('8. route-ready without any network', lc.state() === 'route-ready');
  check(
    '8. startNavigation restores live guidance',
    lc.startNavigation(NOW) && lc.state() === 'navigating',
  );
  const md = lc.mapData();
  check(
    '8. the map gets the whole restored geometry',
    md.geometry.length === LINE.length && md.routeId === ROUTE.routeId,
  );
  const tick = lc.tick(
    {
      fix: {
        lat: LINE[2].lat,
        lng: LINE[2].lng,
        accuracyM: 8,
        tMs: NOW + 1000,
        speedMph: 55,
        headingDeg: 0,
      },
      health: 'good',
      lastFixMs: NOW + 1000,
      accuracyM: 8,
      speedMph: 55,
      headingDeg: 0,
      deadReckoning: false,
    },
    NOW + 1000,
  );
  check(
    '8. a tick on the line keeps navigating with a live maneuver',
    tick.state === 'navigating' && tick.view.maneuvers !== null,
  );
  check(
    '8. no transition invariant was violated on the way',
    lc.violations().length === 0,
    lc.violations(),
  );

  /* =============== 9. the driving screen's wiring, pinned ============== */
  {
    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    check('9. the screen persists under the versioned key', screen.includes('TRIP_RESTORE_KEY'));
    /*
     * The write moved into `saveSnapshotNow()` so the periodic save and the
     * leaving-the-screen flush are literally the same code (NAV-ENTRY-1).
     * Both guards are asserted here rather than one: the periodic save still
     * only runs while guidance is live, and the flush — which is what lets a
     * driver open Settings mid-trip and come back to it — is gated on the
     * same ACTIVE list, read from the lifecycle at cleanup time.
     */
    const flat = screen.replace(/\s+/g, ' ');
    check(
      '9. periodic persistence runs only while guidance is live',
      /ACTIVE_LIFECYCLE_STATES\.includes\(lcState\)\) \{ if \(Date\.now\(\) - lastSavedMsRef\.current >= RESTORE_REFRESH_MS\) saveSnapshotNow\(\);/.test(
        flat,
      ),
    );
    check(
      '9. the unmount flush is gated on the same ACTIVE list, and runs BEFORE the cancel',
      /if \(ACTIVE_LIFECYCLE_STATES\.includes\(lifecycle\.state\(\)\)\) saveSnapshotNow\(\);[\s\S]{0,200}lifecycle\.cancel/.test(
        flat,
      ),
    );
    check(
      '9. the snapshot clears on the transition into arrived/completed',
      screen.includes("(lcState === 'arrived' || lcState === 'completed') && prev !== lcState") &&
        screen.includes('sessionStorage.removeItem(TRIP_RESTORE_KEY)'),
    );
    check('9. restore is gated on pilot mode', screen.includes('if (!pilot.active) return;'));
    check(
      '9. restore runs once per mount, StrictMode included',
      screen.includes('restoreAttemptedRef.current') &&
        screen.includes('restoreAttemptedRef.current = true;'),
    );
    check(
      '9. the GPS watch restarts only on a positive permission answer',
      screen.includes("query({ name: 'geolocation' })") &&
        screen.includes("if (status.state === 'granted') start();"),
    );
    check(
      '9. a consumed or refused payload never lingers armed',
      screen.includes('restorePayloadRef.current = null; // consumed or refused'),
    );
    check(
      '9. a stale or damaged snapshot is deleted, not retried',
      /parsed === null[\s\S]{0,400}?sessionStorage\.removeItem\(TRIP_RESTORE_KEY\)/.test(screen),
    );
    check('9. the restore is recorded in the pilot log', screen.includes("'trip-restored'"));
    // The privacy harnesses scrub the sanctioned sessionStorage call
    // shapes from the screen before applying their bans — which is only
    // safe because THIS pin holds: every storage call the screen makes
    // names the versioned trip key, so no other key can ride the
    // exemption.
    const storageCalls = screen.match(/sessionStorage\.(getItem|setItem|removeItem)\(/g) ?? [];
    // TWO versioned keys now, and only two: the trip snapshot, and the
    // confirmed TRUCK (truck-route confidence milestone). They are
    // deliberately separate — a truck outlives a trip, so discarding a
    // trip must not discard the profile the driver verified — and both
    // are named constants, so no unversioned or ad-hoc key can appear.
    const keyedCalls =
      screen.match(/sessionStorage\.(getItem|setItem|removeItem)\(\s*TRIP_RESTORE_KEY/g) ?? [];
    check(
      '9. every storage call on the screen uses the ONE versioned trip key',
      storageCalls.length >= 3 && storageCalls.length === keyedCalls.length,
      { storageCalls: storageCalls.length, keyedCalls: keyedCalls.length },
    );
    /*
     * The confirmed TRUCK moved to its own module in the pre-trip setup
     * milestone — same key, same envelope, now in localStorage so it
     * survives to the next VISIT and not merely the next reload. The
     * record is pinned where it now lives, and the safety property
     * travels with it: a stored confirmation counts only while it still
     * matches the stored values, so restoring a truck never restores
     * permission to route for a truck nobody checked.
     */
    const truckStore = readFileSync('src/components/navigator/truck-storage.ts', 'utf8');
    check(
      '9. the truck key is versioned and carries no trip or position data',
      /const TRUCK_PROFILE_KEY = 'tlws-navigator-truck-v\d+'/.test(truckStore) &&
        /confirmed: confirmation\.confirmedFingerprint/.test(truckStore) &&
        !/lat|lng|position|route|firstName/.test(
          truckStore.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
        ),
    );
    check(
      '9. a restored truck whose values no longer match its fingerprint comes back UNCONFIRMED',
      /confirmed === routingFingerprint\(profile\)/.test(truckStore) &&
        /NO_CONFIRMATION/.test(truckStore),
    );
  }

  console.log(`navigator-trip-restore: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
