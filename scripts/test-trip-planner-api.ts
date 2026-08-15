/**
 * Phase 4 unit tests: route estimation, directory-loader mapping, NWS and
 * EIA adapters (offline via injected fetch — including failure modes), rate
 * limiting, simple-clock expansion, and the composite quote flow with every
 * provider failing. Pure logic — no network, no database.
 *
 * Run:
 *   npx esbuild scripts/test-trip-planner-api.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-trip-planner-api.cjs \
 *   && node /tmp/test-trip-planner-api.cjs
 */
import { estimateRoute, ROAD_CIRCUITY_FACTOR } from '@/lib/trip-planner/route-estimate';
import { mapRowToListing, buildAnchorLabel } from '@/lib/trip-planner/directory-loader';
import {
  classifyForecastSeverity,
  classifyAlertSeverity,
  sampleForWeather,
  createNwsWeatherPort,
} from '@/lib/trip-planner/nws-weather';
import {
  parseEiaResponse,
  eiaDieselPrice,
  createEiaFuelPort,
  STATE_TO_PADD,
  __resetEiaPriceCache,
} from '@/lib/trip-planner/eia-fuel';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import { createHereRoutingPort } from '@/lib/trip-planner/here-routing';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import {
  CLASSIC_PLANNER_DEFAULT_BUFFER_MIN,
  PLAN_MY_DAY_DEFAULT_BUFFER_MIN,
} from '@/lib/trip-planner/drive-window';
import {
  clockStateFromSimple,
  composeQuote,
  quoteRequestSchema,
  simpleClocksSchema,
  HOS_DISCLAIMER,
} from '@/lib/trip-planner/compose-quote';
import {
  CANADA_WEATHER_UNAVAILABLE,
  CROSS_BORDER_WEATHER_PARTIAL,
  ROUTE_COUNTRY_UNDETERMINED,
} from '@/lib/trip-planner/route-weather-timing';
import { resolveRouteRegion, countryFromStateCode } from '@/lib/trip-planner/route-region';
import { validateClockState, remainingClocks } from '@/lib/trip-planner/hos-engine';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
import { haversineMiles } from '@/lib/map/geo';
import type { DirectoryListing } from '@/lib/trip-planner/directory-layer';

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

async function main() {
  /* ------------------------------------------------ route estimation */
  {
    const est = estimateRoute(
      { label: 'Atlanta', position: ATL },
      { label: 'Knoxville', position: KNX },
    );
    const straight = haversineMiles(ATL, KNX);
    check(
      'route: distance = straight × circuity',
      approx(est.route.totalMiles, straight * ROAD_CIRCUITY_FACTOR, 0.5),
      est.route.totalMiles,
    );
    check('route: labeled as estimate', est.isEstimate === true && est.method.includes('estimate'));
    check(
      'route: points start at 0 and end at total',
      est.routePoints[0].routeMile === 0 &&
        approx(est.routePoints[est.routePoints.length - 1].routeMile, est.route.totalMiles, 0.2),
    );
    check(
      'route: sampled roughly every 10 miles',
      est.routePoints.length >= est.route.totalMiles / 10,
    );
    let threw = false;
    try {
      estimateRoute({ label: 'a', position: ATL }, { label: 'b', position: ATL });
    } catch {
      threw = true;
    }
    check('route: same-point rejected', threw);
  }

  /* ------------------------------------------------ directory mapping */
  {
    const row = {
      id: 'x1',
      name: 'Test Stop',
      category_slug: 'truck-stops',
      lat: 34.2,
      lng: -84.8,
      state: 'ga',
      interstate: 'I-75',
      exit_number: '296',
      parking_spaces: 80,
      overnight_parking: true,
      tpc_url: 'https://truckparkingclub.com/x',
      amenities: ['Fuel', 'Showers', 7, null],
      fuel_brands: ['Pilot'],
      coord_verification_status: 'manually-verified',
      city: 'Cartersville',
    };
    const l = mapRowToListing(row as never);
    check('loader: maps core fields', l.id === 'x1' && l.lat === 34.2 && l.parkingSpaces === 80);
    check(
      'loader: non-string amenities dropped',
      JSON.stringify(l.amenities) === '["Fuel","Showers"]',
    );
    check(
      'loader: keeps https reservation url',
      l.reservationUrl === 'https://truckparkingclub.com/x',
    );
    const bad = mapRowToListing({ ...row, tpc_url: 'javascript:alert(1)' } as never);
    check('loader: non-http url stripped', bad.reservationUrl === null);
    const noAmen = mapRowToListing({
      ...row,
      amenities: 'not-an-array',
      fuel_brands: null,
    } as never);
    check(
      'loader: malformed arrays become empty',
      (noAmen.amenities ?? []).length === 0 && (noAmen.fuelBrands ?? []).length === 0,
    );
    check(
      'loader: anchor label uses city + state + interstate',
      buildAnchorLabel(l) === 'Test Stop (Cartersville, ga · I-75)',
      buildAnchorLabel(l),
    );
    check(
      'loader: anchor label degrades without locality',
      buildAnchorLabel({ ...l, city: null, state: null, interstate: null }) === 'Test Stop',
    );
  }

  /* ------------------------------------------------ NWS adapter */
  {
    check('nws: blizzard → warning', classifyForecastSeverity('Blizzard conditions') === 'warning');
    check('nws: snow → watch', classifyForecastSeverity('Heavy Snow') === 'watch');
    check('nws: rain → advisory', classifyForecastSeverity('Light rain showers') === 'advisory');
    check('nws: sunny → none', classifyForecastSeverity('Sunny') === 'none');
    check(
      'nws: alert severity mapping',
      classifyAlertSeverity('Severe') === 'warning' &&
        classifyAlertSeverity('Minor') === 'advisory',
    );

    const pts = Array.from({ length: 30 }, (_, i) => ({
      position: { lat: 33 + i * 0.1, lng: -84 },
      routeMile: i * 10,
    }));
    const sampled = sampleForWeather(pts, 4);
    check(
      'nws: subsampling bounds calls',
      sampled.length === 4 && sampled[0].routeMile === 0 && sampled[3].routeMile === 290,
    );

    // Success path with a fake service.
    const okFetch = async (url: string) => ({
      status: 200,
      json: async () => {
        if (url.includes('/points/'))
          return { properties: { forecast: 'https://api.weather.gov/gridpoints/X/1,2/forecast' } };
        if (url.includes('/forecast')) {
          return {
            properties: {
              periods: [
                {
                  startTime: new Date(T0).toISOString(),
                  endTime: new Date(T0 + 12 * 3_600_000).toISOString(),
                  shortForecast: 'Snow likely',
                },
              ],
            },
          };
        }
        return {
          features: [
            {
              properties: {
                headline: 'Winter Storm Warning',
                severity: 'Severe',
                expires: new Date(T0 + 6 * 3_600_000).toISOString(),
              },
            },
          ],
        };
      },
    });
    const port = createNwsWeatherPort(okFetch);
    const res = await port.alongRoute(pts, T0);
    check(
      'nws: bands produced with severity',
      res.bands.length === 4 && res.bands.every((b) => b.severity === 'watch'),
    );
    check(
      'nws: alerts deduped across samples',
      res.alerts.length === 1 && res.alerts[0].severity === 'warning',
    );

    // Failure paths: 500s and thrown fetches → empty results, no throw.
    const failPort = createNwsWeatherPort(async () => ({ status: 500, json: async () => ({}) }));
    const failRes = await failPort.alongRoute(pts, T0);
    check('nws: 500s fail soft', failRes.bands.length === 0 && failRes.alerts.length === 0);
    const throwPort = createNwsWeatherPort(async () => {
      throw new Error('offline');
    });
    const throwRes = await throwPort.alongRoute(pts, T0);
    check(
      'nws: thrown fetch fails soft',
      throwRes.bands.length === 0 && throwRes.alerts.length === 0,
    );
    const malformedPort = createNwsWeatherPort(async () => ({
      status: 200,
      json: async () => ({ junk: true }),
    }));
    const malformedRes = await malformedPort.alongRoute(pts, T0);
    check('nws: malformed payload fails soft', malformedRes.bands.length === 0);

    // ETA alignment: a period ending 2h out covers only samples whose
    // estimated arrival (routeMile / 50 mph) falls inside it.
    const shortFetch = async (url: string) => ({
      status: 200,
      json: async () => {
        if (url.includes('/points/'))
          return { properties: { forecast: 'https://api.weather.gov/gridpoints/X/1,2/forecast' } };
        if (url.includes('/forecast')) {
          return {
            properties: {
              periods: [
                {
                  startTime: new Date(T0).toISOString(),
                  endTime: new Date(T0 + 2 * 3_600_000).toISOString(),
                  shortForecast: 'Rain',
                },
              ],
            },
          };
        }
        return { features: [] };
      },
    });
    const etaRes = await createNwsWeatherPort(shortFetch).alongRoute(pts, T0);
    check(
      'nws: bands align to per-sample ETA (stale periods skipped downroute)',
      etaRes.bands.length === 2,
      etaRes.bands.length,
    );

    // SSRF guard: a forecast URL pointing off api.weather.gov is never fetched.
    const fetched: string[] = [];
    const evilFetch = async (url: string) => {
      fetched.push(url);
      return {
        status: 200,
        json: async () => {
          if (url.includes('/points/'))
            return { properties: { forecast: 'https://evil.example.com/forecast' } };
          return { features: [] };
        },
      };
    };
    await createNwsWeatherPort(evilFetch).alongRoute(pts, T0);
    check(
      'nws: non-NWS forecast URL never followed',
      fetched.length > 0 && fetched.every((u) => u.startsWith('https://api.weather.gov/')),
      fetched.filter((u) => !u.startsWith('https://api.weather.gov/')),
    );
  }

  /* ------------------------------------------------ EIA adapter */
  {
    check('eia: GA maps to lower-atlantic PADD', STATE_TO_PADD.GA === 'R1Z');
    const body = { response: { data: [{ period: '2026-07-13', value: '3.899', duoarea: 'R1Z' }] } };
    const parsed = parseEiaResponse(body, 'R1Z');
    check(
      'eia: parses dollars to cents with period',
      parsed?.centsPerGallon === 390 && parsed.period === '2026-07-13',
    );
    check(
      'eia: absurd price rejected',
      parseEiaResponse({ response: { data: [{ period: 'x', value: 250 }] } }, 'R1Z') === null,
    );
    check('eia: empty data rejected', parseEiaResponse({ response: { data: [] } }, 'R1Z') === null);

    const okFetch = async () => ({ status: 200, json: async () => body });
    const price = await eiaDieselPrice('GA', okFetch, 'test-key');
    check(
      'eia: lookup succeeds with key',
      price?.centsPerGallon === 390 && price.source.includes('EIA'),
    );
    // The weekly price is cached per PADD region, so failure-path cases must
    // start from a cold cache or they would assert against the cached success.
    __resetEiaPriceCache();
    check(
      'eia: no key → null (no invented price)',
      (await eiaDieselPrice('GA', okFetch, undefined)) === null,
    );
    __resetEiaPriceCache();
    check(
      'eia: http failure → null',
      (await eiaDieselPrice('GA', async () => ({ status: 503, json: async () => ({}) }), 'k')) ===
        null,
    );
    __resetEiaPriceCache();
    check(
      'eia: thrown fetch → null',
      (await eiaDieselPrice(
        'GA',
        async () => {
          throw new Error('down');
        },
        'k',
      )) === null,
    );
    __resetEiaPriceCache();
    const portPrice = await createEiaFuelPort(okFetch, 'k').dieselCentsPerGallon('TN');
    check('eia: port wraps lookup', portPrice === 390);

    /* -------------------------------------- EIA price cache behavior */
    __resetEiaPriceCache();
    let eiaFetches = 0;
    const countingFetch = async () => {
      eiaFetches++;
      return { status: 200, json: async () => body };
    };
    await eiaDieselPrice('GA', countingFetch, 'k');
    await eiaDieselPrice('GA', countingFetch, 'k');
    check('eia cache: repeat lookup for the same region does not refetch', eiaFetches === 1);

    // GA and TN are different PADD regions, so a TN lookup is a real fetch.
    await eiaDieselPrice('TN', countingFetch, 'k');
    check('eia cache: distinct region is a distinct entry', eiaFetches === 2);

    // Concurrent lookups share ONE in-flight fetch — the promise is cached,
    // not the settled value.
    __resetEiaPriceCache();
    eiaFetches = 0;
    await Promise.all([
      eiaDieselPrice('GA', countingFetch, 'k'),
      eiaDieselPrice('GA', countingFetch, 'k'),
      eiaDieselPrice('GA', countingFetch, 'k'),
    ]);
    check('eia cache: concurrent lookups coalesce to one fetch', eiaFetches === 1);

    // A null result (outage) is evicted, never pinned: the next lookup after
    // a failure retries instead of serving the cached failure for an hour.
    __resetEiaPriceCache();
    check(
      'eia cache: failure is not cached',
      (await eiaDieselPrice('GA', async () => ({ status: 503, json: async () => ({}) }), 'k')) ===
        null && (await eiaDieselPrice('GA', okFetch, 'k'))?.centsPerGallon === 390,
    );
    __resetEiaPriceCache();
  }

  /* ------------------------------------------------ rate limiter */
  {
    let now = T0;
    const rl = new RateLimiter({ capacity: 3, refillPerSecond: 1, nowMs: () => now });
    check('rl: allows burst to capacity', rl.allow('ip') && rl.allow('ip') && rl.allow('ip'));
    check('rl: blocks when empty', !rl.allow('ip'));
    check('rl: separate keys separate buckets', rl.allow('other-ip'));
    now += 2000; // 2s → 2 tokens back
    check('rl: refills over time', rl.allow('ip') && rl.allow('ip') && !rl.allow('ip'));

    // Flood of unique keys (all fresh, so age-based eviction can't fire)
    // must still keep the bucket map bounded.
    const flood = new RateLimiter({ capacity: 3, refillPerSecond: 1, nowMs: () => T0 });
    for (let i = 0; i < 12_000; i++) flood.allow(`ip-${i}`);
    const floodSize = (flood as unknown as { buckets: Map<string, unknown> }).buckets.size;
    check('rl: unique-key flood stays bounded', floodSize <= 10_000, floodSize);
  }

  /* ------------------------------------------------ simple clocks */
  {
    const defaults = simpleClocksSchema.parse({});
    check(
      'clocks: schema defaults are fresh',
      defaults.drivingUsedMin === 0 && defaults.cycleRule === '70/8',
    );
    const s = clockStateFromSimple(
      {
        cycleRule: '70/8',
        drivingUsedMin: 300,
        windowElapsedMin: -1,
        drivingSinceBreakMin: 400,
        cycleUsedMin: 100,
      },
      T0,
    );
    check('clocks: window opens when driving used', s.windowElapsedMin === 300);
    check('clocks: break clamped to driving', s.drivingSinceBreakMin === 300);
    check('clocks: cycle at least driving', cycleTotal(s) === 300);
    check(
      'clocks: expanded state validates',
      validateClockState(s).length === 0,
      validateClockState(s),
    );
    const big = clockStateFromSimple(
      {
        cycleRule: '70/8',
        drivingUsedMin: 0,
        windowElapsedMin: -1,
        drivingSinceBreakMin: 0,
        cycleUsedMin: 60 * 60,
      },
      T0,
    );
    check(
      'clocks: 60h cycle spread across buckets',
      big.onDutyByDayMin.length >= 3 && cycleTotal(big) === 60 * 60,
    );
    check('clocks: big state validates', validateClockState(big).length === 0);
    check(
      'clocks: big cycle keeps newest bucket partial',
      big.onDutyByDayMin[big.onDutyByDayMin.length - 1] < 24 * 60,
    );

    // A driver-entered window smaller than driving time is physically
    // impossible — it gets clamped up, and the raw form is rejected.
    const clamped = clockStateFromSimple(
      {
        cycleRule: '70/8',
        drivingUsedMin: 300,
        windowElapsedMin: 120,
        drivingSinceBreakMin: 0,
        cycleUsedMin: 300,
      },
      T0,
    );
    check('clocks: window clamped up to driving used', clamped.windowElapsedMin === 300);
    check('clocks: clamped state validates', validateClockState(clamped).length === 0);
    check(
      'hos: validator rejects window < driving',
      validateClockState({ ...clamped, windowElapsedMin: 290 }).length > 0,
    );

    // Cycle at an exact day multiple must roll to a fresh partial bucket.
    const exact = clockStateFromSimple(
      {
        cycleRule: '70/8',
        drivingUsedMin: 0,
        windowElapsedMin: -1,
        drivingSinceBreakMin: 0,
        cycleUsedMin: 24 * 60,
      },
      T0,
    );
    check(
      'clocks: exact-day cycle rolls to fresh partial bucket',
      exact.onDutyByDayMin[exact.onDutyByDayMin.length - 1] === 0 && cycleTotal(exact) === 24 * 60,
      exact.onDutyByDayMin,
    );
    check('clocks: exact-day state validates', validateClockState(exact).length === 0);

    function cycleTotal(state: { onDutyByDayMin: number[] }) {
      return state.onDutyByDayMin.reduce((a, b) => a + b, 0);
    }
  }

  /* ------------------------------------------------ composite quote */
  {
    const listing = (mile: number, id: string): DirectoryListing => ({
      id,
      name: `Stop ${id}`,
      categorySlug: 'truck-stops',
      lat: ATL.lat + (KNX.lat - ATL.lat) * (mile / 240),
      lng: ATL.lng + (KNX.lng - ATL.lng) * (mile / 240),
      city: null,
      state: 'GA',
      interstate: 'I-75',
      exitNumber: null,
      parkingSpaces: 60,
      overnightParking: true,
      freeParking: null,
      paidParking: null,
      reservationUrl: null,
      amenities: ['fuel'],
      fuelBrands: [],
      coordVerificationStatus: 'manually-verified',
    });
    const goodDeps = {
      loadListings: async () => [listing(60, 'a'), listing(120, 'b'), listing(180, 'c')],
      weather: nullWeatherPort,
      fuelPrice: async () => ({
        centsPerGallon: 390,
        period: '2026-07-13',
        region: 'R1Z',
        source: 'EIA weekly',
      }),
    };
    const req = quoteRequestSchema.parse({
      origin: { label: 'Atlanta', position: ATL },
      destination: { label: 'Knoxville', position: KNX },
      departAtMs: T0,
      clocks: {},
    });
    const q = await composeQuote(req, goodDeps);
    check('quote: succeeds', q.ok === true);
    if (q.ok) {
      check('quote: route flagged estimate', q.routeSummary.isEstimate === true);
      check('quote: candidates matched', q.candidatesAvailable === 3);
      check('quote: legal window present', q.remainingAtDeparture.legalDrivingMin === 8 * 60);
      check('quote: fuel price attributed', q.fuelPrice?.source.includes('EIA') === true);
      check('quote: cost uses live price', q.cost.fuelCents != null);
      check(
        'quote: disclaimer present',
        q.disclaimer === HOS_DISCLAIMER && q.disclaimer.includes('NOT an ELD'),
      );
      check(
        'quote: itinerary reaches destination',
        q.itinerary.stops[q.itinerary.stops.length - 1].kind === 'destination',
      );
      check('quote: zero violations', q.itinerary.violations.length === 0);
    }

    // Zero-space safety rule, end to end: a corridor whose every listing
    // states zero spaces (one reservable, one explicitly free) must produce
    // ZERO Last Stop slots — no reservable, no free — and report that no
    // reservable parking exists on the corridor at all.
    const zeroSpaceDeps = {
      ...goodDeps,
      loadListings: async () => [
        {
          ...listing(60, 'z-res'),
          parkingSpaces: 0,
          reservationUrl: 'https://truckparkingclub.com/z',
        },
        { ...listing(120, 'z-free'), parkingSpaces: 0, freeParking: true },
        { ...listing(180, 'z-plain'), parkingSpaces: 0 },
      ],
    };
    const zq = await composeQuote(req, zeroSpaceDeps);
    check('quote: zero-space corridor still plans', zq.ok === true);
    if (zq.ok) {
      check(
        'quote: zero-space corridor yields zero Last Stop slots',
        zq.lastStop.slots.length === 0,
      );
      check(
        'quote: zero-space reservable is not reservable-on-corridor',
        zq.lastStop.noReservableOnCorridor === true,
      );
      check(
        'quote: no planned stop of parking kind gets a zero-space candidate',
        zq.itinerary.stops
          .filter((s) => s.kind === 'overnight' || s.kind === 'parking')
          .every((s) => s.candidate === null),
      );
    }

    // Every provider failing → still a plan, with warnings, no throw.
    const failingDeps = {
      loadListings: async () => {
        throw new Error('db down');
      },
      weather: {
        name: 'boom',
        alongRoute: async () => {
          throw new Error('weather down');
        },
      },
      fuelPrice: async () => {
        throw new Error('fuel down');
      },
    };
    const q2 = await composeQuote(req, failingDeps);
    check('quote: all-providers-down still plans', q2.ok === true);
    if (q2.ok) {
      check(
        'quote: fail-soft warnings recorded',
        q2.warnings.some((w) => w.includes('weather')) &&
          q2.warnings.some((w) => w.includes('fuel price')) &&
          q2.warnings.some((w) => w.includes('directory')),
      );
      check(
        'quote: cost omits fuel without price',
        q2.cost.fuelCents === null && q2.cost.totalCents === null,
      );
      check('quote: candidates zero', q2.candidatesAvailable === 0);
    }

    // A provider that hangs forever is cut off by its time budget; the plan
    // still completes with a warning.
    const hangDeps = {
      ...goodDeps,
      weather: { name: 'hang', alongRoute: () => new Promise<never>(() => {}) },
      weatherBudgetMs: 50,
    };
    const q3 = await composeQuote(req, hangDeps);
    check('quote: hung weather provider cut off by budget', q3.ok === true);
    if (q3.ok) {
      check(
        'quote: budget cutoff recorded as outage warning',
        q3.warnings.some((w) => w.includes('weather service unavailable')),
      );
    }
    // Empty-but-successful weather warns "no data", not "unavailable".
    if (q.ok) {
      check(
        'quote: empty weather warns once, not as outage',
        q.warnings.some((w) => w.includes('no weather data')) &&
          !q.warnings.some((w) => w.includes('weather service unavailable')),
        q.warnings,
      );
    }

    // Invalid inputs rejected by schema and by composeQuote.
    check(
      'quote: schema rejects bad lat',
      !quoteRequestSchema.safeParse({
        ...req,
        origin: { label: 'x', position: { lat: 99, lng: 0 } },
      }).success,
    );
    check(
      'quote: schema rejects missing destination',
      !quoteRequestSchema.safeParse({ origin: req.origin, departAtMs: T0, clocks: {} }).success,
    );
    const same = await composeQuote({ ...req, destination: req.origin }, goodDeps);
    check(
      'quote: same origin/destination rejected',
      same.ok === false && !same.ok && same.error.code === 'bad-route',
    );
    check(
      'quote: clock schema rejects 12h driving',
      !simpleClocksSchema.safeParse({ drivingUsedMin: 12 * 60 }).success,
    );

    /* --------------------------- provider-spend ordering guarantees */
    // A request that fails clock validation must cost NOTHING: no routing
    // transaction (HERE calls are capped and billed) and no directory scan.
    {
      let routed = 0;
      let loaded = 0;
      const spendTrackingDeps = {
        ...goodDeps,
        loadListings: async () => {
          loaded++;
          return goodDeps.loadListings();
        },
        routing: {
          name: 'spend-tracker',
          route: async () => {
            routed++;
            return null;
          },
        },
      };
      // Driver-entered inconsistencies are CLAMPED into validity by
      // clockStateFromSimple, so a schema-legal request cannot fail clock
      // validation — the bad-clocks branch is defense in depth for callers
      // that bypass the schema. Exercise it that way: a non-positive
      // departAtMs makes atMs invalid and nothing clamps it.
      const badClocks = await composeQuote({ ...req, departAtMs: -5 }, spendTrackingDeps);
      check(
        'quote: invalid clocks reject before ANY provider spend',
        badClocks.ok === false &&
          !badClocks.ok &&
          badClocks.error.code === 'bad-clocks' &&
          routed === 0 &&
          loaded === 0,
        { routed, loaded },
      );

      // The directory scan must START before the routing call resolves —
      // they are independent, so they run concurrently, not sequentially.
      let listingsStartedBeforeRoutingResolved = false;
      let listingsStarted = false;
      const concurrencyDeps = {
        ...goodDeps,
        loadListings: async () => {
          listingsStarted = true;
          return goodDeps.loadListings();
        },
        routing: {
          name: 'concurrency-probe',
          route: async () => {
            // Yield one macrotask so a concurrently-started listings load has
            // observably begun; a sequential implementation cannot have
            // started it yet because this call has not resolved.
            await new Promise((r) => setTimeout(r, 10));
            listingsStartedBeforeRoutingResolved = listingsStarted;
            return null;
          },
        },
      };
      const concurrent = await composeQuote(req, concurrencyDeps);
      check(
        'quote: directory scan runs concurrently with routing, not after it',
        concurrent.ok === true && listingsStartedBeforeRoutingResolved,
      );
    }

    /* ------------------------- one quote buys exactly one truck route */
    {
      /*
       * THE HALF OF THE CHAIN THE BROWSER CANNOT SEE. The routing call is
       * made server-side, so Playwright can prove one submission sends
       * one POST to /api/trip-planner/quote but not what that handler
       * does upstream. This closes it: one composed quote makes exactly
       * one call to the routing port, and one routing-port call makes
       * exactly one HTTP request to the provider.
       *
       * Both halves matter for the same reason — a duplicated request is
       * billed twice and, on a metered free tier, exhausts the allowance
       * at double speed without changing anything the driver sees.
       */
      let portCalls = 0;
      const countingDeps = {
        ...goodDeps,
        routing: {
          name: 'counting',
          route: async () => {
            portCalls += 1;
            return null;
          },
        },
      };
      await composeQuote(req, countingDeps);
      check(
        'routing: one composed quote calls the routing port exactly once',
        portCalls === 1,
        portCalls,
      );

      /*
       * The provider request count, against the adapter's DOCUMENTED
       * retry policy rather than against a wish: one retry on 5xx and
       * network failure only, never on 4xx, because a rejected request
       * will not fix itself and retrying it just spends quota.
       *
       * The answered case is the one that governs the bill, and it is
       * pinned at exactly one.
       */
      const countRequests = async (status: number, body: unknown = {}) => {
        let httpCalls = 0;
        const port = createHereRoutingPort(
          async () => {
            httpCalls += 1;
            return { status, json: async () => body };
          },
          'test-key-not-a-real-credential',
          // No cache between cases: a warm entry would answer the second
          // call from memory and report zero requests for the wrong reason.
          { cacheMax: 0 },
        );
        await port.route({
          origin: ATL,
          destination: KNX,
          waypoints: [],
          departAtMs: T0,
          truck: DEFAULT_TRUCK_PROFILE,
        });
        return httpCalls;
      };

      check(
        'routing: an answered route makes exactly one provider request',
        (await countRequests(200, { routes: [] })) === 1,
      );
      check(
        'routing: a rejected route is not retried — a 4xx will not fix itself',
        (await countRequests(403)) === 1,
      );
      check(
        'routing: a 5xx is retried exactly once, never in a loop',
        (await countRequests(500)) === 2,
      );
    }

    /* ------------------------------------- the driver's safety buffer */
    {
      /*
       * The buffer chips on Plan My Day moved a number nothing read: the
       * wire carried no buffer, so every plan was computed against
       * `selectLastStops`'s own 30-minute default while the results
       * screen printed whichever preset the driver had tapped. These
       * pin the plumbing that closed that gap — including the half that
       * must NOT change, since the classic cost planner posts to the
       * same endpoint and sends no buffer at all.
       */
      check(
        'buffer: the wire accepts a driver-chosen buffer',
        quoteRequestSchema.safeParse({
          origin: { label: 'Atlanta', position: ATL },
          destination: { label: 'Knoxville', position: KNX },
          departAtMs: T0,
          clocks: {},
          bufferMin: 90,
        }).success,
      );
      /*
       * OMITTING THE BUFFER IS THE CLASSIC PLANNER SPEAKING. It is the
       * only caller that never sends one, so the wire default must stay
       * its 30 — collapsing everything to Plan My Day's 45 would silently
       * re-rank the stop recommendations on a screen this milestone was
       * told to preserve.
       */
      check(
        'buffer: an omitted buffer preserves the classic planner’s 30 minutes',
        quoteRequestSchema.parse({
          origin: { label: 'Atlanta', position: ATL },
          destination: { label: 'Knoxville', position: KNX },
          departAtMs: T0,
          clocks: {},
        }).bufferMin === CLASSIC_PLANNER_DEFAULT_BUFFER_MIN,
      );
      check(
        'buffer: ...which is 30, not Plan My Day’s 45',
        CLASSIC_PLANNER_DEFAULT_BUFFER_MIN === 30 && PLAN_MY_DAY_DEFAULT_BUFFER_MIN === 45,
      );
      for (const bad of [-1, 181, 2.5]) {
        check(
          `buffer: ${bad} minutes is rejected, not clamped`,
          !quoteRequestSchema.safeParse({
            origin: { label: 'Atlanta', position: ATL },
            destination: { label: 'Knoxville', position: KNX },
            departAtMs: T0,
            clocks: {},
            bufferMin: bad,
          }).success,
        );
      }

      const noBuffer = await composeQuote(req, goodDeps);
      const withBuffer = await composeQuote({ ...req, bufferMin: 90 }, goodDeps);
      check(
        'buffer: the chosen buffer reaches the parking filter',
        withBuffer.ok === true && withBuffer.lastStop.bufferMin === 90,
      );
      check(
        'buffer: the plan is computed against the same number it displays',
        // Non-null asserted, not tolerated: a null window would make this
        // assertion pass while proving nothing about the buffer at all.
        withBuffer.ok === true &&
          withBuffer.plan.window !== null &&
          withBuffer.plan.window.bufferMin === 90,
      );
      check(
        'buffer: a wider buffer really does shorten the usable window',
        withBuffer.ok === true &&
          noBuffer.ok === true &&
          withBuffer.plan.window !== null &&
          noBuffer.plan.window !== null &&
          withBuffer.plan.window.stopTargetMin < noBuffer.plan.window.stopTargetMin,
      );

      check(
        'buffer: a quote with no buffer plans the classic planner’s 30 minutes',
        noBuffer.ok === true && noBuffer.lastStop.bufferMin === 30,
        noBuffer.ok && noBuffer.lastStop.bufferMin,
      );
      /*
       * THE VALUE TRAVELS UNCHANGED. Every surface a driver could read it
       * from must show the same number: the reachability filter, the
       * drive window, and the caption on the results card.
       */
      for (const chosen of [15, 30, 45, 60]) {
        const q = await composeQuote({ ...req, bufferMin: chosen }, goodDeps);
        check(
          `buffer: ${chosen} minutes survives UI → request → endpoint → plan intact`,
          q.ok === true &&
            q.lastStop.bufferMin === chosen &&
            q.plan.window !== null &&
            q.plan.window.bufferMin === chosen,
          q.ok && { filter: q.lastStop.bufferMin, window: q.plan.window?.bufferMin },
        );
      }
    }

    /* --------------------------------- which alert service can speak */
    {
      /*
       * A ROUTE HAS TWO COUNTRIES. The first version of this asked "is
       * this route Canadian?" and answered with one label, which is
       * false at one end of every crossing — and worse, the collapsing
       * rule turned a US-to-Canada haul into a purely Canadian one and
       * hid the US half of the weather that WAS available.
       *
       * Both ends are resolved separately now, the crossing is its own
       * state, and the Great Lakes band — where no latitude rule can
       * separate Windsor from Detroit — is answered by the caller's
       * attested state code rather than by geography guessing.
       */
      const CALGARY = { lat: 51.0447, lng: -114.0719 };
      const DETROIT = { lat: 42.3314, lng: -83.0458 };
      const WINDSOR = { lat: 42.3149, lng: -83.0364 };

      type Pt = { lat: number; lng: number };
      type Claim = 'US' | 'CA' | null;
      const region = (o: Pt, oc: Claim, d: Pt, dc: Claim) =>
        resolveRouteRegion({
          origin: o,
          originCountry: oc,
          destination: d,
          destinationCountry: dc,
        });

      const usus = region(ATL, null, KNX, null);
      check('region: two US endpoints are fully US', usus.fullyUS && !usus.crossBorder);

      const caca = region(CALGARY, null, CALGARY, null);
      check(
        'region: two Canadian endpoints are not a crossing and not US',
        caca.touchesCanada && !caca.fullyUS && !caca.crossBorder,
      );

      const northbound = region(ATL, null, CALGARY, null);
      check(
        'region: US → Canada is a crossing, not a Canadian route',
        northbound.crossBorder &&
          northbound.origin === 'US' &&
          northbound.destination === 'CA' &&
          !northbound.fullyUS,
      );
      const southbound = region(CALGARY, null, ATL, null);
      check(
        'region: Canada → US is a crossing in the other direction',
        southbound.crossBorder && southbound.origin === 'CA' && southbound.destination === 'US',
      );

      /*
       * The case that motivated all of this. Windsor sits three km from
       * Detroit and SOUTH of it; no half-plane separates them.
       */
      const guessed = region(DETROIT, null, WINDSOR, null);
      check(
        'region: without claims the Windsor–Detroit corridor is honestly unplaceable',
        guessed.origin === 'unknown' && guessed.destination === 'unknown' && !guessed.fullyUS,
        guessed,
      );
      const claimed = region(DETROIT, 'US', WINDSOR, 'CA');
      check(
        'region: with attested countries it is a crossing, not one country',
        claimed.crossBorder && claimed.origin === 'US' && claimed.destination === 'CA',
      );
      check(
        'region: and Detroit is never called Canadian',
        region(DETROIT, 'US', DETROIT, 'US').fullyUS,
      );

      check(
        'region: a state code attests to the United States',
        countryFromStateCode('mi') === 'US',
      );
      check('region: a province code attests to Canada', countryFromStateCode('ON') === 'CA');
      check(
        'region: an unrecognised code claims nothing rather than guessing',
        countryFromStateCode('') === null && countryFromStateCode('Michigan') === null,
      );

      /* ---- and what each of those does to the weather section -------- */
      const quoteFor = async (o: Pt, oc: Claim, d: Pt, dc: Claim) =>
        composeQuote(
          {
            ...req,
            origin: { label: 'origin', position: o, country: oc },
            destination: { label: 'destination', position: d, country: dc },
          },
          goodDeps,
        );

      const canadian = await quoteFor(CALGARY, 'CA', { lat: 53.5461, lng: -113.4938 }, 'CA');
      check(
        'weather: a Canadian route refuses instead of implying NWS coverage',
        canadian.ok === true &&
          canadian.plan.weather.ok === false &&
          canadian.plan.weather.notice === CANADA_WEATHER_UNAVAILABLE,
        canadian.ok && canadian.plan.weather,
      );

      const crossings: [string, Pt, Claim, Pt, Claim][] = [
        ['US → Canada', ATL, 'US', CALGARY, 'CA'],
        ['Canada → US', CALGARY, 'CA', ATL, 'US'],
      ];
      for (const [name, o, oc, d, dc] of crossings) {
        const crossing = await quoteFor(o, oc, d, dc);
        check(
          `weather: ${name} says the crossing is only half covered`,
          crossing.ok === true &&
            crossing.plan.weather.ok === false &&
            crossing.plan.weather.reason === 'cross-border' &&
            crossing.plan.weather.notice === CROSS_BORDER_WEATHER_PARTIAL,
          crossing.ok && crossing.plan.weather,
        );
      }

      const unplaceable = await quoteFor(DETROIT, null, WINDSOR, null);
      check(
        'weather: an unplaceable route says so rather than claiming a country',
        unplaceable.ok === true &&
          unplaceable.plan.weather.ok === false &&
          unplaceable.plan.weather.reason === 'country-unknown' &&
          unplaceable.plan.weather.notice === ROUTE_COUNTRY_UNDETERMINED,
        unplaceable.ok && unplaceable.plan.weather,
      );

      /*
       * A fully US route must never be refused ON REGION GROUNDS. It can
       * still refuse for timing — these deps route by estimate — and
       * asserting `ok === true` here would be asserting the wrong thing.
       */
      const domestic = await quoteFor(ATL, 'US', KNX, 'US');
      check(
        'weather: a fully US route is never refused on region grounds',
        domestic.ok === true &&
          (domestic.plan.weather.ok === true ||
            !['region-unsupported', 'cross-border', 'country-unknown'].includes(
              domestic.plan.weather.reason,
            )),
        domestic.ok && domestic.plan.weather,
      );
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
