/**
 * Lead-funnel display-helper tests (read-only).
 *
 * Covers: source→segment mapping for known sources; safe fallback for
 * unknown/null/empty and prototype-chain source names; UTM summarization
 * across valid, partial, missing, malformed, and foreign-object inputs
 * (never throws).
 *
 * Run:
 *   npx esbuild scripts/test-lead-funnel.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-lead-funnel.cjs && node /tmp/test-lead-funnel.cjs
 */
import { segmentFor, utmSummary, LEAD_SOURCES } from '@/lib/leads/funnel';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ── segmentFor: known sources map to a stable, labeled segment ────────── */
check('newsletter → driver-general', segmentFor('newsletter').key === 'driver-general');
check('founder → supporters', segmentFor('founder').key === 'supporters');
check('practice-test → students-cdl-prep', segmentFor('practice-test').key === 'students-cdl-prep');
for (const s of LEAD_SOURCES) {
  const seg = segmentFor(s);
  check(`${s}: has label`, typeof seg.label === 'string' && seg.label.length > 0, seg);
  check(`${s}: not fallback`, seg.key !== 'unsegmented', seg);
}

/* ── segmentFor: unknown / empty / null → fallback ─────────────────────── */
check('unknown source → unsegmented', segmentFor('whatever').key === 'unsegmented');
check('null → unsegmented', segmentFor(null).key === 'unsegmented');
check('undefined → unsegmented', segmentFor(undefined).key === 'unsegmented');
check('empty string → unsegmented', segmentFor('').key === 'unsegmented');

/* ── segmentFor: prototype-chain names never resolve to a real segment ─── */
for (const evil of ['constructor', '__proto__', 'hasOwnProperty', 'toString']) {
  check(`prototype-chain "${evil}" → unsegmented`, segmentFor(evil).key === 'unsegmented');
}

/* ── utmSummary: valid, partial, missing, malformed ────────────────────── */
check(
  'full utm → source · campaign',
  utmSummary({ utm_source: 'youtube', utm_medium: 'video', utm_campaign: 'dot-guide' }) ===
    'youtube · dot-guide',
);
check(
  'no campaign → source · medium',
  utmSummary({ utm_source: 'youtube', utm_medium: 'video' }) === 'youtube · video',
);
check('source only → source', utmSummary({ utm_source: 'newsletter' }) === 'newsletter');
check('empty object → null', utmSummary({}) === null);
check('null → null', utmSummary(null) === null);
check('undefined → null', utmSummary(undefined) === null);
check('string → null (not object)', utmSummary('utm_source=x') === null);
check('number → null', utmSummary(42) === null);
check(
  'non-string values ignored',
  utmSummary({ utm_source: 123, utm_campaign: { nested: true } }) === null,
);
check(
  'foreign keys ignored',
  utmSummary({ ref: 'x', foo: 'bar' }) === null,
  utmSummary({ ref: 'x', foo: 'bar' }),
);

console.log(`\nlead-funnel: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
