/**
 * Milestone 21 unit tests: slug-redirect planning — self-loop prevention,
 * chain collapse (resolution is old → listing → CURRENT slug, so one hop by
 * construction), reclaim pruning (A→B→A never leaves a row that redirects the
 * reclaimed slug away), collision handling on old_slug uniqueness, and input
 * validation. Resolution itself is exercised through a fixture resolver that
 * mirrors resolveSlugRedirect()'s guards (published/deleted/self checks).
 *
 * Run:
 *   npx esbuild scripts/test-redirects.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-redirects.cjs && node /tmp/test-redirects.cjs
 */
import { planSlugRedirect } from '@/lib/directory/redirects';
import { isValidDetailSlug } from '@/lib/directory/detail-slug';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ------------------------- planning ------------------------- */
{
  const plan = planSlugRedirect({ currentSlug: 'old-name-dalton-ga', nextSlug: 'new-name-dalton-ga', existingOldSlugs: new Set() });
  check('plan: simple rename ok', plan.ok && plan.insert.oldSlug === 'old-name-dalton-ga' && plan.insert.newSlug === 'new-name-dalton-ga');
  check('plan: no deletes when nothing conflicts', plan.ok && plan.deleteOldSlugs.length === 0);

  const noop = planSlugRedirect({ currentSlug: 'same-slug', nextSlug: 'same-slug', existingOldSlugs: new Set() });
  check('plan: unchanged slug refused (self-loop prevention)', !noop.ok);

  // Reclaim: the listing had A, was renamed to B (row A→B exists), and is now
  // renamed back to A. The stale A→B row MUST be deleted or the reclaimed URL
  // would redirect away from its own listing.
  const reclaim = planSlugRedirect({ currentSlug: 'b-slug', nextSlug: 'a-slug', existingOldSlugs: new Set(['a-slug']) });
  check('plan: reclaimed slug row pruned', reclaim.ok && reclaim.deleteOldSlugs.includes('a-slug'));

  // Ping-pong: renaming back and forth must replace the old row for
  // currentSlug rather than violating old_slug uniqueness.
  const pingPong = planSlugRedirect({ currentSlug: 'b-slug', nextSlug: 'a-slug', existingOldSlugs: new Set(['a-slug', 'b-slug']) });
  check('plan: existing old_slug row replaced (collision prevention)', pingPong.ok && pingPong.deleteOldSlugs.includes('b-slug') && pingPong.deleteOldSlugs.includes('a-slug'));

  const badInput = planSlugRedirect({ currentSlug: 'UPPER-Case', nextSlug: 'fine-slug', existingOldSlugs: new Set() });
  check('plan: invalid slug refused', !badInput.ok);
}

/* ------------------------- resolution semantics (fixture mirror) ------------------------- */
// Mirrors resolveSlugRedirect(): old_slug → location → CURRENT detail_slug,
// null for unpublished/deleted/missing/self.
type FixtureListing = { detailSlug: string; published: boolean; deleted: boolean };
function resolveFixture(
  oldSlug: string,
  redirects: Map<string, string>, // old_slug → location key
  listings: Map<string, FixtureListing>,
): string | null {
  if (!isValidDetailSlug(oldSlug)) return null;
  const locationKey = redirects.get(oldSlug);
  if (!locationKey) return null;
  const listing = listings.get(locationKey);
  if (!listing || !listing.published || listing.deleted) return null;
  if (listing.detailSlug === oldSlug) return null;
  return listing.detailSlug;
}

{
  const listings = new Map<string, FixtureListing>([
    ['L1', { detailSlug: 'current-slug', published: true, deleted: false }],
    ['L2', { detailSlug: 'unpub-slug', published: false, deleted: false }],
    ['L3', { detailSlug: 'deleted-slug', published: true, deleted: true }],
  ]);
  // Two generations of renames for L1: oldest-slug → mid-slug → current-slug.
  const redirects = new Map<string, string>([
    ['oldest-slug', 'L1'],
    ['mid-slug', 'L1'],
    ['retired-unpub', 'L2'],
    ['retired-deleted', 'L3'],
  ]);

  check('resolve: old slug → current canonical', resolveFixture('mid-slug', redirects, listings) === 'current-slug');
  check('resolve: two-generation chain collapses to one hop', resolveFixture('oldest-slug', redirects, listings) === 'current-slug');
  check('resolve: unknown slug → null (404)', resolveFixture('never-existed', redirects, listings) === null);
  check('resolve: unpublished target → null (404)', resolveFixture('retired-unpub', redirects, listings) === null);
  check('resolve: deleted target → null (404)', resolveFixture('retired-deleted', redirects, listings) === null);
  check('resolve: malformed slug → null', resolveFixture('../etc', redirects, listings) === null);

  // Self-loop guard: a redirect row whose old_slug equals the listing's
  // current slug must resolve to null, not to itself.
  const selfLoop = new Map<string, string>([['current-slug', 'L1']]);
  check('resolve: self-loop row → null', resolveFixture('current-slug', selfLoop, listings) === null);

  // Canonical invariant: whatever hop you enter from, the destination is the
  // listing's CURRENT slug — the sitemap contains only current slugs, so
  // destination ∈ sitemap and no redirect target is itself redirected.
  const destinations = ['oldest-slug', 'mid-slug']
    .map((s) => resolveFixture(s, redirects, listings))
    .filter((s): s is string => Boolean(s));
  check('resolve: every destination is the current slug (sitemap-safe)', destinations.every((d) => d === 'current-slug'));
  check('resolve: destinations never re-redirect', destinations.every((d) => resolveFixture(d, redirects, listings) === null));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
