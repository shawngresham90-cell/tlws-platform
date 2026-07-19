/**
 * Routing avoidances + impossible-profile contract tests (30-hour-window
 * Milestone B). Deterministic, offline (injected fetch, no live API):
 * avoid[features] whitelisting and URL building, cache-key separation,
 * adapter-level impossible-profile rejection with ZERO provider calls, and
 * end-to-end threading through the quote schema and composeQuote.
 *
 * Run:
 *   npx esbuild scripts/test-routing-avoidances.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-routing-avoidances.cjs \
 *   && node /tmp/test-routing-avoidances.cjs
 */
import {
  buildHereRouteUrl,
  createHereRoutingPort,
  HERE_AVOID_FEATURES,
  routeCacheKey,
  sanitizeAvoidances,
  validateTruckProfileForRouting,
} from '@/lib/trip-planner/here-routing';
import { composeQuote, quoteRequestSchema } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort, type RoutingRequest } from '@/lib/trip-planner/providers';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const T0 = 1_750_000_000_000;
const ATL = { lat: 33.749, lng: -84.388 };
const KNX = { lat: 35.9606, lng: -83.9207 };
const SPEC_POLYLINE = 'BFoz5xJ67i1B1B7PzIhaxL7Y';

const baseReq = (over: Partial<RoutingRequest> = {}): RoutingRequest => ({
  origin: ATL,
  destination: KNX,
  waypoints: [],
  truck: DEFAULT_TRUCK_PROFILE,
  departAtMs: T0,
  ...over,
});

const hereResponse = () => ({
  routes: [
    { sections: [{ summary: { length: 300000, duration: 12000 }, polyline: SPEC_POLYLINE }] },
  ],
});

async function main() {
  /* --------------------------------------------------- sanitize + URL */
  {
    check(
      'avoid: whitelist passes known values',
      JSON.stringify(sanitizeAvoidances(['tollRoad', 'ferry'])) === '["tollRoad","ferry"]',
    );
    check(
      'avoid: unknown values dropped (never forwarded)',
      JSON.stringify(sanitizeAvoidances(['tollRoad', 'motorway', 'evil<script>'])) ===
        '["tollRoad"]',
    );
    check('avoid: duplicates collapsed', sanitizeAvoidances(['ferry', 'ferry']).length === 1);
    check('avoid: undefined → empty', sanitizeAvoidances(undefined).length === 0);

    const url = buildHereRouteUrl(baseReq({ avoid: ['tollRoad', 'tunnel'] }), 'K');
    const q = new URL(url).searchParams;
    check('url: avoid[features] set from request', q.get('avoid[features]') === 'tollRoad,tunnel');
    const urlNone = buildHereRouteUrl(baseReq(), 'K');
    check(
      'url: no avoid param when none requested',
      new URL(urlNone).searchParams.get('avoid[features]') === null,
    );
    const urlJunk = buildHereRouteUrl(
      baseReq({ avoid: ['motorway' as never, 'seasonalClosure' as never] }),
      'K',
    );
    check(
      'url: junk-only avoidances produce no param',
      new URL(urlJunk).searchParams.get('avoid[features]') === null,
    );
  }

  /* ------------------------------------------------------- cache key */
  {
    const plain = routeCacheKey(baseReq());
    const tolls = routeCacheKey(baseReq({ avoid: ['tollRoad'] }));
    const tollsFerry1 = routeCacheKey(baseReq({ avoid: ['tollRoad', 'ferry'] }));
    const tollsFerry2 = routeCacheKey(baseReq({ avoid: ['ferry', 'tollRoad'] }));
    check('cache: avoidances separate cache entries', plain !== tolls && tolls !== tollsFerry1);
    check('cache: avoidance order does not fragment the cache', tollsFerry1 === tollsFerry2);
    check(
      'cache: junk avoidances equal no avoidances',
      routeCacheKey(baseReq({ avoid: ['motorway' as never] })) === plain,
    );
  }

  /* ------------------------------------------- impossible truck profiles */
  {
    check(
      'profile: default profile valid',
      validateTruckProfileForRouting(DEFAULT_TRUCK_PROFILE).length === 0,
    );
    const impossible = [
      { ...DEFAULT_TRUCK_PROFILE, heightFt: 20 },
      { ...DEFAULT_TRUCK_PROFILE, heightFt: 2 },
      { ...DEFAULT_TRUCK_PROFILE, widthFt: 30 },
      { ...DEFAULT_TRUCK_PROFILE, lengthFt: 500 },
      { ...DEFAULT_TRUCK_PROFILE, grossWeightLbs: 1_000_000 },
      { ...DEFAULT_TRUCK_PROFILE, grossWeightLbs: 100 },
      { ...DEFAULT_TRUCK_PROFILE, axles: 1 },
      { ...DEFAULT_TRUCK_PROFILE, axles: 50 },
      { ...DEFAULT_TRUCK_PROFILE, heightFt: NaN },
      { ...DEFAULT_TRUCK_PROFILE, grossWeightLbs: Infinity },
    ];
    check(
      'profile: 10 impossible profiles all rejected with named problems',
      impossible.every((t) => validateTruckProfileForRouting(t).length > 0),
    );

    // Adapter contract: an impossible profile makes ZERO provider calls.
    let calls = 0;
    const counting = async () => {
      calls++;
      return { status: 200, json: async () => hereResponse() };
    };
    const port = createHereRoutingPort(counting, 'KEY', { nowMs: () => T0 });
    const res = await port.route(baseReq({ truck: { ...DEFAULT_TRUCK_PROFILE, heightFt: 99 } }));
    check('adapter: impossible profile → null', res === null);
    check('adapter: impossible profile spent zero transactions', calls === 0);
    // …and a valid profile still routes.
    const ok = await port.route(baseReq());
    check('adapter: valid profile still routes', ok !== null && calls === 1);
    // Avoidances flow into the fetched URL.
    let seenUrl = '';
    const capture = async (url: string) => {
      seenUrl = url;
      return { status: 200, json: async () => hereResponse() };
    };
    const port2 = createHereRoutingPort(capture, 'KEY', { nowMs: () => T0 });
    await port2.route(baseReq({ avoid: ['ferry'] }));
    check(
      'adapter: avoid[features] reaches the request URL',
      seenUrl.includes('avoid%5Bfeatures%5D=ferry'),
    );
    // Guard placement: an invalid profile must not consume hourly-cap budget.
    // With a cap of 1, the invalid request would starve the valid one if the
    // guard sat after underCap().
    let capCalls = 0;
    const capCounting = async () => {
      capCalls++;
      return { status: 200, json: async () => hereResponse() };
    };
    const port3 = createHereRoutingPort(capCounting, 'KEY', { nowMs: () => T0, hourlyCap: 1 });
    const bad = await port3.route(baseReq({ truck: { ...DEFAULT_TRUCK_PROFILE, heightFt: 99 } }));
    const good = await port3.route(baseReq());
    check(
      'adapter: invalid profile leaves hourly-cap budget untouched',
      bad === null && good !== null && capCalls === 1,
    );
  }

  /* --------------------------------------------------- quote threading */
  {
    check(
      'schema: valid avoidances accepted',
      quoteRequestSchema.safeParse({
        origin: { label: 'A', position: ATL },
        destination: { label: 'B', position: KNX },
        departAtMs: T0,
        clocks: {},
        avoid: ['tollRoad', 'ferry'],
      }).success,
    );
    check(
      'schema: unknown avoidance rejected',
      !quoteRequestSchema.safeParse({
        origin: { label: 'A', position: ATL },
        destination: { label: 'B', position: KNX },
        departAtMs: T0,
        clocks: {},
        avoid: ['motorway'],
      }).success,
    );
    check(
      'schema: avoid defaults to empty',
      quoteRequestSchema.parse({
        origin: { label: 'A', position: ATL },
        destination: { label: 'B', position: KNX },
        departAtMs: T0,
        clocks: {},
      }).avoid.length === 0,
    );
    // Drift guard: the zod enum and the adapter whitelist must stay the same
    // set — a value accepted by the API but dropped by sanitize would be
    // silently swallowed instead of sent to HERE.
    const enumOptions: readonly string[] =
      quoteRequestSchema.shape.avoid.removeDefault().element.options;
    check(
      'schema: enum matches adapter whitelist exactly',
      enumOptions.length === HERE_AVOID_FEATURES.size &&
        enumOptions.every((v) => HERE_AVOID_FEATURES.has(v)),
      { enumOptions, whitelist: [...HERE_AVOID_FEATURES] },
    );

    // composeQuote passes the avoidances into the RoutingRequest.
    let seen: RoutingRequest | null = null;
    const spyPort = {
      name: 'spy',
      route: async (req: RoutingRequest) => {
        seen = req;
        return null; // fall back to estimate; we only care about the request
      },
    };
    const req = quoteRequestSchema.parse({
      origin: { label: 'A', position: ATL },
      destination: { label: 'B', position: KNX },
      departAtMs: T0,
      clocks: {},
      avoid: ['tunnel', 'dirtRoad'],
    });
    const q = await composeQuote(req, {
      loadListings: async () => [],
      weather: nullWeatherPort,
      fuelPrice: async () => null,
      routing: spyPort,
    });
    check('quote: still plans (estimate fallback) with avoidances', q.ok === true);
    check(
      'quote: avoidances threaded into RoutingRequest',
      seen !== null && JSON.stringify((seen as RoutingRequest).avoid) === '["tunnel","dirtRoad"]',
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
