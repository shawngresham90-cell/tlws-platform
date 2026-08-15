/**
 * Trip Planner candidate-pool pagination (2026-07-30).
 *
 * The loader used to fetch the planner's candidate pool with a single
 * `.limit(2000)`. That ceiling was arbitrary and SILENT: at 2,001 eligible
 * rows the 2,001st simply stopped existing as far as the planner was
 * concerned, with no error and no log line. The pool was at 1,940 when it was
 * found.
 *
 * These tests drive `collectPlannerRows` against synthetic pools through an
 * injected fetcher, so they prove the paging contract with no database and no
 * network. The second half re-asserts that the safety rules the planner
 * actually depends on are byte-for-byte unchanged by this work.
 *
 * Run:
 *   npx esbuild scripts/test-planner-pool-pagination.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-planner-pool-pagination.cjs \
 *   && node /tmp/test-planner-pool-pagination.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectPlannerRows,
  mapRowToListing,
  PLANNER_PAGE_SIZE,
  PLANNER_MAX_PAGES,
  type PlannerPageFetcher,
} from '@/lib/trip-planner/directory-loader';
import {
  hasConfirmedTruckParking,
  isParkingNeed,
  NEED_CATEGORIES,
  rankCandidates,
  recommendParking,
  scoreCandidate,
  toStopCandidates,
  type DirectoryListing,
} from '@/lib/trip-planner/directory-layer';
import { selectLastStops, driveMinutesToMile } from '@/lib/trip-planner/last-stop';
import type { RouteTiming } from '@/lib/trip-planner/route-time-axis';
import { buildRoute } from '@/lib/trip-planner/types';
import {
  normalizeOvernightStatus,
  isConfirmedOvernight,
  isProhibitedOvernight,
} from '@/lib/directory/overnight';
import { DEFAULT_SAFETY_BUFFER_MIN } from '@/lib/trip-planner/drive-window';

/*
 * TEST-ONLY time source. These harnesses exercise the ELIGIBILITY FILTER,
 * not the time source, so they inject timing derived from the synthetic
 * route's own leg speeds. It lives here and not in `src/` on purpose:
 * production must never be able to reach an average-speed eligibility
 * path, which is the whole point of `RouteTiming` being required.
 */
function timingOf(route: Parameters<typeof driveMinutesToMile>[0]): RouteTiming {
  return {
    kind: 'provider',
    minutesToMile(mile: number) {
      const m = driveMinutesToMile(route, mile);
      return Number.isFinite(m)
        ? { earliestMin: m, latestMin: m, precision: 'tight' as const }
        : null;
    },
  };
}

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/* ------------------------------------------------------- synthetic pool */

type Row = Parameters<typeof mapRowToListing>[0];

/** Zero-padded ids so lexical order === numeric order, like a sorted uuid scan. */
const idFor = (i: number) => `row-${String(i).padStart(6, '0')}`;

function makePool(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: idFor(i),
    name: `Stop ${i}`,
    category_slug: 'truck-stops',
    lat: 34 + i / 100000,
    lng: -84 - i / 100000,
    state: 'GA',
    interstate: 'I-75',
    exit_number: String(i % 400),
    parking_spaces: 50,
    overnight_parking: null,
    overnight_status: 'confirmed',
    free_parking: null,
    paid_parking: null,
    tpc_url: null,
    amenities: [],
    fuel_brands: [],
    coord_verification_status: 'manually-verified',
    city: 'Cordele',
  }));
}

/** A correct keyset fetcher over an in-memory pool, ordered by id ascending. */
function fetcherFor(pool: Row[], opts: { failOnPage?: number } = {}): PlannerPageFetcher {
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  let calls = 0;
  return async (afterId, pageSize) => {
    calls++;
    if (opts.failOnPage === calls) return { rows: [], error: { code: 'PGRST500' } };
    const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
    if (start < 0) return { rows: [] };
    return { rows: sorted.slice(start, start + pageSize) };
  };
}

const idsOf = (rows: Row[]) => rows.map((r) => r.id);

async function pagingTests() {
  /* ---------------------------------------------- sizes across the old cap */

  for (const n of [0, 1, 499, 500, 501, 1999, 2000, 2001, 3000, 5000]) {
    const pool = makePool(n);
    const res = await collectPlannerRows(fetcherFor(pool), n);
    check(`pool of ${n}: scan succeeds`, res.ok === true, res.ok ? '' : res);
    if (!res.ok) continue;
    check(`pool of ${n}: every row returned`, res.rows.length === n, res.rows.length);
    check(`pool of ${n}: no duplicates`, new Set(idsOf(res.rows)).size === n);
    check(
      `pool of ${n}: no skipped rows`,
      idsOf(res.rows).join(',') === idsOf(pool).join(','),
      res.rows.length,
    );
  }

  // The headline regression: the old code returned exactly 2000 and lost the rest.
  const big = makePool(3000);
  const bigRes = await collectPlannerRows(fetcherFor(big), 3000);
  check('more than 2,000 rows load', bigRes.ok && bigRes.rows.length === 3000);
  check(
    'the 2,001st row is present (the old cap dropped it)',
    bigRes.ok && bigRes.rows.some((r) => r.id === idFor(2000)),
  );
  check(
    'the final row of a 3,000-row pool is present',
    bigRes.ok && bigRes.rows[bigRes.rows.length - 1]?.id === idFor(2999),
  );

  /* -------------------------------------------------------- page mechanics */

  const exactBoundary = makePool(PLANNER_PAGE_SIZE * 3); // 1500: ends on a boundary
  const boundaryRes = await collectPlannerRows(fetcherFor(exactBoundary), exactBoundary.length);
  check(
    'a pool that ends exactly on a page boundary is complete',
    boundaryRes.ok && boundaryRes.rows.length === exactBoundary.length,
  );
  check(
    'ending on a boundary costs one extra empty page, not a lost row',
    boundaryRes.ok && boundaryRes.pages === 4,
    boundaryRes.ok ? boundaryRes.pages : boundaryRes,
  );

  const partial = makePool(PLANNER_PAGE_SIZE * 2 + 7);
  const partialRes = await collectPlannerRows(fetcherFor(partial), partial.length);
  check(
    'a final partial page is returned in full',
    partialRes.ok && partialRes.rows.length === PLANNER_PAGE_SIZE * 2 + 7,
  );
  check(
    'a short page ends the scan (no wasted request)',
    partialRes.ok && partialRes.pages === 3,
    partialRes.ok ? partialRes.pages : partialRes,
  );

  const small = await collectPlannerRows(fetcherFor(makePool(3)), 3, { pageSize: 10 });
  check('a pool smaller than one page works', small.ok && small.rows.length === 3);

  const ordered = await collectPlannerRows(fetcherFor(makePool(1200)), 1200);
  check(
    'rows come back in strictly ascending key order',
    ordered.ok && ordered.rows.every((r, i) => i === 0 || r.id > ordered.rows[i - 1].id),
  );

  /* ---------------------------------------------------------- failure modes */

  const midFail = await collectPlannerRows(fetcherFor(makePool(3000), { failOnPage: 3 }), 3000);
  check('a failed middle page does NOT return ok', midFail.ok === false);
  check(
    'a failed middle page reports the page error',
    !midFail.ok && midFail.reason === 'page_error',
    midFail,
  );
  check(
    'a failed middle page never yields a partial pool that looks complete',
    !midFail.ok && !('rows' in midFail),
  );

  const firstFail = await collectPlannerRows(fetcherFor(makePool(3000), { failOnPage: 1 }), 3000);
  check('a failed first page fails closed', !firstFail.ok && firstFail.reason === 'page_error');

  const lastFail = await collectPlannerRows(fetcherFor(makePool(1001), { failOnPage: 3 }), 1001);
  check('a failed LAST page fails closed too', !lastFail.ok && lastFail.reason === 'page_error');

  // A server-side row cap: the fetcher silently returns fewer rows than asked
  // for while more data exists. Without the count check this looks like a clean
  // last page — which is precisely the old bug in a new costume.
  const capped: PlannerPageFetcher = async (afterId) => {
    const sorted = makePool(3000);
    const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
    return { rows: sorted.slice(start, start + 100) }; // cap below the requested size
  };
  const cappedRes = await collectPlannerRows(capped, 3000, { pageSize: 500 });
  check(
    'a server-side row cap is caught, not mistaken for the last page',
    !cappedRes.ok && cappedRes.reason === 'short_pool',
    cappedRes,
  );
  check(
    'the short-pool failure reports loaded vs expected',
    !cappedRes.ok && cappedRes.loaded === 100 && cappedRes.expected === 3000,
  );

  // A fetcher that ignores the keyset cursor would loop forever and duplicate
  // every row. It must be refused, not spun on.
  const stuck: PlannerPageFetcher = async (_afterId, pageSize) => ({
    rows: makePool(pageSize),
  });
  const stuckRes = await collectPlannerRows(stuck, null, { pageSize: 10, maxPages: 5 });
  check('a cursor-ignoring fetcher is stopped', !stuckRes.ok);
  check(
    'a cursor-ignoring fetcher is reported as no_progress, not silent truncation',
    !stuckRes.ok && stuckRes.reason === 'no_progress',
    stuckRes,
  );

  const runaway = await collectPlannerRows(fetcherFor(makePool(1000)), null, {
    pageSize: 10,
    maxPages: 3,
  });
  check('exhausting the page guard is a failure, never a quiet stop', !runaway.ok);
  check('the page guard reports page_cap', !runaway.ok && runaway.reason === 'page_cap', runaway);

  // Rows published mid-scan push the total above the pre-scan count. That is
  // growth, not loss, and must not be treated as an error.
  const grew = await collectPlannerRows(fetcherFor(makePool(1200)), 1100);
  check('a pool that grew during the scan still succeeds', grew.ok && grew.rows.length === 1200);

  const noCount = await collectPlannerRows(fetcherFor(makePool(2500)), null);
  check(
    'paging still works when the count is unavailable',
    noCount.ok && noCount.rows.length === 2500,
  );

  /* ------ UNIFICATION ADDENDUM (2026-08-04): no-count terminal condition */

  // Same policy as the directory's collectAllRows: with NO independent count,
  // a short page proves nothing — a server-side cap returns short pages while
  // more data exists. The only honest uncorroborated exit is a verified EMPTY
  // page. Before this rule, cap+no-count returned 100 of 3,000 rows as ok.
  {
    const pool = makePool(3000).sort((a, b) => a.id.localeCompare(b.id));
    const cappedNoCount: PlannerPageFetcher = async (afterId) => {
      const start = afterId === null ? 0 : pool.findIndex((r) => r.id > afterId);
      if (start < 0) return { rows: [] };
      return { rows: pool.slice(start, start + 100) }; // cap below requested size
    };
    const res = await collectPlannerRows(cappedNoCount, null, { pageSize: 500, maxPages: 40 });
    check(
      'server cap with NO count: the scan keeps walking to the verified empty page',
      res.ok && res.rows.length === 3000,
      res.ok ? res.rows.length : res,
    );
  }

  {
    let calls = 0;
    const counted: PlannerPageFetcher = async (afterId, pageSize) => {
      calls++;
      const sorted = makePool(7).sort((a, b) => a.id.localeCompare(b.id));
      const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
      if (start < 0) return { rows: [] };
      return { rows: sorted.slice(start, start + pageSize) };
    };
    const res = await collectPlannerRows(counted, null);
    check('no count, short first page: still complete', res.ok && res.rows.length === 7);
    check(
      'no count, short first page: pays the verified-empty confirmation request',
      calls === 2,
      calls,
    );
  }

  {
    // With a count, the corroborated stop still avoids the extra request.
    let calls = 0;
    const counted: PlannerPageFetcher = async (afterId, pageSize) => {
      calls++;
      const sorted = makePool(7).sort((a, b) => a.id.localeCompare(b.id));
      const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
      if (start < 0) return { rows: [] };
      return { rows: sorted.slice(start, start + pageSize) };
    };
    const res = await collectPlannerRows(counted, 7);
    check(
      'with a count, a corroborated short page still stops in ONE request',
      res.ok && calls === 1,
      calls,
    );
  }
}

/* ------------------------------------------------------- loader contract */

const loader = read('src/lib/trip-planner/directory-loader.ts');
/** Executable source only: the header documents the old `.limit(2000)` by name. */
const loaderCode = loader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('the arbitrary 2000-row cap is gone from the code', !/\.limit\(2000\)/.test(loaderCode));
check('the old cap is still explained in the header', /\.limit\(2000\)/.test(loader));
check('paging is keyset, by primary key', /\.gt\('id', afterId\)/.test(loader));
check(
  'an explicit stable order is requested',
  /\.order\('id', \{ ascending: true \}\)/.test(loader),
);
check('the page size is the requested limit, not a fixed cap', /\.limit\(pageSize\)/.test(loader));
check(
  'the expected pool size is measured before paging',
  /count: 'exact', head: true/.test(loader),
);
check(
  'an incomplete scan is logged through the existing logger',
  /log\.error\('planner_pool_load_incomplete'/.test(loader),
);
check(
  'the failure log carries counts and a reason only, never row data',
  /reason: result\.reason,[\s\S]{0,120}pages: result\.pages,/.test(loaderCode) &&
    !/rows: result\.rows|JSON\.stringify/.test(loaderCode),
);
check(
  'no credential or environment value is read or logged here',
  !/process\.env|SERVICE_ROLE|ANON_KEY|apikey/i.test(loaderCode),
);
check(
  'an incomplete scan still fails soft to []',
  /return \[\];\s*\n\s*}\n\n\s*return result\.rows/.test(loader),
);
check(
  'the same filters guard the count and the pages',
  (loader.match(/\.eq\('is_published', true\)/g) ?? []).length === 2 &&
    (loader.match(/\.is\('deleted_at', null\)/g) ?? []).length === 2,
);
check('page size stays under the conventional 1000-row server cap', PLANNER_PAGE_SIZE <= 1000);
check(
  'the runaway guard is far above any plausible directory size',
  PLANNER_PAGE_SIZE * PLANNER_MAX_PAGES >= 30000,
);

/* ------------------------------------- eligibility + safety are UNCHANGED */

check('zero spaces is still not confirmed parking', !hasConfirmedTruckParking(0));
check('negative spaces is still not confirmed parking', !hasConfirmedTruckParking(-5));
check('null spaces is still not confirmed parking', !hasConfirmedTruckParking(null));
check('undefined spaces is still not confirmed parking', !hasConfirmedTruckParking(undefined));
check('NaN spaces is still not confirmed parking', !hasConfirmedTruckParking(NaN));
check('a string count is still not confirmed parking', !hasConfirmedTruckParking('50'));
check('a positive count is still confirmed parking', hasConfirmedTruckParking(1));
check(
  'parking needs are still overnight + parking',
  isParkingNeed('overnight') && isParkingNeed('parking'),
);
check(
  'fuel and break are still not parking needs',
  !isParkingNeed('fuel') && !isParkingNeed('break'),
);
check(
  'the overnight category set is unchanged',
  NEED_CATEGORIES.overnight.join(',') === 'truck-stops,parking,hotels-truck-parking,rest-areas',
);
check(
  'the parking category set is unchanged',
  NEED_CATEGORIES.parking.join(',') === 'parking,truck-stops,rest-areas',
);
check('the fuel category set is unchanged', NEED_CATEGORIES.fuel.join(',') === 'truck-stops');
check(
  'the break category set is unchanged',
  NEED_CATEGORIES.break.join(',') === 'truck-stops,parking,rest-areas,restaurants',
);

const layer = read('src/lib/trip-planner/directory-layer.ts');
const lastStopSrc = read('src/lib/trip-planner/last-stop.ts');
check('this PR did not touch the eligibility layer', !/paginat|pageSize|afterId/i.test(layer));
check('this PR did not touch last-stop selection', !/paginat|pageSize|afterId/i.test(lastStopSrc));
check(
  'the zero-space rule is still a hard filter in ranking',
  /!isParkingNeed\(need\) \|\| hasConfirmedTruckParking\(c\.parkingSpaces\)/.test(layer),
);
check(
  'last-stop still re-applies the zero-space rule',
  /hasConfirmedTruckParking\(c\.parkingSpaces\)/.test(lastStopSrc),
);

/* ------------------------------------------- M3 overnight rules UNCHANGED */

check('unknown normalizes to unknown', normalizeOvernightStatus(undefined) === 'unknown');
check('null normalizes to unknown', normalizeOvernightStatus(null) === 'unknown');
check('garbage normalizes to unknown', normalizeOvernightStatus('yes please') === 'unknown');
check('confirmed stays confirmed', normalizeOvernightStatus('confirmed') === 'confirmed');
check('prohibited stays prohibited', normalizeOvernightStatus('prohibited') === 'prohibited');
check('unknown is never promoted to confirmed', !isConfirmedOvernight('unknown'));
check('unknown is not treated as prohibited either', !isProhibitedOvernight('unknown'));
check(
  'prohibited is still excluded from the overnight need',
  /need !== 'overnight' \|\| !isProhibitedOvernight\(c\.overnightStatus\)/.test(layer),
);
check(
  'the legacy boolean still earns no overnight credit',
  /isConfirmedOvernight\(c\.overnightStatus\) \? 10 : 0/.test(layer),
);

/* -------------------------- ranking / scoring / last-stop produce the same */

const listings: DirectoryListing[] = [
  {
    id: 'a',
    name: 'Alpha Truck Stop',
    categorySlug: 'truck-stops',
    lat: 34.0,
    lng: -84.0,
    city: 'A',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '10',
    parkingSpaces: 120,
    overnightParking: null,
    overnightStatus: 'confirmed',
    freeParking: true,
    paidParking: null,
    reservationUrl: 'https://example.com/reserve',
    amenities: ['showers', 'fuel'],
    fuelBrands: ['pilot'],
    coordVerificationStatus: 'manually-verified',
  },
  {
    id: 'b',
    name: 'Bravo Rest Area',
    categorySlug: 'rest-areas',
    lat: 34.4,
    lng: -84.0,
    city: 'B',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '20',
    parkingSpaces: null, // unknown → never parkable
    overnightParking: true, // legacy boolean → still no credit
    overnightStatus: 'unknown',
    freeParking: true,
    paidParking: null,
    reservationUrl: null,
    amenities: [],
    fuelBrands: [],
    coordVerificationStatus: null,
  },
  {
    id: 'c',
    name: 'Charlie Parking',
    categorySlug: 'parking',
    lat: 34.8,
    lng: -84.0,
    city: 'C',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '30',
    parkingSpaces: 40,
    overnightParking: null,
    overnightStatus: 'prohibited',
    freeParking: true,
    paidParking: null,
    reservationUrl: null,
    amenities: [],
    fuelBrands: [],
    coordVerificationStatus: 'machine-checked',
  },
];

const routePoints = Array.from({ length: 60 }, (_, i) => ({
  position: { lat: 34.0 + i * 0.02, lng: -84.0 },
  routeMile: i * 1.4,
}));
const candidates = toStopCandidates(listings, routePoints, 5);
const window = { fromMile: 0, toMile: 100 };

const overnight = rankCandidates(candidates, 'overnight', window);
check(
  'unknown-space row is still refused for overnight',
  !overnight.some((r) => r.candidate.id === 'b'),
);
check(
  'prohibited row is still refused for overnight',
  !overnight.some((r) => r.candidate.id === 'c'),
);
check(
  'the confirmed row is still offered',
  overnight.some((r) => r.candidate.id === 'a'),
);

const generalParking = rankCandidates(candidates, 'parking', window);
check(
  'a prohibited row is still available for general parking',
  generalParking.some((r) => r.candidate.id === 'c'),
);
check(
  'an unknown-space row is still refused for general parking',
  !generalParking.some((r) => r.candidate.id === 'b'),
);

check(
  'recommendParking still refuses unknown spaces',
  !recommendParking(candidates, window).some((r) => r.candidate.id === 'b'),
);

const alpha = candidates.find((c) => c.id === 'a')!;
const score = scoreCandidate(alpha, 'overnight');
check('score components are unchanged', score.components.category === 30, score.components);
check('manually-verified coordinates still score 15', score.components.coordinates === 15);
check('100+ spaces still score 15', score.components.parking === 15);
check('confirmed overnight still scores 10', score.components.overnightAllowed === 10);
check('a reservable stop still scores 8', score.components.reservable === 8);

const route = buildRoute([
  {
    seq: 0,
    from: { label: 'Origin', position: { lat: 34.0, lng: -84.0 } },
    to: { label: 'Destination', position: { lat: 35.2, lng: -84.0 } },
    distanceMiles: 84,
    avgSpeedMph: 55,
  },
]);
const slots = selectLastStops({
  timing: timingOf(route),
  candidates,
  clocks: {
    drivingMin: 400,
    windowMin: 500,
    untilBreakMin: 300,
    cycleMin: 3000,
    legalDrivingMin: 400,
    limitedBy: '11-hour',
  },
  departAtMs: 0,
});
check(
  'last-stop still only offers confirmed-space rows',
  slots.slots.every((s) => s.candidate.id !== 'b'),
);
check('last-stop still returns slots for eligible rows', slots.slots.length > 0);
/*
 * The buffer default is no longer declared here or in last-stop.ts. Two
 * constants named DEFAULT_SAFETY_BUFFER_MIN used to exist with different
 * values (30 here, 45 in drive-window.ts), and each file's tests passing
 * against its own copy is exactly how they got to disagree — which the
 * driver then saw as a plan computed at 30 minutes under a caption
 * saying whatever preset they had tapped.
 *
 * This asserts the pass-through, not a number: an unspecified buffer
 * resolves to the ONE authority, wherever that authority sets it.
 */
check(
  'an unspecified buffer resolves to the single system-wide default',
  slots.bufferMin === DEFAULT_SAFETY_BUFFER_MIN,
  slots.bufferMin,
);

pagingTests().then(() => {
  console.log(`planner-pool-pagination: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
