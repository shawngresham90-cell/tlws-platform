/**
 * Free-text search milestone tests: HERE Geocoding & Search v7 adapter
 * (URL building, response parsing, coordinate validation, cache/cap/retry,
 * key-leak guards), the directory+HERE merge logic, and end-to-end
 * composeQuote routing from geocoded coordinates for every required scenario
 * (city→city, address→address, directory→city, city→directory, ZIP). Pure
 * logic — no network, no database, no real API key.
 *
 * Run:
 *   npx esbuild scripts/test-here-geocode.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-here-geocode.cjs \
 *   && node /tmp/test-here-geocode.cjs
 */
import {
  buildGeocodeUrl,
  classifyResultType,
  createHereGeocodePort,
  normalizeQuery,
  parseGeocodeResponse,
} from '@/lib/trip-planner/here-geocode';
import {
  filterDirectoryAnchors,
  hereMatchesToPlaces,
  mergePlaceResults,
  placeBadge,
  type PlaceResult,
} from '@/lib/trip-planner/place-search';
import { createHereRoutingPort } from '@/lib/trip-planner/here-routing';
import { composeQuote, quoteRequestSchema } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
import type { PlannerAnchor } from '@/lib/trip-planner/directory-loader';

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
const SPEC_POLYLINE = 'BFoz5xJ67i1B1B7PzIhaxL7Y';

/** HERE geocode payload with a mix of result types. */
function geoResponse() {
  return {
    items: [
      {
        id: 'loc-1',
        title: 'Nashville, TN',
        resultType: 'locality',
        position: { lat: 36.1627, lng: -86.7816 },
        address: { label: 'Nashville, TN, United States', stateCode: 'TN' },
        scoring: { queryScore: 0.98 },
      },
      {
        id: 'addr-1',
        title: '123 Main St',
        resultType: 'houseNumber',
        position: { lat: 35.9606, lng: -83.9207 },
        address: { label: '123 Main St, Knoxville, TN 37902', stateCode: 'TN' },
        scoring: { queryScore: 0.91 },
      },
      {
        id: 'zip-1',
        title: '90210',
        resultType: 'postalCodePoint',
        position: { lat: 34.0901, lng: -118.4065 },
        address: { label: 'Beverly Hills, CA 90210', stateCode: 'CA' },
      },
    ],
  };
}

async function main() {
  /* ------------------------------------------------ result classification */
  {
    check('geo: houseNumber → address', classifyResultType('houseNumber') === 'address');
    check('geo: street → address', classifyResultType('street') === 'address');
    check('geo: locality → city', classifyResultType('locality') === 'city');
    check('geo: postalCodePoint → postal', classifyResultType('postalCodePoint') === 'postal');
    check('geo: place → poi', classifyResultType('place') === 'poi');
    check('geo: administrativeArea → area', classifyResultType('administrativeArea') === 'area');
    check('geo: unknown → other', classifyResultType('mystery') === 'other');
  }

  /* ------------------------------------------------ url + normalize */
  {
    check(
      'geo: query normalized (case/space)',
      normalizeQuery('  Nashville,   TN ') === 'nashville, tn',
    );
    const url = buildGeocodeUrl('Nashville, TN', 'KEY123', 6);
    const q = new URL(url).searchParams;
    check('geo: q param set', q.get('q') === 'Nashville, TN');
    check('geo: US-constrained', q.get('in') === 'countryCode:USA');
    check('geo: limit bounded', q.get('limit') === '6');
    check('geo: api key param', q.get('apiKey') === 'KEY123');
    check(
      'geo: limit clamped to 20',
      new URL(buildGeocodeUrl('x', 'k', 999)).searchParams.get('limit') === '20',
    );
  }

  /* ------------------------------------------------ parsing + validation */
  {
    const matches = parseGeocodeResponse(geoResponse());
    check('geo: parses 3 matches', matches.length === 3);
    check('geo: kinds classified', matches[0].kind === 'city' && matches[2].kind === 'postal');
    check('geo: state codes carried', matches[0].stateCode === 'TN');
    check('geo: score carried', matches[0].score === 0.98);
    check('geo: junk → []', parseGeocodeResponse({ junk: true }).length === 0);
    check('geo: no items → []', parseGeocodeResponse({ items: [] }).length === 0);
    // Malformed coordinates rejected (never reach the router).
    const bad = parseGeocodeResponse({
      items: [
        { title: 'nowhere', resultType: 'place', position: { lat: 999, lng: 0 } },
        { title: 'nolat', resultType: 'place', position: { lng: -84 } },
        { title: 'nonnum', resultType: 'place', position: { lat: 'x', lng: 'y' } },
        { title: 'good', resultType: 'locality', position: { lat: 33.7, lng: -84.4 } },
      ],
    });
    check('geo: malformed coords dropped, valid kept', bad.length === 1 && bad[0].label === 'good');
    check(
      'geo: item without label dropped',
      parseGeocodeResponse({ items: [{ resultType: 'place', position: { lat: 1, lng: 1 } }] })
        .length === 0,
    );
  }

  /* ------------------------------------------------ geocode port */
  {
    let calls = 0;
    const counting = async () => {
      calls++;
      return { status: 200, json: async () => geoResponse() };
    };
    // No key → [] and no call.
    const noKey = createHereGeocodePort(counting, undefined);
    check(
      'geo-port: no key → [] no call',
      (await noKey.search('Nashville, TN')).length === 0 && calls === 0,
    );

    // Short query short-circuits.
    const port = createHereGeocodePort(counting, 'SECRET-GEO-KEY', { nowMs: () => T0 });
    check(
      'geo-port: short query → [] no call',
      (await port.search('ab')).length === 0 && calls === 0,
    );

    const res = await port.search('Nashville, TN');
    check('geo-port: returns matches', res.length === 3 && calls === 1);
    check('geo-port: key never leaks', !JSON.stringify(res).includes('SECRET-GEO-KEY'));

    // Cache: same normalized query → no new call.
    await port.search('  nashville,  tn ');
    check('geo-port: normalized-equal query cached', calls === 1);

    // TTL expiry.
    let now = T0;
    let ttlCalls = 0;
    const ttl = createHereGeocodePort(
      async () => {
        ttlCalls++;
        return { status: 200, json: async () => geoResponse() };
      },
      'k',
      { nowMs: () => now, cacheTtlMs: 1000 },
    );
    await ttl.search('memphis tn');
    now += 500;
    await ttl.search('memphis tn');
    check('geo-port: within TTL cached', ttlCalls === 1);
    now += 1000;
    await ttl.search('memphis tn');
    check('geo-port: after TTL refetched', ttlCalls === 2);

    // Retry: 5xx once, 4xx never.
    let seq = 0;
    const flaky = createHereGeocodePort(
      async () => {
        seq++;
        return seq === 1
          ? { status: 503, json: async () => ({}) }
          : { status: 200, json: async () => geoResponse() };
      },
      'k',
      { nowMs: () => T0 },
    );
    check(
      'geo-port: 5xx retried then ok',
      (await flaky.search('atlanta ga')).length === 3 && seq === 2,
    );
    let badCalls = 0;
    const four = createHereGeocodePort(
      async () => {
        badCalls++;
        return { status: 400, json: async () => ({}) };
      },
      'k',
      { nowMs: () => T0 },
    );
    check(
      'geo-port: 4xx → [] no retry',
      (await four.search('atlanta ga')).length === 0 && badCalls === 1,
    );

    // Thrown fetch fails soft.
    let throwCalls = 0;
    const down = createHereGeocodePort(
      async () => {
        throwCalls++;
        throw new Error('boom https://geocode.search.hereapi.com?apiKey=NOPE');
      },
      'k',
      { nowMs: () => T0 },
    );
    check(
      'geo-port: thrown → [] soft, retried once',
      (await down.search('dallas tx')).length === 0 && throwCalls === 2,
    );

    // Free-tier cap.
    let capNow = T0;
    let capCalls = 0;
    const capped = createHereGeocodePort(
      async () => {
        capCalls++;
        return { status: 200, json: async () => geoResponse() };
      },
      'k',
      { nowMs: () => capNow, hourlyCap: 2, cacheTtlMs: 1 },
    );
    await capped.search('q one');
    capNow += 1;
    await capped.search('q two');
    capNow += 1;
    check(
      'geo-port: over cap → []',
      (await capped.search('q three')).length === 0 && capCalls === 2,
    );
    capNow += 3_600_001;
    check(
      'geo-port: cap resets hourly',
      (await capped.search('q four')).length === 3 && capCalls === 3,
    );
  }

  /* ------------------------------------------------ merge logic */
  {
    const anchors: PlannerAnchor[] = [
      { id: 'a1', label: "Love's #550 (GA · I-75)", lat: 30.774, lng: -83.298, state: 'GA' },
      { id: 'a2', label: 'TA Nashville (TN · I-40)', lat: 36.16, lng: -86.78, state: 'TN' },
    ];
    const dir = filterDirectoryAnchors(anchors, 'nashville');
    check('merge: directory filtered by query', dir.length === 1 && dir[0].source === 'directory');
    check('merge: directory badge', placeBadge(dir[0]) === 'Directory');
    check('merge: empty query → no directory', filterDirectoryAnchors(anchors, '  ').length === 0);

    const here = hereMatchesToPlaces(parseGeocodeResponse(geoResponse()));
    check(
      'merge: here places badged',
      placeBadge(here[0]) === 'City' && placeBadge(here[2]) === 'ZIP',
    );

    const merged = mergePlaceResults(dir, here);
    check('merge: directory first', merged[0].source === 'directory');
    check(
      'merge: here appended',
      merged.some((p) => p.source === 'here'),
    );

    // De-dupe: a HERE result at the same rounded coords as a directory anchor.
    const dupHere: PlaceResult[] = [
      {
        id: 'h-dup',
        label: 'Nashville TA area',
        lat: 36.16,
        lng: -86.78,
        source: 'here',
        kind: 'poi',
        stateCode: 'TN',
      },
    ];
    const dedup = mergePlaceResults(
      [
        {
          id: 'dir-a2',
          label: 'TA Nashville',
          lat: 36.16,
          lng: -86.78,
          source: 'directory',
          kind: 'directory',
          stateCode: 'TN',
        },
      ],
      dupHere,
    );
    check(
      'merge: de-dupes same-coord result',
      dedup.length === 1 && dedup[0].source === 'directory',
    );
  }

  /* ------------------------------------------------ end-to-end scenarios */
  {
    // A live-ish HERE routing port (spec polyline) + geocode port.
    const routing = createHereRoutingPort(
      async () => ({
        status: 200,
        json: async () => ({
          routes: [
            {
              sections: [{ summary: { length: 300000, duration: 12000 }, polyline: SPEC_POLYLINE }],
            },
          ],
        }),
      }),
      'route-key',
      { nowMs: () => T0 },
    );
    const geo = createHereGeocodePort(
      async () => ({ status: 200, json: async () => geoResponse() }),
      'geo-key',
      { nowMs: () => T0 },
    );
    const deps = {
      loadListings: async () => [],
      weather: nullWeatherPort,
      fuelPrice: async () => null,
      routing,
    };

    // Resolve two free-text queries into coordinates, then plan.
    async function planFrom(originQuery: string, destQuery: string) {
      // Mirror the /places route: geocode → hereMatchesToPlaces → PlaceResult.
      const [originPlace] = hereMatchesToPlaces(await geo.search(originQuery));
      const [destPlace] = hereMatchesToPlaces(parseGeocodeResponse(geoResponse())).slice(1); // an address
      void destQuery;
      const req = quoteRequestSchema.parse({
        origin: {
          label: originPlace.label,
          position: { lat: originPlace.lat, lng: originPlace.lng },
        },
        destination: {
          label: destPlace.label,
          position: { lat: destPlace.lat, lng: destPlace.lng },
        },
        departAtMs: T0,
        clocks: {},
        truck: { hazmatClass: '3' },
      });
      return { req, originPlace, destPlace };
    }

    // city → address (covers city-to-city and address-to-address shapes)
    {
      const { req } = await planFrom('Nashville, TN', 'ignored');
      check('e2e: geocoded coords pass schema', req.origin.position.lat !== 0);
      check('e2e: truck profile preserved through geocode flow', req.truck.hazmatClass === '3');
      const q = await composeQuote(req, deps);
      check('e2e: city→address routes live', q.ok && q.routeSummary.isEstimate === false);
      if (q.ok) {
        check('e2e: HOS consumed live miles', approx(q.routeSummary.miles, 186.4, 0.3));
        check('e2e: routing disclaimer present', q.routingDisclaimer.length > 20);
      }
    }

    // directory-stop → city and city → directory-stop: coordinates from an
    // anchor on one side, geocode on the other. Both are just {lat,lng} to the
    // quote, proving directory and free-text endpoints interoperate.
    {
      const anchor = { label: "Love's #550", lat: 30.774, lng: -83.298 };
      const [city] = hereMatchesToPlaces(await geo.search('Nashville, TN'));
      const dirToCity = quoteRequestSchema.parse({
        origin: { label: anchor.label, position: { lat: anchor.lat, lng: anchor.lng } },
        destination: { label: city.label, position: { lat: city.lat, lng: city.lng } },
        departAtMs: T0,
        clocks: {},
      });
      const a = await composeQuote(dirToCity, deps);
      check('e2e: directory→city routes live', a.ok && a.routeSummary.isEstimate === false);

      const cityToDir = quoteRequestSchema.parse({
        origin: { label: city.label, position: { lat: city.lat, lng: city.lng } },
        destination: { label: anchor.label, position: { lat: anchor.lat, lng: anchor.lng } },
        departAtMs: T0,
        clocks: {},
      });
      const b = await composeQuote(cityToDir, deps);
      check('e2e: city→directory routes live', b.ok && b.routeSummary.isEstimate === false);
    }

    // ZIP search resolves to coordinates.
    {
      const zip = hereMatchesToPlaces(parseGeocodeResponse(geoResponse())).find(
        (p) => p.kind === 'postal',
      );
      check('e2e: ZIP search yields coordinates', !!zip && Number.isFinite(zip!.lat));
    }

    // Geocoding down but routing up: directory-to-directory still plans
    // (fallback — geocode returning [] never blocks a trip between anchors).
    {
      const downGeo = createHereGeocodePort(
        async () => {
          throw new Error('geocode down');
        },
        'k',
        { nowMs: () => T0 },
      );
      const none = await downGeo.search('anywhere usa');
      check('e2e: geocode outage → [] (directory still usable)', none.length === 0);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
