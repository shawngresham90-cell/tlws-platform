/**
 * Unit tests for sitemap freshness derivation (SEO). Verifies hub pages get the
 * newest updated_at of their listings, bad dates are ignored, and the fallback
 * behaves.
 *
 * Run:
 *   npx esbuild scripts/test-sitemap-freshness.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-sitemap-freshness.cjs && node /tmp/test-sitemap-freshness.cjs
 */
import {
  computeFreshness,
  exitKey,
  lastModifiedOr,
  type FreshnessInput,
} from '@/lib/directory/sitemap-freshness';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const ENTRIES: FreshnessInput[] = [
  { category: 'truck-stops', state: 'TN', interstate: 'I-24', exitNumber: '81', updatedAt: '2026-07-01T00:00:00Z' },
  { category: 'truck-stops', state: 'TN', interstate: 'I-24', exitNumber: '81', updatedAt: '2026-07-10T00:00:00Z' },
  { category: 'cat-scales', state: 'GA', interstate: 'I-75', exitNumber: '306', updatedAt: '2026-06-15T00:00:00Z' },
  { category: 'truck-stops', state: 'tn', interstate: 'I-24', exitNumber: '64', updatedAt: '2026-05-01T00:00:00Z' },
  { category: 'parking', state: 'GA', updatedAt: '' }, // no date — ignored
  { category: 'parking', state: 'GA', updatedAt: 'not-a-date' }, // bad date — ignored
];

const f = computeFreshness(ENTRIES);
const ts = (s: string) => Date.parse(s);

/* ---------------------- global ---------------------- */
check('global = newest overall (2026-07-10)', f.global === ts('2026-07-10T00:00:00Z'), f.global);

/* ---------------------- by category ---------------------- */
check('truck-stops category = 2026-07-10', f.byCategory.get('truck-stops') === ts('2026-07-10T00:00:00Z'));
check('cat-scales category = 2026-06-15', f.byCategory.get('cat-scales') === ts('2026-06-15T00:00:00Z'));
check('parking category absent (only bad/blank dates)', !f.byCategory.has('parking'));

/* ---------------------- by state (case-normalized) ---------------------- */
check('TN state = 2026-07-10 (merges "tn" + "TN")', f.byState.get('TN') === ts('2026-07-10T00:00:00Z'));
check('GA state = 2026-06-15 (blank/bad dates ignored)', f.byState.get('GA') === ts('2026-06-15T00:00:00Z'));
check('lowercase state key not present', !f.byState.has('tn'));

/* ---------------------- by interstate ---------------------- */
check('I-24 = 2026-07-10', f.byInterstate.get('I-24') === ts('2026-07-10T00:00:00Z'));
check('I-75 = 2026-06-15', f.byInterstate.get('I-75') === ts('2026-06-15T00:00:00Z'));

/* ---------------------- by exit ---------------------- */
check('exitKey format', exitKey('I-24', '81') === 'I-24|81');
check('I-24 exit 81 = 2026-07-10 (max of two)', f.byExit.get(exitKey('I-24', '81')) === ts('2026-07-10T00:00:00Z'));
check('I-24 exit 64 = 2026-05-01', f.byExit.get(exitKey('I-24', '64')) === ts('2026-05-01T00:00:00Z'));
check('unknown exit absent', !f.byExit.has(exitKey('I-24', '999')));

/* ---------------------- empty input ---------------------- */
const empty = computeFreshness([]);
check('empty: global null', empty.global === null);
check('empty: maps empty', empty.byCategory.size === 0 && empty.byState.size === 0);

/* ---------------------- lastModifiedOr ---------------------- */
const fallback = new Date('2026-01-01T00:00:00Z');
check('lastModifiedOr(null) → fallback', lastModifiedOr(null, fallback) === fallback);
check('lastModifiedOr(undefined) → fallback', lastModifiedOr(undefined, fallback) === fallback);
check('lastModifiedOr(ts) → that date', lastModifiedOr(ts('2026-07-10T00:00:00Z'), fallback).getTime() === ts('2026-07-10T00:00:00Z'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
