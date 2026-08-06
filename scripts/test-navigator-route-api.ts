/**
 * N8a — Route API & truck route validation. Exhaustive offline tests for
 * the layers that guarantee every navigation session starts from a
 * VALIDATED truck route:
 *
 *   1. truck-profile validation (impossible dimensions, weights, trailer
 *      combinations, hazmat divisions) — no provider request on failure
 *   2. the request schema + provider-neutral serialization
 *   3. the HERE serializer, field by field — a regression canary proving
 *      no truck restriction can silently disappear from the wire
 *   4. the response parser: notices retained, malformed payloads rejected
 *   5. the route validator: all five states, each reject reason
 *   6. cost controls: cache, coalescing, hourly cap, zero calls on
 *      invalid input — through the REAL adapter with a scripted fetch
 *   7. endpoint structure: flag gate, strict limiter, no key leakage
 *
 * Run:
 *   npx esbuild scripts/test-navigator-route-api.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-nav-route-api.cjs \
 *   && node /tmp/test-nav-route-api.cjs
 */
import { readFileSync } from 'node:fs';
import {
  validateNavigatorTruckProfile,
  validateHazmatClass,
  MAX_LBS_PER_AXLE,
} from '@/lib/navigator/truck-validation';
import {
  navigatorRouteRequestSchema,
  toRoutingRequest,
  validateRouteRequest,
  NAVIGATOR_MAX_WAYPOINTS,
} from '@/lib/navigator-api/route-contract';
import {
  validateRoute,
  DESTINATION_REJECT_MI,
  DESTINATION_REVIEW_MI,
  type ParsedRouteForValidation,
} from '@/lib/navigator/route-validation';
import {
  buildHereRouteUrl,
  parseHereResponse,
  createHereRoutingPort,
  routeCacheKey,
  type HereFetch,
  type HereRouteOutcome,
} from '@/lib/trip-planner/here-routing';
import type { RoutingRequest } from '@/lib/trip-planner/providers';
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
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
const ORIGIN = { lat: 35.0456, lng: -85.3097 }; // Chattanooga
const DEST = { lat: 36.1627, lng: -86.7816 }; // Nashville
const T0 = 1_754_000_000_000;

const req = (over: Partial<RoutingRequest> = {}): RoutingRequest => ({
  origin: ORIGIN,
  destination: DEST,
  waypoints: [],
  truck: TRUCK,
  departAtMs: T0,
  ...over,
});

async function main() {
  // ------------------------------------------------ 1. truck validation
  {
    check('plausible 5-axle semi passes', validateNavigatorTruckProfile(TRUCK).length === 0);

    const bad = (over: Partial<TruckProfile>, code: string, name: string) => {
      const issues = validateNavigatorTruckProfile({ ...TRUCK, ...over });
      check(
        name,
        issues.some((i) => i.code === code),
        issues,
      );
    };
    bad({ heightFt: 16 }, 'out-of-range', 'impossible height (16 ft) rejected');
    bad({ heightFt: 2 }, 'out-of-range', 'impossible height (2 ft) rejected');
    bad({ widthFt: 12 }, 'out-of-range', 'impossible width rejected');
    bad({ lengthFt: 500 }, 'out-of-range', 'impossible length rejected');
    bad({ grossWeightLbs: 500_000 }, 'out-of-range', 'impossible weight rejected');
    bad({ grossWeightLbs: 500 }, 'out-of-range', 'toy weight rejected');
    bad({ axles: 1 }, 'out-of-range', 'single axle rejected');
    bad({ axles: 5.5 }, 'axles-not-integer', 'fractional axles rejected');
    bad({ heightFt: Number.NaN }, 'missing-or-not-a-number', 'missing height (NaN) rejected');
    bad(
      { heightFt: undefined as unknown as number },
      'missing-or-not-a-number',
      'missing height (undefined) rejected',
    );
    bad(
      { grossWeightLbs: Number.POSITIVE_INFINITY },
      'missing-or-not-a-number',
      'Infinity rejected',
    );

    // Trailer-combination impossibilities (cross-field).
    bad(
      { grossWeightLbs: 80_000, axles: 3 },
      'weight-exceeds-axle-capacity',
      `80k lbs on 3 axles rejected (> ${MAX_LBS_PER_AXLE}/axle)`,
    );
    bad(
      { lengthFt: 60, axles: 2, grossWeightLbs: 39_000 },
      'combination-needs-axles',
      '60 ft on 2 axles rejected',
    );
    bad(
      { lengthFt: 100, axles: 4, grossWeightLbs: 79_000 },
      'multi-trailer-needs-axles',
      '100 ft on 4 axles rejected',
    );
    check(
      'legal turnpike double passes (105 ft, 9 axles, 148k)',
      validateNavigatorTruckProfile({
        ...TRUCK,
        lengthFt: 105,
        axles: 9,
        grossWeightLbs: 148_000,
      }).length === 0,
    );

    // Hazmat combinations.
    check('hazmat null valid', validateHazmatClass(null).length === 0);
    check('hazmat "3" valid', validateHazmatClass('3').length === 0);
    check('hazmat "2.1" valid', validateHazmatClass('2.1').length === 0);
    check('hazmat "1.4" valid', validateHazmatClass('1.4').length === 0);
    check('hazmat " 8 " trims and passes', validateHazmatClass(' 8 ').length === 0);
    const hz = (s: string) => validateHazmatClass(s).map((i) => i.code);
    check('hazmat "X" rejected', hz('X').includes('hazmat-format'));
    check('hazmat "10" rejected', hz('10').includes('hazmat-format'));
    check('hazmat "0" rejected', hz('0').includes('hazmat-format'));
    check(
      'hazmat "3.1" rejected (class 3 has no divisions)',
      hz('3.1').includes('hazmat-division-invalid'),
    );
    check(
      'hazmat "2.4" rejected (no such division)',
      hz('2.4').includes('hazmat-division-invalid'),
    );
    check(
      'hazmat "1.7" rejected (explosives end at 1.6)',
      hz('1.7').includes('hazmat-division-invalid'),
    );
    check('hazmat "" rejected', hz('').includes('hazmat-empty'));
    check(
      'invalid hazmat rejects the whole profile',
      validateNavigatorTruckProfile({ ...TRUCK, hazmatClass: '3.9' }).length > 0,
    );
  }

  // ------------------------------------------- 2. request schema + shape
  {
    const good = {
      origin: ORIGIN,
      destination: DEST,
      truck: TRUCK,
      departAtMs: T0,
    };
    check(
      'schema: minimal valid request parses',
      navigatorRouteRequestSchema.safeParse(good).success,
    );
    check(
      'schema: waypoints default to []',
      (() => {
        const p = navigatorRouteRequestSchema.safeParse(good);
        return p.success && Array.isArray(p.data.waypoints) && p.data.waypoints.length === 0;
      })(),
    );
    const rejects = (over: object, name: string) =>
      check(name, !navigatorRouteRequestSchema.safeParse({ ...good, ...over }).success);
    rejects({ origin: { lat: 91, lng: 0 } }, 'schema: lat > 90 rejected');
    rejects({ destination: { lat: 0, lng: 181 } }, 'schema: lng > 180 rejected');
    rejects({ departAtMs: -5 }, 'schema: negative departure rejected');
    rejects({ departAtMs: 1.5 }, 'schema: fractional departure rejected');
    rejects({ truck: undefined }, 'schema: missing truck rejected');
    rejects(
      { waypoints: Array(NAVIGATOR_MAX_WAYPOINTS + 1).fill(ORIGIN) },
      'schema: too many waypoints rejected',
    );
    rejects({ avoid: ['motorway'] }, 'schema: unknown avoidance rejected at the edge');

    const parsed = navigatorRouteRequestSchema.parse({ ...good, avoid: ['tollRoad'] });
    const routing = toRoutingRequest(parsed);
    check(
      'serialization: origin/destination/truck/departure carried verbatim',
      routing.origin === parsed.origin &&
        routing.destination === parsed.destination &&
        routing.departAtMs === T0 &&
        routing.truck.heightFt === TRUCK.heightFt &&
        routing.avoid?.[0] === 'tollRoad',
    );

    check(
      'degenerate route (origin = destination) rejected before any provider work',
      validateRouteRequest(navigatorRouteRequestSchema.parse({ ...good, destination: ORIGIN }))
        .length > 0,
    );
    check(
      'waypoint duplicating an endpoint rejected',
      validateRouteRequest(navigatorRouteRequestSchema.parse({ ...good, waypoints: [ORIGIN] }))
        .length > 0,
    );
    check('clean request has no problems', validateRouteRequest(parsed).length === 0);
  }

  // ------------------------- 3. HERE serializer — field-disappearance canary
  {
    const hazmatTruck = { ...TRUCK, hazmatClass: '2.1' };
    const url = new URL(
      buildHereRouteUrl(
        req({
          truck: hazmatTruck,
          waypoints: [{ lat: 35.5, lng: -86 }],
          avoid: ['tollRoad', 'ferry'],
        }),
        'TEST-KEY',
      ),
    );
    const p = url.searchParams;

    // THE CANARY: every truck restriction that exists in the profile MUST
    // have a serialized form. If someone removes a line from the
    // serializer, this list catches it by name.
    const REQUIRED_RESTRICTION_PARAMS = [
      'truck[height]',
      'truck[width]',
      'truck[length]',
      'truck[grossWeight]',
      'truck[axleCount]',
      'truck[shippedHazardousGoods]',
    ];
    for (const param of REQUIRED_RESTRICTION_PARAMS) {
      const v = p.get(param);
      check(`serializer canary: ${param} present and non-empty`, v !== null && v !== '', param);
    }
    check(
      'serializer canary: request geometry present (origin/destination/via/departureTime)',
      p.get('origin') !== null &&
        p.get('destination') !== null &&
        p.getAll('via').length === 1 &&
        p.get('departureTime') !== null,
    );
    check('serializer: transport mode is truck', p.get('transportMode') === 'truck');

    // Unit conversions, pinned exactly (a wrong unit is as bad as a missing field).
    check('serializer: 13.5 ft height → 411 cm', p.get('truck[height]') === '411');
    check('serializer: 8.5 ft width → 259 cm', p.get('truck[width]') === '259');
    check('serializer: 73 ft length → 2225 cm', p.get('truck[length]') === '2225');
    check('serializer: 80,000 lbs → 36287 kg', p.get('truck[grossWeight]') === '36287');
    check('serializer: 5 axles verbatim', p.get('truck[axleCount]') === '5');
    check('serializer: hazmat 2.1 → gas', p.get('truck[shippedHazardousGoods]') === 'gas');
    check('serializer: avoidances forwarded', p.get('avoid[features]') === 'tollRoad,ferry');
    check(
      'serializer: departure is the requested epoch, ISO-encoded',
      p.get('departureTime') === new Date(T0).toISOString(),
    );

    const noHazmat = new URL(buildHereRouteUrl(req(), 'TEST-KEY')).searchParams;
    check(
      'serializer: no hazmat → parameter honestly absent, not empty',
      noHazmat.get('truck[shippedHazardousGoods]') === null,
    );

    // Cache key covers every restriction field (a field outside the key
    // would let two different trucks share one cached route).
    const keyA = routeCacheKey(req());
    check(
      'cache key: height changes the key',
      routeCacheKey(req({ truck: { ...TRUCK, heightFt: 12.5 } })) !== keyA,
    );
    check(
      'cache key: weight changes the key',
      routeCacheKey(req({ truck: { ...TRUCK, grossWeightLbs: 60_000 } })) !== keyA,
    );
    check(
      'cache key: axles change the key',
      routeCacheKey(req({ truck: { ...TRUCK, axles: 6 } })) !== keyA,
    );
    check(
      'cache key: hazmat changes the key',
      routeCacheKey(req({ truck: { ...TRUCK, hazmatClass: '3' } })) !== keyA,
    );
    check(
      'cache key: avoidances change the key',
      routeCacheKey(req({ avoid: ['ferry'] })) !== keyA,
    );
  }

  // ---------------------------------------- 4. parser — notices + malformed
  {
    // Deterministic tiny polyline: encoded from real HERE flexible-polyline
    // examples is overkill here — reuse a section WITHOUT polyline plus one
    // with, exactly as the existing maneuver tests do. Simplest: craft via
    // two sections where only summaries + actions matter, polyline borrowed
    // from the corpus below.
    const POLY = 'BFoz5xJ67i1B1B7PzIhaxL7Y'; // 3-point sample from the flexible-polyline spec
    const happy = {
      routes: [
        {
          sections: [
            {
              summary: { length: 160_934, duration: 7200 },
              polyline: POLY,
              actions: [
                { action: 'depart', instruction: 'Head north on I-24 W.', offset: 0 },
                { action: 'arrive', instruction: 'Arrive at destination.', offset: 2 },
              ],
              notices: [
                { title: 'Route may include a toll road.', code: 'tollRoad', severity: 'info' },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parseHereResponse(happy);
    check('parser: happy path parses', parsed !== null);
    if (parsed) {
      check(
        'parser: notice retained with code/title/severity',
        parsed.notices.length === 1 &&
          parsed.notices[0].code === 'tollRoad' &&
          parsed.notices[0].severity === 'info',
      );
      check(
        'parser: summary/geometry/maneuvers all present',
        parsed.meters === 160_934 && parsed.positions.length >= 2 && parsed.maneuvers.length === 2,
      );
    }
    check(
      'parser: absent notices → empty array (never undefined)',
      (() => {
        const q = parseHereResponse({
          routes: [{ sections: [{ summary: { length: 100, duration: 60 }, polyline: POLY }] }],
        });
        return q !== null && Array.isArray(q.notices) && q.notices.length === 0;
      })(),
    );
    check(
      'parser: malformed notice entries skipped, well-formed kept',
      (() => {
        const q = parseHereResponse({
          routes: [
            {
              sections: [
                {
                  summary: { length: 100, duration: 60 },
                  polyline: POLY,
                  notices: [
                    { bogus: true },
                    { code: 'violatedVehicleRestriction', severity: 'critical' },
                  ],
                },
              ],
            },
          ],
        });
        return q !== null && q.notices.length === 1 && q.notices[0].severity === 'critical';
      })(),
    );
    check(
      'parser: notice flood capped at 50',
      (() => {
        const q = parseHereResponse({
          routes: [
            {
              sections: [
                {
                  summary: { length: 100, duration: 60 },
                  polyline: POLY,
                  notices: Array.from({ length: 500 }, (_, i) => ({ code: `n${i}` })),
                },
              ],
            },
          ],
        });
        return q !== null && q.notices.length === 50;
      })(),
    );

    // Malformed payloads must reject (null), never half-parse.
    check('parser: missing routes → null', parseHereResponse({}) === null);
    check(
      'parser: empty sections → null',
      parseHereResponse({ routes: [{ sections: [] }] }) === null,
    );
    check(
      'parser: negative summary → null',
      parseHereResponse({
        routes: [{ sections: [{ summary: { length: -5, duration: 60 }, polyline: POLY }] }],
      }) === null,
    );
    check(
      'parser: missing summary → null',
      parseHereResponse({ routes: [{ sections: [{ polyline: POLY }] }] }) === null,
    );
    check(
      'parser: corrupt polyline → null',
      parseHereResponse({
        routes: [
          {
            sections: [
              { summary: { length: 100, duration: 60 }, polyline: '@@@not-a-polyline@@@' },
            ],
          },
        ],
      }) === null,
    );
    check(
      'parser: no geometry anywhere → null',
      parseHereResponse({
        routes: [{ sections: [{ summary: { length: 100, duration: 60 } }] }],
      }) === null,
    );
  }

  // --------------------------------------- 5. validator — all five states
  {
    const goodRoute: ParsedRouteForValidation = {
      summary: { meters: 214_000, seconds: 7_800 }, // ~133 mi at ~61 mph
      firstPosition: ORIGIN,
      lastPosition: DEST,
      geometryPointCount: 900,
      maneuvers: [
        { action: 'depart', instruction: 'Head north.', offset: 0 },
        { action: 'exit', instruction: 'Take exit 320.', offset: 400 },
        { action: 'arrive', instruction: 'Arrive.', offset: 899 },
      ],
      notices: [],
    };
    const v = (route: Partial<ParsedRouteForValidation>) =>
      validateRoute(DEST, { kind: 'parsed', route: { ...goodRoute, ...route } });

    check(
      'state: provider failure',
      validateRoute(DEST, { kind: 'no-response' }).state === 'provider-failure',
    );
    check(
      'state: malformed response → rejected',
      validateRoute(DEST, { kind: 'malformed-response' }).state === 'rejected',
    );
    check('state: clean route → valid', v({}).state === 'valid');
    check(
      'state: info notice → valid-with-warning',
      v({ notices: [{ code: 'tollRoad', title: 'Toll road.', severity: 'info' }] }).state ===
        'valid-with-warning',
    );
    const critical = v({
      notices: [
        {
          code: 'violatedVehicleRestriction',
          title: 'Height restriction violated.',
          severity: 'critical',
        },
      ],
    });
    check(
      'state: critical restriction notice → REJECTED (never handed to a driver)',
      critical.state === 'rejected' &&
        critical.problems.some((p) => p.code.startsWith('restriction-violated:')),
    );

    check(
      'reject: missing geometry',
      v({ geometryPointCount: 0 }).problems.some((p) => p.code === 'missing-geometry'),
    );
    check(
      'reject: non-finite endpoint',
      v({ lastPosition: { lat: Number.NaN, lng: 0 } }).state === 'rejected',
    );
    check(
      'reject: zero distance',
      v({ summary: { meters: 0, seconds: 100 } }).problems.some(
        (p) => p.code === 'invalid-summary',
      ),
    );
    check(
      'reject: destination mismatch beyond 2 mi',
      (() => {
        const r = v({ lastPosition: { lat: DEST.lat + 0.1, lng: DEST.lng } }); // ~6.9 mi north
        return r.state === 'rejected' && r.problems.some((p) => p.code === 'destination-mismatch');
      })(),
    );
    check(
      'review: destination offset between 0.5 and 2 mi',
      (() => {
        const r = v({ lastPosition: { lat: DEST.lat + 0.012, lng: DEST.lng } }); // ~0.83 mi
        return (
          r.state === 'requires-review' && r.problems.some((p) => p.code === 'destination-offset')
        );
      })(),
    );
    check(
      'reject: maneuver with empty instruction',
      v({ maneuvers: [{ action: 'turn', instruction: '  ', offset: 5 }] }).problems.some(
        (p) => p.code === 'invalid-maneuver',
      ),
    );
    check(
      'reject: maneuver offset outside geometry',
      v({ maneuvers: [{ action: 'turn', instruction: 'Turn.', offset: 5000 }] }).problems.some(
        (p) => p.code === 'maneuver-offset-out-of-range',
      ),
    );
    check(
      'reject: maneuvers out of order',
      v({
        maneuvers: [
          { action: 'turn', instruction: 'A.', offset: 500 },
          { action: 'turn', instruction: 'B.', offset: 100 },
        ],
      }).problems.some((p) => p.code === 'maneuver-order'),
    );
    check(
      'review: no maneuvers at all (turn-by-turn cannot run)',
      v({ maneuvers: [] }).state === 'requires-review',
    );
    check(
      'review: implausible travel time (500 mph)',
      v({ summary: { meters: 800_000, seconds: 3_600 } }).state === 'requires-review',
    );
    check(
      'precedence: reject beats review beats warning',
      (() => {
        const r = v({
          summary: { meters: 800_000, seconds: 3_600 }, // review
          notices: [
            { code: 'tollRoad', title: 'Toll.', severity: 'info' }, // warning
            { code: 'violatedVehicleRestriction', title: 'Violated.', severity: 'critical' }, // reject
          ],
        });
        return r.state === 'rejected' && r.warnings.length === 1;
      })(),
    );
    check(
      'thresholds exported and ordered',
      DESTINATION_REJECT_MI > DESTINATION_REVIEW_MI && DESTINATION_REVIEW_MI > 0,
    );
  }

  // ------------------------------ 6. cost controls through the real adapter
  {
    const POLY = 'BFoz5xJ67i1B1B7PzIhaxL7Y';
    const okBody = {
      routes: [
        {
          sections: [
            {
              summary: { length: 160_934, duration: 7200 },
              polyline: POLY,
              actions: [{ action: 'depart', instruction: 'Go.', offset: 0 }],
            },
          ],
        },
      ],
    };
    const makePort = (
      responder: (url: string, calls: number) => { status: number; body: unknown },
      opts: { hourlyCap?: number } = {},
    ) => {
      let calls = 0;
      const outcomes: HereRouteOutcome[] = [];
      let now = T0;
      const fetchFn: HereFetch = async (url) => {
        calls += 1;
        const r = responder(url, calls);
        return { status: r.status, json: async () => r.body };
      };
      const port = createHereRoutingPort(fetchFn, 'TEST-KEY', {
        nowMs: () => now,
        hourlyCap: opts.hourlyCap,
        onOutcome: (o) => outcomes.push(o),
      });
      return { port, callCount: () => calls, outcomes, advance: (ms: number) => (now += ms) };
    };

    // cache: identical requests spend one transaction
    {
      const t = makePort(() => ({ status: 200, body: okBody }));
      const a = await t.port.route(req());
      const b = await t.port.route(req());
      check(
        'cost: second identical request served from cache',
        t.callCount() === 1 && a !== null && b === a,
      );
      check('cost: outcomes recorded ok → cache-hit', t.outcomes.join(',') === 'ok,cache-hit');
      check(
        'cost: result now carries maneuvers/notices/summary for the Navigator',
        a !== null &&
          Array.isArray(a.maneuvers) &&
          Array.isArray(a.notices) &&
          a.summary?.meters === 160_934 &&
          (a.geometryPointCount ?? 0) >= 2,
      );
    }

    // coalescing: two CONCURRENT identical requests spend one transaction
    {
      const t = makePort(() => ({ status: 200, body: okBody }));
      const [a, b] = await Promise.all([t.port.route(req()), t.port.route(req())]);
      check(
        'cost: concurrent identical requests coalesce to one call',
        t.callCount() === 1 && a !== null && b !== null,
      );
      check('cost: coalesced outcome observed', t.outcomes.includes('coalesced'));
    }

    // hourly cap: hard stop with no fetch
    {
      const t = makePort((_, calls) => ({ status: 200, body: okBody }), { hourlyCap: 2 });
      await t.port.route(req());
      await t.port.route(req({ departAtMs: T0 + 3_600_000 })); // different key
      const third = await t.port.route(req({ departAtMs: T0 + 7_200_000 }));
      check('cost: hourly cap stops the third call', third === null && t.callCount() === 2);
      check('cost: over-cap outcome reported', t.outcomes.includes('over-cap'));
    }

    // invalid profile: zero provider calls
    {
      const t = makePort(() => ({ status: 200, body: okBody }));
      const r = await t.port.route(req({ truck: { ...TRUCK, heightFt: 99 } }));
      check(
        'cost: impossible profile never reaches the provider',
        r === null && t.callCount() === 0,
      );
      check('cost: invalid-profile outcome reported', t.outcomes.join(',') === 'invalid-profile');
    }

    // no key: zero calls
    {
      let calls = 0;
      const port = createHereRoutingPort(async () => {
        calls++;
        return { status: 200, json: async () => okBody };
      }, undefined);
      check(
        'cost: no API key → no call, null result',
        (await port.route(req())) === null && calls === 0,
      );
    }

    // provider-error vs malformed-response distinction
    {
      const t = makePort(() => ({ status: 403, body: {} }));
      await t.port.route(req());
      check(
        'outcome: HTTP failure reported as provider-error',
        t.outcomes.join(',') === 'provider-error',
      );
    }
    {
      const t = makePort(() => ({ status: 200, body: { routes: [] } }));
      await t.port.route(req());
      check(
        'outcome: unparseable body reported as malformed-response',
        t.outcomes.join(',') === 'malformed-response',
      );
    }

    // 5xx retry still bounded (one retry), 4xx never retried
    {
      const t = makePort(() => ({ status: 500, body: {} }));
      await t.port.route(req());
      check('cost: 5xx retried exactly once', t.callCount() === 2);
    }
    {
      const t = makePort(() => ({ status: 400, body: {} }));
      await t.port.route(req());
      check('cost: 4xx never retried', t.callCount() === 1);
    }
  }

  // ---------------- 6b. pilot defect regressions — destination mismatch
  // (live pilot on deploy-preview-251: rejected:destination-mismatch).
  // The decode/concat pipeline is pinned against the OFFICIAL HERE
  // flexible-polyline spec vector, and the endpoint-distance tiers are
  // pinned with the measured-distance diagnostic code.
  {
    const SPEC = 'BFoz5xJ67i1B1B7PzIhaxL7Y'; // heremaps/flexible-polyline README vector
    const SPEC_PTS = [
      [50.10228, 8.69821],
      [50.10201, 8.69567],
      [50.10063, 8.6915],
      [50.09878, 8.68752],
    ];
    const body = {
      routes: [
        {
          sections: [
            {
              polyline: SPEC,
              summary: { length: 1000, duration: 60 },
              actions: [{ action: 'depart', instruction: 'Go', offset: 0 }],
            },
            {
              polyline: SPEC,
              summary: { length: 1000, duration: 60 },
              actions: [{ action: 'arrive', instruction: 'Arrive', offset: 3 }],
            },
          ],
        },
      ],
    };
    const parsed = parseHereResponse(body);
    check('spec vector: parse succeeds on a multi-section route', parsed !== null);
    if (parsed) {
      const last = parsed.positions[parsed.positions.length - 1];
      check(
        'spec vector: decode is exact and LAT-FIRST (no lat/lng reversal)',
        Math.abs(parsed.positions[0].lat - SPEC_PTS[0][0]) < 1e-9 &&
          Math.abs(parsed.positions[0].lng - SPEC_PTS[0][1]) < 1e-9,
        parsed.positions[0],
      );
      check(
        'spec vector: multi-section concat keeps order; final point = last section last',
        parsed.positions.length === 8 &&
          Math.abs(last.lat - SPEC_PTS[3][0]) < 1e-9 &&
          Math.abs(last.lng - SPEC_PTS[3][1]) < 1e-9,
        last,
      );
      check(
        'spec vector: arrive offset rebased into the concatenated geometry',
        parsed.maneuvers[parsed.maneuvers.length - 1].offset === 7,
      );
      const mv = validateRoute(
        { lat: SPEC_PTS[3][0], lng: SPEC_PTS[3][1] },
        {
          kind: 'parsed',
          route: {
            summary: { meters: 2000, seconds: 120 },
            firstPosition: parsed.positions[0],
            lastPosition: last,
            geometryPointCount: parsed.positions.length,
            maneuvers: parsed.maneuvers,
            notices: [],
          },
        },
      );
      check(
        'multi-section route validates clean against its true endpoint',
        mv.state === 'valid',
        mv,
      );
    }

    const goodRoute: ParsedRouteForValidation = {
      summary: { meters: 214_000, seconds: 7_800 },
      firstPosition: ORIGIN,
      lastPosition: DEST,
      geometryPointCount: 900,
      maneuvers: [
        { action: 'depart', instruction: 'Head north.', offset: 0 },
        { action: 'arrive', instruction: 'Arrive.', offset: 899 },
      ],
      notices: [],
    };
    const at = (dLatDeg: number) => ({ lat: DEST.lat + dLatDeg, lng: DEST.lng });
    const v = (lastPosition: { lat: number; lng: number }) =>
      validateRoute(DEST, { kind: 'parsed', route: { ...goodRoute, lastPosition } });

    const exact = v(DEST);
    check(
      'fixture: EXACT endpoint → valid, no destination codes',
      exact.state === 'valid' &&
        !exact.problems.some((p) => p.code.startsWith('destination')) &&
        !exact.warnings.some((w) => w.code.startsWith('destination')),
    );
    const snap = v(at(0.3 / 69.0937)); // ~0.3 mi — normal legal road snapping
    check('fixture: normal road snapping (0.3 mi) → still valid', snap.state === 'valid', snap);
    const entrance = v(at(0.8 / 69.0937)); // ~0.8 mi — warehouse entrance offset
    check(
      'fixture: warehouse entrance offset (0.8 mi) → requires-review with measured distance',
      entrance.state === 'requires-review' &&
        entrance.problems.some((p) => p.code === 'destination-offset') &&
        entrance.problems.some((p) => p.code === 'destination-distance:0.8mi'),
      entrance.problems.map((p) => p.code),
    );
    const wrong = v(at(5 / 69.0937)); // ~5 mi — genuinely wrong destination
    check(
      'fixture: genuinely wrong destination (5 mi) → rejected with measured distance',
      wrong.state === 'rejected' &&
        wrong.problems.some((p) => p.code === 'destination-mismatch') &&
        wrong.problems.some((p) => p.code === 'destination-distance:5.0mi'),
      wrong.problems.map((p) => p.code),
    );
    const reversed = v({ lat: DEST.lng, lng: DEST.lat }); // swapped lat/lng
    check(
      'fixture: reversed lat/lng → rejected, distance code exposes the absurd gap',
      reversed.state === 'rejected' &&
        reversed.problems.some((p) => p.code === 'destination-mismatch') &&
        reversed.problems.some((p) => p.code.startsWith('destination-distance:')),
      reversed.problems.map((p) => p.code),
    );
  }

  // --------------------------------------- 7. endpoint + regression structure
  {
    const endpoint = readFileSync('src/app/api/navigator/route/route.ts', 'utf8');
    const code = strip(endpoint);
    check(
      'endpoint: flag-gated 404 while Navigator is disabled',
      code.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true'") && code.includes('404'),
    );
    check(
      'endpoint: strict 6/hour limiter, separate from the planner limiter',
      /capacity:\s*6/.test(code) && /6\s*\/\s*3600/.test(code),
    );
    check(
      'endpoint: truck validation precedes the provider call',
      code.indexOf('validateNavigatorTruckProfile') < code.indexOf('hereRouting.route('),
    );
    check(
      'endpoint: route validation between provider and response',
      code.indexOf('hereRouting.route(') < code.indexOf('validateRoute('),
    );
    check('endpoint: no console/log of URLs or keys', !/console\./.test(code));
    check(
      'endpoint: missing HERE_API_KEY answers a DISTINCT provider-not-configured 503 (pilot diagnosability)',
      code.includes('provider-not-configured') &&
        code.includes('!process.env.HERE_API_KEY') &&
        /503/.test(code),
    );
    check(
      'endpoint: config pre-check runs before the limiter is charged',
      code.indexOf('provider-not-configured') <
        code.indexOf('guardedParseWithLimiter(navigatorLimiter'),
    );
    check(
      'endpoint: provider-failure carries the bucketed adapter cause (codes only, no URL/key)',
      /onOutcome/.test(code) && code.includes('provider-cause:'),
    );
    check(
      'endpoint: the config message never echoes key material',
      !/process\.env\.HERE_API_KEY\s*\}/.test(code) && !/\$\{[^}]*HERE_API_KEY/.test(code),
    );
    check(
      'endpoint: provider HTTP status + sanitized note surfaced on failures',
      /onProviderHttpError/.test(code) && code.includes('provider-http:'),
    );

    const adapter = strip(readFileSync('src/lib/trip-planner/here-routing.ts', 'utf8'));
    check(
      'adapter: provider-HTTP observer is sanitized (key pattern stripped, capped)',
      /apiKey=\[\^&\\s"'\]\*/.test(adapter.replace(/\s/g, '')) ||
        (adapter.includes('onProviderHttpError') && adapter.includes('apiKey=REDACTED')),
    );
    check(
      'adapter: observer is optional and swallowed (planner behavior unchanged)',
      /onProviderHttpError\?\./.test(adapter),
    );

    const apiUtil = strip(readFileSync('src/lib/trip-planner/api-util.ts', 'utf8'));
    check(
      'regression: planner guardedParse still uses the shared 20/min limiter',
      /capacity:\s*20/.test(apiUtil) && /guardedParse/.test(apiUtil),
    );
    const providers = readFileSync('src/lib/trip-planner/providers.ts', 'utf8');
    check(
      'regression: RoutingResult N8a fields are optional (existing consumers unaffected)',
      /maneuvers\?:/.test(providers) &&
        /notices\?:/.test(providers) &&
        /summary\?:/.test(providers),
    );

    // Purity boundary: the navigator lib modules never fetch or read clocks
    // (also enforced globally by test-navigator-purity).
    for (const f of [
      'navigator/truck-validation.ts',
      'navigator/route-validation.ts',
      'navigator-api/route-contract.ts',
    ]) {
      const src = strip(readFileSync(`src/lib/${f}`, 'utf8'));
      check(`purity: ${f} performs no I/O`, !/\bfetch\s*\(|new\s+Date|Date\s*\./.test(src));
    }
  }

  console.log(`navigator-route-api: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
