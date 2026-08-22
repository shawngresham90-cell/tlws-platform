import 'server-only';
import { createUncachedAdminClient } from '@/lib/supabase/admin';
import type { FeaturedSchema } from '@/lib/directory/featured-window';

/**
 * Does the admin client see `locations.featured_until` yet?
 *
 * The public read path has its own probe in `directory/data.ts` on the
 * cookieless anon client. This is the same question asked through the
 * service-role client, and it is asked separately on purpose: the two clients
 * hit different PostgREST schema caches, and an admin that trusted the public
 * probe could offer an activation the write would then reject.
 *
 * The failure direction is the opposite of the public one, and deliberately so.
 * A public read that cannot tell falls back to showing what it showed
 * yesterday, because taking the Directory down is worse than a placement
 * lingering. An ADMIN that cannot tell must refuse to activate: writing
 * `is_featured = true` without a term is precisely the defect REVENUE-2
 * exists to remove, and refusing costs nothing but a retry.
 */

const FEATURED_COLUMN = 'featured_until';

/** Narrow: the column is missing, not "some query failed". */
function isMissingFeaturedColumn(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message : '';
  if (code !== '42703' && code !== 'PGRST204') return false;
  return message.includes(FEATURED_COLUMN);
}

let memo: Promise<FeaturedSchema> | null = null;

/** Test seam. */
export function __resetAdminFeaturedSchemaMemo(): void {
  memo = null;
}

async function probe(): Promise<FeaturedSchema> {
  try {
    // UNCACHED: a cached answer to a schema-shape question outlives the schema
    // it described. See createUncachedAdminClient.
    const supabase = createUncachedAdminClient();
    const { error } = await supabase.from('locations').select(FEATURED_COLUMN).limit(1);
    if (!error) return 'ready';
    if (isMissingFeaturedColumn(error)) return 'unavailable';
  } catch {
    /* fall through */
  }
  // Indeterminate. An admin that cannot prove the column exists does not get
  // to write a placement, so `unavailable` is the safe answer here — and it is
  // not memoized, so the next attempt asks again.
  return 'unavailable';
}

export async function adminFeaturedSchema(): Promise<FeaturedSchema> {
  if (memo) return memo;
  const attempt = probe();
  memo = attempt.then((v) => {
    // Only a definite `ready` is worth remembering. `unavailable` may be a
    // transient answer, and pinning it for the life of the process would keep
    // activation blocked after the migration had actually been applied.
    if (v !== 'ready') memo = null;
    return v;
  });
  return memo;
}
