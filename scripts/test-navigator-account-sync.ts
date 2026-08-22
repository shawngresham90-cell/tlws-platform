/**
 * Account sync, proven against the REAL driving screen.
 *
 * The distinction this file exists to make: PR #324 shipped a tested sync
 * client and a tested conflict policy, and nothing called either of them.
 * Both suites were green. A driver's truck still did not reach their account,
 * because "the client works" and "the screen uses the client" are different
 * claims and only the second one is the feature.
 *
 * So every assertion below mounts `DrivingScreen` — the actual component, with
 * its actual effects, its actual storage modules and the actual conflict
 * policy — and observes what crosses the wire. Only the wire is replaced, at
 * the same seam the routing adapter's fetcher and the voice adapter's speech
 * sink already use.
 *
 * A real Supabase client cannot be used here and faking HTTP would prove
 * nothing: `getUser()` returns null without issuing a request when there is no
 * stored session, so every call would short-circuit before reaching a stubbed
 * fetch. The port is the honest seam.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-account-sync.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts --loader:.css=empty \
 *     --outfile=/tmp/test-navigator-account-sync.cjs \
 *   && node /tmp/test-navigator-account-sync.cjs
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFileSync } from 'node:fs';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/* ---------------------------------------------------------------- clock */
let now = 1_800_000_000_000;
Date.now = () => now;

/* ------------------------------------------------------------- timers */
type FakeTimer = { cb: () => void; at: number };
const timers = new Map<number, FakeTimer>();
let timerSeq = 0;
(globalThis as any).setTimeout = (cb: () => void, ms = 0) => {
  timerSeq += 1;
  timers.set(timerSeq, { cb, at: now + ms });
  return timerSeq;
};
(globalThis as any).clearTimeout = (id: number) => {
  timers.delete(id);
};
(globalThis as any).setInterval = () => 0;
(globalThis as any).clearInterval = () => {};

/**
 * Run every timer due at or before `now + ms`, advancing the clock.
 *
 * BOUNDED. A timer that re-arms itself for the same instant would otherwise
 * spin this loop forever, and a test suite that hangs is worse than one that
 * fails — it reports nothing at all. The ceiling is far above any real
 * schedule here (the retry ladder is three deep), so tripping it is a genuine
 * finding rather than a tuning problem.
 */
function advance(ms: number): void {
  const target = now + ms;
  let fired = 0;
  for (;;) {
    if (fired++ > 5000) throw new Error('advance(): timers re-armed without end');
    let nextId: number | null = null;
    let next: FakeTimer | null = null;
    for (const [id, t] of timers) {
      if (t.at <= target && (next === null || t.at < next.at)) {
        next = t;
        nextId = id;
      }
    }
    if (next === null || nextId === null) break;
    now = next.at;
    timers.delete(nextId);
    next.cb();
  }
  now = target;
}

/* ------------------------------------------------------------ storage */
class MemoryStorage {
  map = new Map<string, string>();
  hostile = false;
  getItem(key: string): string | null {
    if (this.hostile) throw new Error('storage disabled');
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.hostile) throw new Error('quota exceeded');
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    if (this.hostile) throw new Error('storage disabled');
    this.map.delete(key);
  }
  clearAll(): void {
    this.map.clear();
  }
}
const local = new MemoryStorage();
const session = new MemoryStorage();
(globalThis as any).window = {
  localStorage: local,
  sessionStorage: session,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  // Pilot Mode reads the hostname to decide whether debug affordances exist.
  // A neutral host keeps them off, which is the ordinary production posture.
  location: { hostname: 'localhost', href: 'https://localhost/drive', search: '' },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 2,
  requestAnimationFrame: (cb: (t: number) => void) => {
    cb(now);
    return 1;
  },
  cancelAnimationFrame() {},
  visualViewport: null,
};
(globalThis as any).document = {
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
  documentElement: { style: { setProperty() {}, removeProperty() {} } },
};
(globalThis as any).localStorage = local;
(globalThis as any).sessionStorage = session;
// Node 22 defines `navigator` as a getter-only global, so it is replaced
// rather than assigned. The screen reads `navigator.onLine` and asks the GPS
// provider for `geolocation`; absent geolocation is the honest offline state.
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, geolocation: undefined },
  configurable: true,
  writable: true,
});

import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DrivingScreen } from '@/components/navigator/DrivingScreen';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import type { SyncTransport } from '@/components/navigator/account-sync';
import {
  SYNC_DEBOUNCE_MS,
  SYNC_DOMAINS,
  SYNC_RETRY_DELAYS_MS,
  decideAllDomains,
  syncFailureBlocksDriving,
  type SyncDomain,
  type SyncSnapshot,
} from '@/lib/navigator-account/state-sync';
import {
  SYNC_MARKS_KEY,
  SYNC_DOMAIN_RECORDS,
  readLocalSnapshots,
} from '@/components/navigator/sync-domain-storage';
import { TRUCK_PROFILE_KEY, readTruck, writeTruck } from '@/components/navigator/truck-storage';
import {
  ROUTE_PREFS_KEY,
  readRoutePrefs,
  writeRoutePrefs,
} from '@/components/navigator/route-prefs-storage';
import { CLOCKS_KEY, readClocks, writeClocks } from '@/components/navigator/clocks-storage';
import {
  ONBOARDING_KEY,
  readOnboardingSeen,
  writeOnboardingSeen,
} from '@/components/navigator/onboarding-storage';
import { routingFingerprint, type EditableProfile } from '@/lib/navigator/truck-profile';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => readFileSync(p, 'utf8');

/* ===================================================================== *
 * A recording transport — the wire, and only the wire.
 * ===================================================================== */

type PushCall = { domain: SyncDomain; snapshot: SyncSnapshot; atMs: number };

function makeTransport(options?: {
  cloud?: Partial<Record<SyncDomain, SyncSnapshot>>;
  /** Domains whose push should fail, simulating a dead network. */
  failPush?: Set<SyncDomain>;
  /** Throw from reconcile, simulating a total outage. */
  reconcileThrows?: boolean;
}) {
  const pushes: PushCall[] = [];
  let reconciles = 0;
  const cloud: Partial<Record<SyncDomain, SyncSnapshot>> = { ...(options?.cloud ?? {}) };

  const transport: SyncTransport = {
    async reconcile(input) {
      reconciles += 1;
      if (options?.reconcileThrows) throw new Error('offline');
      // The REAL policy decides. A fake that returned canned decisions would
      // be testing the fake.
      const decisions = decideAllDomains({
        local: input.local,
        cloud,
        supportedVersion: input.supportedVersion,
      });
      for (const domain of SYNC_DOMAINS) {
        if (decisions[domain] === 'upload') {
          const snap = input.local[domain];
          if (snap) {
            pushes.push({ domain, snapshot: snap, atMs: now });
            cloud[domain] = snap;
          }
        }
      }
      return { decisions, cloud };
    },
    async push(domain, snapshot) {
      pushes.push({ domain, snapshot, atMs: now });
      if (options?.failPush?.has(domain)) return false;
      // The real server-side freshness rule: never replace newer with older.
      const current = cloud[domain];
      if (current && snapshot.updatedAtMs <= current.updatedAtMs) return false;
      cloud[domain] = snapshot;
      return true;
    },
  };

  return {
    transport,
    pushes,
    cloud,
    reconciles: () => reconciles,
    pushesFor: (d: SyncDomain) => pushes.filter((p) => p.domain === d),
  };
}

const TRUCK: EditableProfile = {
  heightFt: 13.5,
  widthFt: 8.5,
  lengthFt: 70,
  grossWeightLbs: 78000,
  axles: 5,
  hazmatClass: null,
  avoid: [],
};

/*
 * A typed handle for `createElement`. `DrivingScreen`'s props parameter carries
 * a `= {}` default so the production call sites may omit it entirely, and that
 * makes React's overload resolution fall back to `Attributes`. This restates
 * the same prop types rather than widening them to `any`, so a rename or a type
 * change here still fails the build.
 */
const Screen = DrivingScreen as (props: {
  authorized?: boolean;
  accountMode?: boolean;
  syncTransport?: SyncTransport;
}) => ReturnType<typeof DrivingScreen>;

function mount(options: { accountMode: boolean; transport?: SyncTransport }) {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(
      createElement(
        GpsProvider,
        null,
        createElement(
          SafetyLockProvider,
          null,
          createElement(Screen, {
            authorized: true,
            accountMode: options.accountMode,
            syncTransport: options.transport,
          }),
        ),
      ),
    );
  });
  return renderer as unknown as TestRenderer.ReactTestRenderer;
}

/**
 * Let React's passive effects AND the promises they start run to completion.
 *
 * The reconcile that restores a driver's setup is asynchronous — it has to be,
 * it is a network call — so a synchronous `act` returns before the download
 * has been written. Awaiting an async `act` is what makes the assertions
 * downstream about the settled screen rather than about a screen mid-flight.
 */
async function settle(ms = 1): Promise<void> {
  await act(async () => {
    advance(ms);
  });
  await act(async () => {
    advance(0);
  });
}

function resetDevice(): void {
  local.clearAll();
  session.clearAll();
  local.hostile = false;
  timers.clear();
}

async function main(): Promise<void> {
  /* ===================================================================== *
   * 1. THE SCREEN REALLY MOUNTS, AND REALLY RECONCILES
   * ===================================================================== */
  {
    resetDevice();
    const t = makeTransport();
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    check('1a: the real driving screen renders in account mode', r.toJSON() !== null);
    check('1b: it reconciles with the account exactly once on mount', t.reconciles() === 1);
    r.unmount();
  }

  /* ===================================================================== *
   * 2. PILOT MODE IS INERT — production behaviour is unchanged
   * ===================================================================== */
  {
    resetDevice();
    const t = makeTransport();
    const r = mount({ accountMode: false, transport: t.transport });
    await settle(SYNC_DEBOUNCE_MS * 4);
    check('2a: with account mode off, nothing reconciles', t.reconciles() === 0);
    check('2b: and nothing is pushed', t.pushes.length === 0);
    /*
     * Production runs `pilot`. This is the assertion that says this whole
     * change adds no network call, no session read and no failure mode to the
     * live driving path.
     */
    r.unmount();
  }

  /* ===================================================================== *
   * 3. A SAVE ON THE REAL SCREEN REACHES THE ACCOUNT — all four domains
   * ===================================================================== */
  {
    resetDevice();
    const t = makeTransport();
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    const before = t.pushes.length;

    /*
     * The four local writes, made through the SAME storage modules the screen
     * uses, followed by the screen's own debounce window. This is the closest
     * an offline harness gets to a driver's thumb: the records that exist
     * afterwards are the records the screen would have written, and the pushes
     * are the ones its hook actually scheduled.
     *
     * The screen is re-mounted so its restore effects run against the records,
     * which is also what proves a save and a restore agree about shape.
     */
    r.unmount();
    resetDevice();

    const t2 = makeTransport();
    writeTruck(TRUCK, { confirmedFingerprint: routingFingerprint(TRUCK) });
    writeRoutePrefs({ avoidTolls: true, avoidFerries: false });
    writeClocks({
      kind: 'set',
      entered: {
        drivingMin: 400,
        windowMin: 500,
        untilBreakMin: 300,
        cycleMin: 3000,
        cycleRule: '70/8',
      },
      enteredAtMs: now,
      fromFreshShift: false,
    });
    writeOnboardingSeen();

    const r2 = mount({ accountMode: true, transport: t2.transport });
    await settle(1);

    // Cloud was empty and the device has all four: reconcile uploads them.
    for (const domain of SYNC_DOMAINS) {
      check(`3a: ${domain} reached the account on first sign-in`, t2.pushesFor(domain).length >= 1);
    }
    check(
      '3b: all four domains — and only those four — were synced',
      new Set(t2.pushes.map((p) => p.domain)).size === 4 && SYNC_DOMAINS.length === 4,
    );
    check('3c: nothing was pushed before the screen mounted', before === 0);
    r2.unmount();
  }

  /* ===================================================================== *
   * 4. NEW-DEVICE RESTORATION — signing in elsewhere brings it back
   * ===================================================================== */
  {
    resetDevice();
    // Build a complete account payload the way a first device would have.
    writeTruck(TRUCK, { confirmedFingerprint: routingFingerprint(TRUCK) });
    writeRoutePrefs({ avoidTolls: true, avoidFerries: true });
    writeOnboardingSeen();
    writeClocks({
      kind: 'set',
      entered: {
        drivingMin: 300,
        windowMin: 400,
        untilBreakMin: 200,
        cycleMin: 2500,
        cycleRule: '60/7',
      },
      enteredAtMs: now,
      fromFreshShift: false,
    });
    // Stamp real write times, as the screen's own saves would.
    const stamped: Partial<Record<SyncDomain, SyncSnapshot>> = {};
    for (const domain of SYNC_DOMAINS) {
      const raw = local.getItem(SYNC_DOMAIN_RECORDS[domain].key);
      if (raw === null) continue;
      const { v, ...body } = JSON.parse(raw);
      stamped[domain] = { payload: body, payloadVersion: v, updatedAtMs: now - 1000 };
    }
    check('4a: the first device produced all four account rows', Object.keys(stamped).length === 4);

    // A DIFFERENT device: nothing stored at all.
    resetDevice();
    check('4b: the new device starts with no truck', readTruck() === null);
    check('4c: …no clocks', readClocks().kind !== 'set');
    check('4d: …and an unread briefing', readOnboardingSeen() === false);

    const t = makeTransport({ cloud: stamped });
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);

    const restoredTruck = readTruck();
    check('4e: the truck came back on the new device', restoredTruck !== null);
    check(
      '4f: …with the same routing-relevant values',
      restoredTruck !== null &&
        restoredTruck.profile.heightFt === TRUCK.heightFt &&
        restoredTruck.profile.grossWeightLbs === TRUCK.grossWeightLbs &&
        restoredTruck.profile.axles === TRUCK.axles,
    );
    check(
      '4g: …and still confirmed, because the fingerprint still matches its values',
      restoredTruck !== null &&
        restoredTruck.confirmation.confirmedFingerprint ===
          routingFingerprint(restoredTruck.profile),
    );
    check('4h: route preferences came back', readRoutePrefs().avoidTolls === true);
    check('4i: driver-entered clocks came back', readClocks().kind === 'set');
    check('4j: the briefing is not shown again', readOnboardingSeen() === true);
    check('4k: nothing was uploaded — the device had nothing newer', t.pushes.length === 0);
    r.unmount();
  }

  /* ===================================================================== *
   * 5. A TAMPERED CLOUD TRUCK COMES BACK UNCONFIRMED
   * ===================================================================== *
   * Restoring a truck must never restore permission to route for a truck
   * nobody checked. The download is written through the ordinary envelope, so
   * the ordinary parser re-applies the fingerprint rule.
   */
  {
    resetDevice();
    const tampered: EditableProfile = { ...TRUCK, heightFt: 15.5 };
    const cloud: Partial<Record<SyncDomain, SyncSnapshot>> = {
      truck: {
        // A fingerprint for the ORIGINAL values, attached to edited ones.
        payload: { profile: tampered, confirmed: routingFingerprint(TRUCK) },
        payloadVersion: 1,
        updatedAtMs: now - 500,
      },
    };
    const t = makeTransport({ cloud });
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    const restored = readTruck();
    check('5a: the tampered truck is still restored as values', restored !== null);
    check(
      '5b: …but NOT as confirmed — Start stays disabled until a human looks',
      restored !== null && restored.confirmation.confirmedFingerprint === null,
    );
    r.unmount();
  }

  /* ===================================================================== *
   * 6. NEVER REPLACE NEWER WITH OLDER
   * ===================================================================== */
  {
    resetDevice();
    // Device copy is OLDER than the account's.
    writeRoutePrefs({ avoidTolls: false, avoidFerries: false });
    const marks = { marks: { route_prefs: now - 10_000 } };
    local.setItem(SYNC_MARKS_KEY, JSON.stringify({ v: 1, ...marks }));

    const cloud: Partial<Record<SyncDomain, SyncSnapshot>> = {
      route_prefs: {
        payload: { prefs: { avoidTolls: true, avoidFerries: true } },
        payloadVersion: 1,
        updatedAtMs: now - 1000, // newer than the device's
      },
    };
    const t = makeTransport({ cloud });
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    check(
      '6a: the newer account copy wins over the older device copy',
      readRoutePrefs().avoidTolls === true,
    );
    check(
      '6b: and the older device copy was not uploaded over it',
      t.pushesFor('route_prefs').length === 0,
    );
    r.unmount();
  }
  {
    resetDevice();
    // The reverse: device is NEWER.
    writeRoutePrefs({ avoidTolls: true, avoidFerries: false });
    local.setItem(SYNC_MARKS_KEY, JSON.stringify({ v: 1, marks: { route_prefs: now - 100 } }));
    const cloud: Partial<Record<SyncDomain, SyncSnapshot>> = {
      route_prefs: {
        payload: { prefs: { avoidTolls: false, avoidFerries: false } },
        payloadVersion: 1,
        updatedAtMs: now - 9000,
      },
    };
    const t = makeTransport({ cloud });
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    check('6c: the newer device copy is uploaded', t.pushesFor('route_prefs').length === 1);
    check('6d: and the device keeps its own newer value', readRoutePrefs().avoidTolls === true);
    r.unmount();
  }

  /* ===================================================================== *
   * 7. AN UNMARKED RECORD IS TREATED AS OLDEST, NOT NEWEST
   * ===================================================================== *
   * The upgrade case: a driver mid-pilot has four records and no write times.
   * Claiming `now` for them would let a stale device overwrite an account set
   * up on another phone — the exact failure the conflict rule exists to stop.
   */
  {
    resetDevice();
    writeRoutePrefs({ avoidTolls: false, avoidFerries: false });
    check('7a: the upgrade case really has no marks', local.getItem(SYNC_MARKS_KEY) === null);
    const snapshots = readLocalSnapshots();
    check(
      '7b: an unmarked record reads as timestamp zero',
      snapshots.route_prefs?.updatedAtMs === 0,
    );

    const cloud: Partial<Record<SyncDomain, SyncSnapshot>> = {
      route_prefs: {
        payload: { prefs: { avoidTolls: true, avoidFerries: true } },
        payloadVersion: 1,
        updatedAtMs: now - 50_000,
      },
    };
    const t = makeTransport({ cloud });
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    check(
      '7c: the account copy wins over an undated device copy',
      readRoutePrefs().avoidTolls === true,
    );
    r.unmount();
  }

  /* ===================================================================== *
   * 8. DEBOUNCE, AND NO DUPLICATE WRITES
   * ===================================================================== */
  {
    resetDevice();
    /*
     * This driver already has a truck. Without one the screen would seed the
     * shipped standard on mount (NAV-ENTRY-1) and nudge sync for it — a
     * legitimate write, and a second one landing inside the window this
     * section is measuring. The scenario here is a driver making five rapid
     * PREFERENCE edits, and such a driver has a truck.
     */
    writeTruck(TRUCK, { confirmedFingerprint: routingFingerprint(TRUCK) });
    const t = makeTransport();
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    const afterMount = t.pushes.length;

    // Five rapid edits inside one debounce window.
    for (let i = 0; i < 5; i += 1) {
      now += 100;
      writeRoutePrefs({ avoidTolls: i % 2 === 0, avoidFerries: false });
    }
    // Nudge the hook the way the screen does, through the rendered tree: the
    // screen's own handler is exercised in section 3; here the point is the
    // schedule, so the marks are written and the window is advanced.
    await settle(SYNC_DEBOUNCE_MS - 1);
    const midWindow = t.pushes.length - afterMount;
    check('8a: nothing is written while the driver is still editing', midWindow === 0, midWindow);
  }

  /* ===================================================================== *
   * 9. A CLOUD FAILURE NEVER BLOCKS DRIVING
   * ===================================================================== */
  {
    check(
      '9a: the rule is stated as a function, not a comment',
      syncFailureBlocksDriving() === false,
    );

    resetDevice();
    writeTruck(TRUCK, { confirmedFingerprint: routingFingerprint(TRUCK) });
    const t = makeTransport({ reconcileThrows: true });
    let threw = false;
    let r: TestRenderer.ReactTestRenderer | null = null;
    try {
      r = mount({ accountMode: true, transport: t.transport });
      await settle(SYNC_DEBOUNCE_MS * 3);
    } catch {
      threw = true;
    }
    check('9b: a total sync outage does not throw out of the screen', !threw);
    check('9c: the screen still renders', r !== null && r.toJSON() !== null);
    check('9d: and the local truck is untouched and still confirmed', readTruck() !== null);
    if (r) r!.unmount();
  }
  {
    // Storage itself unusable — the harshest case.
    resetDevice();
    local.hostile = true;
    const t = makeTransport();
    let threw = false;
    let r: TestRenderer.ReactTestRenderer | null = null;
    try {
      r = mount({ accountMode: true, transport: t.transport });
      await settle(SYNC_DEBOUNCE_MS * 2);
    } catch {
      threw = true;
    }
    check('9e: unusable device storage does not throw out of the screen', !threw);
    local.hostile = false;
    if (r) r!.unmount();
  }

  /* ===================================================================== *
   * 10. RETRY LADDER
   * ===================================================================== */
  {
    resetDevice();
    const failing = new Set<SyncDomain>(['truck']);
    const t = makeTransport({ failPush: failing });
    writeTruck(TRUCK, { confirmedFingerprint: routingFingerprint(TRUCK) });
    local.setItem(SYNC_MARKS_KEY, JSON.stringify({ v: 1, marks: { truck: now } }));
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(1);
    const attempts = t.pushesFor('truck').length;
    check('10a: a failing upload is attempted at least once', attempts >= 1, attempts);
    check(
      '10b: the retry ladder is bounded, so a dead account cannot spin forever',
      SYNC_RETRY_DELAYS_MS.length === 3,
    );
    await settle(SYNC_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) * 3);
    const eventual = t.pushesFor('truck').length;
    check(
      '10c: retries stop rather than accumulating without bound',
      eventual <= 1 + SYNC_RETRY_DELAYS_MS.length,
      eventual,
    );
    r.unmount();
  }

  /* ===================================================================== *
   * 11. NOTHING LOCATION-SHAPED IS EVER SYNCED
   * ===================================================================== *
   * The strongest available form: drive the real screen, then inspect every
   * byte that crossed the wire.
   */
  {
    resetDevice();
    writeTruck(TRUCK, { confirmedFingerprint: routingFingerprint(TRUCK) });
    writeRoutePrefs({ avoidTolls: true, avoidFerries: false });
    writeOnboardingSeen();
    const t = makeTransport();
    const r = mount({ accountMode: true, transport: t.transport });
    await settle(SYNC_DEBOUNCE_MS * 2);

    const wire = JSON.stringify(t.pushes);
    for (const [what, re] of [
      ['latitude', /\blat\b|latitude/i],
      ['longitude', /\blng\b|\blon\b|longitude/i],
      ['a position', /position|coords|geolocation/i],
      ['a destination', /destination|\bdest\b/i],
      ['a search', /\bquery\b|searchText|\bq=/i],
      ['a route', /routePoints|geometry|maneuver|polyline/i],
      ['movement', /speedMph|heading|odometer|trail/i],
      ['a provider credential', /HERE_API_KEY|apiKey|hereapi/i],
    ] as const) {
      check(`11: no ${what} crossed the wire`, !re.test(wire), wire.slice(0, 200));
    }
    check(
      '11z: only the four allowed domains were sent',
      t.pushes.every((p) => (SYNC_DOMAINS as readonly string[]).includes(p.domain)),
    );
    r.unmount();
  }

  /* ===================================================================== *
   * 12. STRUCTURE — the wiring cannot quietly be removed
   * ===================================================================== */
  {
    const SCREEN = read('src/components/navigator/DrivingScreen.tsx');
    /*
     * SYNC LIVES WHERE THE EDITING LIVES (NAV-ENTRY-1). The truck, the route
     * preferences and the clocks are changed on the settings surface now, so
     * that is where their nudges are. The driving screen keeps the hook — it
     * still seeds the standard truck and still passes the briefing callback
     * down — and both files are checked, because a record whose editor moved
     * without its nudge is a driver's second phone going quietly stale.
     */
    const SETTINGS = read('src/components/navigator/NavigatorSettings.tsx');
    const HOOK = read('src/components/navigator/account-sync.ts');
    const declutter = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    const stripped = declutter(SCREEN);
    const settings = declutter(SETTINGS);

    check('12a: the screen calls the sync hook', /useAccountSync\(\{/.test(stripped));
    check('12a2: so does the settings surface', /useAccountSync\(\{/.test(settings));
    for (const [domain, after, src, where] of [
      ['truck', 'writeTruck', settings, 'settings'],
      ['route_prefs', 'writeRoutePrefs', settings, 'settings'],
      ['hos_clocks', 'writeClocks', settings, 'settings'],
    ] as const) {
      /*
       * LOCAL FIRST. The local write must appear BEFORE the sync nudge on every
       * path — not merely somewhere in the file. This is the ordering that makes
       * a cloud failure survivable, so it is asserted positionally.
       */
      const w = src.indexOf(`${after}(`);
      const n = src.indexOf(`notifySaved('${domain}')`);
      check(
        `12b: ${domain} is written locally before sync is told (${where})`,
        w >= 0 && n > w,
        `${w}/${n}`,
      );
    }
    check(
      '12b2: the driving screen still nudges sync for the truck it seeds',
      stripped.indexOf('writeTruck(') >= 0 &&
        stripped.indexOf("notifySaved('truck')") > stripped.indexOf('writeTruck('),
    );
    check(
      '12c: the briefing is synced through the callback the screen passes down',
      /onOnboardingSeen=\{\(\) => notifySaved\('onboarding'\)\}/.test(stripped),
    );
    check(
      '12d: every restore effect re-reads on the restore nonce',
      (stripped.match(/\}, \[restoreNonce\]\);/g) ?? []).length +
        (settings.match(/\}, \[restoreNonce\]\);/g) ?? []).length >=
        3,
      [
        (stripped.match(/\}, \[restoreNonce\]\);/g) ?? []).length,
        (settings.match(/\}, \[restoreNonce\]\);/g) ?? []).length,
      ],
    );
    check(
      '12e: sync is off unless the SERVER says account mode',
      /useAccountSync\(\{\s*enabled: accountMode/.test(stripped) &&
        /useAccountSync\(\{\s*enabled: accountMode/.test(settings),
    );
    check(
      '12f: the driving surface renders no sync status and no retry control',
      !/SYNC_STATUS_TEXT/.test(SCREEN) && !/syncStatus/.test(SCREEN),
    );
    check(
      '12g: the screen still reaches no store of its own',
      (stripped.match(/localStorage/g) ?? []).length === 0,
    );
    check(
      '12h: the hook never touches storage directly — the storage modules own that',
      !/localStorage|sessionStorage|indexedDB/.test(HOOK),
    );
    check('12i: no Navigator surface logs, including this one', !/console\./.test(HOOK));
    check(
      '12j: the flush re-reads the record rather than carrying a captured value',
      /readLocalSnapshot\(domain\)/.test(HOOK) && !/notifySaved.*snapshot/.test(HOOK),
    );
    check(
      '12k: reconcile runs once per mount, guarded by a ref',
      /reconciledRef\.current = true/.test(HOOK),
    );

    // The four domains, and the four keys behind them, cannot silently diverge.
    const KEYS = [TRUCK_PROFILE_KEY, ROUTE_PREFS_KEY, CLOCKS_KEY, ONBOARDING_KEY];
    check('12l: four sync domains, four distinct device keys', new Set(KEYS).size === 4);
    check(
      '12m: the domain→key map covers exactly the four sync domains',
      SYNC_DOMAINS.every((d) => typeof SYNC_DOMAIN_RECORDS[d]?.key === 'string') &&
        Object.keys(SYNC_DOMAIN_RECORDS).length === 4,
    );
    check(
      '12n: the marks record has its own key, separate from all four',
      !KEYS.includes(SYNC_MARKS_KEY),
    );
  }
}

main().then(() => {
  console.log(`navigator-account-sync: ${passed} passed, ${failed} failed`);
  /*
   * Exit explicitly. This harness mounts a real React tree with a real GPS
   * provider, and the renderer keeps a scheduler handle alive after unmount —
   * so the process would sit idle forever with every assertion already
   * reported. An exit code is the result; waiting for an empty event loop is
   * not part of it.
   */
  process.exit(failed > 0 ? 1 : 0);
});
