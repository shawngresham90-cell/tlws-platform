/**
 * The driver's clocks survive the drive — BEHAVIORAL harness.
 *
 * Required proof case 13: starting navigation, going off route and
 * rerouting, and stopping must NOT reset the clocks a driver entered.
 *
 * `test-navigator-setup-order` pins this by reading the source for an
 * absent reset call, which proves only that nobody wrote the obvious bug.
 * It cannot see a clock re-seeded by a remount, a state initializer that
 * runs again, an effect that re-reads storage on a lifecycle change, or a
 * prop that silently reverts to a default. Those are the ways this
 * actually breaks, and only running the flow finds them.
 *
 * So this mounts the REAL `<GpsProvider><SafetyLockProvider><DrivingScreen/>`
 * tree — same construction as `test-navigator-startup` — with a real
 * storage double carrying a mid-shift driver: a saved name, a confirmed
 * truck, and clocks that are emphatically NOT full. Then it drives the
 * whole cycle and reads the strip at every stage.
 *
 * The single number that matters: 5:05 of drive time left. If any stage
 * shows 11:00, the assumption this milestone removed has grown back.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-clock-lifecycle
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

type FakeUtterance = { text: string; onend: (() => void) | null };
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
    pendingUtterances.push(u);
  },
  cancel() {
    const cancelled = pendingUtterances;
    pendingUtterances = [];
    for (const u of cancelled) u.onend?.();
  },
  resume() {},
};

/** A real store, so the screen restores the way a phone would. */
class MemoryStorage {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}
const local = new MemoryStorage();
const session = new MemoryStorage();

(globalThis as any).window = {
  speechSynthesis: fakeSynth,
  location: { hostname: 'localhost' },
  localStorage: local,
  sessionStorage: session,
  addEventListener() {},
  removeEventListener() {},
};

/*
 * `self` and an idle scheduler. The driving screen links to Settings with
 * next/link, whose prefetch schedules work through `requestIdleCallback` on
 * `self` — neither of which exists in a node harness. Shimmed beside the
 * other browser globals; the idle callback is dropped rather than run,
 * because prefetching is not what any of these harnesses is testing.
 */
(globalThis as any).self = globalThis;
(globalThis as any).requestIdleCallback = () => 0;
(globalThis as any).cancelIdleCallback = () => {};
(globalThis as any).localStorage = local;
(globalThis as any).sessionStorage = session;

type RouteBody = { origin: LatLng; destination: LatLng };
let routeResponder: (body: RouteBody) => { status: number; payload: unknown } = () => {
  throw new Error('routeResponder not scripted');
};
let routeCallLog: RouteBody[] = [];
(globalThis as any).fetch = async (url: string, init?: { body?: string }) => {
  if (String(url) !== '/api/navigator/route') throw new Error(`unexpected fetch: ${url}`);
  const body = JSON.parse(init?.body ?? '{}') as RouteBody;
  routeCallLog.push(body);
  const out = routeResponder(body);
  return { status: out.status, json: async () => out.payload };
};

// ---------------------------------------------------------------------------

import { writeSync } from 'node:fs';
import { createElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import type { GeolocationPort } from '@/lib/navigator/ports';
import type { LatLng } from '@/lib/map/bounds';
import { readClocks, writeClocks } from '@/components/navigator/clocks-storage';
import { writeTruck } from '@/components/navigator/truck-storage';
import { writeDriverName } from '@/components/navigator/driver-storage';
import { confirmProfile, DEFAULT_EDITABLE_PROFILE } from '@/lib/navigator/truck-profile';
import type { DriverEnteredClocks } from '@/lib/navigator/hos-clocks';

let passed = 0;
let failed = 0;
/*
 * Written with `writeSync` rather than `console.log`. Mounting the real
 * tree leaves React's scheduler MessageChannel open, so this harness has
 * to exit explicitly (see the end of `main`) — and an explicit exit can
 * truncate buffered writes to a pipe. Failures are the one thing that
 * must never be the part that gets dropped.
 */
function say(line: string): void {
  writeSync(1, `${line}\n`);
}
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    say(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/*
 * A driver five hours into a shift. Chosen so every displayed value is
 * distinguishable at a glance from the full-clock fiction:
 *   drive   5:05 (never 11:00)   window 7:50 (never 14:00)
 *   break   3:05 (never 8:00)    cycle 22:05 (never 70:00)
 */
const MID_SHIFT: DriverEnteredClocks = {
  drivingMin: 305,
  windowMin: 470,
  untilBreakMin: 185,
  cycleMin: 1_325,
  cycleRule: '70/8',
};
const DRIVE_LEFT = '5:05';
const WINDOW_LEFT = '7:50';
const FULL_DRIVE = '11:00';
const FULL_WINDOW = '14:00';

const MI_PER_DEG_LAT = 69.0937;
function miPerDegLng(lat: number): number {
  return MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}
const START_POS: LatLng = { lat: 35.0, lng: -85.0 };
const DEST: LatLng = { lat: 35.0 + 6 / MI_PER_DEG_LAT, lng: -85.0 };

function wireRoute() {
  const geometry: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    geometry.push([START_POS.lat + (i * 0.05) / MI_PER_DEG_LAT, START_POS.lng]);
  }
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: `clock-lifecycle-${routeCallLog.length}`,
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

type Harness = {
  renderer: ReactTestRenderer;
  emitFix: (over?: Partial<{ lat: number; lng: number; mph: number }>) => Promise<void>;
  text: () => string;
  tap: (label: string) => Promise<void>;
  has: (label: string) => boolean;
  unmount: () => Promise<void>;
};

async function mount(): Promise<Harness> {
  pendingUtterances = [];
  routeCallLog = [];
  intervals.clear();

  let onFix: ((f: any) => void) | null = null;
  const port: GeolocationPort = {
    watch(fx) {
      onFix = fx;
      return () => {
        onFix = null;
      };
    },
  };

  /*
   * The mount itself is wrapped in `act`, unlike the other Navigator
   * harnesses, and it has to be: the whole point here is the RESTORE, and
   * the restore lives in mount effects. Creating the tree outside `act`
   * defers those effects, which shows up as a screen that has forgotten
   * the driver — exactly the bug this file exists to catch, faked by the
   * harness instead of found in the code.
   */
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      createElement(GpsProvider, {
        port,
        children: createElement(SafetyLockProvider, {
          children: createElement(DrivingScreen as any, { authorized: true }),
        }),
      }),
    );
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });

  const flat = (v: any): string =>
    v === null || v === undefined
      ? ''
      : typeof v === 'string' || typeof v === 'number'
        ? String(v)
        : Array.isArray(v)
          ? v.map(flat).join(' ')
          : flat(v.children);

  const textOf = (node: any): string => {
    const parts: string[] = [];
    const walk = (c: any) => {
      if (typeof c === 'string') parts.push(c);
      else if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === 'object' && 'children' in c.props) walk(c.props.children);
    };
    walk(node.props.children);
    return parts.join(' ');
  };

  const find = (label: string) => {
    // Exact alternatives, never a prefix: 'Start with full clocks' is a
    // different button from 'Start Route' and must never be tapped for it.
    const wanted = label === 'Start' ? ['Start', 'Start Route'] : [label];
    const hits = renderer.root.findAll(
      (n) =>
        n.type === 'button' &&
        (String(n.props['aria-label'] ?? '').includes(label) || wanted.includes(textOf(n).trim())),
    );
    return hits[0] ?? null;
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
      /*
       * Finish queued speech one line at a time, OUTSIDE the fix's `act`
       * — the voice module starts the next queued line inside each
       * `onend`. The cap is a deadlock guard, not a tuning knob: a fix
       * that produces an unbounded stream of speech is a real defect, and
       * it should surface as a named failure rather than as a harness
       * that never returns.
       */
      let drained = 0;
      while (pendingUtterances.length > 0) {
        if (++drained > 64) throw new Error('speech never drained: unbounded utterance queue');
        const u = pendingUtterances.shift()!;
        await act(async () => {
          u.onend?.();
          await Promise.resolve();
        });
      }
    },
    text: () => flat(renderer.toJSON()),
    has: (label: string) => find(label) !== null,
    tap: async (label: string) => {
      const btn = find(label);
      if (btn === null) throw new Error(`button not found: ${label}`);
      await act(async () => {
        btn.props.onClick();
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

/** Every clock assertion in one place, so no stage can be checked loosely. */
function clocksIntact(h: Harness, stage: string) {
  const t = h.text();
  check(`${stage}: the driver's drive time is shown`, t.includes(DRIVE_LEFT), {
    stage,
    sample: t.slice(0, 200),
  });
  check(`${stage}: the driver's window is shown`, t.includes(WINDOW_LEFT));
  check(`${stage}: NOT a fresh eleven hours`, !t.includes(FULL_DRIVE));
  check(`${stage}: NOT a fresh fourteen-hour window`, !t.includes(FULL_WINDOW));
  check(`${stage}: and it never says the clocks are unset`, !t.includes('Clocks not set'));
}

async function main(): Promise<void> {
  /* =================================================================== */
  /* The whole drive, on one set of entered clocks                        */
  /* =================================================================== */
  local.map.clear();
  session.map.clear();
  writeDriverName('Shawn');
  writeTruck(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE));
  writeClocks({ kind: 'set', entered: MID_SHIFT, enteredAtMs: T0, fromFreshShift: false });

  routeResponder = () => ({ status: 200, payload: wireRoute() });
  const h = await mount();

  // --- parked, before anything is tapped ------------------------------
  clocksIntact(h, 'parked');
  /*
   * The name is no longer DISPLAYED on the driving screen — the field that
   * showed it moved to /drive/settings with the rest of the setup. What this
   * block cares about is that the record survives a reload and reaches the
   * one thing the name exists for, which is being spoken; that is asserted in
   * test-navigator-startup's greeting scenario. Here the useful statement is
   * the negative one: the driving screen does not ask for it again.
   */
  check(
    'parked: the screen does not re-ask for a name it already has',
    !h.text().includes('Save name') && !h.text().includes('First name'),
  );
  check(
    'parked: the saved truck came back confirmed, so Start is not gated on it',
    !h.text().includes('Confirm your truck first'),
    h.text().slice(0, 300),
  );

  // --- start navigation -----------------------------------------------
  await setDevDestination(h, DEST);
  await h.tap('Start');
  await h.emitFix();
  await h.emitFix({ mph: 45 });
  check('start: a route was requested', routeCallLog.length === 1, routeCallLog.length);
  clocksIntact(h, 'navigating');

  /*
   * --- move along the route ---------------------------------------------
   * One second of travel per fix, at the speed the fix itself reports.
   * The distance and the speed have to agree: the position pipeline
   * rejects a jump that the reported speed cannot explain, and a rejected
   * fix reads as "position unknown" rather than as movement.
   */
  const MPH = 55;
  const PER_TICK_MI = MPH / 3600;
  let mile = 0;
  for (let i = 0; i < 20; i++) {
    mile += PER_TICK_MI;
    await h.emitFix({ lat: START_POS.lat + mile / MI_PER_DEG_LAT, mph: MPH });
  }
  clocksIntact(h, 'under way');

  /*
   * --- go off route, and reroute ---------------------------------------
   * A parallel-road departure, driven the way `test-navigator-offroute-
   * voice` drives it: keep making forward progress along the route while
   * sliding sideways a little at a time, and let the REAL detector decide
   * when that counts. Its calibration (lateral distance, confirming
   * fixes, elapsed time, speed) is not restated here — the loop runs
   * until the screen itself admits the departure, so a future tuning
   * change relaxes this harness instead of breaking it.
   */
  let confirmed = false;
  for (let i = 1; i <= 40 && !confirmed; i++) {
    mile += PER_TICK_MI;
    await h.emitFix({
      lat: START_POS.lat + mile / MI_PER_DEG_LAT,
      lng: START_POS.lng + Math.min(i * 40, 260) / 1609.344 / miPerDegLng(START_POS.lat),
      mph: MPH,
    });
    const state = pilotState(h);
    confirmed = state === 'off route' || state === 'rerouting';
  }
  check('reroute: the real detector confirmed the departure', confirmed, pilotState(h));
  clocksIntact(h, 'off route / rerouting');

  // --- stop -------------------------------------------------------------
  if (h.has('Stop navigation')) {
    await h.tap('Stop navigation');
  }
  clocksIntact(h, 'after Stop');
  check(
    'after Stop: the clock record on disk is untouched',
    local.getItem('tlws-navigator-clocks-v1') !== null,
  );

  await h.unmount();

  /* =================================================================== */
  /* A remount is the reload a driver actually does — same answer         */
  /* =================================================================== */
  {
    const again = await mount();
    clocksIntact(again, 'after a full remount');
    await again.unmount();
  }

  /* =================================================================== */
  /* The negative control: no saved clocks means UNSET, not full ones     */
  /* =================================================================== */
  {
    local.map.clear();
    session.map.clear();
    writeTruck(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE));
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    const bare = await mount();

    const parked = bare.text();
    check('unset: the parked screen says so plainly', parked.includes('Clocks not set'), {
      sample: parked.slice(0, 300),
    });
    check('unset: and does NOT show eleven hours', !parked.includes(FULL_DRIVE));

    // Start is still allowed — navigation is not HOS-gated — but the
    // screen must keep saying guidance is unavailable while driving.
    await setDevDestination(bare, DEST);
    await bare.tap('Start');
    await bare.emitFix();
    await bare.emitFix({ mph: 45 });
    const driving = bare.text();
    check('unset: navigation still starts with no clocks entered', routeCallLog.length >= 1);
    check(
      'unset: and the driving screen never invents clocks',
      !driving.includes(FULL_DRIVE) && !driving.includes(FULL_WINDOW),
      driving.slice(0, 300),
    );
    await bare.unmount();
  }

  say(`navigator-clock-lifecycle: ${passed} passed, ${failed} failed`);
  /*
   * Explicit, because this harness cannot end on its own. React's
   * scheduler opens a MessageChannel per root and never closes it, so a
   * file that mounts the real tree three times leaves the event loop
   * alive with nothing left to do. Unmounting does not release it.
   */
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  say(`HARNESS ERROR: ${e?.stack ?? e}`);
  process.exit(1);
});
