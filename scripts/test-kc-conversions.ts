/**
 * Offline tests for the Knowledge Center conversion map (Block 2, M2). Run:
 *
 *   npx esbuild scripts/test-kc-conversions.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-kc-conversions.cjs && node /tmp/test-kc-conversions.cjs
 */
import { conversionsFor } from '@/lib/kc/conversions';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

// The six live kc_categories slugs (verified against production data).
const CATEGORIES = [
  'cdl-training',
  'dot-compliance',
  'getting-your-cdl',
  'health-on-the-road',
  'hours-of-service',
  'trucking-careers',
];

// Static routes that exist in src/app (the preview crawl re-verifies rendered
// links end-to-end).
const LIVE_ROUTES = new Set([
  '/practice-tests',
  '/cdl-pre-school',
  '/trip-planner',
  '/directory',
  '/books',
  '/academy',
]);

for (const slug of CATEGORIES) {
  const steps = conversionsFor(slug);
  check(`${slug}: exactly two next steps`, steps.length === 2);
  check(
    `${slug}: hrefs are live internal routes`,
    steps.every((s) => LIVE_ROUTES.has(s.href)),
    steps.map((s) => s.href),
  );
  check(
    `${slug}: no duplicate destinations`,
    new Set(steps.map((s) => s.href)).size === steps.length,
  );
  check(
    `${slug}: title/blurb/cta all present`,
    steps.every((s) => s.title && s.blurb && s.cta),
  );
}

const fallback = conversionsFor('some-future-category');
check('unknown category: safe defaults', fallback.length === 2);
check(
  'unknown category: defaults are live routes',
  fallback.every((s) => LIVE_ROUTES.has(s.href)),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
