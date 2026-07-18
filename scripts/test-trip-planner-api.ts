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
} from '@/lib/trip-planner/eia-fuel';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import {
  clockStateFromSimple,
  composeQuote,
  quoteRequestSchema,
  simpleClocksSchema,
  HOS_DISCLAIMER,
} from '@/lib/trip-planner/compose-quote';
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
    check(
      'eia: no key → null (no invented price)',
      (await eiaDieselPrice('GA', okFetch, undefined)) === null,
    );
    check(
      'eia: http failure → null',
      (await eiaDieselPrice('GA', async () => ({ status: 503, json: async () => ({}) }), 'k')) ===
        null,
    );
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
    const portPrice = await createEiaFuelPort(okFetch, 'k').dieselCentsPerGallon('TN');
    check('eia: port wraps lookup', portPrice === 390);
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
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
