/**
 * P0 — a replacement route must not imply an unverified truck turnaround.
 *
 * THE ROAD TEST THIS REPRODUCES
 *
 * Planned route ran west on 278. The driver turned north onto Butler.
 * Navigator detected the departure, asked for a replacement, and the
 * provider returned a route whose first move was SOUTH on Butler — back
 * the way the truck had just come. Navigator promoted it to normal turn
 * guidance. It never said "off route", never said "U-turn", identified no
 * turnaround, and verified nothing as truck-suitable.
 *
 * The scenario below is that drive, in fixtures: a westbound corridor, a
 * northward departure onto a perpendicular road, and a scripted provider
 * that answers with a southbound route.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-reroute-reversal.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-reroute-reversal.cjs && node /tmp/test-navigator-reroute-reversal.cjs
 */
import { readFileSync } from 'node:fs';
import {
  checkInitialReversal,
  REVERSAL_DEFAULTS,
  IMPLICIT_REVERSAL,
} from '@/lib/navigator/reversal-guard';
import {
  createNavigationLifecycle,
  type NavigationLifecycle,
  type PlanFetchResult,
} from '@/lib/navigator/navigation-lifecycle';
import type {
  ReplacementFetchResult,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { PositionState } from '@/lib/navigator/types';
import type { LatLng } from '@/lib/map/bounds';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import {
  createVoiceGuidance,
  rerouteVoiceRequest,
  OFF_ROUTE_SPEECH,
  AWAITING_SAFE_REPLACEMENT_SPEECH,
  REROUTE_STATUS_GROUP,
  MANEUVER_GROUP,
  createHosAnnouncer,
  type SpeechPort,
} from '@/lib/navigator/voice-guidance';
import { ROUTE_START_VOICE_ID, routeStartVoiceRequest } from '@/lib/navigator/driver-greeting';
import { hosWarning } from '@/lib/navigator/hos-strip';
import type { RemainingClocks } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 220)}`}`);
  }
}

/* ------------------------------------------------------- geography ----
 * A westbound corridor ("278") and a perpendicular road ("Butler").
 * Longitude decreases going west; latitude increases going north.
 */
const T0 = 1_754_000_000_000;
const LAT = 34.0;
const LNG0 = -85.0;
/** 0.001° longitude at this latitude ≈ 0.0573 mi; 0.001° latitude ≈ 0.069 mi. */
const JUNCTION: LatLng = { lat: LAT, lng: LNG0 - 0.2 };

/** 278 westbound: 400 points marching west along one latitude. */
const CORRIDOR: LatLng[] = Array.from({ length: 400 }, (_, i) => ({
  lat: LAT,
  lng: LNG0 - i * 0.001,
}));
const DEST = CORRIDOR[CORRIDOR.length - 1];

/** Butler, running north from the junction. */
const butlerNorth = (n: number): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({ lat: LAT + i * 0.001, lng: JUNCTION.lng }));

const DEST_INFO: DestinationInfo = {
  position: DEST,
  facility: 'warehouse',
  positionSource: 'geocode',
  entrances: [{ position: DEST, kind: 'verified', label: 'Gate' }],
};

function pos(p: LatLng, headingDeg: number, speedMph: number, tMs: number): PositionState {
  return {
    fix: { lat: p.lat, lng: p.lng, accuracyM: 8, tMs, speedMph, headingDeg },
    health: 'good',
    lastFixMs: tMs,
    accuracyM: 8,
    speedMph,
    headingDeg,
    deadReckoning: false,
  };
}

function fakePort() {
  const spoken: string[] = [];
  let done: (() => void) | null = null;
  const port: SpeechPort = {
    supported: true,
    speak(t, d) {
      spoken.push(t);
      done = d;
    },
    cancel() {
      done = null;
    },
  };
  return {
    port,
    spoken,
    finish() {
      const d = done;
      done = null;
      d?.();
    },
  };
}

// =====================================================================
// 1. THE GUARD ITSELF — heading vs the first actionable point
// =====================================================================
const HERE: LatLng = { lat: LAT, lng: LNG0 };
/** A straight run of `n` points on `bearing` from HERE, ~0.069 mi apart. */
function runFrom(from: LatLng, bearingDeg: number, n: number, stepDeg = 0.001): LatLng[] {
  const rad = (bearingDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => ({
    lat: from.lat + Math.cos(rad) * i * stepDeg,
    lng: from.lng + (Math.sin(rad) * i * stepDeg) / Math.cos((from.lat * Math.PI) / 180),
  }));
}

{
  // (1) northbound truck, replacement begins southbound
  const north = checkInitialReversal({
    position: HERE,
    headingDeg: 0,
    speedMph: 45,
    accuracyM: 8,
    geometry: runFrom(HERE, 180, 20),
  });
  check('1: northbound truck + southbound replacement IS a reversal', north.reversal, north);
  check('1: and it is named as the validation reason', north.reason === IMPLICIT_REVERSAL, north);
  check('1: with the measured angle recorded', Math.abs(north.relativeDeg ?? 0) > 170, north);

  // (2) southbound / replacement northbound
  check(
    '2: southbound truck + northbound replacement IS a reversal',
    checkInitialReversal({
      position: HERE,
      headingDeg: 180,
      speedMph: 45,
      accuracyM: 8,
      geometry: runFrom(HERE, 0, 20),
    }).reversal,
  );

  // (3) eastbound / replacement westbound
  check(
    '3: eastbound truck + westbound replacement IS a reversal',
    checkInitialReversal({
      position: HERE,
      headingDeg: 90,
      speedMph: 55,
      accuracyM: 8,
      geometry: runFrom(HERE, 270, 20),
    }).reversal,
  );

  // (4) ordinary 20–40° correction is ALLOWED
  for (const deg of [0, 10, 20, 30, 40, 60, 89]) {
    const v = checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 55,
      accuracyM: 8,
      geometry: runFrom(HERE, deg, 20),
    });
    check(`4: a ${deg}° correction is allowed, not a reversal`, !v.reversal, v);
  }
  // A square turn onto a cross street is normal and must never trip it.
  check(
    '4: a 90° turn onto a cross street is allowed',
    !checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 45,
      accuracyM: 8,
      geometry: runFrom(HERE, 90, 20),
    }).reversal,
  );
  check(
    '4: the threshold sits above a square turn',
    REVERSAL_DEFAULTS.reversalDeg > 90,
    REVERSAL_DEFAULTS.reversalDeg,
  );

  // (5) a curved roadway does not false-trigger: a route bending steadily
  // away still starts forward, and only the LEAD point is measured.
  const curve: LatLng[] = [];
  {
    let p = { ...HERE };
    for (let i = 0; i < 40; i++) {
      const b = (i * 4 * Math.PI) / 180; // sweeping to 156° over the run
      p = {
        lat: p.lat + Math.cos(b) * 0.0006,
        lng: p.lng + (Math.sin(b) * 0.0006) / Math.cos((p.lat * Math.PI) / 180),
      };
      curve.push({ ...p });
    }
  }
  const curved = checkInitialReversal({
    position: HERE,
    headingDeg: 0,
    speedMph: 55,
    accuracyM: 8,
    geometry: curve,
  });
  check('5: a curving roadway does not read as a reversal', !curved.reversal, curved);

  // (6) GPS heading jitter does not false-trigger a forward route
  for (const jitter of [-25, -12, 0, 12, 25]) {
    check(
      `6: ${jitter}° of heading jitter does not flip a forward route`,
      !checkInitialReversal({
        position: HERE,
        headingDeg: jitter,
        speedMph: 50,
        accuracyM: 8,
        geometry: runFrom(HERE, 0, 20),
      }).reversal,
    );
  }
  check(
    '6: a loose fix is not evidence at all',
    checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 50,
      accuracyM: 120,
      geometry: runFrom(HERE, 180, 20),
    }).reason === 'loose-fix',
  );

  // (7) low-speed yard crawl never triggers
  for (const mph of [0, 3, 8, 12, 19]) {
    const v = checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: mph,
      accuracyM: 8,
      geometry: runFrom(HERE, 180, 20),
    });
    check(
      `7: a ${mph} mph yard crawl is not a reversal`,
      !v.reversal && v.reason === 'below-speed',
      v,
    );
  }
  check(
    '7: the speed floor matches the detector wrong-direction floor',
    REVERSAL_DEFAULTS.minSpeedMph === 20,
    REVERSAL_DEFAULTS.minSpeedMph,
  );

  // (8) an opposing heading AFTER meaningful movement does trigger
  check(
    '8: at real road speed an opposing route is a reversal',
    checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 20,
      accuracyM: 8,
      geometry: runFrom(HERE, 180, 20),
    }).reversal,
  );

  // (9) a legitimate loop is allowed when the FIRST movement follows travel
  const loop = [
    ...runFrom(HERE, 0, 12), // north first — with the truck
    ...runFrom({ lat: LAT + 0.011, lng: LNG0 }, 90, 12), // then east
    ...runFrom({ lat: LAT + 0.011, lng: LNG0 + 0.011 }, 180, 24), // then back south
  ];
  const looped = checkInitialReversal({
    position: HERE,
    headingDeg: 0,
    speedMph: 50,
    accuracyM: 8,
    geometry: loop,
  });
  check('9: a legal loop starting WITH the truck is allowed', !looped.reversal, looped);

  // Fails open on every unknown.
  check(
    'guard: no heading means no verdict',
    checkInitialReversal({
      position: HERE,
      headingDeg: null,
      speedMph: 50,
      accuracyM: 8,
      geometry: runFrom(HERE, 180, 20),
    }).reason === 'no-heading',
  );
  check(
    'guard: geometry too short to point anywhere makes no claim',
    checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 50,
      accuracyM: 8,
      geometry: [HERE],
    }).reason === 'no-lead-point',
  );
  check(
    'guard: a forward route is explicitly reported forward',
    checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 50,
      accuracyM: 8,
      geometry: runFrom(HERE, 0, 20),
    }).reason === 'forward',
  );
  // Provider geometry snapped a truck-length behind is ordinary, not a U-turn.
  check(
    'guard: a start snapped just behind the truck is stepped over, not flagged',
    !checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 55,
      accuracyM: 8,
      geometry: [{ lat: LAT - 0.0003, lng: LNG0 }, ...runFrom(HERE, 0, 20)],
    }).reversal,
  );
}

// =====================================================================
// 2. NO FABRICATED TURNAROUND — the rule that keeps this honest
// =====================================================================
{
  const src = readFileSync('src/lib/navigator/reversal-guard.ts', 'utf8');
  for (const forbidden of ['uTurn', 'u-turn point', 'turnaroundAt', 'safeTurnaround']) {
    check(`no-fabrication: the guard names no turnaround (${forbidden})`, !src.includes(forbidden));
  }
  const shape = JSON.stringify(
    checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 50,
      accuracyM: 8,
      geometry: runFrom(HERE, 180, 20),
    }),
  );
  check(
    'no-fabrication: the verdict carries no coordinate of any kind',
    !/"lat"|"lng"|"position"|"turnaround"/.test(shape),
    shape,
  );
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'no-fabrication: the screen never tells the driver to turn around',
    !/turn around here|make a u-turn|U-turn now/i.test(screen),
  );
  /*
   * And no provider parameter was invented to ask for one. Pinned as the
   * EXACT set the builder sets, rather than a deny-list of names somebody
   * thought of: a new `p.set(...)` of any kind fails this, which is the
   * property that matters. (`uTurns` already exists inside the avoid
   * whitelist and is a documented HERE avoid feature — it is a value, not
   * a new parameter, and this fix did not touch it.)
   */
  const here = readFileSync('src/lib/trip-planner/here-routing.ts', 'utf8');
  const params = [...here.matchAll(/p\.set\('([^']+)'/g)].map((m) => m[1]).sort();
  check(
    'no-guessing: the provider request sets exactly the parameters it always did',
    params.join(',') ===
      [
        'apiKey',
        'avoid[features]',
        'departureTime',
        'destination',
        'origin',
        'return',
        'transportMode',
        'truck[axleCount]',
        'truck[grossWeight]',
        'truck[height]',
        'truck[length]',
        'truck[shippedHazardousGoods]',
        'truck[width]',
        'units',
      ].join(','),
    params,
  );
  for (const guessed of ['vehicle[type]', 'truck[type]', 'truck[trailerCount]', 'heading']) {
    check(`no-guessing: no ${guessed} parameter was invented`, !params.includes(guessed), params);
  }
}

// =====================================================================
// 3. VOICE
// =====================================================================
{
  const off = rerouteVoiceRequest({ kind: 'off-route', episode: 1 });
  const wait = rerouteVoiceRequest({ kind: 'awaiting-safe-replacement', episode: 1 });
  check('voice: the off-route line is the short functional phrase', off.text === OFF_ROUTE_SPEECH);
  check(
    'voice: which is exactly what the brief asked for',
    OFF_ROUTE_SPEECH === "You're off route. Rerouting.",
  );
  check(
    'voice: the holding line says continue, never turn around',
    wait.text === AWAITING_SAFE_REPLACEMENT_SPEECH,
  );
  check(
    'voice: and it contains no turn instruction',
    !/turn|u-turn|around/i.test(wait.text),
    wait.text,
  );
  check(
    'voice: both ride the same supersession group so they cannot stack',
    off.group === REROUTE_STATUS_GROUP && wait.group === REROUTE_STATUS_GROUP,
  );
  check(
    'voice: normal priority — never preempts a turn',
    off.priority === 'normal' && wait.priority === 'normal',
  );

  // (13) a maneuver in progress is NOT interrupted
  {
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    v.request({
      id: 'm1',
      priority: 'normal',
      group: MANEUVER_GROUP,
      text: 'Turn right onto Butler.',
    });
    const outcome = v.request(off);
    check('13: the off-route line queues behind a maneuver', outcome === 'queued', outcome);
    check(
      '13: it does NOT cut the turn in half',
      f.spoken.length === 1 && f.spoken[0].startsWith('Turn right'),
      f.spoken,
    );
    f.finish();
    check('13: and is heard immediately after', f.spoken[1] === OFF_ROUTE_SPEECH, f.spoken);
  }

  // (14) HOS priority unchanged: critical still preempts
  {
    const remaining: RemainingClocks = {
      drivingMin: 10,
      windowMin: 100,
      cycleMin: 500,
      untilBreakMin: 10,
      limitedBy: '11-hour',
      legalDrivingMin: 10,
    };
    const hos = createHosAnnouncer().collect(hosWarning(remaining), remaining)[0];
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    v.request(off);
    check(
      '14: a critical HOS line still preempts the off-route line',
      v.request(hos) === 'spoken',
      hos,
    );
    check('14: and the clock warning is what is heard', f.spoken.at(-1) === hos.text, f.spoken);
  }

  // (16)(17) once per episode; a second departure announces again
  {
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    for (let i = 0; i < 30; i++) v.request(rerouteVoiceRequest({ kind: 'off-route', episode: 1 }));
    f.finish();
    check('16: thirty ticks in one episode announce exactly once', f.spoken.length === 1, f.spoken);
    v.request(rerouteVoiceRequest({ kind: 'off-route', episode: 2 }));
    f.finish();
    check('17: a second departure after recovery announces again', f.spoken.length === 2, f.spoken);
  }

  // (15) the personalized initial-route phrase NEVER fires on a reroute
  {
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    v.request(off);
    f.finish();
    check(
      '15: the route-start phrase is not part of any reroute wording',
      ![off.text, wait.text].some((t) => t.includes("Here's your route")),
    );
    check(
      '15: and its id is untouched by reroute ids',
      off.id !== ROUTE_START_VOICE_ID && wait.id !== ROUTE_START_VOICE_ID,
    );
    check(
      '15: the route-start phrase still exists for the INITIAL route only',
      routeStartVoiceRequest('Shawn')?.text === "Here's your route, Shawn. Now let's get it!",
    );
  }
}

/* ------------------------------------------------- lifecycle fixtures */

function corridorPlan(): PlanFetchResult {
  return {
    kind: 'route',
    routeId: '278-west',
    positions: CORRIDOR,
    distanceMiles: 22.9,
    durationSeconds: 1800,
    maneuvers: [
      { action: 'depart', instruction: 'Head west on 278.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: CORRIDOR.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

/** The provider's answer in the road test: go back SOUTH down Butler. */
function southboundReplacement(req: ReplacementRequest): ReplacementFetchResult {
  const back: LatLng[] = [];
  for (let i = 0; i <= 12; i++) {
    back.push({ lat: req.origin.lat - i * 0.001, lng: req.origin.lng });
  }
  const positions = [...back, ...CORRIDOR.slice(200)];
  return {
    kind: 'route',
    positions,
    distanceMiles: 15,
    durationSeconds: 1200,
    maneuvers: [
      { action: 'depart', instruction: 'Head south on Butler.', direction: null, offset: 0 },
      { action: 'turn', instruction: 'Turn right onto 278 west.', direction: 'right', offset: 12 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

/** A legal forward-progress answer: keep north, loop west, rejoin. */
function forwardReplacement(req: ReplacementRequest): ReplacementFetchResult {
  const ahead: LatLng[] = [];
  for (let i = 0; i <= 10; i++)
    ahead.push({ lat: req.origin.lat + i * 0.001, lng: req.origin.lng });
  const west: LatLng[] = [];
  for (let i = 1; i <= 40; i++) {
    west.push({ lat: req.origin.lat + 0.01, lng: req.origin.lng - i * 0.001 });
  }
  const positions = [...ahead, ...west, ...CORRIDOR.slice(250)];
  return {
    kind: 'route',
    positions,
    distanceMiles: 20,
    durationSeconds: 1500,
    maneuvers: [
      { action: 'depart', instruction: 'Continue north on Butler.', direction: null, offset: 0 },
      { action: 'turn', instruction: 'Turn left.', direction: 'left', offset: 10 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

function rig(replacement: (r: ReplacementRequest) => ReplacementFetchResult): {
  lc: NavigationLifecycle;
  calls: () => number;
} {
  let calls = 0;
  const lc = createNavigationLifecycle({
    planPort: async () => corridorPlan(),
    replacementPort: async (r) => {
      calls += 1;
      return replacement(r);
    },
  });
  return { lc, calls: () => calls };
}

/** Drive west along 278, then turn north up Butler until confirmed off route. */
async function driveOffRoute(lc: NavigationLifecycle): Promise<number> {
  await lc.plan(
    { origin: CORRIDOR[0], destination: DEST, truck: DEFAULT_TRUCK_PROFILE, departAtMs: T0 },
    DEST_INFO,
    T0,
  );
  lc.startNavigation(T0);
  let t = T0 + 1000;
  // West along the corridor to the junction (heading 270).
  for (let i = 0; i <= 200; i += 2) {
    lc.tick(pos({ lat: LAT, lng: LNG0 - i * 0.001 }, 270, 60, t), t);
    t += 6000;
  }
  // North up Butler (heading 0) — the deliberate departure.
  const north = butlerNorth(16);
  for (const p of north) {
    lc.tick(pos(p, 0, 45, t), t);
    t += 6000;
  }
  return t;
}

async function main() {
  // =================================================================
  // 4. THE REPRODUCTION — the owner's drive, end to end
  // =================================================================
  {
    const { lc, calls } = rig(southboundReplacement);
    const t = await driveOffRoute(lc);
    check('repro: the departure is detected', lc.state() === 'off-route', lc.state());

    const routeBefore = lc.snapshot().routeId;
    const result = await lc.requestReroute(t, 8);

    check(
      'repro: the southbound replacement is refused as an implicit reversal',
      result.outcome === 'unsafe-reversal',
      result,
    );
    check(
      'repro: with the named validation reason',
      result.outcome === 'unsafe-reversal' && result.reason === IMPLICIT_REVERSAL,
      result,
    );
    // TWO calls now, and that is the fix: the first answer pointed back
    // down Butler, so a second was asked from a forward anchor. Both are
    // charged. Bounded at two per reroute attempt.
    check(
      'repro: the provider was asked twice — once here, once from a forward anchor',
      calls() === 2,
      calls(),
    );
    check(
      'repro: the unsafe route is NOT promoted to guidance',
      lc.snapshot().routeId === routeBefore,
      { before: routeBefore, after: lc.snapshot().routeId },
    );
    check(
      'repro: no "head south" instruction reaches the driver',
      !JSON.stringify(lc.view().maneuvers ?? {})
        .toLowerCase()
        .includes('south'),
      lc.view().maneuvers,
    );
    check(
      'repro: navigation is not killed — the truck keeps its context',
      lc.state() === 'off-route' || lc.state() === 'navigating',
      lc.state(),
    );
    check('repro: no illegal lifecycle transitions', lc.violations().length === 0, lc.violations());
    check(
      'repro: (20) the destination is unchanged',
      lc.mapData().destination?.lng === DEST.lng && lc.mapData().destination?.lat === DEST.lat,
      lc.mapData().destination,
    );
  }

  // A forward-progress replacement IS accepted from the same position.
  {
    const { lc } = rig(forwardReplacement);
    const t = await driveOffRoute(lc);
    const before = lc.snapshot().routeId;
    const result = await lc.requestReroute(t, 8);
    check(
      'forward: a replacement that starts WITH the truck is accepted',
      result.outcome === 'replaced',
      result,
    );
    check(
      'forward: and becomes the active route',
      lc.snapshot().routeId !== before,
      lc.snapshot().routeId,
    );
    check('forward: back to navigating', lc.state() === 'navigating', lc.state());
  }

  // (10) budgets stay bounded when the provider keeps reversing.
  {
    const { lc, calls } = rig(southboundReplacement);
    let t = await driveOffRoute(lc);
    let unsafe = 0;
    for (let i = 0; i < 25; i++) {
      const r = await lc.requestReroute(t, 8);
      if (r.outcome === 'unsafe-reversal') unsafe += 1;
      t += 5000;
      lc.tick(pos({ lat: LAT + 0.02 + i * 0.001, lng: JUNCTION.lng }, 0, 45, t), t);
      t += 5000;
    }
    check('10: reversals are refused repeatedly without ever being promoted', unsafe >= 1, unsafe);
    check(
      '10: and the provider is not hammered — calls stay inside the session budget',
      calls() <= 12,
      calls(),
    );
    check(
      '10: no illegal transitions across the burst',
      lc.violations().length === 0,
      lc.violations(),
    );
  }

  // (11) provider 503 behaviour unchanged.
  {
    const { lc } = rig(() => ({ kind: 'failure', reason: 'provider-error' }));
    const t = await driveOffRoute(lc);
    const r = await lc.requestReroute(t, 8);
    check(
      '11: a provider error is still reported as provider-failure',
      r.outcome === 'provider-failure',
      r,
    );
  }

  // (12) network-failure refund behaviour unchanged.
  {
    const { lc } = rig(() => ({ kind: 'failure', reason: 'network' }));
    const t = await driveOffRoute(lc);
    const r = await lc.requestReroute(t, 8);
    check(
      '12: a transport failure is still a provider-failure outcome',
      r.outcome === 'provider-failure',
      r,
    );
  }

  // (18) a truck crawling a yard never has a replacement refused for reversal,
  // because the guard refuses to judge at that speed.
  {
    const v = checkInitialReversal({
      position: HERE,
      headingDeg: 0,
      speedMph: 5,
      accuracyM: 8,
      geometry: runFrom(HERE, 180, 20),
    });
    check('18: a yard crawl produces no reversal verdict at all', !v.reversal, v);
  }

  // =================================================================
  // 5. THE SCREEN WIRING — source pins freeze the SHAPE of the wiring.
  //    They cannot prove the effects execute (a regex matches dead code
  //    just as happily — that is exactly how the off-route announcement
  //    stayed silent until the 2026-08 audit); the EXECUTION is proven
  //    by test-navigator-offroute-voice.ts, which mounts the real screen
  //    and drives a departure through the real engines.
  // =================================================================
  {
    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    check(
      'wiring: the off-route line is announced on the transition INTO off-route',
      // The edge is detected from the render-scoped lcState — a snapshot
      // taken here would already read 'rerouting', because the reroute
      // effect above transitions synchronously before this effect runs.
      /lcState === 'off-route' && prev !== 'off-route'/.test(screen),
      'the announcement is not edge-triggered — it would repeat every tick',
    );
    check(
      'wiring: the episode counter advances per departure, not per tick',
      /offRouteEpisodeRef\.current \+= 1/.test(screen) &&
        screen.indexOf('offRouteEpisodeRef.current += 1') >
          screen.indexOf("lcState === 'off-route' && prev !== 'off-route'"),
    );
    check(
      'wiring: an unsafe-reversal outcome sets the holding state',
      /result\.outcome === 'unsafe-reversal'/.test(screen) &&
        /setAwaitingSafeReroute\(true\)/.test(screen),
    );
    check(
      'wiring: a successful replacement clears it',
      /result\.outcome === 'replaced'/.test(screen) &&
        /setAwaitingSafeReroute\(false\)/.test(screen),
    );
    check(
      'wiring: the driver sees an OFF ROUTE state',
      screen.includes('OFF ROUTE · Rerouting — continue safely.'),
      'no off-route indicator',
    );
    check(
      'wiring: and an honest line while holding out for a safe route',
      screen.includes('OFF ROUTE · Continue safely while a new route is calculated.'),
    );
    check(
      'wiring: neither UI line tells the truck which way to go',
      !/OFF ROUTE[^']*\b(south|north|east|west|turn around)\b/i.test(screen),
    );

    const session = readFileSync('src/lib/navigator/navigation-session.ts', 'utf8');
    check(
      'wiring: the truck real heading reaches the reroute controller',
      /headingDeg: lastFix\?\.headingDeg/.test(session) &&
        /speedMph: lastFix\?\.speedMph/.test(session),
      'the guard would always answer no-heading',
    );
    check(
      'wiring: and the retained fix is released with the engines',
      /lastFix = null/.test(session),
      'position outlived the session (AD-7)',
    );

    const controller = readFileSync('src/lib/navigator/reroute-controller.ts', 'utf8');
    check(
      'wiring: the guard runs AFTER validation and BEFORE the session swap',
      // The guard runs on a VALIDATED candidate (fetchReplacement returns
      // only ok:true sessions) and before the swap.
      controller.indexOf('const first = await fetchReplacement') <
        controller.lastIndexOf('checkInitialReversal({') &&
        controller.lastIndexOf('checkInitialReversal({') <
          controller.indexOf('session = accepted;'),
      'the unsafe route could still be promoted',
    );
    check(
      'wiring: a refused reversal still starts the failure cooldown (no hammering)',
      /forwardReversal\.reversal[\s\S]{0,200}failureCooldown\(input\.tMs\)/.test(controller),
    );
    check(
      'wiring: and the forward-anchor retry is bounded by the existing budgets',
      /callTimes\.length < cfg\.maxPerHour && sessionCount \+ 1 < cfg\.maxPerSession/.test(
        controller,
      ),
      'the anchored retry can outrun the provider budget',
    );
    check(
      'wiring: a reversal refusal does NOT set the duplicate-suppression key',
      !/reversalsRefused[\s\S]{0,600}lastFailedKey = key/.test(controller),
      'a refused reversal would block the next anchored attempt as a duplicate',
    );
    check('wiring: and is counted so it is auditable', /reversalsRefused \+= 1/.test(controller));
  }

  console.log(`navigator-reroute-reversal: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
