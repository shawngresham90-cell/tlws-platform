/**
 * Phase 5 unit tests: HERE Routing API v8 adapter — flexible-polyline
 * decoding (reference vectors from the published spec), truck-parameter URL
 * building with unit conversion, response parsing, retry/cache/cap behavior,
 * key-leak guards, and composeQuote live-route integration with fallback.
 * Pure logic — no network, no database, no real API key anywhere.
 *
 * Run:
 *   npx esbuild scripts/test-here-routing.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-here-routing.cjs \
 *   && node /tmp/test-here-routing.cjs
 */
import { decodeFlexiblePolyline } from '@/lib/trip-planner/flexible-polyline';
import {
  buildHereRouteUrl,
  createHereRoutingPort,
  hazmatToHereGoods,
  parseHereResponse,
  routeCacheKey,
  toRoutePoints,
} from '@/lib/trip-planner/here-routing';
import type { RoutingRequest } from '@/lib/trip-planner/providers';
import { composeQuote, quoteRequestSchema } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
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
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const T0 = 1_750_000_000_000;

const ATL = { lat: 33.749, lng: -84.388 };
const KNX = { lat: 35.9606, lng: -83.9207 };

// Reference vector from the flexible-polyline spec (precision 5, 2D).
const SPEC_POLYLINE = 'BFoz5xJ67i1B1B7PzIhaxL7Y';
const SPEC_COORDS = [
  [50.10228, 8.69821],
  [50.10201, 8.69567],
  [50.10063, 8.6915],
  [50.09878, 8.68752],
];

function baseRequest(over: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    origin: ATL,
    destination: KNX,
    waypoints: [],
    truck: DEFAULT_TRUCK_PROFILE,
    departAtMs: T0,
    ...over,
  };
}

/** A plausible HERE v8 success payload built on the spec polyline. */
function hereResponse(meters = 300_000, seconds = 12_000) {
  return {
    routes: [
      {
        sections: [
          {
            summary: { length: meters, duration: seconds },
            polyline: SPEC_POLYLINE,
            actions: [
              { instruction: 'Head north on I-75.' },
              { instruction: 'Take exit 368 toward Knoxville.' },
            ],
          },
        ],
      },
    ],
  };
}

async function main() {
  /* ------------------------------------------------ polyline decoder */
  {
    const d = decodeFlexiblePolyline(SPEC_POLYLINE);
    check(
      'poly: decodes 4 positions at precision 5',
      d.positions.length === 4 && d.precision === 5,
    );
    check(
      'poly: matches spec reference coordinates',
      d.positions.every(
        (p, i) => approx(p[0], SPEC_COORDS[i][0], 1e-4) && approx(p[1], SPEC_COORDS[i][1], 1e-4),
      ),
      d.positions,
    );
    let threw = 0;
    for (const bad of ['', 'B', 'BFoz5xJ67i1B1B7PzIhaxL7Y!!', 'zzzzzz~']) {
      try {
        decodeFlexiblePolyline(bad);
      } catch {
        threw++;
      }
    }
    check('poly: malformed inputs throw (no silent garbage)', threw >= 3, threw);
  }

  /* ------------------------------------------------ hazmat mapping */
  {
    check('hazmat: class 1 → explosive', hazmatToHereGoods('1') === 'explosive');
    check('hazmat: subclass 1.1 → explosive', hazmatToHereGoods('1.1') === 'explosive');
    check('hazmat: class 3 → flammable', hazmatToHereGoods('3') === 'flammable');
    check('hazmat: class 7 → radioactive', hazmatToHereGoods('7') === 'radioactive');
    check('hazmat: none → null', hazmatToHereGoods(null) === null);
    check('hazmat: unknown → conservative "other"', hazmatToHereGoods('weird') === 'other');
  }

  /* ------------------------------------------------ URL building */
  {
    const url = buildHereRouteUrl(baseRequest(), 'TESTKEY');
    const q = new URL(url).searchParams;
    check('url: truck transport mode', q.get('transportMode') === 'truck');
    check('url: origin/destination set', q.get('origin')!.startsWith('33.749'));
    check('url: height 13.5 ft → 411 cm', q.get('truck[height]') === '411');
    check('url: width 8.5 ft → 259 cm', q.get('truck[width]') === '259');
    check('url: length 70 ft → 2134 cm', q.get('truck[length]') === '2134');
    check('url: weight 80,000 lb → 36287 kg', q.get('truck[grossWeight]') === '36287');
    check('url: axle count carried', q.get('truck[axleCount]') === '5');
    check('url: no hazmat param without placard', q.get('truck[shippedHazardousGoods]') === null);
    check('url: api key as param', q.get('apiKey') === 'TESTKEY');
    check(
      'url: polyline+summary+actions requested',
      q.get('return') === 'polyline,summary,actions',
    );

    const hazUrl = buildHereRouteUrl(
      baseRequest({ truck: { ...DEFAULT_TRUCK_PROFILE, hazmatClass: '3' } }),
      'k',
    );
    check(
      'url: hazmat placard becomes shippedHazardousGoods',
      new URL(hazUrl).searchParams.get('truck[shippedHazardousGoods]') === 'flammable',
    );
    const viaUrl = buildHereRouteUrl(baseRequest({ waypoints: [{ lat: 34.5, lng: -84.1 }] }), 'k');
    check('url: waypoints become via params', new URL(viaUrl).searchParams.has('via'));
  }

  /* ------------------------------------------------ response parsing */
  {
    const parsed = parseHereResponse(hereResponse());
    check(
      'parse: distance/duration/geometry extracted',
      parsed !== null &&
        parsed.meters === 300_000 &&
        parsed.seconds === 12_000 &&
        parsed.positions.length === 4 &&
        parsed.instructions.length === 2,
    );
    check('parse: junk → null', parseHereResponse({ junk: true }) === null);
    check('parse: empty routes → null', parseHereResponse({ routes: [] }) === null);
    check(
      'parse: negative length → null',
      parseHereResponse({
        routes: [
          { sections: [{ summary: { length: -5, duration: 10 }, polyline: SPEC_POLYLINE }] },
        ],
      }) === null,
    );
    check(
      'parse: corrupt polyline → null (not partial data)',
      parseHereResponse({
        routes: [{ sections: [{ summary: { length: 10, duration: 10 }, polyline: '!!!' }] }],
      }) === null,
    );
  }

  /* ------------------------------------------------ route points */
  {
    const pts = toRoutePoints(
      SPEC_COORDS.map(([lat, lng]) => ({ lat, lng })),
      186,
    );
    check(
      'points: start at 0, end at provider total',
      pts[0].routeMile === 0 && approx(pts[pts.length - 1].routeMile, 186, 0.2),
      pts,
    );
    check(
      'points: monotonically increasing',
      pts.every((p, i) => i === 0 || p.routeMile > pts[i - 1].routeMile),
    );
  }

  /* ------------------------------------------------ port behavior */
  {
    // No key → null, and fetch is NEVER called.
    let calls = 0;
    const counting = async () => {
      calls++;
      return { status: 200, json: async () => hereResponse() };
    };
    const noKey = createHereRoutingPort(counting, undefined);
    check('port: no key → null without any call', (await noKey.route(baseRequest())) === null);
    check('port: no key really made zero calls', calls === 0);

    // Success path.
    const okPort = createHereRoutingPort(counting, 'SECRET-KEY-123', { nowMs: () => T0 });
    const res = await okPort.route(baseRequest());
    check('port: live route returned', res !== null);
    if (res) {
      check('port: miles from meters', approx(res.route.totalMiles, 186.4, 0.2));
      check('port: drive minutes from duration', approx(res.route.driveMinutes, 200, 1));
      check('port: provider attribution', res.provider.includes('HERE'));
      check('port: instructions surfaced', (res.instructions ?? []).length === 2);
      check('port: key never leaks into result', !JSON.stringify(res).includes('SECRET-KEY-123'));
    }

    // Cache: identical request → no second fetch; different truck → refetch.
    const before = calls;
    await okPort.route(baseRequest());
    check('port: identical request served from cache', calls === before);
    await okPort.route(baseRequest({ truck: { ...DEFAULT_TRUCK_PROFILE, heightFt: 12 } }));
    check('port: different truck profile is a different route', calls === before + 1);
    check(
      'port: cache key separates truck profiles',
      routeCacheKey(baseRequest()) !==
        routeCacheKey(baseRequest({ truck: { ...DEFAULT_TRUCK_PROFILE, heightFt: 12 } })),
    );

    // TTL expiry with injected clock.
    let now = T0;
    let ttlCalls = 0;
    const ttlPort = createHereRoutingPort(
      async () => {
        ttlCalls++;
        return { status: 200, json: async () => hereResponse() };
      },
      'k',
      { nowMs: () => now, cacheTtlMs: 1000 },
    );
    await ttlPort.route(baseRequest());
    now += 500;
    await ttlPort.route(baseRequest());
    check('port: within TTL → cached', ttlCalls === 1);
    now += 1000;
    await ttlPort.route(baseRequest());
    check('port: after TTL → refetched', ttlCalls === 2);

    // Retry: one retry on 5xx, none on 4xx.
    let seq = 0;
    const flaky = createHereRoutingPort(
      async () => {
        seq++;
        return seq === 1
          ? { status: 503, json: async () => ({}) }
          : { status: 200, json: async () => hereResponse() };
      },
      'k',
      { nowMs: () => T0 },
    );
    check('port: 5xx retried once then succeeds', (await flaky.route(baseRequest())) !== null);
    check('port: exactly two attempts', seq === 2);

    let badCalls = 0;
    const unauthorized = createHereRoutingPort(
      async () => {
        badCalls++;
        return { status: 401, json: async () => ({}) };
      },
      'k',
      { nowMs: () => T0 },
    );
    check('port: 4xx → null', (await unauthorized.route(baseRequest())) === null);
    check('port: 4xx never retried (quota protection)', badCalls === 1);

    let throwCalls = 0;
    const down = createHereRoutingPort(
      async () => {
        throwCalls++;
        throw new Error('network down https://router.hereapi.com?apiKey=SHOULD-NOT-ESCAPE');
      },
      'k',
      { nowMs: () => T0 },
    );
    check('port: thrown fetch fails soft to null', (await down.route(baseRequest())) === null);
    check('port: throw retried once then gave up', throwCalls === 2);

    // Free-tier cap: per-instance hourly budget, resets after an hour.
    let capNow = T0;
    let capCalls = 0;
    const capped = createHereRoutingPort(
      async () => {
        capCalls++;
        return { status: 200, json: async () => hereResponse() };
      },
      'k',
      { nowMs: () => capNow, hourlyCap: 2, cacheTtlMs: 1 },
    );
    await capped.route(baseRequest());
    capNow += 10;
    await capped.route(baseRequest({ destination: { lat: 36.1, lng: -86.7 } }));
    capNow += 10;
    const overCap = await capped.route(baseRequest({ destination: { lat: 32.3, lng: -86.3 } }));
    check('port: over hourly cap → null (free tier protected)', overCap === null);
    check('port: cap really stopped the call', capCalls === 2);
    capNow += 3_600_001;
    const nextWindow = await capped.route(baseRequest({ destination: { lat: 30.4, lng: -84.3 } }));
    check('port: cap window resets after an hour', nextWindow !== null && capCalls === 3);
  }

  /* ------------------------------------------------ composeQuote wiring */
  {
    const goodDeps = {
      loadListings: async () => [],
      weather: nullWeatherPort,
      fuelPrice: async () => null,
    };
    const req = quoteRequestSchema.parse({
      origin: { label: 'Atlanta', position: ATL },
      destination: { label: 'Knoxville', position: KNX },
      departAtMs: T0,
      clocks: {},
    });
    check('schema: truck defaults applied', req.truck.heightFt === 13.5 && req.truck.axles === 5);
    check(
      'schema: absurd height rejected',
      !quoteRequestSchema.safeParse({ ...req, truck: { heightFt: 20 } }).success,
    );
    check(
      'schema: hazmat class validated',
      quoteRequestSchema.safeParse({ ...req, truck: { hazmatClass: '3' } }).success &&
        !quoteRequestSchema.safeParse({ ...req, truck: { hazmatClass: 'flammable' } }).success,
    );

    // Live routing port → real geometry drives the whole quote.
    let weatherPoints: number[] = [];
    const spyWeather = {
      name: 'spy',
      alongRoute: async (pts: { routeMile: number }[]) => {
        weatherPoints = pts.map((p) => p.routeMile);
        return { bands: [], alerts: [] };
      },
    };
    const livePort = createHereRoutingPort(
      async () => ({ status: 200, json: async () => hereResponse() }),
      'k',
      { nowMs: () => T0 },
    );
    const live = await composeQuote(req, { ...goodDeps, weather: spyWeather, routing: livePort });
    check('quote: live route not an estimate', live.ok && live.routeSummary.isEstimate === false);
    if (live.ok) {
      check('quote: live miles used', approx(live.routeSummary.miles, 186.4, 0.2));
      check('quote: provider named as method', live.routeSummary.method.includes('HERE'));
      check('quote: instructions surfaced', (live.routeSummary.instructions ?? []).length === 2);
      check(
        'quote: weather sampled from live geometry',
        weatherPoints.length > 0 && approx(weatherPoints[weatherPoints.length - 1], 186.4, 0.5),
        weatherPoints,
      );
      check('quote: routing disclaimer present', live.routingDisclaimer.length > 20);
      check(
        'quote: no fallback warning on live success',
        !live.warnings.some((w) => w.includes('live truck routing unavailable')),
      );
    }

    // Routing port answering null → estimate fallback + warning.
    const fallback = await composeQuote(req, {
      ...goodDeps,
      routing: { name: 'null', route: async () => null },
    });
    check(
      'quote: null routing falls back to estimate',
      fallback.ok && fallback.routeSummary.isEstimate === true,
    );
    if (fallback.ok) {
      check(
        'quote: fallback warning recorded',
        fallback.warnings.some((w) => w.includes('live truck routing unavailable')),
      );
      check('quote: estimate method labeled', fallback.routeSummary.method.includes('estimate'));
    }

    // Routing port hanging → budget cutoff → fallback.
    const hung = await composeQuote(req, {
      ...goodDeps,
      routing: { name: 'hang', route: () => new Promise(() => {}) },
      routingBudgetMs: 50,
    });
    check(
      'quote: hung routing cut off by budget → estimate',
      hung.ok && hung.routeSummary.isEstimate === true,
    );

    // No routing dep at all (Phase 4 behavior preserved).
    const noPort = await composeQuote(req, goodDeps);
    check(
      'quote: without routing dep, no fallback warning',
      noPort.ok &&
        noPort.routeSummary.isEstimate === true &&
        !noPort.warnings.some((w) => w.includes('live truck routing')),
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
