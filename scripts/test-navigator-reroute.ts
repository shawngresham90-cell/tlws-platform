/**
 * N8e — controlled truck rerouting (the doc 10 harness name). Offline
 * tests with a scripted replacement port: trigger discipline, cooldown
 * and backoff, budgets, stale rejection, duplicate suppression,
 * coalescing/single-flight, replacement validation identical to the
 * original route, failure behavior (current session always preserved,
 * never a crash), preservation of truck/destination/avoidances, and
 * measured (never invented) performance.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-reroute.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-nav-reroute.cjs \
 *   && node /tmp/test-nav-reroute.cjs
 */
import {
  createRerouteController,
  REROUTE_DEFAULTS,
  type ReplacementFetchResult,
  type ReplacementRequest,
  type RerouteController,
  type RerouteResult,
} from '@/lib/navigator/reroute-controller';
import { createRouteSession, type RouteSession } from '@/lib/navigator/route-session';
import type { LatLng } from '@/lib/map/bounds';
import type { TruckProfile } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ---------------------------------------------------------------- fixtures
const T0 = 1_754_000_000_000;
const TRUCK: TruckProfile = {
  lengthFt: 73,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80_000,
  axles: 5,
  hazmatClass: '3',
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.8,
};

function line(n: number, startLat = 35, lng = -85): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push({ lat: startLat + i * 0.001, lng });
  return out;
}
const MI_PER_STEP = 0.0690937;

function makeSession(): RouteSession {
  const positions = line(1000);
  const made = createRouteSession({
    routeId: 'trip-1',
    truck: TRUCK,
    origin: positions[0],
    destination: positions[999],
    positions,
    distanceMiles: Number((999 * MI_PER_STEP).toFixed(1)),
    durationSeconds: 4500,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: 999 },
    ],
    avoid: ['tollRoad', 'ferry'],
    validationState: 'valid',
  });
  if (!made.ok) throw new Error('session fixture failed');
  return made.session;
}

/** A good replacement: from the given origin straight to the destination. */
function goodReplacement(req: ReplacementRequest): ReplacementFetchResult {
  const n = 400;
  const positions: LatLng[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    positions.push({
      lat: req.origin.lat + (req.destination.lat - req.origin.lat) * t,
      lng: req.origin.lng + (req.destination.lng - req.origin.lng) * t,
    });
  }
  const miles = Number((Math.abs(req.destination.lat - req.origin.lat) * 69.0937).toFixed(1));
  return {
    kind: 'route',
    positions,
    distanceMiles: Math.max(miles, 0.5),
    durationSeconds: Math.max(60, Math.round((miles / 55) * 3600)),
    maneuvers: [
      { action: 'depart', instruction: 'Head to the route.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: n - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

type PortScript = (
  req: ReplacementRequest,
  call: number,
) => ReplacementFetchResult | Promise<ReplacementFetchResult>;
function makeRig(script: PortScript, config = {}) {
  const session = makeSession();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const seen: ReplacementRequest[] = [];
  const controller = createRerouteController(
    session,
    async (req) => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      seen.push(req);
      try {
        return await script(req, calls);
      } finally {
        active -= 1;
      }
    },
    config,
  );
  return { session, controller, calls: () => calls, maxActive: () => maxActive, seen };
}

const confirmedAt = (pos: LatLng, tMs: number, accuracyM = 8) => ({
  detectorState: 'confirmed' as const,
  currentPosition: pos,
  accuracyM,
  tMs,
});
const OFF_POS = { lat: 35.3, lng: -85.004 };

async function main() {
  // ------------------------------------------------- successful reroute
  {
    const r = makeRig((req) => goodReplacement(req));
    const before = r.controller.currentSession();
    const result = await r.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check('success: outcome replaced', result.outcome === 'replaced');
    check('success: exactly one provider call', r.calls() === 1);
    if (result.outcome === 'replaced') {
      const s = result.session;
      check(
        'success: controller now navigates the new session',
        r.controller.currentSession() === s,
      );
      check(
        'success: TRUCK preserved verbatim (every restriction)',
        JSON.stringify(s.truck) === JSON.stringify(TRUCK),
      );
      check(
        'success: DESTINATION preserved verbatim',
        s.destination.lat === before.destination.lat &&
          s.destination.lng === before.destination.lng,
      );
      check(
        'success: AVOIDANCES preserved verbatim',
        JSON.stringify([...s.avoid]) === JSON.stringify(['tollRoad', 'ferry']),
      );
      check(
        'success: origin is the truck position, not the old origin',
        s.origin.lat === OFF_POS.lat,
      );
      check(
        'success: replacement fully validated (session created, frozen)',
        Object.isFrozen(s) && Object.isFrozen(s.geometry),
      );
      check(
        'success: old session untouched and intact',
        Object.isFrozen(before) && before.routeId === 'trip-1' && before.geometry.length === 1000,
      );
      check('success: new route id lineage', s.routeId === 'trip-1-r1');
    }
    check(
      'success: request carried the preserved fields to the provider',
      JSON.stringify(r.seen[0].truck) === JSON.stringify(TRUCK) && r.seen[0].avoid.length === 2,
    );
    const stats = r.controller.stats();
    check(
      'success: stats record the spend honestly',
      stats.providerCalls === 1 && stats.successes === 1 && stats.requested === 1,
    );
  }

  // ------------------------------------------- trigger discipline (free)
  {
    const r = makeRig((req) => goodReplacement(req));
    for (const state of ['suspected', 'recovering', 'on-route', 'recovered'] as const) {
      const result = await r.controller.requestReroute({
        detectorState: state,
        currentPosition: OFF_POS,
        accuracyM: 8,
        tMs: T0,
      });
      check(
        `discipline: '${state}' refused without spending`,
        result.outcome === 'refused' && result.outcome === 'refused' && r.calls() === 0,
      );
    }
    const degraded = await r.controller.requestReroute(confirmedAt(OFF_POS, T0, 45));
    check(
      'discipline: degraded position (45 m) refused without spending',
      degraded.outcome === 'refused' && r.calls() === 0,
    );
    const noAcc = await r.controller.requestReroute(
      confirmedAt(OFF_POS, T0, null as unknown as number),
    );
    check(
      'discipline: unknown accuracy refused without spending',
      noAcc.outcome === 'refused' && r.calls() === 0,
    );
  }

  // ------------------------- rejected replacement: session NEVER replaced
  {
    const r = makeRig((req) => ({ ...goodReplacement(req), validationState: 'requires-review' }));
    const result = await r.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check('rejected: requires-review replacement rejected', result.outcome === 'rejected');
    check(
      'rejected: current session preserved',
      r.controller.currentSession().routeId === 'trip-1',
    );
    check(
      'rejected: spend counted, success not',
      r.controller.stats().rejectedReplacements === 1 && r.controller.stats().successes === 0,
    );

    // malformed geometry replacement
    const bad = makeRig((req) => ({
      ...goodReplacement(req),
      positions: [
        { lat: Number.NaN, lng: -85 },
        { lat: 35, lng: -85 },
      ],
    }));
    const badResult = await bad.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check(
      'malformed: NaN replacement rejected, session kept',
      badResult.outcome === 'rejected' && bad.controller.currentSession().routeId === 'trip-1',
    );

    // destination-mismatch replacement (route to the wrong place)
    const wrong = makeRig((req) => {
      const g = goodReplacement({
        ...req,
        destination: { lat: req.destination.lat + 0.5, lng: req.destination.lng },
      });
      return g;
    });
    const wrongResult = await wrong.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check(
      'mismatch: replacement to the wrong destination rejected',
      wrongResult.outcome === 'rejected' && wrong.controller.currentSession().routeId === 'trip-1',
    );
  }

  // ------------------------------ provider failure: navigate on, backoff
  {
    const r = makeRig(() => ({ kind: 'failure', reason: 'timeout' }));
    const result = await r.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check(
      'failure: provider failure surfaced, session kept',
      result.outcome === 'provider-failure' && r.controller.currentSession().routeId === 'trip-1',
    );
    const tooSoon = await r.controller.requestReroute(confirmedAt(OFF_POS, T0 + 5_000));
    check(
      'failure: cooldown blocks an immediate retry (30 s ladder)',
      tooSoon.outcome === 'refused' && tooSoon.outcome === 'refused' && r.calls() === 1,
    );
    if (tooSoon.outcome === 'refused')
      check('failure: retry time exposed honestly', tooSoon.retryAtMs === T0 + 30_000);
    const retry = await r.controller.requestReroute(confirmedAt(OFF_POS, T0 + 31_000));
    check(
      'failure: retry allowed after cooldown',
      retry.outcome === 'provider-failure' && r.calls() === 2,
    );
    const third = await r.controller.requestReroute(confirmedAt(OFF_POS, T0 + 31_000 + 45_000));
    check(
      'failure: backoff escalates 30→60 (45 s later still blocked)',
      third.outcome === 'refused' && r.calls() === 2,
    );
    const fourth = await r.controller.requestReroute(confirmedAt(OFF_POS, T0 + 31_000 + 61_000));
    check(
      'failure: second retry after 60 s backoff',
      fourth.outcome === 'provider-failure' && r.calls() === 3,
    );

    // port that THROWS: never crash
    const throwing = makeRig(() => {
      throw new Error('boom');
    });
    const crashless = await throwing.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check(
      'failure: a throwing port never crashes the controller',
      crashless.outcome === 'provider-failure' &&
        throwing.controller.currentSession().routeId === 'trip-1',
    );
  }

  // ------------------------------------------- stale response rejection
  {
    let release: (() => void) | null = null;
    const r = makeRig(
      (req) =>
        new Promise<ReplacementFetchResult>((resolve) => {
          release = () => resolve(goodReplacement(req));
        }),
    );
    const pending = r.controller.requestReroute(confirmedAt(OFF_POS, T0));
    check(
      'stale: in-flight not yet expired at 10 s',
      r.controller.expireInFlight(T0 + 10_000) === false,
    );
    check(
      'stale: expired after the 15 s timeout',
      r.controller.expireInFlight(T0 + 16_000) === true,
    );
    release!();
    const result = await pending;
    check('stale: the late response is DROPPED, never applied', result.outcome === 'stale-dropped');
    check('stale: session unchanged', r.controller.currentSession().routeId === 'trip-1');
    check('stale: drop counted', r.controller.stats().staleDropped === 1);
  }

  // ------------------------------- duplicate suppression + coalescing
  {
    // Coalescing: concurrent requests share ONE provider call.
    let release: (() => void) | null = null;
    const r = makeRig(
      (req) =>
        new Promise<ReplacementFetchResult>((resolve) => {
          release = () => resolve(goodReplacement(req));
        }),
    );
    const p1 = r.controller.requestReroute(confirmedAt(OFF_POS, T0));
    const p2 = r.controller.requestReroute(confirmedAt(OFF_POS, T0 + 1000));
    const p3 = r.controller.requestReroute(confirmedAt(OFF_POS, T0 + 2000));
    check('coalesce: concurrent requests share the same promise', p1 === p2 && p2 === p3);
    release!();
    const [a, b, c] = await Promise.all([p1, p2, p3]);
    check('coalesce: one provider call for three requests', r.calls() === 1 && a === b && b === c);
    check('coalesce: never concurrent provider requests', r.maxActive() === 1);
    check('coalesce: counted', r.controller.stats().coalesced === 2);

    // Duplicate suppression: the same failing request is not re-spent.
    const dup = makeRig((req) => ({ ...goodReplacement(req), validationState: 'rejected' }), {
      failureBackoffMs: [1],
    });
    await dup.controller.requestReroute(confirmedAt(OFF_POS, T0));
    const repeat = await dup.controller.requestReroute(confirmedAt(OFF_POS, T0 + 5_000));
    check(
      'duplicate: identical failed request suppressed inside the window',
      repeat.outcome === 'refused' && dup.calls() === 1,
    );
    const moved = await dup.controller.requestReroute(
      confirmedAt({ lat: 35.35, lng: -85.01 }, T0 + 6_000),
    );
    check(
      'duplicate: a genuinely new position is allowed to spend',
      moved.outcome !== 'refused' && dup.calls() === 2,
    );
  }

  // ------------------------------------------------------------ budgets
  {
    const r = makeRig((req) => goodReplacement(req), {
      failureBackoffMs: [1],
      successCooldownMs: 1,
      duplicateWindowMs: 0,
    });
    let t = T0;
    let spent = 0;
    for (let i = 0; i < 8; i++) {
      t += 120_000;
      const result = await r.controller.requestReroute(
        confirmedAt({ lat: 35.05 + i * 0.02, lng: -85.003 }, t),
      );
      if (result.outcome === 'replaced') spent += 1;
    }
    check('budget: trailing-hour cap stops at 6 spends', r.calls() === 6 && spent === 6, r.calls());
    check(
      'budget: refusals counted as hourly-budget',
      r.controller.stats().refused['hourly-budget'] === 2,
    );

    // Window slides: an hour after the FIRST call, one more is allowed.
    const afterWindow = await r.controller.requestReroute(
      confirmedAt({ lat: 35.9, lng: -85.006 }, T0 + 120_000 + 3_600_001),
    );
    check(
      'budget: the trailing window slides — a 7th spend an hour later',
      afterWindow.outcome === 'replaced' && r.calls() === 7,
    );

    // Session cap.
    const capped = makeRig((req) => goodReplacement(req), {
      maxPerSession: 2,
      maxPerHour: 100,
      successCooldownMs: 1,
      duplicateWindowMs: 0,
    });
    let t2 = T0;
    const outcomes: string[] = [];
    for (let i = 0; i < 3; i++) {
      t2 += 10_000;
      outcomes.push(
        (
          await capped.controller.requestReroute(
            confirmedAt({ lat: 35.1 + i * 0.05, lng: -85.002 }, t2),
          )
        ).outcome,
      );
    }
    check(
      'budget: per-session cap enforced',
      outcomes.join(',') === 'replaced,replaced,refused' && capped.calls() === 2,
      outcomes,
    );
  }

  // ------------------------------------------- measured performance/memory
  {
    (globalThis as { gc?: () => void }).gc?.();
    const heapBefore = process.memoryUsage().heapUsed;
    const r = makeRig((req) => goodReplacement(req), {
      maxPerHour: 1_000_000,
      maxPerSession: 1_000_000,
      successCooldownMs: 0,
      duplicateWindowMs: 0,
    });
    const times: number[] = [];
    let t = T0;
    for (let i = 0; i < 500; i++) {
      t += 1_000;
      const s0 = performance.now();
      await r.controller.requestReroute(
        confirmedAt({ lat: 35.05 + (i % 400) * 0.001, lng: -85.003 }, t),
      );
      times.push(performance.now() - s0);
    }
    const avg = times.reduce((s, x) => s + x, 0) / times.length;
    const worst = Math.max(...times);
    const heapAfter = process.memoryUsage().heapUsed;
    console.log(
      `measured: full reroute cycle (request→validate→replace) avg ${avg.toFixed(2)} ms · worst ${worst.toFixed(1)} ms · ` +
        `heap delta over 500 replacements ${((heapAfter - heapBefore) / 1048576).toFixed(1)} MB · provider calls ${r.calls()}`,
    );
    check('perf: average full replacement cycle < 20 ms', avg < 20, avg);
    check('perf: worst cycle < 250 ms', worst < 250, worst);
    check('perf: 500 replacements retain < 120 MB', heapAfter - heapBefore < 120 * 1048576);
    check(
      'perf: stats agree with the port (no hidden calls)',
      r.controller.stats().providerCalls === r.calls(),
    );
  }

  // Defaults sanity (doc 05 §4).
  check(
    'defaults: budget 6/hour, ladder 30/60/120 s',
    REROUTE_DEFAULTS.maxPerHour === 6 &&
      REROUTE_DEFAULTS.failureBackoffMs.join(',') === '30000,60000,120000',
  );

  console.log(`navigator-reroute: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
