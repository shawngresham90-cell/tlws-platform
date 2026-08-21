/**
 * Map-top parked destination search (final pilot milestone) — BEHAVIORAL.
 *
 * The search box moved from the trip-controls stack to the top of the
 * parked map, and the pick it produces is ONE state owned by the driving
 * screen. Like the startup harness, this mounts the REAL
 * `<GpsProvider><SafetyLockProvider><DrivingScreen/>` tree with
 * react-test-renderer (real effects, real declaration order) and injects
 * only at the app's own seams: the GpsProvider port, `fetch` for the
 * route AND destination-search endpoints, and a fake speech engine. The
 * debounce timer is virtualized so the 350 ms spend gate is exercised,
 * not slept through.
 *
 * What it pins:
 *   1. parked cold start: the search renders on the map surface, BEFORE
 *      any location permission, with the honest unbiased hint
 *   2. typing requests NOTHING: no GPS watch, no permission prompt, no
 *      route request — and no search request until the debounce elapses;
 *      retyping inside the window still costs ONE search request
 *   3. pre-permission searches travel with NO origin (the server's
 *      unbiased mode), and results without a distance never render one
 *   4. results show name + address; selecting updates the chosen
 *      destination on the Start surface; editing the text drops the pick
 *   5. the Start tap plans to the SEARCHED place — exactly one route
 *      request, destination equal to the picked coordinates — and five
 *      rapid Start taps still produce ONE watch and ONE request
 *   6. while a Start attempt runs the search is disabled; Cancel
 *      re-enables it without having spent a route request
 *   7. while guidance is live there is NO search input anywhere — no
 *      keyboard can auto-open over the map, nothing can cover the live
 *      controls
 *   8. a genuinely MOVING truck loses the text field through the shared
 *      lock (compact locked row, passenger path intact), and GPS loss
 *      AFTER established motion keeps it locked (UNKNOWN never re-opens)
 *   9. structure: the overlay clears Leaflet panes but sits under its
 *      controls, scrolls internally instead of clipping, and the input
 *      never autofocuses
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-map-search
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Environment shims — installed BEFORE the component tree mounts (same
// construction as test-navigator-startup.ts, plus a virtual setTimeout
// for the search debounce).

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

// The debounce clock. Node's scheduler paths (setImmediate, microtasks)
// are untouched; only setTimeout/clearTimeout ride virtual time, which is
// exactly what DestinationSearch uses for its 350 ms spend gate.
type FakeTimeout = { cb: () => void; at: number };
const timeouts = new Map<number, FakeTimeout>();
let timeoutSeq = 100_000;
(globalThis as any).setTimeout = (cb: () => void, ms?: number) => {
  timeoutSeq += 1;
  timeouts.set(timeoutSeq, { cb, at: virtualNow + Math.max(0, ms ?? 0) });
  return timeoutSeq;
};
(globalThis as any).clearTimeout = (id: number) => {
  timeouts.delete(id);
};
function fireDueTimeouts(): void {
  for (const [id, t] of [...timeouts]) {
    if (t.at <= virtualNow) {
      timeouts.delete(id);
      t.cb();
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

type RouteBody = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
};
let routeResponder: (body: RouteBody) => { status: number; payload: unknown } = () => {
  throw new Error('routeResponder not scripted');
};
let routeCallLog: { body: RouteBody; status: number }[] = [];
let searchResponder: (url: string) => { status: number; payload: unknown } = () => {
  throw new Error('searchResponder not scripted');
};
let searchCallLog: string[] = [];
(globalThis as any).fetch = async (url: string, init?: { body?: string }) => {
  const u = String(url);
  if (u === '/api/navigator/route') {
    const body = JSON.parse(init?.body ?? '{}') as RouteBody;
    const out = routeResponder(body);
    routeCallLog.push({ body, status: out.status });
    return { ok: out.status === 200, status: out.status, json: async () => out.payload };
  }
  if (u.startsWith('/api/navigator/destination-search')) {
    searchCallLog.push(u);
    const out = searchResponder(u);
    return { ok: out.status === 200, status: out.status, json: async () => out.payload };
  }
  throw new Error(`unexpected fetch: ${u}`);
};

// ---------------------------------------------------------------------------

import { createElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import type { GeolocationPort } from '@/lib/navigator/ports';
import type { LatLng } from '@/lib/map/bounds';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';

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

// ================================================== fixtures + wire fakes

const MI_PER_DEG_LAT = 69.0937;
const START_POS: LatLng = { lat: 35.0, lng: -85.0 };
const DEST: LatLng = { lat: 35.0 + 6 / MI_PER_DEG_LAT, lng: -85.0 };

// Unbiased-mode candidates: the server STRIPS straight-line distances
// when no origin travels (they would be measured from the documented
// CONUS center, not from the truck), so the wire carries null.
const PLACE_A: DestinationCandidate = {
  id: 'here:pilot-ringgold',
  title: 'Pilot Travel Center',
  address: '3151 Battlefield Pkwy, Ringgold, GA 30736',
  position: DEST,
  facility: 'truck-stop',
  distanceMi: null,
};
const PLACE_B: DestinationCandidate = {
  id: 'here:loves-chatt',
  title: "Love's Travel Stop",
  address: '2600 S Market St, Chattanooga, TN 37408',
  position: DEST,
  facility: 'truck-stop',
  distanceMi: null,
};

function wireRoute(warnings: string[] = []) {
  const geometry: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    geometry.push([START_POS.lat + (i * 0.05) / MI_PER_DEG_LAT, START_POS.lng]);
  }
  return {
    ok: true,
    state: warnings.length > 0 ? 'valid-with-warning' : 'valid',
    warnings,
    route: {
      routeId: 'map-search-clean',
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

const SEARCH_INPUT_LABEL = 'Search for a destination by address, business, truck stop, or city';

type GeoMode = 'granted' | 'prompt' | 'denied';
type Harness = {
  renderer: ReactTestRenderer;
  emitFix: (over?: Partial<{ lat: number; lng: number; mph: number }>) => Promise<void>;
  emitError: (kind: 'denied' | 'unavailable' | 'timeout') => Promise<void>;
  settle: () => Promise<void>;
  advance: (ms: number) => Promise<void>;
  grant: () => void;
  watchCalls: () => number;
  text: () => string;
  searchInput: () => any | null;
  type: (value: string) => Promise<void>;
  pickResult: (title: string) => Promise<void>;
  tap: (label: string) => Promise<void>;
  unmount: () => Promise<void>;
};

async function mount(mode: GeoMode): Promise<Harness> {
  spoken = [];
  pendingUtterances = [];
  routeCallLog = [];
  searchCallLog = [];
  intervals.clear();
  timeouts.clear();

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

  const advance = async (ms: number) => {
    await act(async () => {
      virtualNow += ms;
      fireDueTimeouts();
      fireDueIntervals();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const settle = async () => {
    await advance(1000);
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

  const searchInput = () => {
    const hits = renderer.root.findAll(
      (n) => n.type === 'input' && n.props['aria-label'] === SEARCH_INPUT_LABEL,
    );
    return hits.length === 0 ? null : hits[0];
  };

  const find = (label: string) => {
    /*
     * EXACT match, with one alias. The idle control was renamed 'Start'
     * → 'Start Route' in the pre-trip setup milestone, so the scenarios
     * below that ask for 'Start' still mean that button.
     *
     * Deliberately NOT a prefix match: 'Start navigation' on the briefing
     * and 'Start with full clocks' in the clock editor both begin with
     * 'Start', and a scenario that meant one must never silently tap
     * another.
     */
    const wanted = label === 'Start' ? ['Start', 'Start Route'] : [label];
    const hits = renderer.root.findAll(
      (n) =>
        n.type === 'button' &&
        (String(n.props['aria-label'] ?? '').includes(label) || wanted.includes(textOf(n).trim())),
    );
    if (hits.length === 0) throw new Error(`button not found: ${label}`);
    return hits[0];
  };

  return {
    renderer,
    emitFix: async (over = {}) => {
      await act(async () => {
        virtualNow += 1000;
        fireDueTimeouts();
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
    advance,
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
    searchInput,
    type: async (value: string) => {
      const input = searchInput();
      if (input === null) throw new Error('search input not mounted');
      await act(async () => {
        input.props.onChange({ target: { value } });
        await Promise.resolve();
      });
    },
    pickResult: async (title: string) => {
      const hits = renderer.root.findAll(
        (n) =>
          n.type === 'button' && textOf(n).includes(title) && textOf(n).includes('›') === false,
      );
      // The whole card is the button; its text carries the title.
      const cards = renderer.root.findAll((n) => n.type === 'button' && textOf(n).includes(title));
      const card = (hits[0] ?? cards[0]) as any;
      if (!card) throw new Error(`result card not found: ${title}`);
      await act(async () => {
        card.props.onClick();
        await Promise.resolve();
      });
    },
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

function pilotState(h: Harness): string | null {
  const m = h
    .text()
    .match(
      /Pilot trip state: (route ready|final approach|off route|rerouting|navigating|planning|arrived|completed|idle)/,
    );
  return m ? m[1] : null;
}

async function main(): Promise<void> {
  // ------------- 1+2+3+4+5+7: the whole parked search flow, pre-permission
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    searchResponder = () => ({ status: 200, payload: { ok: true, places: [PLACE_A] } });
    const h = await mount('prompt');
    await h.settle(); // flush mount effects; the standard truck needs no confirm tap

    check('parked: the search renders at a cold start', h.searchInput() !== null);
    check(
      'parked: the honest unbiased hint shows before location exists',
      h.text().includes("Location hasn't started yet"),
    );
    check(
      'parked: the empty state tells the driver where the search IS',
      h.text().includes('Search for a destination on the map above'),
    );

    // Typing requests NOTHING — not location, not a route, and not even a
    // search until the debounce elapses. Retyping inside the window is
    // still one request.
    await h.type('pil');
    await h.advance(100);
    await h.type('pilot');
    await h.advance(100);
    await h.type('pilot ringgold');
    check('typing: no search request before the debounce', searchCallLog.length === 0);
    check('typing: no GPS watch was requested by typing', h.watchCalls() === 0);
    await h.advance(350);
    check(
      'typing: retypes inside the debounce collapse to ONE search request',
      searchCallLog.length === 1,
      searchCallLog,
    );
    check(
      'typing: the pre-permission search travels with NO origin (unbiased mode)',
      searchCallLog.length === 1 && !searchCallLog[0].includes('lat='),
      searchCallLog,
    );
    check('typing: still no GPS watch after the search fired', h.watchCalls() === 0);
    check('typing: no route request either — planning waits for Start', routeCallLog.length === 0);

    // Results: name + address, never an invented distance.
    const withResults = h.text();
    check('results: place name shown', withResults.includes('Pilot Travel Center'));
    check('results: postal address shown', withResults.includes('3151 Battlefield Pkwy'));
    check(
      'results: no distance line when the wire carried none',
      !withResults.includes('mi away') && !withResults.includes('≈'),
    );

    // Selecting updates the chosen destination beside Start.
    await h.pickResult('Pilot Travel Center');
    check(
      'pick: the chosen destination is confirmed beside Start',
      h.text().includes('Destination:') && h.text().includes('Pilot Travel Center'),
    );
    check(
      'pick: the result list is gone once a place is chosen',
      h.renderer.root.findAll((n) => n.props?.['aria-label'] === 'Destination search results')
        .length === 0,
    );

    // Editing the text drops the pick — one source of truth.
    searchResponder = () => ({ status: 200, payload: { ok: true, places: [PLACE_B] } });
    await h.type('loves chattanooga');
    check(
      'edit: typing again clears the previous pick',
      h.text().includes('Search for a destination on the map above'),
    );
    await h.advance(350);
    check('edit: the new query spent exactly one more request', searchCallLog.length === 2);
    await h.pickResult("Love's Travel Stop");
    check('edit: the replacement pick is confirmed', h.text().includes("Love's Travel Stop"));

    // ONE Start tap → permission → fix → exactly one plan to the SEARCHED
    // place → navigating, with the search gone from the live surface.
    await h.tap('Start');
    check('start: the tap started the ONE GPS watch', h.watchCalls() === 1);
    const duringAttempt = h.searchInput();
    check(
      'start: the search refuses edits while the attempt runs',
      duringAttempt !== null && duringAttempt.props.disabled === true,
    );
    h.grant();
    await h.emitFix();
    await h.settle();
    check('start: navigating', pilotState(h) === 'navigating', pilotState(h));
    check('start: exactly one route request', routeCallLog.length === 1, routeCallLog.length);
    check(
      'start: the plan went to the SEARCHED destination',
      routeCallLog.length === 1 &&
        Math.abs(routeCallLog[0].body.destination.lat - DEST.lat) < 1e-9 &&
        Math.abs(routeCallLog[0].body.destination.lng - DEST.lng) < 1e-9,
      routeCallLog.map((c) => c.body.destination),
    );
    check(
      'navigating: NO search input on the live surface (no keyboard can open)',
      h.searchInput() === null,
    );
    check(
      'navigating: the search prompt is gone from the screen entirely',
      !h.text().includes('Where are you going?'),
    );
    await h.unmount();
  }

  // ------------- 5: five rapid Start taps on a searched destination -------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    searchResponder = () => ({ status: 200, payload: { ok: true, places: [PLACE_A] } });
    const h = await mount('granted');
    await h.settle(); // flush mount effects; the standard truck needs no confirm tap
    await h.type('pilot ringgold');
    await h.advance(350);
    await h.pickResult('Pilot Travel Center');
    await h.tap('Start');
    for (let i = 0; i < 4; i++) {
      try {
        await h.tap('Start');
      } catch {
        /* button may legitimately be gone already */
      }
    }
    check('rapid: five taps, ONE watch', h.watchCalls() === 1, h.watchCalls());
    await h.emitFix();
    await h.settle();
    check('rapid: five taps, ONE route request', routeCallLog.length === 1, routeCallLog.length);
    check('rapid: navigating', pilotState(h) === 'navigating', pilotState(h));
    await h.unmount();
  }

  // ------------- 6: Cancel re-enables the search, nothing spent ------------
  {
    routeResponder = () => ({ status: 200, payload: wireRoute() });
    searchResponder = () => ({ status: 200, payload: { ok: true, places: [PLACE_A] } });
    const h = await mount('prompt');
    await h.settle(); // flush mount effects; the standard truck needs no confirm tap
    await h.type('pilot ringgold');
    await h.advance(350);
    await h.pickResult('Pilot Travel Center');
    await h.tap('Start');
    check(
      'cancel: search disabled while locating',
      h.searchInput() !== null && h.searchInput().props.disabled === true,
    );
    await h.tap('Cancel');
    check(
      'cancel: search enabled again after Cancel',
      h.searchInput() !== null && h.searchInput().props.disabled !== true,
    );
    check('cancel: no route request was ever made', routeCallLog.length === 0);
    check(
      'cancel: the pick survives the cancelled attempt',
      h.text().includes('Pilot Travel Center'),
    );
    await h.unmount();
  }

  // ------------- 8: MOVING locks the field; GPS loss keeps it locked ------
  {
    // The plan fails (500) so the truck ends up MOVING with no trip: the
    // exact state where a parked-page text field would be a hazard.
    routeResponder = () => ({ status: 500, payload: { ok: false } });
    searchResponder = () => ({ status: 200, payload: { ok: true, places: [PLACE_A] } });
    const h = await mount('granted');
    await h.settle(); // flush mount effects; the standard truck needs no confirm tap
    await h.type('pilot ringgold');
    await h.advance(350);
    await h.pickResult('Pilot Travel Center');
    await h.tap('Start');
    for (let i = 0; i <= 11; i++) {
      await h.emitFix({ mph: 40, lat: START_POS.lat + i * 0.0002 });
    }
    await h.settle();
    check('moving: no trip is running (the plan failed)', pilotState(h) === null, pilotState(h));
    /*
     * THE OWNER REVERSED THIS (NAV-ENTRY-1). The field used to vanish at
     * speed and be replaced by a locked row offering PASSENGER ACCESS. A
     * driver whose plan just failed at 40 mph is exactly the person who needs
     * to fix their destination — at the next stop, with a reminder that says
     * so — and taking the control away did not stop them, it only made them
     * use the passenger declaration to get it back.
     */
    check('moving: the text field is STILL THERE', h.searchInput() !== null);
    check(
      'moving: and nothing offers a passenger declaration to get it back',
      h.renderer.root.findAll(
        (n) => n.type === 'button' && /passenger/i.test(String(n.props['aria-label'] ?? '')),
      ).length === 0,
    );

    // GPS loss AFTER established motion: the app cannot see the truck. It
    // says so elsewhere; it does not take the driver's destination away.
    await h.emitError('unavailable');
    await h.settle();
    check('gps-loss: the field survives a position lost after motion', h.searchInput() !== null);
    await h.unmount();
  }

  // ------------- 9: structural rails for the overlay itself ----------------
  {
    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    const search = readFileSync('src/components/navigator/DestinationSearch.tsx', 'utf8');
    check(
      'structure: the overlay clears Leaflet panes (400) and sits under its controls (1000)',
      screen.includes('z-[500]'),
    );
    check(
      'structure: the wrapper passes touches through; only the card catches them',
      screen.includes('pointer-events-none absolute inset-0 z-[500]') &&
        screen.includes('pointer-events-auto'),
    );
    check(
      'structure: a long result list scrolls inside the map box instead of clipping',
      screen.includes('max-h-full overflow-y-auto'),
    );
    check(
      'structure: the input never autofocuses (no keyboard auto-open)',
      !search.includes('autoFocus'),
    );
    check(
      'structure: the map search rides the EXISTING edit-destination lock class',
      /mapSearchSlot=\{[\s\S]{0,600}action="edit-destination"/.test(screen),
    );
    check(
      'structure: the search only mounts parked and idle',
      screen.includes("pilot.active && !fullScreen && lcState === 'idle'"),
    );
    check(
      'structure: the attempt disable is wired from the controls, not re-derived',
      screen.includes('onAttemptActive={setStartPending}') &&
        screen.includes('disabled={startPending}'),
    );
  }

  console.log(`navigator-map-search: ${passed} passed, ${failed} failed`);
  // Explicit exit: the shimmed environment can leave a live handle behind
  // after the final unmount (same rationale as the startup harness).
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('HARNESS ERROR:', err);
  process.exit(1);
});
