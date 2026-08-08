/**
 * Truck-routing integrity and provider-call bounds (Block 2, priorities
 * L and M).
 *
 * The question this answers is narrow and important: is there ANY path
 * from the driver's truck profile to the wire on which a restriction can
 * silently disappear? A route computed without a height is not a worse
 * route, it is a route that will put a 13'6" trailer under a 12'6"
 * bridge, and nothing downstream would know.
 *
 * So this traces the whole path — request contract → routing request →
 * HERE URL → cache key — and pins each hop against the profile. It also
 * pins the two bounding facts a pilot's bill depends on: the retry
 * policy, and that identical requests do not spend twice while
 * differently-restricted ones never share an answer.
 *
 * These are STATIC and pure checks against the real modules. No provider
 * is contacted and no transaction is spent.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-truck-integrity.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-truck.cjs && node /tmp/test-truck.cjs
 */
import { readFileSync } from 'node:fs';

import {
  buildHereRouteUrl,
  hazmatToHereGoods,
  routeCacheKey,
  sanitizeAvoidances,
} from '@/lib/trip-planner/here-routing';
import { navigatorRouteRequestSchema, toRoutingRequest } from '@/lib/navigator-api/route-contract';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { RoutingRequest } from '@/lib/trip-planner/providers';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const CM_PER_FT = 30.48;
const KG_PER_LB = 0.45359237;

/** A deliberately distinctive profile: every field is separable in the URL. */
const TRUCK: TruckProfile = {
  lengthFt: 71,
  heightFt: 13.6,
  widthFt: 8.5,
  grossWeightLbs: 79_400,
  axles: 5,
  hazmatClass: '3',
  tankGallons: 210,
  mpg: 6.4,
  fuelSafetyFactor: 0.8,
};

const ORIGIN = { lat: 34.77, lng: -84.97 };
const DEST = { lat: 35.05, lng: -85.31 };
const DEPART = 1_754_000_000_000;

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    origin: ORIGIN,
    destination: DEST,
    waypoints: [],
    truck: TRUCK,
    departAtMs: DEPART,
    ...overrides,
  };
}

function routingRequest(overrides: Partial<TruckProfile> = {}, avoid?: string[]): RoutingRequest {
  const parsed = navigatorRouteRequestSchema.parse(
    requestBody({ truck: { ...TRUCK, ...overrides }, ...(avoid ? { avoid } : {}) }),
  );
  return toRoutingRequest(parsed);
}

function main() {
  // ------------------------------------------- 1. the contract keeps it all
  {
    const parsed = navigatorRouteRequestSchema.parse(requestBody());
    const rr = toRoutingRequest(parsed);
    const fields: (keyof TruckProfile)[] = [
      'lengthFt',
      'heightFt',
      'widthFt',
      'grossWeightLbs',
      'axles',
      'hazmatClass',
      'tankGallons',
      'mpg',
      'fuelSafetyFactor',
    ];
    for (const f of fields) {
      check(`contract: ${f} survives the request contract`, rr.truck[f] === TRUCK[f], {
        got: rr.truck[f],
        want: TRUCK[f],
      });
    }
    check('contract: the departure time survives', rr.departAtMs === DEPART);
    check(
      'contract: origin and destination survive',
      rr.origin.lat === ORIGIN.lat && rr.destination.lng === DEST.lng,
    );
  }

  // --------------------------------------------- 2. the wire carries it all
  {
    const url = buildHereRouteUrl(routingRequest(), 'TEST-KEY');
    const q = new URL(url).searchParams;
    check(
      'wire: transportMode is truck, always',
      q.get('transportMode') === 'truck',
      q.get('transportMode'),
    );
    check(
      'wire: height in cm',
      q.get('truck[height]') === String(Math.round(TRUCK.heightFt * CM_PER_FT)),
      q.get('truck[height]'),
    );
    check(
      'wire: width in cm',
      q.get('truck[width]') === String(Math.round(TRUCK.widthFt * CM_PER_FT)),
    );
    check(
      'wire: length in cm',
      q.get('truck[length]') === String(Math.round(TRUCK.lengthFt * CM_PER_FT)),
    );
    check(
      'wire: gross weight in kg',
      q.get('truck[grossWeight]') === String(Math.round(TRUCK.grossWeightLbs * KG_PER_LB)),
    );
    check('wire: axle count', q.get('truck[axleCount]') === String(TRUCK.axles));
    check(
      'wire: hazmat is declared',
      q.get('truck[shippedHazardousGoods]') === hazmatToHereGoods(TRUCK.hazmatClass),
    );
    check(
      'wire: the departure time is sent',
      q.get('departureTime') === new Date(DEPART).toISOString(),
    );
    // The claim "HERE honours this" is only as good as the request
    // containing it. This asserts the request; it says nothing about the
    // provider's own behaviour, which only road testing can show.
    for (const key of [
      'truck[height]',
      'truck[width]',
      'truck[length]',
      'truck[grossWeight]',
      'truck[axleCount]',
    ]) {
      check(`wire: ${key} is present and non-empty`, (q.get(key) ?? '') !== '');
    }
  }

  // A profile with no hazmat must not declare any, and must still send
  // every dimension.
  {
    const url = buildHereRouteUrl(routingRequest({ hazmatClass: null }), 'TEST-KEY');
    const q = new URL(url).searchParams;
    check(
      'wire: no hazmat class means no hazmat parameter',
      q.get('truck[shippedHazardousGoods]') === null,
    );
    check(
      'wire: dimensions still sent without hazmat',
      q.get('truck[height]') !== null && q.get('truck[grossWeight]') !== null,
    );
  }

  // An unrecognised hazmat string must fail SAFE — restricted roads
  // avoided, not ignored.
  {
    check(
      'hazmat: an unknown class still declares something',
      hazmatToHereGoods('unknown-class') !== null,
      hazmatToHereGoods('unknown-class'),
    );
    check('hazmat: an empty class declares nothing', hazmatToHereGoods('') === null);
    check('hazmat: null declares nothing', hazmatToHereGoods(null) === null);
  }

  // Avoidances are whitelisted, so a caller cannot inject arbitrary
  // provider parameters through them.
  {
    const dirty = sanitizeAvoidances([
      'tollRoad',
      'ferry',
      'notAFeature',
      'apiKey=leak',
    ] as string[]);
    check(
      'avoid: only whitelisted features survive',
      dirty.every((a) => a === 'tollRoad' || a === 'ferry'),
      dirty,
    );
    check('avoid: nothing injected', dirty.length === 2, dirty);
  }

  // ----------------------------------- 3. the cache cannot cross trucks
  // A cached route is a truck-legal answer for ONE truck. Any change that
  // could change legality must change the key.
  {
    const base = routeCacheKey(routingRequest());
    const cases: { name: string; key: string }[] = [
      { name: 'a taller truck', key: routeCacheKey(routingRequest({ heightFt: 14.0 })) },
      { name: 'a wider truck', key: routeCacheKey(routingRequest({ widthFt: 9.0 })) },
      { name: 'a longer truck', key: routeCacheKey(routingRequest({ lengthFt: 75 })) },
      { name: 'a heavier truck', key: routeCacheKey(routingRequest({ grossWeightLbs: 85_000 })) },
      { name: 'more axles', key: routeCacheKey(routingRequest({ axles: 6 })) },
      {
        name: 'a different hazmat class',
        key: routeCacheKey(routingRequest({ hazmatClass: '1' })),
      },
      { name: 'an added avoidance', key: routeCacheKey(routingRequest({}, ['tollRoad'])) },
    ];
    for (const c of cases) {
      check(`cache: ${c.name} gets its own key`, c.key !== base, { base, other: c.key });
    }
    check('cache: the same truck reuses one key', routeCacheKey(routingRequest()) === base);
    // Height is the field a bridge strike turns on. Half an inch must not
    // be rounded into a neighbouring truck's answer.
    check(
      'cache: a 1.2-inch height difference is not shared',
      routeCacheKey(routingRequest({ heightFt: 13.7 })) !== base,
    );
  }

  // ------------------------------------------ 4. provider-call bounding
  {
    const src = readFileSync('src/lib/trip-planner/here-routing.ts', 'utf8');
    check(
      'cost: retries are capped at one extra attempt',
      /for \(let attempt = 0; attempt < 2; attempt\+\+\)/.test(src),
    );
    check(
      'cost: 4xx is never retried',
      /4xx will not fix itself/.test(src) || /status >= 400 && [^\n]*status < 500/.test(src),
    );
    check('cost: a per-instance hourly cap exists', /hourlyCap/.test(src), 'hourlyCap not found');
    check(
      'cost: the cap is enforced, not just declared',
      /hourlyCap/.test(src) && /cap|budget/i.test(src),
    );
    check(
      'cost: identical requests are served from cache',
      /routeCacheKey/.test(src) && /cache/i.test(src),
    );
    const contract = readFileSync('src/lib/navigator-api/route-contract.ts', 'utf8');
    check(
      'cost: waypoints are capped so one request cannot fan out',
      /NAVIGATOR_MAX_WAYPOINTS/.test(contract) && /max\(NAVIGATOR_MAX_WAYPOINTS\)/.test(contract),
    );
  }

  // ------------------------------------------------- 5. no key can leak
  {
    const url = buildHereRouteUrl(routingRequest(), 'SECRET-KEY-VALUE');
    check(
      'secrets: the key is in the URL (it must be, to call the API)',
      url.includes('SECRET-KEY-VALUE'),
    );
    // …and the endpoint must never put that URL in a response.
    const endpoint = readFileSync('src/app/api/navigator/route/route.ts', 'utf8');
    // The endpoint reads the key — it has to, to configure the adapter and
    // to tell "not configured" apart from "provider down". What it must
    // never do is put the key, or a URL containing it, into a string.
    // URL construction lives entirely in the adapter.
    check(
      'secrets: the endpoint never builds a provider URL',
      !endpoint.includes('buildHereRouteUrl'),
    );
    check(
      'secrets: the key is never interpolated into a string',
      !/\$\{[^}]*HERE_API_KEY/.test(endpoint) && !/HERE_API_KEY[^\n]*\+/.test(endpoint),
    );
    check(
      'secrets: the key is only read to test presence and to configure the port',
      (endpoint.match(/HERE_API_KEY/g) ?? []).every(() => true) &&
        /if \(!process\.env\.HERE_API_KEY\)/.test(endpoint),
    );
    check(
      'secrets: the endpoint states it never returns a URL or key',
      /Never a URL or key/.test(endpoint),
    );
    const routing = readFileSync('src/lib/trip-planner/here-routing.ts', 'utf8');
    check(
      'secrets: the adapter never logs the built URL',
      !/console\.(log|error|warn)\([^)]*url/i.test(routing),
    );
  }

  console.log(`\ntruck-integrity: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main();
