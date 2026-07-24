/**
 * Knowledge Center conversion-map tests.
 *
 * Covers: every known category maps to exactly two conversions; unknown
 * categories fall back to safe defaults; every destination is a live-style
 * internal route; no destination is undefined; no category repeats a
 * destination; all referenced routes belong to a confirmed-live allowlist.
 *
 * Run:
 *   npx esbuild scripts/test-kc-conversions.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-kc-conversions.cjs && node /tmp/test-kc-conversions.cjs
 */
import { conversionsFor, type KcConversion } from '@/lib/kc/conversions';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

// Category slugs that exist in the KC seed migrations.
const KNOWN_CATEGORIES = [
  'dot-compliance',
  'hours-of-service',
  'getting-your-cdl',
  'cdl-training',
  'trucking-careers',
  'health-on-the-road',
];

// Confirmed-live static routes the map is allowed to point at.
const LIVE_ROUTES = new Set([
  '/practice-tests',
  '/cdl-pre-school',
  '/trip-planner',
  '/directory',
  '/books',
  '/academy',
  '/dot-tools',
]);

const validShape = (c: KcConversion) =>
  !!c &&
  typeof c.title === 'string' &&
  c.title.length > 0 &&
  typeof c.blurb === 'string' &&
  c.blurb.length > 0 &&
  typeof c.href === 'string' &&
  typeof c.cta === 'string' &&
  c.cta.length > 0;

/* ── 1. Known categories: exactly two valid, live, unique destinations ─── */
for (const cat of KNOWN_CATEGORIES) {
  const steps = conversionsFor(cat);
  check(`${cat}: two steps`, steps.length === 2, steps.length);
  check(`${cat}: no undefined`, steps.every(Boolean), steps);
  check(`${cat}: valid shape`, steps.every(validShape), steps);
  check(
    `${cat}: internal hrefs`,
    steps.every((s) => s.href.startsWith('/') && !s.href.startsWith('//')),
    steps.map((s) => s.href),
  );
  check(
    `${cat}: hrefs are live routes`,
    steps.every((s) => LIVE_ROUTES.has(s.href)),
    steps.map((s) => s.href),
  );
  const hrefs = steps.map((s) => s.href);
  check(`${cat}: no duplicate destination`, new Set(hrefs).size === hrefs.length, hrefs);
}

/* ── 2. Unknown category → safe defaults ───────────────────────────────── */
const fallback = conversionsFor('does-not-exist');
check('fallback: two steps', fallback.length === 2, fallback);
check(
  'fallback: valid + live',
  fallback.every((s) => validShape(s) && LIVE_ROUTES.has(s.href)),
  fallback,
);
check('fallback: no duplicates', new Set(fallback.map((s) => s.href)).size === fallback.length);

/* ── 3. Prototype-chain category names hit the fallback, never throw ────── */
for (const evil of ['constructor', '__proto__', 'hasOwnProperty', 'toString']) {
  const out = conversionsFor(evil);
  check(
    `prototype-chain "${evil}" → safe defaults`,
    out.length === 2 && out.every(validShape),
    out,
  );
}

console.log(`\nkc-conversions: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
