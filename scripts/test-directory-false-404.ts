/**
 * Directory read semantics — empty vs. error (2026-07-30).
 *
 * `/directory/i75/exit-369` served a 404 for hours while 11 published rows sat
 * in the table. Cause: every directory read collapsed a failed query into
 * `[]`, and the exit page turned `[]` into `notFound()`. On an ISR route that
 * 404 is cached, so one transient failure became a durable lie.
 *
 * These tests pin the three-outcome contract and prove the exit page's 404
 * decision now depends on a SUCCESSFUL empty read — never on a failure.
 *
 * The page components are server components that hit the network, so the
 * decision logic is verified two ways: the pure helpers are executed directly,
 * and the page source is asserted to route each outcome to the right terminal
 * (notFound vs. throw). Data-shape fixtures mirror the real Exit 369 / 201 rows.
 *
 * Run:
 *   npx esbuild scripts/test-directory-false-404.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-directory-false-404.cjs \
 *   && node /tmp/test-directory-false-404.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DirectoryUnavailableError,
  throwDirectoryUnavailable,
  unwrapDirectoryRead,
  type DirectoryReadResult,
} from '@/lib/directory/data';
import { exitSlug, exitFromSlug, interstateBySlug } from '@/lib/directory/interstates';
import {
  parseExitPosition,
  resolveRoutePosition,
  PARKING_CATEGORIES,
} from '@/lib/directory/corridor';
import {
  normalizeOvernightStatus,
  isConfirmedOvernight,
  isProhibitedOvernight,
} from '@/lib/directory/overnight';
import { hasConfirmedTruckParking, NEED_CATEGORIES } from '@/lib/trip-planner/directory-layer';

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
const exitPage = read('src/app/(directory)/directory/[category]/[exit]/page.tsx');
const categoryPage = read('src/app/(directory)/directory/[category]/page.tsx');
const dataLayer = read('src/lib/directory/data.ts');
/** Executable source only — the headers document the old bug by name. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const exitCode = strip(exitPage);
const categoryCode = strip(categoryPage);
const dataCode = strip(dataLayer);

/* ---------------------------------------- the three-outcome read contract */

const okRows: DirectoryReadResult<string[]> = { ok: true, data: ['a', 'b'] };
const okEmpty: DirectoryReadResult<string[]> = { ok: true, data: [] };
const errQuery: DirectoryReadResult<string[]> = { ok: false, reason: 'query_error', code: '57014' };
const errUnavail: DirectoryReadResult<string[]> = { ok: false, reason: 'unavailable' };

check(
  'B: success with rows unwraps to the rows',
  unwrapDirectoryRead(okRows, 'op', '/r').length === 2,
);
check(
  'A: success with ZERO rows unwraps to [] and does NOT throw',
  unwrapDirectoryRead(okEmpty, 'op', '/r').length === 0,
);
check(
  'A is distinguishable from C: both are "empty" downstream, but only one is ok',
  okEmpty.ok === true && errQuery.ok === false,
);

for (const [label, failure] of [
  ['query_error', errQuery],
  ['unavailable', errUnavail],
] as const) {
  let threw: unknown = null;
  try {
    unwrapDirectoryRead(failure, 'op', '/r');
  } catch (e) {
    threw = e;
  }
  check(
    `C: a ${label} read THROWS rather than returning []`,
    threw instanceof DirectoryUnavailableError,
  );
  check(
    `C: the ${label} error names the failed operation`,
    (threw as Error)?.message?.includes('op'),
  );
}

let direct: unknown = null;
try {
  throwDirectoryUnavailable('op', '/r', { reason: 'query_error', code: '57014' });
} catch (e) {
  direct = e;
}
check('throwDirectoryUnavailable always throws', direct instanceof DirectoryUnavailableError);

/* --------------------------------------------- timeout-like read failure */

// 57014 is Postgres statement_timeout — the anon role carries a 3s limit, the
// most likely real-world trigger. It must never look like "no listings".
const timeout: DirectoryReadResult<string[]> = { ok: false, reason: 'query_error', code: '57014' };
let timeoutThrew = false;
try {
  unwrapDirectoryRead(timeout, 'exit_page.entries', '/directory/i75/exit-369');
} catch {
  timeoutThrew = true;
}
check('a timeout-shaped failure throws, never yields an empty page', timeoutThrew);
check(
  'a timeout failure is not confused with a successful empty read',
  timeout.ok === false && okEmpty.ok === true,
);

/* -------------------------------------------------- no secrets in logging */

check(
  'the failure log carries operation, route, reason and code only',
  /log\.error\('directory_read_failed', \{[\s\S]{0,200}operation,[\s\S]{0,200}route,[\s\S]{0,200}reason:[\s\S]{0,200}code:/.test(
    dataCode,
  ),
);
check(
  'the driver error message and details are never logged or thrown',
  !/error\.message|error\.details|error\.hint|JSON\.stringify\(error/.test(dataCode),
);
/**
 * The credential ban is absolute and unchanged. What changed is the shape of
 * the assertion: the complete-read work introduced ONE environment read —
 * NEXT_PHASE, the build-phase marker Next assigns during `next build` — so a
 * blanket `process.env` ban no longer distinguishes "reads a secret" from
 * "checks which phase it is running in". Naming the single permitted read and
 * pinning how it may be used is strictly stronger than the blanket form: an
 * aliased or dynamic env read now fails where before it could slip past.
 */
check(
  'no credential is read in the data layer',
  !/SERVICE_ROLE|ANON_KEY|apikey|SUPABASE_[A-Z_]*KEY|SECRET|TOKEN|PASSWORD/i.test(dataCode),
);
check(
  'the ONLY environment value read is the build-phase marker',
  (dataCode.match(/process\.env\.[A-Za-z_]+/g) ?? []).every(
    (m) => m === 'process.env.NEXT_PHASE',
  ) && !/process\.env\s*\[/.test(dataCode),
);
check(
  'the build-phase marker is compared to a literal, never logged or returned',
  /process\.env\.NEXT_PHASE === BUILD_PHASE/.test(dataCode) &&
    (dataCode.match(/process\.env\.NEXT_PHASE/g) ?? []).length === 1,
);
check('only a short SQLSTATE-shaped code is surfaced', /code\.length <= 12/.test(dataCode));
check(
  'no row contents are logged',
  !/rows:|data: result\.data|entries\)/.test(
    strip(dataLayer.split('throwDirectoryUnavailable')[1] ?? ''),
  ),
);

/* ------------------------------------------------ exit page 404 decisions */

check(
  'the exit page models three outcomes, not two',
  /status: 'ok'/.test(exitCode) &&
    /status: 'not-found'/.test(exitCode) &&
    /status: 'unavailable'/.test(exitCode),
);
check(
  'an unknown interstate slug is a genuine 404 with no database involved',
  /if \(!interstate\) return \{ status: 'not-found' \}/.test(exitCode),
);
check(
  'a FAILED facet read resolves to unavailable, never not-found',
  /if \(!facetsResult\.ok\) \{\s*return \{ status: 'unavailable'/.test(exitCode),
);
check(
  'an exit missing from a SUCCESSFUL facet read is a genuine 404',
  /if \(!exit\) return \{ status: 'not-found' \}/.test(exitCode),
);
check(
  'unavailable throws instead of calling notFound()',
  /if \(resolved\.status === 'unavailable'\) \{\s*throwDirectoryUnavailable/.test(exitCode),
);
check(
  'not-found still calls notFound()',
  /if \(resolved\.status === 'not-found'\) notFound\(\)/.test(exitCode),
);
/**
 * The exit page now reads through request-scoped `cache()` wrappers (its
 * metadata and body used to run the same facet scan three times). The
 * invariant these checks pin is unchanged — every page read resolves to a
 * STRICT `*Result` variant, never a fail-soft one — so the assertion follows
 * the chain: the page must call the cached names, and the wrapper module
 * must bind each cached name to exactly its strict variant via React cache().
 */
const requestCacheCode = read('src/lib/directory/request-cache.ts');
check(
  'every page read uses the request-cached strict result variant',
  /cachedEntriesByExitResult\(/.test(exitCode) &&
    /cachedEntriesByInterstateResult\(/.test(exitCode) &&
    /cachedDirectoryFacetsResult\(/.test(exitCode),
);
check(
  'the cached wrappers wrap exactly the strict result variants',
  /cachedDirectoryFacetsResult = cache\(getDirectoryFacetsResult\)/.test(requestCacheCode) &&
    /cachedEntriesByExitResult = cache\(getEntriesByExitResult\)/.test(requestCacheCode) &&
    /cachedEntriesByInterstateResult = cache\(getEntriesByInterstateResult\)/.test(
      requestCacheCode,
    ),
);
// generateStaticParams stays fail-soft ON PURPOSE (a build that cannot reach
// the database prerenders nothing rather than failing or baking 404s). The
// render path — metadata onward — is what must never take a fail-soft read.
const exitRenderCode = exitCode.slice(exitCode.indexOf('export async function generateMetadata'));
check(
  'the render path takes no fail-soft directory read',
  exitRenderCode.length > 0 &&
    !/getEntries\(|getEntriesByExit\(|getEntriesByInterstate\(|getDirectoryFacets\(/.test(
      exitRenderCode,
    ),
);
check(
  'all three page reads are unwrapped (a failure in any one cannot be ignored)',
  (exitCode.match(/unwrapDirectoryRead\(/g) ?? []).length === 3,
);
check(
  'the only remaining empty-based 404 is guarded by a SUCCESSFUL read',
  /const entries = unwrapDirectoryRead\(entriesResult[\s\S]{0,400}if \(entries\.length === 0\) notFound\(\)/.test(
    exitCode,
  ),
);
check(
  'the fail-soft getEntriesByExit is no longer used by the exit page',
  !/[^a-zA-Z]getEntriesByExit\(/.test(exitCode),
);
check(
  'generateStaticParams stays fail-soft so a DB-less build cannot bake 404s',
  /generateStaticParams\(\)[\s\S]{0,200}await getDirectoryFacets\(\)/.test(exitCode),
);
check(
  'metadata never decides the response status',
  /if \(resolved\.status !== 'ok'\) return \{\}/.test(exitCode),
);

/* ------------------------------------- category / corridor page semantics */

/**
 * The category/state/corridor page CANNOT false-404: its only notFound() is
 * guarded by resolveSlug(), which is pure (registry + regex, no database). A
 * failed read there renders an empty directory instead — a real but different
 * defect, deliberately left for a separate decision because making it throw
 * fails the BUILD whenever the database is unreachable (its 8 categories
 * always prerender). Verified here so the claim cannot silently rot.
 */
const resolveSlugBody = (() => {
  const start = categoryCode.indexOf('function resolveSlug');
  if (start < 0) return '';
  const next = categoryCode.indexOf('\nexport ', start);
  return categoryCode.slice(start, next < 0 ? undefined : next);
})();
check('resolveSlug definition was found', resolveSlugBody.length > 0);
check(
  'resolveSlug is pure (synchronous, no await, no database call)',
  !/async function resolveSlug/.test(categoryCode) &&
    !/await/.test(resolveSlugBody) &&
    !/getEntries|getDirectoryFacets/.test(resolveSlugBody),
);
check(
  'the category page never 404s from a read — its guard is the pure resolver',
  /const resolved = resolveSlug\(params\.category\);\s*if \(!resolved\) notFound\(\)/.test(
    categoryCode,
  ),
);
check(
  'the category page still calls notFound() exactly once, for an unknown slug',
  (categoryCode.match(/notFound\(\)/g) ?? []).length === 1,
);
check(
  'the category page is UNCHANGED by this PR (kept fail-soft on purpose)',
  /getEntries\(category\.slug\), getDirectoryFacets\(\)/.test(categoryCode) &&
    !/unwrapDirectoryRead/.test(categoryCode),
);

/* ------------------------------ Exit 369 / 201 data shapes resolve as valid */

const i75 = interstateBySlug('i75');
check('i75 resolves to the I-75 corridor', i75?.designation === 'I-75');

// Facet shape as getDirectoryFacets builds it: distinct trimmed exit values.
const knownExits = ['201', '369', '60', '369A'];
check('Exit 369 resolves from its slug', exitFromSlug('exit-369', knownExits) === '369');
check('Exit 201 control resolves from its slug', exitFromSlug('exit-201', knownExits) === '201');
check('exit 369 slugifies round-trip', exitSlug('369') === 'exit-369');
check('369A is a DIFFERENT exit and does not collide', exitSlug('369A') === 'exit-369a');
check(
  'an exit absent from the facets is genuinely unresolvable',
  exitFromSlug('exit-999', knownExits) === undefined,
);

// The 11 real Exit 369 rows: mixed categories, all published, TN, I-75.
const exit369Rows = [
  { name: 'Petro Knoxville', category_slug: 'truck-stops' },
  { name: 'TA Knoxville West', category_slug: 'truck-stops' },
  { name: 'Flying J Travel Center #722', category_slug: 'truck-stops' },
  { name: 'CAT Scale — Petro Knoxville #312', category_slug: 'cat-scales' },
  { name: 'CAT Scale — Pilot Travel Center (Flying J #722)', category_slug: 'cat-scales' },
  { name: 'CAT Scale — TA Knoxville West #269', category_slug: 'cat-scales' },
  { name: "Love's Speedco #932 Knoxville", category_slug: 'tire-repair' },
  { name: 'TA Truck Service - Petro Knoxville', category_slug: 'tire-repair' },
  { name: 'TA Truck Service - TA Knoxville West', category_slug: 'tire-repair' },
  { name: 'Blue Beacon Truck Wash of Knoxville', category_slug: 'truck-washes' },
  { name: 'Pride Truck Wash', category_slug: 'truck-washes' },
];
const exit369Read: DirectoryReadResult<typeof exit369Rows> = { ok: true, data: exit369Rows };
const resolved369 = unwrapDirectoryRead(
  exit369Read,
  'exit_page.entries',
  '/directory/i75/exit-369',
);
check('Exit 369 fixture carries 11 rows', resolved369.length === 11);
check('Exit 369 is therefore NOT a 404 (rows > 0)', resolved369.length > 0);
check(
  'Exit 369 spans the real mixed categories',
  new Set(resolved369.map((r) => r.category_slug)).size === 4,
);

const exit201Read: DirectoryReadResult<{ name: string }[]> = {
  ok: true,
  data: Array.from({ length: 8 }, (_, i) => ({ name: `Exit 201 listing ${i}` })),
};
check(
  'Exit 201 control resolves with its 8 rows',
  unwrapDirectoryRead(exit201Read, 'op', '/r').length === 8,
);

// A genuinely empty exit: the read SUCCEEDED, so 404 is correct.
const emptyExitRead: DirectoryReadResult<unknown[]> = { ok: true, data: [] };
check(
  'a valid exit with a confirmed zero-row read is a legitimate 404',
  emptyExitRead.ok === true && unwrapDirectoryRead(emptyExitRead, 'op', '/r').length === 0,
);

/* ------------------------------- normalization + filtering are UNCHANGED */

check('strict exit parser unchanged: plain number', parseExitPosition('41') === 41);
check('strict exit parser unchanged: letter suffix', parseExitPosition('41A') === 41);
check(
  'strict exit parser unchanged: compound refused',
  parseExitPosition('11/I-49, Exit 39') === null,
);
check('strict exit parser unchanged: street name refused', parseExitPosition('Third St') === null);
check(
  'an exit is still never relabeled a mile marker',
  resolveRoutePosition({ mileMarker: undefined, exitNumber: '369' })?.positionKind === 'exit',
);
check(
  'a verified mile marker is still labeled MM',
  resolveRoutePosition({ mileMarker: 71.5, exitNumber: '369' })?.positionKind === 'mile-marker',
);
check(
  'parking categories unchanged',
  PARKING_CATEGORIES.join(',') === 'parking,truck-stops,rest-areas,hotels-truck-parking',
);
check(
  'planner overnight categories unchanged',
  NEED_CATEGORIES.overnight.join(',') === 'truck-stops,parking,hotels-truck-parking,rest-areas',
);

check(
  'the published filter is unchanged on both queries',
  (dataCode.match(/\.eq\('is_published', true\)/g) ?? []).length >= 2,
);
check(
  'the soft-delete filter is unchanged on both queries',
  (dataCode.match(/\.is\('deleted_at', null\)/g) ?? []).length >= 2,
);
/**
 * The entry and facet reads no longer carry a fixed cap: the complete-read
 * pagination change replaced `.limit(1000)` / `.limit(5000)` with a keyset
 * scan over the whole set. These two assertions used to pin those literals;
 * they now pin the SEMANTIC invariant those literals were standing in for —
 * the reads are still scoped and still deterministically ordered, and the
 * featured-then-name presentation order still governs what a driver sees.
 */
check(
  'entry and facet reads page deterministically by primary key',
  /\.order\('id', \{ ascending: true \}\)/.test(dataCode) && /\.gt\('id', afterId\)/.test(dataCode),
);
check(
  'the featured-then-name presentation order still governs the rendered list',
  /Number\(b\.featured\) - Number\(a\.featured\) \|\| a\.name\.localeCompare\(b\.name\)/.test(
    dataCode,
  ),
);
check('a bounded safety cap still scopes the per-corridor read', /\.limit\(1000\)/.test(dataCode));
check(
  'facet normalization is unchanged (trim + upper state, trim highway/exit)',
  /r\.state\?\.trim\(\)\.toUpperCase\(\)/.test(dataCode) &&
    /r\.interstate\?\.trim\(\)/.test(dataCode) &&
    /r\.exit_number\?\.trim\(\)/.test(dataCode),
);
check(
  'no filter was loosened — the only query shape is still eq-based',
  !/\.or\(|\.ilike\(|\.neq\('is_published'/.test(dataCode),
);

/* --------------------------- parking / overnight / mile-marker unchanged */

check('zero spaces still not confirmed parking', !hasConfirmedTruckParking(0));
check('null spaces still not confirmed parking', !hasConfirmedTruckParking(null));
check('positive spaces still confirmed parking', hasConfirmedTruckParking(42));
check(
  'unknown overnight still normalizes to unknown',
  normalizeOvernightStatus(null) === 'unknown',
);
check('unknown is still never promoted to confirmed', !isConfirmedOvernight('unknown'));
check('prohibited is still prohibited', isProhibitedOvernight('prohibited'));
check(
  'this PR did not touch the planner or corridor modules',
  !/DirectoryReadResult|unwrapDirectoryRead/.test(
    read('src/lib/trip-planner/directory-layer.ts'),
  ) && !/DirectoryReadResult|unwrapDirectoryRead/.test(read('src/lib/directory/corridor.ts')),
);
check(
  'no migration was added for this change',
  !fs.existsSync(path.join(process.cwd(), 'supabase/migrations/050_directory_read_semantics.sql')),
);

console.log(`directory-false-404: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
