import { createStaticClient } from '@/lib/supabase/static';
import { isValidDetailSlug } from './detail-slug';

/**
 * Slug redirect resolution + planning (Milestone 21). The redirect table
 * (migration 023) may not exist yet — every read fails SOFT to "no redirect",
 * which is exactly the pre-023 behavior (unknown slugs 404). Resolution goes
 * old_slug → location_id → the listing's CURRENT detail_slug, so a chain of
 * regenerations always collapses to one hop and redirects never go stale.
 * Unpublished/deleted destinations resolve to null (the route 404s).
 */

export type RedirectTarget = {
  /** The CURRENT canonical slug to permanently redirect to. */
  currentSlug: string;
};

/**
 * Resolve an old slug to the current canonical slug of a PUBLISHED listing.
 * Null when: table missing (023 unapplied), no redirect row, destination
 * unpublished/deleted, or the "current" slug equals the requested one
 * (self-loop guard — never redirect a slug to itself).
 */
export async function resolveSlugRedirect(oldSlug: string): Promise<RedirectTarget | null> {
  if (!isValidDetailSlug(oldSlug)) return null;
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('directory_slug_redirects')
      .select('location_id, locations!inner (detail_slug, is_published, deleted_at)')
      .eq('old_slug', oldSlug)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const listing = (
      data as unknown as {
        locations: { detail_slug: string | null; is_published: boolean; deleted_at: string | null };
      }
    ).locations;
    if (!listing || !listing.is_published || listing.deleted_at || !listing.detail_slug) return null;
    if (listing.detail_slug === oldSlug) return null; // self-loop guard
    return { currentSlug: listing.detail_slug };
  } catch {
    return null;
  }
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
  if (!isValidDetailSlug(currentSlug)) return { ok: false, reason: `current slug "${currentSlug}" is not valid` };
  if (!isValidDetailSlug(nextSlug)) return { ok: false, reason: `next slug "${nextSlug}" is not valid` };
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
