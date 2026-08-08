/**
 * Failure recovery (10-hour block, P10). Everything the road actually
 * does to a navigation app: the routing provider errors or hangs, the
 * network drops, the route comes back malformed or empty, the phone
 * refuses location or loses it in a tunnel, and the speech engine is
 * missing, broken, or silently never finishes an utterance.
 *
 * The bar is not "does not crash". It is:
 *
 *   - the app never shows progress it does not have,
 *   - every failure is RECOVERABLE — one bad response must not end the
 *     trip or wedge the screen,
 *   - a failed reroute leaves the CURRENT route standing,
 *   - and no failure path can spend the driver's provider budget
 *     faster than the healthy path.
 *
 * Pure and offline: every port is injected, every clock is an argument.
 *
 * Run:
 *   npx esbuild scripts/test-navigation-failure-recovery.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-nav-failure.cjs && node /tmp/test-nav-failure.cjs
 */
import { readFileSync } from 'node:fs';

import { createGpsSession } from '@/lib/navigator/gps-session';
import {
  createNavigationLifecycle,
  type NavigationLifecycle,
  type PlanFetchResult,
} from '@/lib/navigator/navigation-lifecycle';
import type { ReplacementFetchResult } from '@/lib/navigator/reroute-controller';
import {
  createVoiceGuidance,
  STUCK_UTTERANCE_MS,
  type SpeechPort,
} from '@/lib/navigator/voice-guidance';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
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

// -------------------------------------------------------------- fixtures

const T0 = 1_754_000_000_000;
const MI_PER_DEG_LAT = 69.0937;
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

/** A straight 4-mile road sampled every 0.01 mi. */
const ROUTE: LatLng[] = [];
for (let i = 0; i <= 400; i++) ROUTE.push({ lat: 35 + (i * 0.01) / MI_PER_DEG_LAT, lng: -85 });

const DESTINATION: DestinationInfo = {
  position: ROUTE[ROUTE.length - 1],
  facility: 'distribution-center',
  positionSource: 'geocode',
};

/** The success branch, so `{ ...goodPlan(), positions: [] }` still narrows. */
type RoutePlan = Extract<PlanFetchResult, { kind: 'route' }>;

function goodPlan(routeId = 'good'): RoutePlan {
  return {
    kind: 'route',
    routeId,
    positions: ROUTE,
    distanceMiles: 4,
    durationSeconds: 300,
    maneuvers: [
      { action: 'depart', instruction: 'Head north.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: ROUTE.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

type PlanScript = (call: number) => PlanFetchResult | Promise<PlanFetchResult>;

function rig(plan: PlanScript, replace?: (call: number) => Promise<ReplacementFetchResult>) {
  let planCalls = 0;
  let replaceCalls = 0;
  const life = createNavigationLifecycle({
    planPort: async () => plan(++planCalls),
    replacementPort: async () => {
      replaceCalls += 1;
      return replace
        ? replace(replaceCalls)
        : ({ kind: 'failure', reason: 'unscripted' } as ReplacementFetchResult);
    },
  });
  return {
    life,
    planCalls: () => planCalls,
    replaceCalls: () => replaceCalls,
  };
}

function plan(life: NavigationLifecycle, tMs: number) {
  return life.plan(
    {
      origin: ROUTE[0],
      destination: ROUTE[ROUTE.length - 1],
      truck: TRUCK,
      departAtMs: tMs,
    },
    DESTINATION,
    tMs,
  );
}

/** Drive `fixes` seconds up the route from `fromMi` at `speedMph`. */
function driveUp(
  life: NavigationLifecycle,
  gps: ReturnType<typeof createGpsSession>,
  opts: { fromMi: number; speedMph: number; fixes: number; startMs: number; lateralM?: number },
) {
  let mi = opts.fromMi;
  let t = opts.startMs;
  for (let i = 0; i < opts.fixes; i++) {
    const lat = 35 + mi / MI_PER_DEG_LAT;
    const lng =
      -85 + (opts.lateralM ?? 0) / 1609.344 / (MI_PER_DEG_LAT * Math.cos((35 * Math.PI) / 180));
    const state = gps.ingestFix({
      lat,
      lng,
      accuracyM: 8,
      speedMps: opts.speedMph / 2.236936,
      headingDeg: 0,
      tMs: t,
    });
    life.tick(state, t);
    mi += opts.speedMph / 3600;
    t += 1000;
  }
  return t;
}

// ------------------------------------------------------------- speech rig

type SpeechBehavior = 'ok' | 'never-finishes' | 'throws-on-speak' | 'throws-on-cancel' | 'missing';

function speechPort(behavior: SpeechBehavior): SpeechPort & { spoken: string[] } {
  const spoken: string[] = [];
  return {
    supported: behavior !== 'missing',
    spoken,
    speak(text: string, onDone: () => void) {
      if (behavior === 'throws-on-speak') throw new Error('speechSynthesis.speak failed');
      spoken.push(text);
      // 'never-finishes' models the real speechSynthesis bug where an
      // utterance's end event never fires (backgrounded tab, iOS).
      if (behavior !== 'never-finishes') onDone();
    },
    cancel() {
      if (behavior === 'throws-on-cancel') throw new Error('speechSynthesis.cancel failed');
    },
  };
}

async function main() {
  // ------------------------------------------------------- provider errors

  // The plan port throws outright (DNS failure, aborted fetch, a bug in
  // the caller). The lifecycle must land back in idle and stay usable.
  {
    const r = rig((call) => {
      if (call === 1) throw new Error('network down');
      return goodPlan();
    });
    const first = await plan(r.life, T0);
    check('plan throw: refused honestly', first.ok === false, first);
    check('plan throw: back to idle', r.life.state() === 'idle', r.life.state());
    check('plan throw: no route is shown', r.life.view().status === 'no-route');
    check('plan throw: map has no geometry', r.life.mapData().geometry.length === 0);
    const retry = await plan(r.life, T0 + 5000);
    check('plan throw: an immediate retry succeeds', retry.ok === true, retry);
    check('plan throw: retry reached route-ready', r.life.state() === 'route-ready');
    check('plan throw: no lifecycle violations', r.life.violations().length === 0);
  }

  // A clean provider failure (HTTP 5xx, no route found) is the same
  // contract, minus the exception.
  {
    const r = rig((call) =>
      call === 1 ? { kind: 'failure', reason: 'no-route-found' } : goodPlan(),
    );
    const first = await plan(r.life, T0);
    check(
      'plan failure: reason is surfaced verbatim',
      first.ok === false && first.reason === 'no-route-found',
      first,
    );
    check(
      'plan failure: not marked as a refusal',
      first.ok === false && first.refused === false,
      first,
    );
    const retry = await plan(r.life, T0 + 1000);
    check('plan failure: retry succeeds', retry.ok === true);
  }

  // ---------------------------------------------------- bad / empty routes

  const malformed: { name: string; result: PlanFetchResult }[] = [
    { name: 'empty geometry', result: { ...goodPlan(), positions: [] } },
    { name: 'single point', result: { ...goodPlan(), positions: [ROUTE[0]] } },
    {
      name: 'non-finite coordinates',
      result: { ...goodPlan(), positions: [ROUTE[0], { lat: Number.NaN, lng: -85 }, ROUTE[2]] },
    },
    { name: 'zero duration', result: { ...goodPlan(), durationSeconds: 0 } },
    {
      name: 'maneuver outside the geometry',
      result: {
        ...goodPlan(),
        maneuvers: [{ action: 'turn', instruction: 'Turn.', direction: null, offset: 99_999 }],
      },
    },
    {
      name: 'a route the validator would not sign off',
      result: { ...goodPlan(), validationState: 'requires-review' },
    },
    { name: 'missing route id', result: { ...goodPlan(), routeId: '' } },
  ];
  for (const bad of malformed) {
    const r = rig((call) => (call === 1 ? bad.result : goodPlan()));
    const outcome = await plan(r.life, T0);
    check(`bad route (${bad.name}): refused`, outcome.ok === false, outcome);
    check(`bad route (${bad.name}): back to idle`, r.life.state() === 'idle', r.life.state());
    check(
      `bad route (${bad.name}): guidance never started`,
      r.life.view().status === 'no-route' && r.life.mapData().routeId === null,
    );
    check(
      `bad route (${bad.name}): a good route still plans`,
      (await plan(r.life, T0 + 1000)).ok === true,
    );
    check(
      `bad route (${bad.name}): no violations`,
      r.life.violations().length === 0,
      r.life.violations(),
    );
  }

  // A plan still in flight when the driver backs out. The stale response
  // must be dropped, not applied to a screen that moved on.
  {
    let release: (v: PlanFetchResult) => void = () => {};
    const r = rig(() => new Promise<PlanFetchResult>((res) => (release = res)));
    const pending = plan(r.life, T0);
    check('in-flight cancel: lifecycle is planning', r.life.state() === 'planning');
    r.life.cancel(T0 + 500);
    check('in-flight cancel: back to idle immediately', r.life.state() === 'idle');
    release(goodPlan('late'));
    const outcome = await pending;
    check(
      'in-flight cancel: the late response is dropped',
      outcome.ok === false && outcome.reason === 'superseded',
      outcome,
    );
    check('in-flight cancel: still idle', r.life.state() === 'idle');
    check('in-flight cancel: the late route was not loaded', r.life.mapData().routeId === null);
    check('in-flight cancel: no violations', r.life.violations().length === 0);
  }

  // ---------------------------------------------------------- GPS failures

  // Permission denied mid-trip: progress freezes, the screen says so,
  // and nothing advances on the frozen position.
  {
    const r = rig(() => goodPlan());
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const gps = createGpsSession();
    let t = driveUp(r.life, gps, { fromMi: 0, speedMph: 60, fixes: 30, startMs: T0 + 2000 });
    const mileBefore = r.life.view().routeMile ?? 0;
    check('denied: the trip was making progress first', mileBefore > 0.3, mileBefore);

    r.life.tick(gps.ingestError('denied'), t);
    check(
      'denied: the screen says denied',
      r.life.view().status === 'denied',
      r.life.view().status,
    );
    check(
      'denied: progress is frozen, not invented',
      (r.life.view().routeMile ?? 0) === mileBefore,
    );

    // Permission comes back — the driver granted it in settings.
    t = driveUp(r.life, gps, { fromMi: 0.6, speedMph: 60, fixes: 20, startMs: t + 1000 });
    check(
      'denied: recovers to navigating',
      r.life.view().status === 'navigating',
      r.life.view().status,
    );
    check('denied: progress resumed', (r.life.view().routeMile ?? 0) > mileBefore);
    check('denied: no violations', r.life.violations().length === 0, r.life.violations());
  }

  // A tunnel: the platform reports nothing for 15 s. Health must go
  // 'lost' with the LAST KNOWN position flagged as such, then recover.
  {
    const r = rig(() => goodPlan());
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const gps = createGpsSession();
    let t = driveUp(r.life, gps, { fromMi: 0, speedMph: 60, fixes: 30, startMs: T0 + 2000 });
    const mileBefore = r.life.view().routeMile ?? 0;

    for (let i = 0; i < 15; i++) {
      r.life.tick(gps.tick(t), t);
      t += 1000;
    }
    check(
      'tunnel: the screen says position lost',
      r.life.view().status === 'position-lost',
      r.life.view().status,
    );
    check('tunnel: the shown position is flagged as last-known', r.life.view().lastKnown === true);
    check(
      'tunnel: no progress was invented in the dark',
      (r.life.view().routeMile ?? 0) === mileBefore,
    );

    driveUp(r.life, gps, { fromMi: 0.55, speedMph: 60, fixes: 15, startMs: t + 1000 });
    check(
      'tunnel: recovers to navigating on the next fix',
      r.life.view().status === 'navigating',
      r.life.view().status,
    );
    check('tunnel: progress resumed', (r.life.view().routeMile ?? 0) > mileBefore);
  }

  // The platform says it has no position source at all.
  {
    const r = rig(() => goodPlan());
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const gps = createGpsSession();
    r.life.tick(gps.ingestError('unavailable'), T0 + 2000);
    check(
      'unavailable: the screen says so',
      r.life.view().status === 'position-unavailable',
      r.life.view().status,
    );
    check('unavailable: no route mile is claimed', (r.life.view().routeMile ?? 0) === 0);
    driveUp(r.life, gps, { fromMi: 0, speedMph: 60, fixes: 20, startMs: T0 + 3000 });
    check(
      'unavailable: recovers when a fix arrives',
      r.life.view().status === 'navigating',
      r.life.view().status,
    );
  }

  // Every fix is too loose to trust: guidance continues, honestly labelled.
  {
    const r = rig(() => goodPlan());
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const gps = createGpsSession();
    driveUp(r.life, gps, { fromMi: 0, speedMph: 60, fixes: 10, startMs: T0 + 2000 });
    let t = T0 + 12_000;
    for (let i = 0; i < 10; i++) {
      // 120 m accuracy — past the 50 m gate. Discarded, health degraded.
      r.life.tick(
        gps.ingestFix({
          lat: 35 + (0.2 + i * 0.01) / MI_PER_DEG_LAT,
          lng: -85,
          accuracyM: 120,
          speedMps: 26,
          headingDeg: 0,
          tMs: t,
        }),
        t,
      );
      t += 1000;
    }
    check(
      'loose fixes: guidance continues, marked degraded',
      r.life.view().status === 'position-degraded',
      r.life.view().status,
    );
    check('loose fixes: no violations', r.life.violations().length === 0);
  }

  // ------------------------------------------------- reroute-side failures

  /** Drive off route until the lifecycle confirms it, then hand back. */
  async function toOffRoute(life: NavigationLifecycle) {
    const gps = createGpsSession();
    let t = driveUp(life, gps, { fromMi: 0, speedMph: 60, fixes: 20, startMs: T0 + 2000 });
    // Diverge gradually — an instant sidestep is a teleport and the GPS
    // gate rejects it, which would test the gate, not the detector.
    let mi = 0.34;
    for (let i = 0; i < 30; i++) {
      const lateralM = 20 * (i + 1);
      const lng = -85 + lateralM / 1609.344 / (MI_PER_DEG_LAT * Math.cos((35 * Math.PI) / 180));
      life.tick(
        gps.ingestFix({
          lat: 35 + mi / MI_PER_DEG_LAT,
          lng,
          accuracyM: 8,
          speedMps: 60 / 2.236936,
          headingDeg: 0,
          tMs: t,
        }),
        t,
      );
      mi += 60 / 3600;
      t += 1000;
      if (life.state() === 'off-route') break;
    }
    return t;
  }

  // The replacement provider fails. The current route must stand — a
  // driver mid-trip is never left with no guidance because a fetch broke.
  {
    const r = rig(
      () => goodPlan('original'),
      async () => ({ kind: 'failure', reason: 'provider-503' }),
    );
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const t = await toOffRoute(r.life);
    check('reroute failure: reached off-route', r.life.state() === 'off-route', r.life.state());
    const before = r.life.mapData().routeId;
    const result = await r.life.requestReroute(t, 10);
    check(
      'reroute failure: surfaced as provider-failure',
      result.outcome === 'provider-failure',
      result,
    );
    check(
      'reroute failure: the current route still stands',
      r.life.mapData().routeId === before,
      r.life.mapData().routeId,
    );
    check(
      'reroute failure: map geometry intact',
      r.life.mapData().geometry.length === ROUTE.length,
    );
    check(
      'reroute failure: lifecycle is not wedged in rerouting',
      r.life.state() !== 'rerouting',
      r.life.state(),
    );
    check('reroute failure: no violations', r.life.violations().length === 0, r.life.violations());

    // Backoff: an immediate second ask must not spend another call.
    const callsAfterFirst = r.replaceCalls();
    await r.life.requestReroute(t + 500, 10);
    check(
      'reroute failure: backoff prevents an immediate second spend',
      r.replaceCalls() === callsAfterFirst,
      { callsAfterFirst, now: r.replaceCalls() },
    );
  }

  // The replacement comes back malformed. Same contract: keep the route.
  {
    const r = rig(
      () => goodPlan('original'),
      async () => ({
        kind: 'route',
        positions: [],
        distanceMiles: 4,
        durationSeconds: 300,
        maneuvers: [],
        validationState: 'valid',
      }),
    );
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const t = await toOffRoute(r.life);
    const result = await r.life.requestReroute(t, 10);
    check('bad replacement: rejected, not applied', result.outcome === 'rejected', result);
    check(
      'bad replacement: the original route still stands',
      r.life.mapData().routeId === 'original',
    );
    check('bad replacement: geometry unchanged', r.life.mapData().geometry.length === ROUTE.length);
    check('bad replacement: no violations', r.life.violations().length === 0, r.life.violations());
  }

  // A replacement request that never settles must not hold the
  // single-flight slot forever and silently block every later reroute.
  {
    let settle: (v: ReplacementFetchResult) => void = () => {};
    const r = rig(
      () => goodPlan('original'),
      (call) =>
        call === 1
          ? new Promise<ReplacementFetchResult>((res) => (settle = res))
          : Promise.resolve({ kind: 'failure', reason: 'second-call' } as ReplacementFetchResult),
    );
    await plan(r.life, T0);
    r.life.startNavigation(T0 + 1000);
    const t = await toOffRoute(r.life);
    const gps = createGpsSession();
    void r.life.requestReroute(t, 10); // this promise never settles
    check('hung reroute: one provider call so far', r.replaceCalls() === 1, r.replaceCalls());
    check(
      'hung reroute: the lifecycle is rerouting',
      r.life.state() === 'rerouting',
      r.life.state(),
    );
    check(
      'hung reroute: the map still shows the current route',
      r.life.mapData().routeId === 'original',
    );

    // Ordinary ticks keep arriving while the fetch hangs. Past the
    // in-flight timeout one of them must retire it — otherwise the
    // screen says "rerouting" for the rest of the trip and no later
    // reroute is ever possible.
    let tt = t + 1000;
    for (let i = 0; i < 40; i++) {
      r.life.tick(
        gps.ingestFix({
          lat: 35 + (1.0 + i * 0.01) / MI_PER_DEG_LAT,
          lng: -85,
          accuracyM: 8,
          speedMps: 60 / 2.236936,
          headingDeg: 0,
          tMs: tt,
        }),
        tt,
      );
      tt += 1000;
      if (r.life.state() !== 'rerouting') break;
    }
    check(
      'hung reroute: the lifecycle escapes rerouting',
      r.life.state() !== 'rerouting',
      r.life.state(),
    );
    check(
      'hung reroute: the timeout is recorded honestly',
      r.life.transitions().some((x) => x.cause === 'reroute-timed-out'),
      r.life.transitions().slice(-3),
    );
    settle({ kind: 'failure', reason: 'too late' });
    await Promise.resolve();
    check(
      'hung reroute: the late response did not replace the route',
      r.life.mapData().routeId === 'original',
    );
    check('hung reroute: no violations', r.life.violations().length === 0, r.life.violations());
  }

  // -------------------------------------------------------- speech failures

  // No speech engine at all: every request is dropped cleanly and
  // navigation is untouched.
  {
    const port = speechPort('missing');
    const voice = createVoiceGuidance(port, { startMuted: false });
    const out = voice.request({ id: 'a', priority: 'normal', text: 'Turn right.' });
    check('speech missing: dropped as unavailable', out === 'dropped-unavailable', out);
    check('speech missing: nothing was spoken', port.spoken.length === 0);
    check('speech missing: snapshot is honest', voice.snapshot().supported === false);
  }

  // The engine throws when asked to speak. This is the one that matters:
  // the throw must not escape into the navigation effect that called it,
  // and the voice channel must still work afterwards.
  {
    const port = speechPort('throws-on-speak');
    const voice = createVoiceGuidance(port, { startMuted: false });
    let threw = false;
    try {
      voice.request({ id: 'a', priority: 'normal', text: 'Turn right.' });
    } catch {
      threw = true;
    }
    check('speech throws: the exception does not escape into navigation', threw === false);
    check(
      'speech throws: the channel is not left mid-utterance',
      voice.snapshot().speakingId === null,
      voice.snapshot(),
    );
    const after = createVoiceGuidance(speechPort('ok'), { startMuted: false });
    check(
      'speech throws: a healthy port still speaks',
      after.request({ id: 'b', priority: 'normal', text: 'x' }) === 'spoken',
    );
  }

  // The engine accepts the utterance and then never reports it finished
  // (a real speechSynthesis behavior when the tab backgrounds). Without
  // a watchdog the queue is jammed for the rest of the trip.
  {
    const port = speechPort('never-finishes');
    const voice = createVoiceGuidance(port, { startMuted: false });
    voice.request({ id: 'a', priority: 'normal', text: 'In half a mile, turn right.' });
    voice.request({ id: 'b', priority: 'normal', text: 'Turn right.' });
    check('stuck speech: the first went out', port.spoken.length === 1, port.spoken);
    check(
      'stuck speech: the second is waiting',
      voice.snapshot().queuedIds.length === 1,
      voice.snapshot(),
    );

    // The caller ticks on its ordinary cadence. The first tick only
    // starts the clock (this module never reads one); once the utterance
    // has been outstanding past the ceiling it is retired and the queue
    // drains — the driver is not left in silence for the rest of the
    // drive because one utterance went missing.
    voice.tick(T0);
    voice.tick(T0 + 1000);
    check('stuck speech: the watchdog does not fire early', port.spoken.length === 1, port.spoken);
    voice.tick(T0 + STUCK_UTTERANCE_MS + 1000);
    check(
      'stuck speech: the queue drained after the watchdog',
      port.spoken.length === 2,
      port.spoken,
    );
    check(
      'stuck speech: nothing is left waiting',
      voice.snapshot().queuedIds.length === 0,
      voice.snapshot(),
    );
    // The replacement utterance is now in the driver's ear — and this
    // engine never finishes that one either. The watchdog must keep
    // working, not fire once and give up.
    voice.tick(T0 + STUCK_UTTERANCE_MS + 2000);
    voice.tick(T0 + STUCK_UTTERANCE_MS * 2 + 3000);
    check(
      'stuck speech: the watchdog keeps working',
      voice.snapshot().speakingId === null,
      voice.snapshot(),
    );
  }

  // A healthy port must never be retired by the watchdog.
  {
    const port = speechPort('ok');
    const voice = createVoiceGuidance(port, { startMuted: false });
    voice.request({ id: 'a', priority: 'normal', text: 'one' });
    voice.tick(T0);
    voice.tick(T0 + 600_000);
    check(
      'watchdog: idle ticks are harmless',
      port.spoken.length === 1 && voice.snapshot().speakingId === null,
    );
  }

  // cancel() throwing (mute, stop, arrival) must not escape either.
  {
    const port = speechPort('throws-on-cancel');
    const voice = createVoiceGuidance(port, { startMuted: false });
    voice.request({ id: 'a', priority: 'normal', text: 'one' });
    let threw = false;
    try {
      voice.clearPending();
      voice.mute();
    } catch {
      threw = true;
    }
    check('cancel throws: the exception does not escape', threw === false);
    check('cancel throws: the channel still reports muted', voice.snapshot().muted === true);
  }

  // The watchdog is only worth anything if something calls it. Pin the
  // wiring: a future refactor that drops the tick would leave the fix
  // present, tested in isolation, and dead in production.
  {
    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    check('watchdog is wired: DrivingScreen ticks the voice channel', /voice\.tick\(/.test(screen));
    check(
      'watchdog is wired: it ticks on the position-driven effect, not a bare timer',
      screen.indexOf('voice.tick(') > screen.indexOf('const view = useMemo'),
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
