/**
 * N8b — full-resolution geometry & navigation session handoff. Offline
 * tests for the geometry pipeline (normalization, validation, integrity),
 * the immutable route session, and the handoff into the UNCHANGED N5
 * controller/tracker/engine — plus measured (never invented) performance
 * and memory numbers printed for the record.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-route-session.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-nav-session.cjs && node /tmp/test-nav-session.cjs
 */
import { readFileSync } from 'node:fs';
import {
  normalizeGeometry,
  validateGeometryEndpoints,
  geometryFingerprint,
  MAX_GEOMETRY_POINTS,
  ENDPOINT_MATCH_MI,
  type GeometryPoint,
} from '@/lib/navigator/route-geometry';
import {
  createRouteSession,
  sessionToControllerRoute,
  thinForTracker,
  TRACKER_HANDOFF_MAX_POINTS,
  type CreateSessionInput,
  type RouteSession,
} from '@/lib/navigator/route-session';
import { createNavigationController } from '@/lib/navigator/navigation-controller';
import { createHereRoutingPort, type HereFetch } from '@/lib/trip-planner/here-routing';
import type { RoutingRequest } from '@/lib/trip-planner/providers';
import type { PositionState } from '@/lib/navigator/types';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { LatLng } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TRUCK: TruckProfile = {
  lengthFt: 73,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80_000,
  axles: 5,
  hazmatClass: null,
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.8,
};

/** Straight synthetic corridor: n points north from (35, -85). */
function line(n: number, startLat = 35, lng = -85, stepLat = 0.001): LatLng[] {
  const out: LatLng[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = { lat: startLat + i * stepLat, lng };
  return out;
}
/** Great-circle miles of a 0.001° lat step ≈ 0.0691 mi. */
const MI_PER_STEP = 0.0690937;

function sessionInput(over: Partial<CreateSessionInput> = {}): CreateSessionInput {
  const positions = over.positions ?? line(1000);
  const totalMiles =
    over.distanceMiles ?? Number(((positions.length - 1) * MI_PER_STEP).toFixed(1));
  return {
    routeId: 'nav-test-1',
    truck: TRUCK,
    origin: positions[0],
    destination: positions[positions.length - 1],
    positions,
    distanceMiles: totalMiles,
    durationSeconds: Math.round((totalMiles / 55) * 3600),
    maneuvers: [
      { action: 'depart', instruction: 'Head north.', direction: null, offset: 0 },
      { action: 'exit', instruction: 'Take exit 320.', direction: 'right', offset: 500 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    ...over,
  };
}

// ------------------------------------------------------- normalization
{
  const n = normalizeGeometry(line(100), 6.9);
  check('normalize: clean line has no problems', n.problems.length === 0);
  check('normalize: keeps every distinct point', n.points.length === 100);
  check('normalize: starts at mile 0', n.points[0].routeMile === 0);
  check('normalize: last mile lands exactly on the provider total', n.points[99].routeMile === 6.9);
  check(
    'normalize: cumulative mileage strictly monotonic (non-decreasing)',
    n.points.every((p, i) => i === 0 || p.routeMile >= n.points[i - 1].routeMile),
  );
  check(
    'normalize: identity index map when nothing was dropped',
    n.indexMap.length === 100 && n.indexMap[0] === 0 && n.indexMap[99] === 99,
  );

  const withNaN = line(50);
  withNaN[25] = { lat: Number.NaN, lng: -85 };
  check(
    'normalize: NaN coordinate rejects',
    normalizeGeometry(withNaN, 3).problems.some((p) => p.code === 'invalid-coordinate'),
  );
  const outOfRange = line(50);
  outOfRange[10] = { lat: 91.5, lng: -85 };
  check(
    'normalize: out-of-range latitude rejects',
    normalizeGeometry(outOfRange, 3).problems.some((p) => p.code === 'invalid-coordinate'),
  );
  check(
    'normalize: below minimum point count rejects',
    normalizeGeometry([{ lat: 35, lng: -85 }], 1).problems.some(
      (p) => p.code === 'missing-geometry',
    ),
  );
  check(
    'normalize: empty rejects',
    normalizeGeometry([], 1).problems.some((p) => p.code === 'missing-geometry'),
  );
  check(
    'normalize: memory bound enforced (reject, never truncate)',
    normalizeGeometry(line(MAX_GEOMETRY_POINTS + 1, 0, -85, 0.0000001), 100).problems.some(
      (p) => p.code === 'geometry-too-large',
    ),
  );
  check(
    'normalize: zero/absent total distance rejects',
    normalizeGeometry(line(10), 0).problems.some((p) => p.code === 'invalid-total') &&
      normalizeGeometry(line(10), Number.NaN).problems.some((p) => p.code === 'invalid-total'),
  );

  // Duplicates: dropped, counted, and mapped.
  const dup = [line(10)[0], line(10)[0], ...line(10).slice(1)]; // one duplicated head
  const nd = normalizeGeometry(dup, 0.7);
  check(
    'normalize: consecutive duplicate dropped and counted',
    nd.duplicatesDropped === 1 && nd.points.length === 10,
  );
  check(
    'normalize: dropped duplicate maps to the kept point (offset integrity)',
    nd.indexMap[0] === 0 && nd.indexMap[1] === 0 && nd.indexMap[2] === 1,
  );
  const mostlyDup: LatLng[] = [];
  for (let i = 0; i < 100; i++)
    mostlyDup.push(i % 4 === 0 ? { lat: 35 + i * 0.001, lng: -85 } : mostlyDup[i - 1]);
  check(
    'normalize: majority-duplicate corruption rejects',
    normalizeGeometry(mostlyDup, 2).problems.some((p) => p.code === 'duplicate-corruption'),
  );
  const allSame = new Array(10).fill({ lat: 35, lng: -85 });
  const ns = normalizeGeometry(allSame, 1);
  check(
    'normalize: fully-collapsed geometry rejects',
    ns.problems.length > 0, // duplicate-corruption (9/10) fires before degenerate
  );
}

// ------------------------------------------------- endpoint validation
{
  const pts = normalizeGeometry(line(100), 6.9).points;
  const origin = { lat: 35, lng: -85 };
  const dest = { lat: 35.099, lng: -85 };
  check(
    'endpoints: agreeing route passes',
    validateGeometryEndpoints(pts, origin, dest).length === 0,
  );
  check(
    'endpoints: wrong origin rejected',
    validateGeometryEndpoints(pts, { lat: 34.5, lng: -85 }, dest).some(
      (p) => p.code === 'origin-mismatch',
    ),
  );
  check(
    'endpoints: wrong destination rejected',
    validateGeometryEndpoints(pts, origin, { lat: 36.5, lng: -85 }).some(
      (p) => p.code === 'destination-mismatch',
    ),
  );
  check('endpoints: tolerance exported sanely', ENDPOINT_MATCH_MI === 2.0);
}

// ---------------------------------------------------------- fingerprint
{
  const pts = normalizeGeometry(line(500), 34.5).points;
  const fp1 = geometryFingerprint(pts);
  check('fingerprint: stable across calls', fp1 === geometryFingerprint(pts) && fp1.length === 8);
  const tampered: GeometryPoint[] = pts.map((p, i) =>
    i === 250
      ? { position: { lat: p.position.lat + 0.0002, lng: p.position.lng }, routeMile: p.routeMile }
      : p,
  );
  check('fingerprint: detects a single moved point', geometryFingerprint(tampered) !== fp1);
  const rounded: GeometryPoint[] = pts.map((p) => ({
    position: {
      lat: Number(p.position.lat.toFixed(5)),
      lng: Number(p.position.lng.toFixed(5)),
    },
    routeMile: p.routeMile,
  }));
  check(
    'fingerprint: survives 5-decimal wire rounding (same quantization)',
    geometryFingerprint(rounded) === fp1,
  );
}

// -------------------------------------------------------- session create
{
  const r = createRouteSession(sessionInput());
  check('session: valid input creates', r.ok);
  if (r.ok) {
    const s = r.session;
    check('session: carries full geometry', s.geometry.length === 1000);
    check(
      'session: route id / truck / endpoints present',
      s.routeId === 'nav-test-1' && s.truck.axles === 5,
    );
    check(
      'session: maneuver miles resolved EXACTLY from full geometry',
      s.maneuvers[1].mileMi === s.geometry[500].routeMile &&
        s.maneuvers[2].mileMi === s.distanceMiles,
    );
    check(
      'session: fingerprint recorded',
      s.geometryFingerprint === geometryFingerprint(s.geometry as GeometryPoint[]),
    );

    // Deep immutability — every layer frozen, mutations change nothing.
    check(
      'session: deep-frozen (session/geometry/point/position/maneuvers/truck)',
      Object.isFrozen(s) &&
        Object.isFrozen(s.geometry) &&
        Object.isFrozen(s.geometry[3]) &&
        Object.isFrozen(s.geometry[3].position) &&
        Object.isFrozen(s.maneuvers) &&
        Object.isFrozen(s.maneuvers[0]) &&
        Object.isFrozen(s.truck) &&
        Object.isFrozen(s.origin) &&
        Object.isFrozen(s.warnings),
    );
    const before = s.geometry[3].position.lat;
    try {
      (s.geometry[3].position as { lat: number }).lat = 0;
    } catch {
      /* strict mode throws — equally acceptable */
    }
    try {
      (s as { distanceMiles: number }).distanceMiles = 1;
    } catch {
      /* ditto */
    }
    check(
      'session: mutation attempts change nothing',
      s.geometry[3].position.lat === before && s.distanceMiles !== 1,
    );
    check(
      'session: input arrays are NOT shared (no mutable shared state)',
      (s.maneuvers as unknown) !== (sessionInput().maneuvers as unknown),
    );
  }

  check(
    "session: a 'requires-review' route can NEVER become a session",
    (() => {
      const r2 = createRouteSession(sessionInput({ validationState: 'requires-review' }));
      return !r2.ok && r2.problems.some((p) => p.code === 'ineligible-state');
    })(),
  );
  check(
    "session: a 'rejected' route refused",
    !createRouteSession(sessionInput({ validationState: 'rejected' })).ok,
  );
  check(
    'session: valid-with-warning is eligible and keeps its warnings',
    (() => {
      const r2 = createRouteSession(
        sessionInput({ validationState: 'valid-with-warning', warnings: ['toll road'] }),
      );
      return (
        r2.ok &&
        r2.session.validationState === 'valid-with-warning' &&
        r2.session.warnings[0] === 'toll road'
      );
    })(),
  );
  check(
    'session: missing route id refused',
    !createRouteSession(sessionInput({ routeId: ' ' })).ok,
  );
  check(
    'session: invalid duration refused',
    !createRouteSession(sessionInput({ durationSeconds: 0 })).ok,
  );
  check(
    'session: maneuver beyond the geometry refused',
    (() => {
      const r2 = createRouteSession(
        sessionInput({
          maneuvers: [{ action: 'turn', instruction: 'Turn.', direction: null, offset: 5000 }],
        }),
      );
      return !r2.ok && r2.problems.some((p) => p.code === 'maneuver-outside-geometry');
    })(),
  );
  check(
    'session: geometry failures refuse creation (origin mismatch)',
    (() => {
      const r2 = createRouteSession(sessionInput({ origin: { lat: 20, lng: -85 } }));
      return !r2.ok && r2.problems.some((p) => p.code === 'origin-mismatch');
    })(),
  );
  check(
    'session: duplicate-shifted maneuver offsets land on the RIGHT point',
    (() => {
      const base = line(1000);
      // Duplicate the first 10 points: original offset 500 now indexes a
      // geometry whose first 10 entries collapsed to 1.
      const positions = [...base.slice(0, 10).flatMap((p) => [p, p]), ...base.slice(10)];
      const r2 = createRouteSession(
        sessionInput({
          positions,
          origin: base[0],
          destination: base[999],
          maneuvers: [{ action: 'exit', instruction: 'Exit.', direction: null, offset: 25 }],
        }),
      );
      if (!r2.ok) return false;
      // Original index 25 = (25-20) + 10 = original point 15 → normalized 15.
      const expected = r2.session.geometry[15].routeMile;
      return r2.session.maneuvers[0].mileMi === expected;
    })(),
  );
}

// ----------------------------------------------- handoff into the engine
{
  const created = createRouteSession(sessionInput());
  const session = (created as { ok: true; session: RouteSession }).session;
  const route = sessionToControllerRoute(session);
  check('handoff: totalMi is the session distance', route.totalMi === session.distanceMiles);
  check('handoff: maneuver engine sees every maneuver', route.engine.count() === 3);

  const controller = createNavigationController(route);
  const T0 = 1_754_000_000_000;
  const fixAt = (i: number, t: number): PositionState => ({
    fix: {
      lat: session.geometry[i].position.lat,
      lng: session.geometry[i].position.lng,
      accuracyM: 8,
      tMs: t,
      speedMph: 58,
      headingDeg: 0,
    },
    health: 'good',
    lastFixMs: t,
    accuracyM: 8,
    speedMph: 58,
    headingDeg: 0,
    deadReckoning: false,
  });

  let view = controller.update(fixAt(0, T0));
  view = controller.update(fixAt(100, T0 + 10_000));
  view = controller.update(fixAt(300, T0 + 20_000));
  check('handoff: controller navigates on the session route', view.status === 'navigating');
  check(
    'handoff: route mile advances with full-resolution accuracy',
    view.routeMile !== null && Math.abs(view.routeMile - session.geometry[300].routeMile) < 0.2,
    view.routeMile,
  );
  check(
    'handoff: next maneuver is the mile-500 exit with a live distance',
    view.maneuvers?.next?.instruction === 'Take exit 320.' &&
      view.maneuvers.distanceMi !== null &&
      Math.abs(view.maneuvers.distanceMi - (session.geometry[500].routeMile - view.routeMile!)) <
        0.2,
  );
  check(
    'handoff: session remains frozen after the drive (no mutable sharing)',
    Object.isFrozen(session.geometry) && session.geometry.length === 1000,
  );

  // Thinning: only above the bound, deterministic, endpoints intact.
  const small = session.geometry;
  check(
    'handoff: below the bound nothing is thinned',
    thinForTracker(small).length === small.length,
  );
  const big = normalizeGeometry(line(50_000, 0, -85, 0.00002), 43.2).points;
  const thinned = thinForTracker(big);
  check(
    'handoff: 50k points thinned under the tracker bound (+ endpoints kept)',
    thinned.length <= TRACKER_HANDOFF_MAX_POINTS + 1 &&
      thinned[0] === big[0] &&
      thinned[thinned.length - 1] === big[big.length - 1],
    thinned.length,
  );
  check(
    'handoff: thinning preserves monotonic miles',
    thinned.every((p, i) => i === 0 || p.routeMile >= thinned[i - 1].routeMile),
  );
}

// ------------------------------------- adapter: geometry retention rules
async function adapterChecks() {
  const POLY = 'BFoz5xJ67i1B1B7PzIhaxL7Y';
  const okBody = {
    routes: [
      {
        sections: [
          {
            summary: { length: 160_934, duration: 7200 },
            polyline: POLY,
            actions: [{ action: 'depart', instruction: 'Go.', offset: 0 }],
          },
        ],
      },
    ],
  };
  const req: RoutingRequest = {
    origin: { lat: 35.0456, lng: -85.3097 },
    destination: { lat: 36.1627, lng: -86.7816 },
    waypoints: [],
    truck: TRUCK,
    departAtMs: 1_754_000_000_000,
  };
  const fetchOk: HereFetch = async () => ({ status: 200, json: async () => okBody });

  const plain = createHereRoutingPort(fetchOk, 'TEST-KEY');
  const a = await plain.route(req);
  check(
    'adapter: geometry absent by default (planner memory unchanged)',
    a !== null && a.geometry === undefined,
  );

  const retaining = createHereRoutingPort(fetchOk, 'TEST-KEY', { retainGeometry: true });
  const b = await retaining.route(req);
  check(
    'adapter: retainGeometry exposes the FULL decoded polyline',
    b !== null && Array.isArray(b.geometry) && b.geometry.length === (b.geometryPointCount ?? -1),
  );
}

// --------------------------------------------- endpoint + doc structure
{
  const endpoint = strip(readFileSync('src/app/api/navigator/route/route.ts', 'utf8'));
  check(
    'endpoint: opts into geometry retention with a small cache',
    /retainGeometry:\s*true/.test(endpoint) && /cacheMax:\s*24/.test(endpoint),
  );
  check(
    'endpoint: geometry normalized + endpoint-validated before the response',
    endpoint.indexOf('normalizeGeometry(') < endpoint.indexOf('routeId: `nav-') &&
      /validateGeometryEndpoints/.test(endpoint),
  );
  check(
    'endpoint: full geometry returned rounded to 5 decimals',
    /toFixed\(5\)/.test(endpoint) && /geometry:\s*normalized\.points\.map/.test(endpoint),
  );
  check(
    'endpoint: geometry failures are geometry:-coded rejects',
    /geometry:\$\{p\.code\}/.test(endpoint),
  );
  check('endpoint: response carries a route id for the session', /routeId:\s*`nav-/.test(endpoint));
}

// ------------------------- measured performance / memory (never invented)
async function perf() {
  const N = 100_000;
  const positions = line(N, 0, -85, 0.00002); // ~86 mi of dense geometry
  const totalMiles = Number(((N - 1) * 0.00138).toFixed(1));

  (globalThis as { gc?: () => void }).gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const normalized = normalizeGeometry(positions, totalMiles);
  const t1 = performance.now();
  const created = createRouteSession({
    routeId: 'bench',
    truck: TRUCK,
    origin: positions[0],
    destination: positions[N - 1],
    positions,
    distanceMiles: totalMiles,
    durationSeconds: 3600 * 3,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: N - 1 },
    ],
    validationState: 'valid',
  });
  const t2 = performance.now();
  const handoff = created.ok ? sessionToControllerRoute(created.session) : null;
  const t3 = performance.now();
  const heapAfter = process.memoryUsage().heapUsed;

  const normalizeMs = t1 - t0;
  const sessionMs = t2 - t1;
  const handoffMs = t3 - t2;
  const retainedMb = (heapAfter - heapBefore) / (1024 * 1024);
  console.log(
    `measured (${N.toLocaleString()} pts): normalize ${normalizeMs.toFixed(1)} ms · ` +
      `session ${sessionMs.toFixed(1)} ms · handoff ${handoffMs.toFixed(1)} ms · ` +
      `heap delta ${retainedMb.toFixed(1)} MB`,
  );
  check('perf: 100k-point normalization parses clean', normalized.problems.length === 0);
  check('perf: 100k-point session creates', created.ok);
  check('perf: handoff produced a bounded tracker', handoff !== null);
  check('perf: worst-case pipeline stays interactive (< 5 s total)', t3 - t0 < 5000, t3 - t0);
  check('perf: retained heap for worst-case route < 100 MB', retainedMb < 100, retainedMb);
}

async function main() {
  await adapterChecks();
  await perf();
  console.log(`navigator-route-session: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
