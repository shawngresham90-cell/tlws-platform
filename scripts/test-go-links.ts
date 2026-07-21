/**
 * Offline tests for the /go short-link system (Block 2, M4). Run:
 *
 *   npx esbuild scripts/test-go-links.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-go-links.cjs && node /tmp/test-go-links.cjs
 */
import { GO_LINKS, resolveGoLink } from '@/lib/go-links';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

// Static routes/anchors known to exist (the preview crawl verifies rendered
// pages end-to-end; /knowledge/* categories are verified against live data).
const LIVE_TARGETS = new Set([
  '/knowledge/dot-compliance',
  '/knowledge/hours-of-service',
  '/directory/parking',
  '/directory',
  '/practice-tests',
  '/trip-planner',
  '/books',
  '/cdl-pre-school',
  '/academy/apply',
  '/academy',
  '/founders',
  '/sponsors',
  '/#newsletter',
]);

for (const [slug, target] of Object.entries(GO_LINKS)) {
  check(`${slug}: slug is url-safe lowercase`, /^[a-z0-9-]+$/.test(slug));
  check(`${slug}: target is a known internal route`, LIVE_TARGETS.has(target), target);
  const resolved = resolveGoLink(slug);
  check(
    `${slug}: resolves with youtube utm tagging`,
    Boolean(resolved?.includes('utm_source=youtube') && resolved.includes(`utm_campaign=${slug}`)),
  );
}

{
  const r = resolveGoLink('newsletter');
  check(
    'hash targets keep the fragment after the query',
    r === '/?utm_source=youtube&utm_medium=video&utm_campaign=newsletter#newsletter',
    r,
  );
}
check('unknown slug → null (route falls back to /)', resolveGoLink('nope') === null);
check(
  'no external destinations',
  Object.values(GO_LINKS).every((t) => t.startsWith('/')),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
