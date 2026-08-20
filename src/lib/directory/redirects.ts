import { createStaticClient } from '@/lib/supabase/static';
import { failureCode, type DirectoryReadResult } from './data';
import { isValidDetailSlug } from './detail-slug';

/**
 * Slug redirect resolution + planning (Milestone 21). Resolution goes
 * old_slug → location_id → the listing's CURRENT detail_slug, so a chain of
 * regenerations always collapses to one hop and redirects never go stale.
 * Unpublished/deleted destinations resolve to null (the route 404s).
 *
 * The redirect table (migration 023) may not exist yet, and that ONE case
 * still resolves to "no redirect" — the documented pre-023 behaviour. Every
 * other read failure is now reported as a failure rather than silently
 * becoming "no redirect": this lookup sits on the detail route's 404 branch,
 * and a lookup that could not run is not evidence that a slug is unknown.
 */

export type RedirectTarget = {
  /** The CURRENT canonical slug to permanently redirect to. */
  currentSlug: string;
};

/**
 * A missing relation is the ONLY error this resolver is allowed to treat as
 * "no redirect". Migration 023 provisions `directory_slug_redirects`; before
 * it is applied the table genuinely does not exist, and the documented
 * pre-023 behaviour is that unknown slugs 404. PostgREST reports that as
 * SQLSTATE `42P01` (undefined_table) or its own `PGRST205` (relation absent
 * from the schema cache). Every OTHER error — a statement timeout, a dropped
 * connection, a permission change — is a read that failed over a table that
 * exists, and must never be reported as "there is no redirect for this slug".
 */
function isMissingRelation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '42P01' || code === 'PGRST205';
}

/**
 * Resolve an old slug to the current canonical slug of a PUBLISHED listing.
 *
 * Three outcomes, not two — this read is consulted on the detail route's 404
 * branch, so collapsing a failed lookup into "no redirect" manufactures a 404
 * out of an outage exactly the way the entry read used to (see
 * `getEntryByDetailSlugResult`). A SUCCESSFUL null means: no redirect row,
 * destination unpublished/deleted, or the "current" slug equals the requested
 * one (self-loop guard — never redirect a slug to itself). The pre-023
 * table-missing case stays a successful null, because there the answer really
 * is "this database has no redirects".
 */
export async function resolveSlugRedirectResult(
  oldSlug: string,
): Promise<DirectoryReadResult<RedirectTarget | null>> {
  // Pure shape check — an invalid slug can hold no redirect regardless of
  // database health, so this answer never depends on a read.
  if (!isValidDetailSlug(oldSlug)) return { ok: true, data: null };
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('directory_slug_redirects')
      .select('location_id, locations!inner (detail_slug, is_published, deleted_at)')
      .eq('old_slug', oldSlug)
      .limit(1)
      .maybeSingle();
    if (error && !isMissingRelation(error)) {
      return { ok: false, reason: 'query_error', code: failureCode(error) };
    }
    if (error || !data) return { ok: true, data: null };
    const listing = (
      data as unknown as {
        locations: { detail_slug: string | null; is_published: boolean; deleted_at: string | null };
      }
    ).locations;
    if (!listing || !listing.is_published || listing.deleted_at || !listing.detail_slug)
      return { ok: true, data: null };
    if (listing.detail_slug === oldSlug) return { ok: true, data: null }; // self-loop guard
    return { ok: true, data: { currentSlug: listing.detail_slug } };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/**
 * Fail-soft variant: `null` for "no redirect" AND for a failed lookup. Kept
 * for callers that do not decide a response status from the answer.
 */
export async function resolveSlugRedirect(oldSlug: string): Promise<RedirectTarget | null> {
  const result = await resolveSlugRedirectResult(oldSlug);
  return result.ok ? result.data : null;
}

/* ------------------------------------------------ regeneration planning */

export type RedirectPlanInput = {
  /** The slug the listing has right now (becomes the redirect's old_slug). */
  currentSlug: string;
  /** The slug regeneration will assign. */
  nextSlug: string;
  /** old_slugs of redirect rows that already exist (any listing). */
  existingOldSlugs: Set<string>;
};

export type RedirectPlan =
  | {
      ok: true;
      /** Row to insert BEFORE the slug changes. */
      insert: { oldSlug: string; newSlug: string };
      /** old_slug rows to DELETE because they equal the slug being assigned
       *  (a listing reclaiming a previous slug must not redirect away from it). */
      deleteOldSlugs: string[];
    }
  | { ok: false; reason: string };

/**
 * Plan the redirect writes for one regeneration. Pure — the action performs
 * the plan inside its history-first sequence, and tests exercise every
 * guard: no self-redirect, no redirect to an identical slug, reclaim rows
 * removed so no loops or >1-hop chains can be created.
 */
export function planSlugRedirect(input: RedirectPlanInput): RedirectPlan {
  const { currentSlug, nextSlug, existingOldSlugs } = input;
  if (!isValidDetailSlug(currentSlug))
    return { ok: false, reason: `current slug "${currentSlug}" is not valid` };
  if (!isValidDetailSlug(nextSlug))
    return { ok: false, reason: `next slug "${nextSlug}" is not valid` };
  if (currentSlug === nextSlug) {
    return { ok: false, reason: 'slug is unchanged — nothing to redirect' };
  }
  // If the listing is reclaiming a slug that some redirect row currently
  // retires (typically its own older slug), that row must be deleted in the
  // same operation — otherwise the reclaimed URL would redirect away from
  // the very listing that now owns it (a loop after one more regeneration).
  const deleteOldSlugs = existingOldSlugs.has(nextSlug) ? [nextSlug] : [];
  // The new redirect's old_slug must be free after the deletes above.
  if (existingOldSlugs.has(currentSlug) && currentSlug !== nextSlug) {
    // A row already retires currentSlug (e.g. A→B→A→B ping-pong). Inserting a
    // duplicate old_slug would violate uniqueness; the caller should UPSERT
    // (replace the stale row) — signalled here so the action knows.
    return {
      ok: true,
      insert: { oldSlug: currentSlug, newSlug: nextSlug },
      deleteOldSlugs: [...deleteOldSlugs, currentSlug],
    };
  }
  return { ok: true, insert: { oldSlug: currentSlug, newSlug: nextSlug }, deleteOldSlugs };
}
