/**
 * Missed turn → forward-progress reroute (second owner road test).
 *
 * WHAT HAPPENED
 *
 * Northbound on Hwy 92. The route wanted a turn at Charles Hardy Pkwy.
 * The driver passed it deliberately. Navigator detected the departure and
 * said "You're off route. Rerouting." — and then:
 *
 *   - the truck marker tracked visibly RIGHT of the roadway
 *   - the old Charles Hardy turn kept being shown and spoken
 *   - no usable replacement ever arrived
 *   - the app behaved as though the truck should turn around
 *
 * A Garmin in the same seat rerouted FORWARD and kept the truck on 92.
 *
 * Three separate defects, and this harness pins all three: the marker
 * draws the matched position when the matcher is confident, the missed
 * maneuver is retired the moment the truck is off route, and a first
 * answer that points backwards triggers ONE forward-anchored retry rather
 * than a dead end.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-missed-turn.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-missed-turn.cjs && node /tmp/test-navigator-missed-turn.cjs
 */
import { readFileSync } from 'node:fs';
import {
  createNavigationLifecycle,
  MATCHED_DISPLAY_LATERAL_M,
  type NavigationLifecycle,
  type PlanFetchResult,
} from '@/lib/navigator/navigation-lifecycle';
import type {
  ReplacementFetchResult,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import { projectAhead, FORWARD_ANCHOR_MI } from '@/lib/navigator/reversal-guard';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { PositionState } from '@/lib/navigator/types';
import type { LatLng } from '@/lib/map/bounds';
import { haversineMiles } from '@/lib/map/geo';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

/* -------------------------------------------------------- geography ---
 * Hwy 92 runs NORTH. Charles Hardy runs EAST from a junction partway up.
 * The planned route goes north on 92, turns east at the junction.
 */
const T0 = 1_754_000_000_000;
const LNG = -84.8;
const LAT0 = 33.9;
const STEP = 0.001; // ≈ 0.069 mi of latitude
const TURN_IDX = 120;

/** Hwy 92 northbound, well past the junction. */
const HWY92: LatLng[] = Array.from({ length: 400 }, (_, i) => ({
  lat: LAT0 + i * STEP,
  lng: LNG,
}));
const JUNCTION = HWY92[TURN_IDX];

/** The planned route: north on 92 to the junction, then east. */
const PLANNED: LatLng[] = [
  ...HWY92.slice(0, TURN_IDX + 1),
  ...Array.from({ length: 120 }, (_, i) => ({
    lat: JUNCTION.lat,
    lng: JUNCTION.lng + (i + 1) * STEP,
  })),
];
const DEST = PLANNED[PLANNED.length - 1];

const DEST_INFO: DestinationInfo = {
  position: DEST,
  facility: 'warehouse',
  positionSource: 'geocode',
  entrances: [{ position: DEST, kind: 'verified', label: 'Gate' }],
};

function pos(p: LatLng, headingDeg: number, speedMph: number, tMs: number, accuracyM = 8) {
  const state: PositionState = {
    fix: { lat: p.lat, lng: p.lng, accuracyM, tMs, speedMph, headingDeg },
    health: 'good',
    lastFixMs: tMs,
    accuracyM,
    speedMph,
    headingDeg,
    deadReckoning: false,
  };
  return state;
}

function plannedRoute(): PlanFetchResult {
  return {
    kind: 'route',
    routeId: 'hwy92-charles-hardy',
    positions: PLANNED,
    distanceMiles: 16.6,
    durationSeconds: 1500,
    maneuvers: [
      { action: 'depart', instruction: 'Head north on Hwy 92.', direction: null, offset: 0 },
      {
        action: 'turn',
        instruction: 'Turn right onto Charles Hardy Pkwy.',
        direction: 'right',
        offset: TURN_IDX,
      },
      {
        action: 'arrive',
        instruction: 'Arrive.',
        direction: null,
        offset: PLANNED.length - 1,
      },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

/**
 * The provider that produced the road-test failure, and the one that
 * fixes it: asked from where the truck IS, it wants a U-turn back down 92
 * to the missed junction. Asked from a point up the road, it does the
 * sensible thing and goes on north before cutting across.
 *
 * That difference is the entire mechanism — the origin is the only field
 * that changes, and no provider parameter is invented.
 */
function realisticProvider(req: ReplacementRequest): ReplacementFetchResult {
  const aheadOfJunction = req.origin.lat - JUNCTION.lat;
  const wantsUturn = aheadOfJunction > 0 && aheadOfJunction < 0.04; // within ~2.7 mi
  const positions: LatLng[] = wantsUturn
    ? [
        // back down 92 to the junction, then east — the unsafe answer
        ...Array.from({ length: 40 }, (_, i) => ({
          lat: req.origin.lat - i * STEP,
          lng: LNG,
        })).filter((p) => p.lat >= JUNCTION.lat),
        ...Array.from({ length: 120 }, (_, i) => ({
          lat: JUNCTION.lat,
          lng: JUNCTION.lng + (i + 1) * STEP,
        })),
      ]
    : [
        // on north, then east and back down to the destination — forward
        ...Array.from({ length: 30 }, (_, i) => ({ lat: req.origin.lat + i * STEP, lng: LNG })),
        ...Array.from({ length: 130 }, (_, i) => ({
          lat: req.origin.lat + 29 * STEP,
          lng: LNG + (i + 1) * STEP,
        })),
        { ...DEST },
      ];
  return {
    kind: 'route',
    positions,
    distanceMiles: 12,
    durationSeconds: 1100,
    maneuvers: [
      {
        action: 'depart',
        instruction: wantsUturn ? 'Head south on Hwy 92.' : 'Continue north on Hwy 92.',
        direction: null,
        offset: 0,
      },
      { action: 'turn', instruction: 'Turn right.', direction: 'right', offset: 29 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

function rig(provider: (r: ReplacementRequest) => ReplacementFetchResult = realisticProvider) {
  const origins: LatLng[] = [];
  const lc = createNavigationLifecycle({
    planPort: async () => plannedRoute(),
    replacementPort: async (r) => {
      origins.push({ ...r.origin });
      return provider(r);
    },
  });
  return { lc, origins };
}

/** Drive north on 92, straight past the Charles Hardy junction. */
async function missTheTurn(lc: NavigationLifecycle): Promise<number> {
  await lc.plan(
    { origin: HWY92[0], destination: DEST, truck: DEFAULT_TRUCK_PROFILE, departAtMs: T0 },
    DEST_INFO,
    T0,
  );
  lc.startNavigation(T0);
  let t = T0 + 1000;
  for (let i = 0; i <= TURN_IDX + 40; i += 2) {
    lc.tick(pos(HWY92[i], 0, 55, t), t);
    t += 6000;
  }
  return t;
}

async function main() {
  // =================================================================
  // 1-3. THE MISSED TURN IS DETECTED AND THE OLD TURN IS RETIRED
  // =================================================================
  {
    const { lc } = rig();
    await missTheTurn(lc);
    check(
      '1: driving straight past the required turn goes off route',
      lc.state() === 'off-route',
      lc.state(),
    );
    check(
      '9: the destination is untouched by any of this',
      lc.mapData().destination?.lat === DEST.lat && lc.mapData().destination?.lng === DEST.lng,
    );

    // The engine still knows the old route — the SCREEN is what retires it.
    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    check(
      '2: off route drops the stale maneuver from the view the driver sees',
      /const guidanceStale = lcState === 'off-route' \|\| lcState === 'rerouting'/.test(screen) &&
        /shownView[\s\S]{0,120}maneuvers: null/.test(screen),
      'the missed turn would still be displayed',
    );
    check(
      '2: and the announcer is silenced for it too',
      /staleGuidance[\s\S]{0,200}maneuverAnnouncerRef/.test(screen),
      'the missed turn would still be spoken',
    );
    check(
      '2: the road name is dropped with it',
      /const roadName = guidanceStale/.test(screen),
      'a stale road name would survive the missed turn',
    );
    check(
      '3: the off-route line is still announced exactly once per episode',
      // Edge-detected from the render-scoped lcState (not a snapshot the
      // earlier reroute effect has already advanced) — the execution of
      // this wiring is proven by test-navigator-offroute-voice.ts.
      /lcState === 'off-route' && prev !== 'off-route'/.test(screen),
    );
  }

  // =================================================================
  // 4-8. FIRST ANSWER POINTS BACK; THE ANCHORED SECOND ONE IS TAKEN
  // =================================================================
  {
    const { lc, origins } = rig();
    const t = await missTheTurn(lc);
    const beforeId = lc.mapData().routeId;
    const beforeGeom = lc.mapData().geometry.length;

    const result = await lc.requestReroute(t, 8);

    check('5: a forward-progress replacement is ACCEPTED', result.outcome === 'replaced', result);
    check('6: the lifecycle is not stuck rerouting', lc.state() === 'navigating', lc.state());
    check(
      '7: the map carries the replacement route, not the old one',
      lc.mapData().routeId !== beforeId,
      {
        beforeId,
        after: lc.mapData().routeId,
      },
    );
    check('7: and its geometry actually changed', lc.mapData().geometry.length !== beforeGeom);
    // The controller for the replacement populates its maneuver view on
    // the next gated fix — ~1 s in the field. Drive one.
    lc.tick(pos({ lat: HWY92[TURN_IDX + 42].lat, lng: LNG }, 0, 55, t + 6000), t + 6000);
    check(
      '8: a next maneuver is generated from the REPLACEMENT',
      lc.view().maneuvers !== null,
      lc.view().maneuvers,
    );
    check(
      '8: and it is not the missed Charles Hardy turn',
      !JSON.stringify(lc.view().maneuvers ?? {}).includes('Charles Hardy'),
      lc.view().maneuvers,
    );
    check(
      '10: no southbound instruction reached the driver',
      !JSON.stringify(lc.view().maneuvers ?? {})
        .toLowerCase()
        .includes('south'),
      lc.view().maneuvers,
    );

    // 4: the provider WAS asked twice, and the second origin was ahead.
    check('4: the provider was asked exactly twice', origins.length === 2, origins.length);
    check(
      '4: the first ask used the truck position (which produced the U-turn)',
      Math.abs(origins[0].lat - HWY92[TURN_IDX + 40].lat) < 0.003,
      origins[0],
    );
    const anchorGap = haversineMiles(origins[0], origins[1]);
    check(
      '4: the second ask was anchored roughly half a mile up the road',
      Math.abs(anchorGap - FORWARD_ANCHOR_MI) < 0.05,
      anchorGap,
    );
    check(
      '4: and the anchor was AHEAD (further north), never behind',
      origins[1].lat > origins[0].lat,
      { first: origins[0].lat, second: origins[1].lat },
    );
    check(
      '9: destination still unchanged after the reroute',
      lc.mapData().destination?.lat === DEST.lat,
    );
    check('lifecycle: no illegal transitions', lc.violations().length === 0, lc.violations());
  }

  // =================================================================
  // 11-12. NO INVENTED TURNAROUND; BUDGET STAYS BOUNDED
  // =================================================================
  {
    // Comment-stripped: these modules DISCUSS turnarounds at length in
    // prose precisely because they must never emit one. The ban is on
    // driver-facing strings, not on the reasoning.
    const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const guard = strip(readFileSync('src/lib/navigator/reversal-guard.ts', 'utf8'));
    const screen = strip(readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8'));
    check(
      '11: no driver-facing string names a turnaround, U-turn point or lot',
      !/turn around here|make a u-turn|parking lot|driveway/i.test(guard + screen),
      'a turnaround instruction reached the driver-facing code',
    );
    check(
      '11: the pending copy tells the driver to continue, not to reverse',
      screen.includes('Continue safely while a new route is calculated'),
    );

    // A provider that reverses from EVERY origin must not loop.
    const alwaysBack = (r: ReplacementRequest): ReplacementFetchResult => ({
      kind: 'route',
      positions: Array.from({ length: 40 }, (_, i) => ({ lat: r.origin.lat - i * STEP, lng: LNG })),
      distanceMiles: 3,
      durationSeconds: 300,
      maneuvers: [
        { action: 'depart', instruction: 'Head south.', direction: null, offset: 0 },
        { action: 'arrive', instruction: 'Arrive.', direction: null, offset: 39 },
      ],
      validationState: 'valid',
      warnings: [],
    });
    const { lc, origins } = rig(alwaysBack);
    let t = await missTheTurn(lc);
    for (let i = 0; i < 20; i++) {
      const r = await lc.requestReroute(t, 8);
      check(`12: attempt ${i} never promotes a reversing route`, r.outcome !== 'replaced', r);
      t += 4000;
      lc.tick(pos({ lat: HWY92[TURN_IDX + 40].lat + i * STEP, lng: LNG }, 0, 55, t), t);
      t += 4000;
    }
    check(
      '12: and provider calls stay inside the session budget',
      origins.length <= 12,
      origins.length,
    );
    check(
      '12: the truck keeps its route context — navigation is not killed',
      lc.state() === 'off-route',
      lc.state(),
    );
  }

  // =================================================================
  // 13-14. PROVIDER FAILURE SEMANTICS UNCHANGED
  // =================================================================
  {
    const { lc, origins } = rig(() => ({ kind: 'failure', reason: 'provider-error' }));
    const t = await missTheTurn(lc);
    const r = await lc.requestReroute(t, 8);
    check('13: a 503-class failure is still provider-failure', r.outcome === 'provider-failure', r);
    check(
      '13: and no forward-anchor retry is attempted on a failure',
      origins.length === 1,
      origins.length,
    );
  }
  {
    const { lc } = rig(() => ({ kind: 'failure', reason: 'network' }));
    const t = await missTheTurn(lc);
    const r = await lc.requestReroute(t, 8);
    check(
      '14: a transport failure is still provider-failure (refund path)',
      r.outcome === 'provider-failure',
      r,
    );
  }

  // =================================================================
  // 15-17. THE MARKER: matched when confident, raw when not
  // =================================================================
  {
    const { lc } = rig();
    await lc.plan(
      { origin: HWY92[0], destination: DEST, truck: DEFAULT_TRUCK_PROFILE, departAtMs: T0 },
      DEST_INFO,
      T0,
    );
    lc.startNavigation(T0);
    let t = T0 + 1000;
    // Drive clean, then drift ~12 m RIGHT of the roadway (east of 92) —
    // exactly the road-test symptom, and inside civilian GPS error.
    for (let i = 0; i <= 40; i += 2) {
      lc.tick(pos(HWY92[i], 0, 55, t), t);
      t += 6000;
    }
    const driftLng = LNG + 0.00013; // ≈ 12 m east at this latitude
    for (let i = 42; i <= 60; i += 2) {
      lc.tick(pos({ lat: HWY92[i].lat, lng: driftLng }, 0, 55, t), t);
      t += 6000;
    }
    const md = lc.mapData();
    check(
      '15-16: a confident near-road fix yields a matched display position',
      md.matchedPosition !== null,
      md.matchedPosition,
    );
    if (md.matchedPosition !== null) {
      check(
        '16: and it sits ON the roadway, not beside it',
        Math.abs(md.matchedPosition.lng - LNG) < 0.00002,
        md.matchedPosition,
      );
    }
    check(
      '16: the display bound is tighter than the matcher high-confidence bound',
      MATCHED_DISPLAY_LATERAL_M <= 30,
      MATCHED_DISPLAY_LATERAL_M,
    );

    // 17: a loose fix must NOT be snapped — honest degradation.
    let t2 = t;
    for (let i = 62; i <= 76; i += 2) {
      lc.tick(pos({ lat: HWY92[i].lat, lng: LNG + 0.002 }, 0, 55, t2, 90), t2);
      t2 += 6000;
    }
    check(
      '17: a poor/far fix is NOT snapped to the road',
      lc.mapData().matchedPosition === null,
      lc.mapData().matchedPosition,
    );

    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    check(
      '15: the screen prefers the matched position and falls back to raw',
      /mapData\.matchedPosition \?\?/.test(screen),
      'the marker still draws raw GPS only',
    );
  }

  // =================================================================
  // The anchor helper itself
  // =================================================================
  {
    const from = { lat: 34, lng: -84.8 };
    const north = projectAhead(from, 0);
    check('anchor: half a mile north lands north', north !== null && north.lat > from.lat);
    check(
      'anchor: at the documented distance',
      north !== null && Math.abs(haversineMiles(from, north) - FORWARD_ANCHOR_MI) < 0.01,
      north,
    );
    const east = projectAhead(from, 90);
    check('anchor: heading east moves east', east !== null && east.lng > from.lng);
    check('anchor: an unusable heading anchors nothing', projectAhead(from, null) === null);
    check('anchor: NaN anchors nothing', projectAhead(from, Number.NaN) === null);
    check('anchor: a non-positive distance anchors nothing', projectAhead(from, 0, 0) === null);
  }

  console.log(`navigator-missed-turn: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
