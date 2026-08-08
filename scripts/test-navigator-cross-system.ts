/**
 * Hostile cross-system pass (Block 2, priority Q).
 *
 * Every subsystem here has its own harness and passes it. This one only
 * asks questions that no single subsystem can answer, because the answer
 * lives in the seam between two of them.
 *
 * The headline case: a truck goes off route in a DEAD-SIGNAL stretch — a
 * canyon, a mountain pass, the exact places a wrong turn is most likely
 * and least recoverable. Off-route detection works. The reroute budget
 * works. Together they used to strand the driver.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-cross-system.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-cross.cjs && node /tmp/test-cross.cjs
 */
import {
  createRerouteController,
  REROUTE_DEFAULTS,
  type ReplacementFetchResult,
} from '@/lib/navigator/reroute-controller';
import { createRouteSession, type RouteSession } from '@/lib/navigator/route-session';
import type { LatLng } from '@/lib/map/bounds';
import type { TruckProfile } from '@/lib/trip-planner/types';
import { buildRoadTestReport } from '@/lib/navigator/road-test-report';
import { offlineNotice } from '@/lib/navigator/network-status';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_754_000_000_000;
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

function line(n: number, lat0 = 35): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < n; i += 1) out.push({ lat: lat0 + i * 0.001, lng: -85 });
  return out;
}

function session(): RouteSession {
  const positions = line(400);
  const made = createRouteSession({
    routeId: 'cross-system',
    truck: TRUCK,
    origin: positions[0],
    destination: positions[399],
    positions,
    distanceMiles: 27.5,
    durationSeconds: 2400,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: 399 },
    ],
    validationState: 'valid',
  });
  if (!made.ok) throw new Error('fixture failed');
  return made.session;
}

/** A replacement that actually starts where the truck is and ends at the
 *  session destination — anything else is correctly rejected. */
function detour(from: LatLng, to: LatLng, n = 300): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = i / (n - 1);
    out.push({ lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f });
  }
  return out;
}
const OFF_ROUTE_AT: LatLng = { lat: 35.05, lng: -85.01 };

const goodRoute = (): ReplacementFetchResult => ({
  kind: 'route',
  positions: detour(OFF_ROUTE_AT, { lat: 35.399, lng: -85 }),
  distanceMiles: 20.7,
  durationSeconds: 1800,
  maneuvers: [
    { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
    { action: 'arrive', instruction: 'Arrive.', direction: null, offset: 299 },
  ],
  validationState: 'valid',
});

async function main(): Promise<void> {
  // ============ off route, in a dead-signal canyon =====================
  {
    /*
     * The seam. The reroute budget exists to cap provider SPEND — six
     * calls in a trailing hour. The route port returns `network` when the
     * fetch never completed, which means the request never reached our
     * server, let alone the provider, and therefore cost nothing.
     *
     * Charging those to the budget protected nothing and rationed the one
     * thing the driver needed: by the time signal returned, the app knew
     * the truck was off route and had no budget left to fix it.
     */
    let online = false;
    let calls = 0;
    const controller = createRerouteController(session(), async () => {
      calls += 1;
      return online
        ? goodRoute()
        : ({ kind: 'failure', reason: 'network' } as ReplacementFetchResult);
    });

    // Twenty minutes of confirmed off-route with no signal. The failure
    // backoff ladder is respected by stepping past each cooldown.
    let t = T0;
    let attempts = 0;
    for (let i = 0; i < 10; i += 1) {
      const r = await controller.requestReroute({
        detectorState: 'confirmed',
        currentPosition: { lat: 35.05, lng: -85.01 },
        accuracyM: 8,
        tMs: t,
      });
      if (r.outcome === 'provider-failure') attempts += 1;
      t += 180_000; // past the longest backoff rung
    }
    check('canyon: every attempt failed at the transport layer', attempts === 10, attempts);

    const dead = controller.stats();
    check(
      'canyon: transport failures are refunded, so the hourly budget is intact',
      dead.hourlyWindowCount === 0,
      dead,
    );
    check('canyon: and the refunds are auditable, not silent', dead.budgetRefunds === 10);
    check(
      'canyon: the failures are still counted honestly',
      dead.providerFailures === 10 && dead.providerCalls === 0,
    );

    // Signal returns. The driver must be able to reroute.
    online = true;
    const recovered = await controller.requestReroute({
      detectorState: 'confirmed',
      currentPosition: { lat: 35.05, lng: -85.01 },
      accuracyM: 8,
      tMs: t,
    });
    check(
      'canyon: when signal returns the truck CAN be rerouted',
      recovered.outcome === 'replaced',
      recovered.outcome,
    );
    check('canyon: the provider was called exactly once for real', calls === 11);
  }

  // ============ a failure that DID reach the provider stays charged =====
  {
    const controller = createRerouteController(
      session(),
      async () => ({ kind: 'failure', reason: 'bad-response:503' }) as ReplacementFetchResult,
    );
    let t = T0;
    for (let i = 0; i < 3; i += 1) {
      await controller.requestReroute({
        detectorState: 'confirmed',
        currentPosition: { lat: 35.05, lng: -85.01 },
        accuracyM: 8,
        tMs: t,
      });
      t += 180_000;
    }
    const s = controller.stats();
    // The refund is narrow on purpose: anything that got as far as a
    // status code reached the provider and may have cost something.
    check(
      'provider-side failures are NOT refunded',
      s.budgetRefunds === 0 && s.providerCalls === 3,
      s,
    );
  }

  // ============ the budget still bites when calls really happen =========
  {
    let calls = 0;
    const controller = createRerouteController(session(), async () => {
      calls += 1;
      return { kind: 'failure', reason: 'malformed-route' } as ReplacementFetchResult;
    });
    let t = T0;
    let refusals = 0;
    for (let i = 0; i < 12; i += 1) {
      const r = await controller.requestReroute({
        detectorState: 'confirmed',
        // A fresh position each time, or duplicate suppression fires first.
        currentPosition: { lat: 35.05 + i * 0.01, lng: -85.01 },
        accuracyM: 8,
        tMs: t,
      });
      if (r.outcome === 'refused' && r.reason === 'hourly-budget') refusals += 1;
      t += 180_000;
    }
    check(
      'the hourly cap still stops real spend',
      calls === REROUTE_DEFAULTS.maxPerHour && refusals > 0,
      { calls, refusals },
    );
  }

  // ============ the offline notice and the reroute rail agree ===========
  {
    // Two subsystems, one claim. The notice tells the driver rerouting is
    // unavailable; the controller must actually behave that way, and must
    // not have quietly spent the budget proving it.
    const notice = offlineNotice({ online: false, navigating: true });
    check('offline: the driver is told rerouting is what stops', /Rerouting/.test(notice ?? ''));
    check(
      'offline: and is NOT told guidance has stopped, because it has not',
      /guidance continues/.test(notice ?? ''),
    );
  }

  // ============ the report is honest about a trip still running =========
  {
    // The road-test report is built from live state, including a
    // lifecycle that has not finished. It must not imply a completed trip
    // it does not have, and must survive every subsystem being null.
    const report = buildRoadTestReport({
      generatedMs: T0,
      pilot: Object.freeze({ active: true, debugLogging: true, reason: 'pilot' as const }),
      lifecycleState: 'rerouting',
      trip: null,
      log: [Object.freeze({ tMs: T0, event: 'reroute', detail: 'provider-failure network' })],
      logDropped: 0,
      gps: { health: 'lost', accuracyM: null, speedMph: null },
      voice: null,
      wake: null,
      device: { userAgent: null, viewport: null, online: false },
    });
    check('report: mid-trip, it says there is no completed trip', /no completed trip/.test(report));
    check('report: it carries the state that explains the failure', /rerouting/.test(report));
    check('report: and says the device was offline', /network: OFFLINE/.test(report));
    check(
      'report: nothing that looks like a coordinate or a secret survives',
      !/-?\d{1,3}\.\d{4,}/.test(report) && !/apikey|password/i.test(report),
    );
  }

  console.log(`navigator-cross-system: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
