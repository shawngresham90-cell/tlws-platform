/**
 * Off-route voice announcement — BEHAVIORAL harness.
 *
 * Why this file exists: the August 2026 technical-debt audit (Finding 1)
 * showed the "You're off route. Rerouting." announcement from the #272
 * road-test fix is unreachable in the integrated driving screen — the
 * reroute effect moves the lifecycle to 'rerouting' synchronously before
 * the voice effect snapshots it, so the guard can never be satisfied and
 * the episode counter never advances. The harness that pinned this wiring
 * (`test-navigator-reroute-reversal.ts`) regex-matches source text, which
 * passes against code that cannot execute.
 *
 * So this harness DRIVES THE REAL THING. It mounts the actual
 * `<GpsProvider><SafetyLockProvider><DrivingScreen/>` tree with
 * react-test-renderer (which runs real effects in real declaration
 * order), injects only at the app's own seams — the GpsProvider port,
 * `fetch` for the route endpoint (parsed by the real route-port), and a
 * fake `speechSynthesis` engine behind the real browser speech port —
 * and then drives a scripted trip through the REAL engines: plan a
 * route, start navigating, leave the route, sustain the departure
 * through a failed reroute and its cooldown, accept a replacement,
 * drive the new route, and leave it again.
 *
 * Everything between the injected seams is production code: the
 * lifecycle, matcher, off-route detector, reroute controller with its
 * real budgets/cooldowns/reversal guard, the voice guidance module with
 * its real announce-once ledger and priorities, and both React effects
 * exactly as the screen declares them.
 *
 * What it pins, per off-route EPISODE semantics:
 *   1. first legitimate off-route transition → phrase spoken exactly once
 *   2. repeated off-route ticks in the same episode → no repeat
 *   3. replacement completes → "Route updated.", episode closes, no
 *      off-route lines while back on route
 *   4. a later independent departure → phrase spoken exactly once again
 *   5. the reroute never replays the personalized route-start phrase
 *   6. no maneuver line is initiated while guidance is stale
 *      (off-route/rerouting), and the card shows no maneuver
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-offroute-voice
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Environment shims — installed BEFORE the component tree mounts. Every
// shim stands in for a browser global the components already feature-detect;
// nothing here patches app modules.

// Pilot Mode on (the components read this env var at runtime under the
// harness bundle's --platform=node build).
process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'true';

// React act() support.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// --- virtual clock ---------------------------------------------------------
// Components legitimately read Date.now() at their edges (the pure core
// cannot). The trip below spans ~4 simulated minutes of GPS cadence plus a
// 30-second reroute cooldown; a virtual clock makes that instant and makes
// gps staleness, safety-lock dwell and reroute cooldowns deterministic.
const T0 = 1_754_000_000_000;
let virtualNow = T0;
Date.now = () => virtualNow;

// --- deterministic intervals ----------------------------------------------
// GpsProvider, SafetyLockProvider and HosStrip each run a 1 Hz interval.
// Real timers would fire on wall time, not virtual time — so intervals are
// captured and fired by the clock advance below, inside act().
type FakeInterval = { cb: () => void; everyMs: number; nextAt: number };
const intervals = new Map<number, FakeInterval>();
let intervalSeq = 0;
(globalThis as any).setInterval = (cb: () => void, everyMs: number) => {
  intervalSeq += 1;
  intervals.set(intervalSeq, { cb, everyMs: Math.max(1, everyMs), nextAt: virtualNow + everyMs });
  return intervalSeq;
};
(globalThis as any).clearInterval = (id: number) => {
  intervals.delete(id);
};
function fireDueIntervals(): void {
  for (const iv of intervals.values()) {
    while (iv.nextAt <= virtualNow) {
      iv.nextAt += iv.everyMs;
      iv.cb();
    }
  }
}

// --- fake speech engine, behind the REAL browser speech port ---------------
// createBrowserSpeechPort() looks for window.speechSynthesis and the
// SpeechSynthesisUtterance constructor; this engine records every utterance
// the real voice-guidance module actually speaks, with the tick it started.
type FakeUtterance = {
  text: string;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const spoken: { text: string; tick: number }[] = [];
let pendingUtterances: FakeUtterance[] = [];
let tickIndex = 0;
(globalThis as any).SpeechSynthesisUtterance = class {
  text: string;
  lang = '';
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
};
const fakeSynth = {
  paused: false,
  speak(u: FakeUtterance) {
    spoken.push({ text: u.text, tick: tickIndex });
    pendingUtterances.push(u);
  },
  cancel() {
    // Real engines fire onend asynchronously after cancel; the voice
    // module has already invalidated its token, so these are stale calls.
    const cancelled = pendingUtterances;
    pendingUtterances = [];
    for (const u of cancelled) u.onend?.();
  },
  resume() {},
};

// --- window ---------------------------------------------------------------
// The minimal surface the components feature-detect: speech, hostname for
// the pilot debug-log decision, and inert resize/online listeners.
(globalThis as any).window = {
  speechSynthesis: fakeSynth,
  location: { hostname: 'localhost' },
  addEventListener() {},
  removeEventListener() {},
};

// --- fetch stub for /api/navigator/route ----------------------------------
// The REAL route-port builds the request and parses this response; the stub
// is the network, not the port. `routeResponder` is re-pointed per phase.
type WireRoute = {
  ok: true;
  state: 'valid';
  warnings: string[];
  route: {
    routeId: string;
    distanceMiles: number;
    seconds: number;
    geometry: [number, number][];
    maneuvers: { action: string; instruction: string; direction: string | null; offset: number }[];
  };
};
type RouteBody = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
};
let routeResponder: (
  body: RouteBody,
  call: number,
) => { status: number; payload: unknown } = () => {
  throw new Error('routeResponder not scripted');
};
let routeCalls = 0;
const routeCallLog: { body: RouteBody; status: number }[] = [];
(globalThis as any).fetch = async (url: string, init?: { body?: string }) => {
  if (String(url) !== '/api/navigator/route') {
    throw new Error(`unexpected fetch: ${url}`);
  }
  routeCalls += 1;
  const body = JSON.parse(init?.body ?? '{}') as RouteBody;
  const out = routeResponder(body, routeCalls);
  routeCallLog.push({ body, status: out.status });
  return { status: out.status, json: async () => out.payload };
};

// ---------------------------------------------------------------------------
// Imports come AFTER the shims (module bodies are safe — every browser
// access in them is behind runtime guards — but keeping this order makes
// the harness's contract obvious).

import { createElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import { VOICE_ENABLED_CONFIRMATION } from '@/components/navigator/VoiceControls';
import { OFF_ROUTE_SPEECH } from '@/lib/navigator/voice-guidance';
import { routeStartText } from '@/lib/navigator/driver-greeting';
import type { GeolocationPort } from '@/lib/navigator/ports';
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

// ------------------------------------------------------------- geometry
// Same flat-earth-at-course-scale math the navigation-scenarios harness
// uses; small enough to keep this file self-contained.

const MI_PER_DEG_LAT = 69.0937;
function miPerDegLng(lat: number): number {
  return MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}
function offsetM(p: LatLng, northM: number, eastM: number): LatLng {
  return { lat: p.lat + northM / 111_320, lng: p.lng + eastM / 1609.344 / miPerDegLng(p.lat) };
}

type Course = {
  positions: LatLng[];
  totalMi: number;
  maneuvers: WireRoute['route']['maneuvers'];
};

/** North-then-east L-shaped course sampled at 0.01 mi. */
function buildCourse(
  start: LatLng,
  northMi: number,
  eastMi: number,
  turnInstruction: string,
): Course {
  const positions: LatLng[] = [{ lat: start.lat, lng: start.lng }];
  const maneuvers: Course['maneuvers'] = [
    { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
  ];
  let { lat, lng } = start;
  const step = 0.01;
  for (let d = 0; d < northMi - 1e-9; d += step) {
    lat += step / MI_PER_DEG_LAT;
    positions.push({ lat, lng });
  }
  maneuvers.push({
    action: 'turn',
    instruction: turnInstruction,
    direction: 'right',
    offset: positions.length - 1,
  });
  for (let d = 0; d < eastMi - 1e-9; d += step) {
    lng += step / miPerDegLng(lat);
    positions.push({ lat, lng });
  }
  maneuvers.push({
    action: 'arrive',
    instruction: 'Arrive at the receiving gate.',
    direction: null,
    offset: positions.length - 1,
  });
  return { positions, totalMi: northMi + eastMi, maneuvers };
}

function wireRoute(routeId: string, course: Course): WireRoute {
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId,
      distanceMiles: Number(course.totalMi.toFixed(1)),
      seconds: Math.max(60, Math.round((course.totalMi / 45) * 3600)),
      geometry: course.positions.map((p) => [p.lat, p.lng] as [number, number]),
      maneuvers: course.maneuvers,
    },
  };
}

const START: LatLng = { lat: 35.0, lng: -85.0 };
const ROUTE_A = buildCourse(START, 2.5, 2.5, 'Turn right onto Mill Road.');
const DESTINATION = ROUTE_A.positions[ROUTE_A.positions.length - 1];

// ------------------------------------------------------------- tree driving

let emitFix:
  | ((fix: {
      lat: number;
      lng: number;
      accuracyM: number;
      speedMps: number | null;
      headingDeg: number | null;
      tMs: number;
    }) => void)
  | null = null;

const gpsPort: GeolocationPort = {
  watch(onFix) {
    emitFix = onFix;
    return () => {
      emitFix = null;
    };
  },
};

function findButton(root: ReactTestRenderer, matcher: (label: string) => boolean) {
  const hits = root.root.findAll(
    (n) => n.type === 'button' && matcher(String(n.props['aria-label'] ?? textOf(n))),
  );
  if (hits.length === 0) throw new Error('button not found');
  return hits[0];
}

function textOf(node: any): string {
  const parts: string[] = [];
  const walk = (c: any) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
    else if (c && typeof c === 'object' && c.props) walk(c.props.children);
  };
  try {
    walk(node.props.children);
  } catch {
    /* host nodes without children */
  }
  return parts.join(' ');
}

function renderedText(root: ReactTestRenderer): string {
  const flat = (v: any): string =>
    v === null || v === undefined
      ? ''
      : typeof v === 'string'
        ? v
        : Array.isArray(v)
          ? v.map(flat).join(' ')
          : flat(v.children);
  return flat(root.toJSON());
}

/** One 1 Hz tick: advance the virtual second, fire intervals, deliver a fix,
 *  let the effects and any resolved reroute settle, then let queued speech
 *  finish so the next line is never blocked by an eternally-open utterance. */
async function tick(
  pos: LatLng,
  opts: { mph: number; headingDeg: number | null; accuracyM?: number },
): Promise<void> {
  tickIndex += 1;
  await act(async () => {
    virtualNow += 1000;
    fireDueIntervals();
    emitFix?.({
      lat: pos.lat,
      lng: pos.lng,
      accuracyM: opts.accuracyM ?? 8,
      speedMps: opts.mph / 2.236936,
      headingDeg: opts.headingDeg,
      tMs: virtualNow,
    });
    // Let requestReroute / plan promises resolve and their bump() land.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  // Finish utterances OUTSIDE the tick's act, one at a time — the voice
  // module starts the next queued line inside each onend.
  while (pendingUtterances.length > 0) {
    const u = pendingUtterances.shift()!;
    await act(async () => {
      u.onend?.();
      await Promise.resolve();
    });
  }
}

function countSpoken(text: string, fromTick = 0, toTick = Number.POSITIVE_INFINITY): number {
  return spoken.filter((s) => s.text === text && s.tick >= fromTick && s.tick < toTick).length;
}

/** The pilot state line, e.g. 'navigating', from the rendered tree. */
function pilotState(root: ReactTestRenderer): string | null {
  const m = renderedText(root).match(
    /Pilot trip state: (route ready|final approach|off route|rerouting|navigating|planning|arrived|completed|idle)/,
  );
  return m ? m[1] : null;
}

const trace: { tick: number; state: string | null }[] = [];

// ------------------------------------------------------------- the drive

async function main(): Promise<void> {
  const Screen = DrivingScreen as (props: { authorized?: boolean }) => JSX.Element;
  const renderer = TestRenderer.create(
    createElement(GpsProvider, {
      port: gpsPort,
      children: createElement(SafetyLockProvider, {
        children: createElement(Screen, { authorized: true }),
      }),
    }),
  );
  await act(async () => {
    await Promise.resolve();
  });

  // -- the simplified startup (pilot round 3): trip setup is available at
  //    a cold start — the setup window (doc 06 §1a) — so there is no
  //    Enable-location step and no stationary dwell to wait out before
  //    the destination and the optional name/voice controls exist.
  check(
    'behavior: trip setup available at a cold start (setup window)',
    renderedText(renderer).includes('Pilot trip controls'),
  );

  // -- give the driver a name (so route-start suppression is a REAL check) --
  const nameInput = renderer.root.findAll(
    (n) => n.type === 'input' && n.props.autoComplete === 'given-name',
  )[0];
  await act(async () => {
    nameInput.props.onChange({ target: { value: 'Alex' } });
  });
  const nameForm = renderer.root.findAll((n) => n.type === 'form')[0];
  await act(async () => {
    nameForm.props.onSubmit({ preventDefault() {} });
  });
  check('behavior: name accepted', renderedText(renderer).includes('Driving as'));

  // -- enable voice through the real control (the unlock gesture) -----------
  await act(async () => {
    findButton(renderer, (l) => l === 'Enable voice guidance').props.onClick();
  });
  while (pendingUtterances.length > 0) {
    const u = pendingUtterances.shift()!;
    await act(async () => {
      u.onend?.();
      await Promise.resolve();
    });
  }
  check(
    'voice: enable confirmation spoken exactly once',
    countSpoken(VOICE_ENABLED_CONFIRMATION) === 1,
    spoken,
  );

  // -- destination via the developer coordinate entry, then ONE Start ------
  // The tap is the location gesture: the watch starts inside it, the
  // attempt waits for the first usable fix, plans once, and a clean
  // route auto-starts on the route-ready render — the same render the
  // voice effect reads, which is what keeps the personalized route-start
  // line alive (asserted below and at every reroute).
  routeResponder = () => ({ status: 200, payload: wireRoute('route-a', ROUTE_A) });
  const latInput = renderer.root.findAll(
    (n) => n.type === 'input' && n.props['aria-label'] === 'Destination latitude',
  )[0];
  const lngInput = renderer.root.findAll(
    (n) => n.type === 'input' && n.props['aria-label'] === 'Destination longitude',
  )[0];
  await act(async () => {
    latInput.props.onChange({ target: { value: String(DESTINATION.lat) } });
  });
  await act(async () => {
    lngInput.props.onChange({ target: { value: String(DESTINATION.lng) } });
  });
  await act(async () => {
    // The truck must be confirmed before a route may be requested
    // (truck-route confidence milestone): Start refuses to spend a
    // provider transaction on a profile no human has verified.
    findButton(renderer, (l) => l.trim() === 'This is my truck').props.onClick();
  });
  await act(async () => {
    // Renamed 'Start' → 'Start Route' in the pre-trip setup milestone.
    // Matched by exact alternatives, never by prefix: 'Start navigation'
    // and 'Start with full clocks' are different buttons.
    findButton(renderer, (l) => l.trim() === 'Start' || l.trim() === 'Start Route').props.onClick();
  });
  check('behavior: the Start tap started the GPS watch', emitFix !== null);
  check(
    'behavior: honest progress while locating',
    renderedText(renderer).includes('Getting location…'),
  );
  // Two parked fixes: the first usable one is the origin the plan uses.
  await tick(START, { mph: 0, headingDeg: null });
  await tick(START, { mph: 0, headingDeg: null });
  check(
    'behavior: a clean route went straight to navigating (no briefing pause)',
    pilotState(renderer) === 'navigating',
    renderedText(renderer).slice(0, 300),
  );

  // -- follow route A north at 50 mph to ~mile 0.6 --------------------------
  const MPH = 50;
  const perTickMi = MPH / 3600;
  let mile = 0;
  while (mile < 0.6) {
    mile += perTickMi;
    const pos = ROUTE_A.positions[Math.min(Math.round(mile / 0.01), ROUTE_A.positions.length - 1)];
    await tick(pos, { mph: MPH, headingDeg: 0 });
  }
  check(
    'behavior: navigating on route A',
    renderedText(renderer).includes('Pilot trip state: navigating'),
    renderedText(renderer).slice(0, 300),
  );
  const spokenBeforeDeparture = spoken.length;
  check('voice: nothing off-route was spoken while ON route', countSpoken(OFF_ROUTE_SPEECH) === 0);

  // == EPISODE 1: leave the route ===========================================
  // Parallel-road departure: keep driving north at 50 mph while sliding
  // west to ~260 m lateral, until the SCREEN admits the departure (the
  // detector's own calibration decides how many fixes that takes). The
  // first reroute attempt gets HTTP 500, so the controller applies its
  // real 30 s failure cooldown and the episode stays open — exactly the
  // sustained-off-route window episode semantics need.
  routeResponder = () => ({ status: 500, payload: { ok: false, state: 'provider-failure' } });
  const departStartTick = tickIndex;
  let lateral = 0;
  let confirmTick: number | null = null;
  for (let i = 1; i <= 40 && confirmTick === null; i++) {
    mile += perTickMi;
    lateral = Math.min(40 * i, 260);
    const on = ROUTE_A.positions[Math.min(Math.round(mile / 0.01), ROUTE_A.positions.length - 1)];
    await tick(offsetM(on, 0, -lateral), { mph: MPH, headingDeg: 0 });
    const st = pilotState(renderer);
    trace.push({ tick: tickIndex, state: st });
    if (st === 'off route' || st === 'rerouting') confirmTick = tickIndex;
  }
  check(
    'behavior: departure confirmed by the real detector',
    confirmTick !== null,
    trace.slice(-8),
  );
  const bodyText = renderedText(renderer);
  check(
    'behavior: off-route recognized on screen (visual line present)',
    bodyText.includes('OFF ROUTE'),
    bodyText.slice(0, 400),
  );
  check(
    'behavior: stale maneuver retired from the card while off route',
    !bodyText.includes('Turn right onto Mill Road'),
  );

  // THE FINDING-1 CORE ASSERTION: the departure was announced, once.
  check(
    'voice: "You\'re off route. Rerouting." spoken EXACTLY ONCE on departure',
    countSpoken(OFF_ROUTE_SPEECH, departStartTick) === 1,
    { spokenSinceDeparture: spoken.slice(spokenBeforeDeparture) },
  );

  // -- sustain the same episode INSIDE the 30 s failure cooldown ------------
  // 25 more off-route ticks: plenty of repeated state updates in the same
  // episode, and short enough that the controller's next provider attempt
  // (at cooldown expiry) happens in the replacement phase below.
  for (let i = 0; i < 25; i++) {
    mile += perTickMi;
    const on = ROUTE_A.positions[Math.min(Math.round(mile / 0.01), ROUTE_A.positions.length - 1)];
    await tick(offsetM(on, 0, -260), { mph: MPH, headingDeg: 0 });
  }
  check(
    'voice: same episode, NO repeat announcement across sustained off-route ticks',
    countSpoken(OFF_ROUTE_SPEECH, departStartTick) === 1,
    spoken.filter((s) => s.tick >= departStartTick),
  );
  check(
    'voice: no maneuver line initiated while guidance was stale',
    spoken.filter(
      (s) =>
        confirmTick !== null &&
        s.tick > confirmTick &&
        (s.text.includes('Turn right onto Mill Road') || s.text.includes('Head north on Depot')),
    ).length === 0,
    spoken.filter((s) => confirmTick !== null && s.tick > confirmTick),
  );

  // == REPLACEMENT: serve a valid forward route at the next attempt =========
  // Built FROM the controller's own requested origin so its first move is
  // the truck's actual travel direction — the reversal guard must accept it.
  routeResponder = (body) => {
    const northMi = Math.max(0.2, (DESTINATION.lat - body.origin.lat) * MI_PER_DEG_LAT);
    const eastMi = Math.max(
      0.2,
      (DESTINATION.lng - body.origin.lng) * miPerDegLng(body.origin.lat),
    );
    return {
      status: 200,
      payload: wireRoute(
        'route-b',
        buildCourse(body.origin, northMi, eastMi, 'Turn right onto Frontage Road.'),
      ),
    };
  };
  let replacedTick: number | null = null;
  let routeBOrigin: LatLng | null = null;
  for (let i = 0; i < 45 && replacedTick === null; i++) {
    mile += perTickMi;
    const on = ROUTE_A.positions[Math.min(Math.round(mile / 0.01), ROUTE_A.positions.length - 1)];
    await tick(offsetM(on, 0, -260), { mph: MPH, headingDeg: 0 });
    if (countSpoken('Route updated.') > 0) {
      replacedTick = tickIndex;
      routeBOrigin = routeCallLog[routeCallLog.length - 1].body.origin;
    }
  }
  check('behavior: replacement route accepted ("Route updated." spoken)', replacedTick !== null, {
    calls: routeCallLog.map((c) => c.status),
    spoken,
  });
  check('voice: "Route updated." spoken exactly once', countSpoken('Route updated.') === 1);

  // -- drive the NEW route: the episode must be closed ----------------------
  // Fixes follow route B's own north leg from the origin the controller
  // asked to be routed from, so the matcher finds the truck ON route B.
  const b = routeBOrigin ?? offsetM(ROUTE_A.positions[Math.round(mile / 0.01)], 0, -260);
  let bNorthMi = 0;
  let backNavigating = false;
  for (let i = 0; i < 20; i++) {
    bNorthMi += perTickMi;
    await tick({ lat: b.lat + bNorthMi / MI_PER_DEG_LAT, lng: b.lng }, { mph: MPH, headingDeg: 0 });
    const st = pilotState(renderer);
    trace.push({ tick: tickIndex, state: st });
    if (st === 'navigating') {
      backNavigating = true;
      break;
    }
  }
  check('behavior: navigating again on the replacement route', backNavigating, trace.slice(-8));
  check(
    'voice: episode closed — no off-route line initiated once back ON route',
    countSpoken(OFF_ROUTE_SPEECH, (replacedTick ?? 0) + 1) === 0,
  );
  check(
    'voice: reroute did NOT replay the personalized route-start phrase',
    countSpoken(routeStartText('Alex'), replacedTick ?? 0) === 0 &&
      countSpoken(routeStartText('Alex')) <= 1,
    spoken.filter((s) => s.text === routeStartText('Alex')),
  );

  // -- a few settled seconds on route B before the next departure -----------
  for (let i = 0; i < 5; i++) {
    bNorthMi += perTickMi;
    await tick({ lat: b.lat + bNorthMi / MI_PER_DEG_LAT, lng: b.lng }, { mph: MPH, headingDeg: 0 });
  }

  // == EPISODE 2: an independent later departure ============================
  routeResponder = () => ({ status: 500, payload: { ok: false, state: 'provider-failure' } });
  const episode2Start = tickIndex;
  let confirm2: number | null = null;
  for (let i = 1; i <= 40 && confirm2 === null; i++) {
    bNorthMi += perTickMi;
    const on = { lat: b.lat + bNorthMi / MI_PER_DEG_LAT, lng: b.lng };
    await tick(offsetM(on, 0, -Math.min(40 * i, 260)), { mph: MPH, headingDeg: 0 });
    const st = pilotState(renderer);
    trace.push({ tick: tickIndex, state: st });
    if (st === 'off route' || st === 'rerouting') confirm2 = tickIndex;
  }
  check('behavior: second departure confirmed', confirm2 !== null, trace.slice(-8));
  check(
    'voice: SECOND departure announced exactly once (episode advanced)',
    countSpoken(OFF_ROUTE_SPEECH, episode2Start) === 1,
    spoken.filter((s) => s.tick >= episode2Start),
  );
  check(
    'voice: whole trip — off-route line spoken exactly twice, once per episode',
    countSpoken(OFF_ROUTE_SPEECH) === 2,
    spoken.filter((s) => s.text === OFF_ROUTE_SPEECH),
  );

  // -- teardown: unmount cancels the trip and kills pending speech ----------
  await act(async () => {
    renderer.unmount();
    await Promise.resolve();
  });

  console.log(`navigator-offroute-voice: ${passed} passed, ${failed} failed`);
  // Explicit exit either way: the route-port arms a real 20 s
  // AbortSignal.timeout per request, and those platform timers would
  // otherwise keep this process alive long after the last check.
  process.exit(failed > 0 ? 1 : 0);
}

main().then(
  () => {},
  (err) => {
    console.error('HARNESS ERROR:', err);
    process.exit(1);
  },
);
