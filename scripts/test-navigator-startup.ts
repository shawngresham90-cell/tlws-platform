/**
 * Simplified startup (pilot round 3) — BEHAVIORAL harness.
 *
 * The parked flow under test: choose a destination → ONE Start tap →
 * just-in-time location permission → wait for a real fix → exactly one
 * validated plan request → navigation. Like the off-route voice harness,
 * this mounts the REAL `<GpsProvider><SafetyLockProvider><DrivingScreen/>`
 * tree with react-test-renderer (real effects, real declaration order)
 * and injects only at the app's own seams: the GpsProvider port, `fetch`
 * for the route endpoint, and a fake speech engine behind the real
 * browser speech port. Everything in between — the lifecycle, the
 * attempt guard, the safety lock, the voice ledger — is production code.
 *
 * What it pins:
 *   1. the pure trip-start module: fix assessment in every health, and
 *      the attempt guard's one-begin / one-plan-ticket semantics
 *   2. the safety lock's SETUP WINDOW (doc 06 §1a): open at a cold
 *      start, latched shut forever by the FIRST motion determination
 *   3. destination + Start available at a cold start; locked once the
 *      truck is genuinely MOVING
 *   4. the Start tap starts the ONE GPS watch (just-in-time permission)
 *      and shows honest progress; rapid duplicate taps produce ONE watch
 *      and ONE route request
 *   5. denial → one clear recovery line, ZERO route requests, parked
 *   6. timeout/unavailable → honest recovery, ZERO route requests, and
 *      a retry that works (one request per attempt)
 *   7. a clean route auto-starts; a WARNED route pauses at the existing
 *      briefing and its own Start commits
 *   8. blank name → no personalized line is fabricated; a given name →
 *      greeting + route-start exactly once (voice enabled by a real tap)
 *   9. the destination is frozen at tap time — edits mid-attempt cannot
 *      change what gets planned
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-startup
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Environment shims — installed BEFORE the component tree mounts (same
// construction as test-navigator-offroute-voice.ts).

process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'true';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const T0 = 1_754_000_000_000;
let virtualNow = T0;
Date.now = () => virtualNow;

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

type FakeUtterance = {
  text: string;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
let spoken: string[] = [];
let pendingUtterances: FakeUtterance[] = [];
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
    spoken.push(u.text);
    pendingUtterances.push(u);
  },
  cancel() {
    const cancelled = pendingUtterances;
    pendingUtterances = [];
    for (const u of cancelled) u.onend?.();
  },
  resume() {},
};

(globalThis as any).window = {
  speechSynthesis: fakeSynth,
  location: { hostname: 'localhost' },
  addEventListener() {},
  removeEventListener() {},
};

type RouteBody = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
};
let routeResponder: (body: RouteBody) => { status: number; payload: unknown } = () => {
  throw new Error('routeResponder not scripted');
};
let routeCallLog: { body: RouteBody; status: number }[] = [];
(globalThis as any).fetch = async (url: string, init?: { body?: string }) => {
  if (String(url) !== '/api/navigator/route') throw new Error(`unexpected fetch: ${url}`);
  const body = JSON.parse(init?.body ?? '{}') as RouteBody;
  const out = routeResponder(body);
  routeCallLog.push({ body, status: out.status });
  return { status: out.status, json: async () => out.payload };
};

// ---------------------------------------------------------------------------

import { createElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import type { GeolocationPort } from '@/lib/navigator/ports';
import type { LatLng } from '@/lib/map/bounds';
import { createSafetyLock } from '@/lib/navigator/safety-lock';
import {
  assessStartFix,
  createStartAttempt,
  GETTING_LOCATION_TEXT,
  LOCATION_DENIED_TEXT,
  LOCATION_UNAVAILABLE_TEXT,
} from '@/lib/navigator/trip-start';
import { routeStartText, greetingText, getGreetingPeriod } from '@/lib/navigator/driver-greeting';
import { VOICE_ENABLED_CONFIRMATION } from '@/components/navigator/VoiceControls';
import type { PositionState } from '@/lib/navigator/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 220)}`}`,
    );
  }
}

// ============================================================ pure module

{
  const base: PositionState = {
    fix: { lat: 35, lng: -85, accuracyM: 8, tMs: T0, speedMph: 0, headingDeg: null },
    health: 'good',
    lastFixMs: T0,
    accuracyM: 8,
    speedMph: 0,
    headingDeg: null,
    deadReckoning: false,
  };
  check('assess: good fix plans', assessStartFix(base, false, true) === 'plan');
  check(
    'assess: degraded fix still plans (the lifecycle feeds engines on the same predicate)',
    assessStartFix({ ...base, health: 'degraded' }, false, true) === 'plan',
  );
  check(
    'assess: denied is terminal regardless of any held fix',
    assessStartFix({ ...base, health: 'denied', fix: null }, true, false) === 'denied',
  );
  check(
    'assess: a LOST (stale) fix never becomes an origin',
    assessStartFix({ ...base, health: 'lost' }, false, true) === 'unusable',
  );
  check(
    'assess: acquiring with nothing yet = wait (platform still owes an answer)',
    assessStartFix({ ...base, fix: null, health: 'unavailable' }, true, true) === 'wait',
  );
  check(
    'assess: no watch yet = wait, never a spurious refusal (commit-order safety)',
    assessStartFix({ ...base, fix: null, health: 'unavailable' }, false, false) === 'wait',
  );
  check(
    'assess: platform answered with nothing = unusable, never a guessed origin',
    assessStartFix({ ...base, fix: null, health: 'unavailable' }, false, true) === 'unusable',
  );

  const attempt = createStartAttempt();
  check('attempt: first begin claims the slot', attempt.begin() === true);
  check('attempt: duplicate begin refused (the double tap)', attempt.begin() === false);
  check('attempt: one plan ticket', attempt.claimPlan() === true);
  check('attempt: second plan claim refused', attempt.claimPlan() === false);
  attempt.end();
  check('attempt: ended attempt has no ticket', attempt.claimPlan() === false);
  check('attempt: slot reusable after end', attempt.begin() === true);
  attempt.end();
}

// ====================================================== setup window (lock)

{
  const lock = createSafetyLock('s-test');
  const cold: PositionState = {
    fix: null,
    health: 'unavailable',
    lastFixMs: 0,
    accuracyM: Number.NaN,
    speedMph: null,
    headingDeg: null,
    deadReckoning: false,
  };
  let t = T0;
  let st = lock.sample(cold, t);
  check(
    'setup window: open at a cold start (UNKNOWN, locked otherwise)',
    st.setupWindow && st.locked,
  );

  const moving = (mph: number, tMs: number): PositionState => ({
    fix: { lat: 35, lng: -85, accuracyM: 8, tMs, speedMph: mph, headingDeg: 0 },
    health: 'good',
    lastFixMs: tMs,
    accuracyM: 8,
    speedMph: mph,
    headingDeg: 0,
    deadReckoning: false,
  });
  for (let i = 0; i <= 11; i++) {
    t += 1000;
    st = lock.sample(moving(40, t), t);
  }
  check(
    'setup window: latched shut by the MOVING determination',
    st.motion === 'MOVING' && !st.setupWindow,
  );
  // The truck vanishes from GPS: UNKNOWN again — but the window must NOT
  // re-open, because motion was last seen at 40 mph.
  t += 1000;
  st = lock.sample(cold, t);
  check(
    'setup window: UNKNOWN after motion stays locked and stays shut (never re-opens)',
    st.motion === 'UNKNOWN' && st.locked && !st.setupWindow,
  );

  // And the STATIONARY determination latches it too, on a fresh lock.
  const lock2 = createSafetyLock('s-test2');
  let t2 = T0;
  let st2 = lock2.sample(cold, t2);
  check('setup window: open before any determination', st2.setupWindow);
  for (let i = 0; i <= 31; i++) {
    t2 += 1000;
    st2 = lock2.sample(moving(0, t2), t2);
  }
  check(
    'setup window: STATIONARY latches it shut as well (normal rules take over)',
    st2.motion === 'STATIONARY' && !st2.locked && !st2.setupWindow,
  );
}

// ================================================== full-tree behavioral

const MI_PER_DEG_LAT = 69.0937;
const START_POS: LatLng = { lat: 35.0, lng: -85.0 };
const DEST: LatLng = { lat: 35.0 + 6 / MI_PER_DEG_LAT, lng: -85.0 };

function wireRoute(warnings: string[] = []) {
  const geometry: [number, number][] = [];
  // 0.05-mile sampling: dense enough to be a real polyline, sparse
  // enough that the repeated-segment density artifact stays out of the
  // way — that advisory's non-gating role is pinned separately below.
  for (let i = 0; i <= 120; i++) {
    geometry.push([START_POS.lat + (i * 0.05) / MI_PER_DEG_LAT, START_POS.lng]);
  }
  return {
    ok: true,
    state: warnings.length > 0 ? 'valid-with-warning' : 'valid',
    warnings,
    route: {
      routeId: `startup-${warnings.length > 0 ? 'warned' : 'clean'}`,
      distanceMiles: 6,
      seconds: 480,
      geometry,
      maneuvers: [
        { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
        {
          action: 'turn',
          instruction: 'Turn right onto Old Mill Road.',
          direction: 'right',
          offset: 60,
        },
        {
          action: 'arrive',
          instruction: 'Arrive at the receiving gate.',
          direction: null,
          offset: 120,
        },
      ],
    },
  };
}

type GeoMode = 'granted' | 'prompt' | 'denied';
type Harness = {
  renderer: ReactTestRenderer;
  emitFix: (over?: Partial<{ lat: number; lng: number; mph: number }>) => Promise<void>;
  emitError: (kind: 'denied' | 'unavailable' | 'timeout') => Promise<void>;
  settle: () => Promise<void>;
  grant: () => void;
  watchCalls: () => number;
  text: () => string;
  find: (label: string) => any;
  tap: (label: string) => Promise<void>;
  unmount: () => Promise<void>;
};

/**
 * Mount a fresh tree with a scripted geolocation port. 'granted' delivers
 * fixes on demand; 'prompt' holds the watch until grant(); 'denied'
 * answers every watch with a denial.
 */
async function mount(mode: GeoMode): Promise<Harness> {
  spoken = [];
  pendingUtterances = [];
  routeCallLog = [];
  intervals.clear();

  type FixCb = (f: any) => void;
  type ErrCb = (k: 'denied' | 'unavailable' | 'timeout') => void;
  let onFix: FixCb | null = null;
  let onError: ErrCb | null = null;
  let pendingPrompt: { fix: FixCb; err: ErrCb } | null = null;
  let watchCalls = 0;
  let granted = mode === 'granted';
  const port: GeolocationPort = {
    watch(fx, er) {
      watchCalls += 1;
      if (mode === 'denied') {
        queueMicrotask(() => er('denied'));
      } else if (!granted) {
        pendingPrompt = { fix: fx, err: er };
      } else {
        onFix = fx;
        onError = er;
      }
      return () => {
        onFix = null;
        onError = null;
        pendingPrompt = null;
      };
    },
  };

  const renderer = TestRenderer.create(
    createElement(GpsProvider, {
      port,
      children: createElement(SafetyLockProvider, {
        children: createElement(DrivingScreen as any, { authorized: true }),
      }),
    }),
  );
  await act(async () => {
    await Promise.resolve();
  });

  const settle = async () => {
    await act(async () => {
      virtualNow += 1000;
      fireDueIntervals();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    while (pendingUtterances.length > 0) {
      const u = pendingUtterances.shift()!;
      await act(async () => {
        u.onend?.();
        await Promise.resolve();
      });
    }
  };

  const flat = (v: any): string =>
    v === null || v === undefined
      ? ''
      : typeof v === 'string'
        ? v
        : Array.isArray(v)
          ? v.map(flat).join(' ')
          : flat(v.children);

  const textOf = (node: any): string => {
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
  };

  const find = (label: string) => {
    const hits = renderer.root.findAll(
      (n) =>
        n.type === 'button' &&
        (String(n.props['aria-label'] ?? '').includes(label) || textOf(n).trim() === label),
    );
    if (hits.length === 0) throw new Error(`button not found: ${label}`);
    return hits[0];
  };

  return {
    renderer,
    emitFix: async (over = {}) => {
      await act(async () => {
        virtualNow += 1000;
        fireDueIntervals();
        onFix?.({
          lat: over.lat ?? START_POS.lat,
          lng: over.lng ?? START_POS.lng,
          accuracyM: 8,
          speedMps: (over.mph ?? 0) / 2.236936,
          headingDeg: 0,
          tMs: virtualNow,
        });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      while (pendingUtterances.length > 0) {
        const u = pendingUtterances.shift()!;
        await act(async () => {
          u.onend?.();
          await Promise.resolve();
        });
      }
    },
    emitError: async (kind) => {
      await act(async () => {
        onError?.(kind);
        await Promise.resolve();
        await Promise.resolve();
      });
    },
    settle,
    grant: () => {
      granted = true;
      if (pendingPrompt) {
        onFix = pendingPrompt.fix;
        onError = pendingPrompt.err;
        pendingPrompt = null;
      }
    },
    watchCalls: () => watchCalls,
    text: () => flat(renderer.toJSON()),
    find,
    tap: async (label: string) => {
      await act(async () => {
        find(label).props.onClick();
        await Promise.resolve();
      });
    },
    unmount: async () => {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}

async function setDevDestination(h: Harness, dest: LatLng) {
  const latInput = h.renderer.root.findAll(
    (n) => n.type === 'input' && n.props['aria-label'] === 'Destination latitude',
  )[0];
  const lngInput = h.renderer.root.findAll(
    (n) => n.type === 'input' && n.props['aria-label'] === 'Destination longitude',
  )[0];
  await act(async () => {
    latInput.props.onChange({ target: { value: String(dest.lat) } });
  });
  await act(async () => {
    lngInput.props.onChange({ target: { value: String(dest.lng) } });
  });
}

function pilotState(h: Harness): string | null {
  const m = h
    .text()
    .match(
      /Pilot trip state: (route ready|final approach|off route|rerouting|navigating|planning|arrived|completed|idle)/,
    );
  return m ? m[1] : null;
}

async function main(): Promise<void> {
  // ---------------- clean flow, granted permission, duplicate taps --------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');

    check(
      'cold start: destination entry present with NO location step first',
      h.text().includes('Where are you going?'),
    );
    check(
      'cold start: the standalone Enable-location control is gone (Start owns location)',
      !h.text().includes('Enable location'),
    );
    check(
      'cold start: overlay explains the setup window',
      h.text().includes('Trip setup available'),
    );

    await setDevDestination(h, DEST);
    check('no watch exists before the Start tap', h.watchCalls() === 0);

    await h.tap('Start');
    check('the Start tap started the ONE GPS watch', h.watchCalls() === 1, h.watchCalls());
    check('honest progress: locating', h.text().includes(GETTING_LOCATION_TEXT));

    // Four more rapid taps land on a disabled control / claimed slot.
    for (let i = 0; i < 4; i++) {
      try {
        await h.tap('Start');
      } catch {
        /* button may legitimately be gone already */
      }
    }
    check('rapid taps: still exactly one watch', h.watchCalls() === 1, h.watchCalls());

    await h.emitFix();
    await h.settle();
    check(
      'exactly one route request across five taps',
      routeCallLog.length === 1,
      routeCallLog.length,
    );
    check('clean route auto-started navigation', pilotState(h) === 'navigating', pilotState(h));
    check('no personalized line fabricated for a blank name', spoken.length === 0, spoken);
    await h.unmount();
  }

  // ---------------- prompt state: the tap is the permission gesture -------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('prompt');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    await setDevDestination(h, DEST);
    await h.tap('Start');
    check('prompt: watch requested by the tap', h.watchCalls() === 1);
    check(
      'prompt: still locating while the driver decides',
      h.text().includes(GETTING_LOCATION_TEXT),
    );
    check('prompt: no route request before permission resolves', routeCallLog.length === 0);
    h.grant();
    await h.emitFix();
    await h.settle();
    check(
      'prompt: granted mid-attempt → navigating',
      pilotState(h) === 'navigating',
      pilotState(h),
    );
    check('prompt: exactly one route request', routeCallLog.length === 1);
    await h.unmount();
  }

  // ---------------- denied ------------------------------------------------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('denied');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    await setDevDestination(h, DEST);
    await h.tap('Start');
    await h.settle();
    check(
      'denied: the one clear recovery line',
      h.text().includes(LOCATION_DENIED_TEXT),
      h.text().slice(0, 600),
    );
    check('denied: ZERO route requests', routeCallLog.length === 0);
    check('denied: still parked at idle', pilotState(h) === null || pilotState(h) === 'idle');
    check('denied: Start is offered again (retry stays possible)', h.find('Start') !== null);
    await h.unmount();
  }

  // ---------------- unavailable / timeout, then a working retry -----------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    await setDevDestination(h, DEST);
    await h.tap('Start');
    await h.emitError('timeout');
    await h.settle();
    check('timeout: honest recovery line', h.text().includes(LOCATION_UNAVAILABLE_TEXT));
    check('timeout: ZERO route requests — no guessed origin, ever', routeCallLog.length === 0);

    await h.tap('Start');
    await h.emitFix();
    await h.settle();
    check('timeout retry: navigating', pilotState(h) === 'navigating', pilotState(h));
    check('timeout retry: one request for the whole retry', routeCallLog.length === 1);
    await h.unmount();
  }

  // ---------------- route refused, honest failure, safe retry -------------
  {
    let fail = true;
    routeResponder = () => {
      if (fail) {
        fail = false;
        return { status: 502, payload: { ok: false, state: 'provider-failure' } };
      }
      return { status: 200, payload: wireRoute() };
    };
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    await setDevDestination(h, DEST);
    await h.tap('Start');
    await h.emitFix();
    await h.settle();
    await h.settle();
    check('refused plan: the existing honest failure line', h.text().includes('Route refused:'));
    check('refused plan: parked at idle', pilotState(h) === null || pilotState(h) === 'idle');
    check('refused plan: exactly one request was spent', routeCallLog.length === 1);

    await h.tap('Start');
    await h.emitFix();
    await h.settle();
    check('refused plan retry: navigating', pilotState(h) === 'navigating', pilotState(h));
    check('refused plan retry: one request per attempt', routeCallLog.length === 2);
    await h.unmount();
  }

  // ---------------- a WARNED route pauses at the briefing -----------------
  {
    routeResponder = () => ({
      status: 200,
      payload: wireRoute(['Route includes a segment the validator flagged.']),
    });
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    await setDevDestination(h, DEST);
    await h.tap('Start');
    await h.emitFix();
    await h.settle();
    check('warned route: paused at the flight briefing', h.text().includes('Route briefing'));
    check('warned route: the warning is on the surface', h.text().includes('validator flagged'));
    check('warned route: machine holds at route-ready', pilotState(h) === 'route ready');
    await h.tap('Start navigation');
    await h.emitFix();
    check('warned route: the briefing Start commits', pilotState(h) === 'navigating');
    check('warned route: still one route request', routeCallLog.length === 1);
    await h.unmount();
  }

  // ---------------- name + voice: the greeting survives auto-start --------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');

    const nameInput = h.renderer.root.findAll(
      (n) => n.type === 'input' && n.props.autoComplete === 'given-name',
    )[0];
    await act(async () => {
      nameInput.props.onChange({ target: { value: 'Shawn' } });
    });
    const nameForm = h.renderer.root.findAll((n) => n.type === 'form')[0];
    await act(async () => {
      nameForm.props.onSubmit({ preventDefault() {} });
    });
    await h.tap('Enable voice guidance');
    await h.settle();
    check(
      'voice: in-gesture confirmation spoke',
      spoken.includes(VOICE_ENABLED_CONFIRMATION),
      spoken,
    );
    const expectedGreeting = greetingText(
      getGreetingPeriod(new Date(virtualNow).getHours()),
      'Shawn',
    );
    check(
      'voice: time-of-day greeting spoke while parked',
      spoken.includes(expectedGreeting),
      spoken,
    );

    await setDevDestination(h, DEST);
    await h.tap('Start');
    await h.emitFix();
    await h.settle();
    await h.settle();
    check('greeting: navigating after auto-start', pilotState(h) === 'navigating');
    check(
      'greeting: the personalized route-start line survived the auto-start, exactly once',
      spoken.filter((s) => s === routeStartText('Shawn')).length === 1,
      spoken,
    );
    await h.unmount();
  }

  // ---------------- destination frozen at tap time ------------------------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    await setDevDestination(h, DEST);
    await h.tap('Start');
    // Mid-attempt sabotage: change the coordinate box before the fix
    // lands. The plan must still go to the destination the driver was
    // looking at when they tapped Start.
    await setDevDestination(h, { lat: 44.4, lng: -100.1 });
    await h.emitFix();
    await h.settle();
    check(
      'frozen destination: the plan carried the tap-time destination',
      routeCallLog.length === 1 && Math.abs(routeCallLog[0].body.destination.lat - DEST.lat) < 1e-9,
      routeCallLog.map((c) => c.body.destination),
    );
    await h.unmount();
  }

  // ---------------- motion safety: MOVING locks the setup surface ---------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const h = await mount('granted');
    // The truck must be CONFIRMED before any route may be requested
    // (truck-route confidence milestone). One tap, once per session.
    await h.tap('This is my truck');
    check('moving: setup present while cold', h.text().includes('Where are you going?'));
    // Start the watch through the app's own gesture (destination + Start
    // would plan, so use Start with no destination: the honest note path
    // starts nothing). Instead: tap Start WITH a destination, but feed
    // MOVING fixes so the attempt plans from a rolling truck — planning
    // is legal; TYPING afterwards is what must lock.
    await setDevDestination(h, DEST);
    await h.tap('Start');
    for (let i = 0; i <= 11; i++) await h.emitFix({ mph: 40, lat: START_POS.lat + i * 0.0002 });
    await h.settle();
    const text = h.text();
    check(
      'moving: destination entry locked once the truck is genuinely MOVING',
      text.includes('Destination entry is locked') || !text.includes('Where are you going?'),
      text.slice(0, 200),
    );
    await h.unmount();
  }

  console.log(`navigator-startup: ${passed} passed, ${failed} failed`);
  // Explicit exit on success too: the shimmed environment (fake window,
  // scripted ports, React test scheduler) can leave a live handle behind
  // after the final unmount, and a harness that finished all its checks
  // must not hang the runner on an idle event loop.
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('HARNESS ERROR:', err);
  process.exit(1);
});
