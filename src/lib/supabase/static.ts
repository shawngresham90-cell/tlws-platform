import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cookieless anon client for build-time / static-generation reads
 * (generateStaticParams, sitemap). No request scope, no cookies — safe to call
 * outside a request. Only ever reads public/published rows (RLS enforces this).
 */
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * The same cookieless anon client, with fetch caching switched OFF.
 *
 * WHY THIS EXISTS (found by the REVENUE-2 browser bench, not by review)
 *
 * Next patches global `fetch` and caches GETs in the Data Cache, and that cache
 * lives in `.next/cache`, which build platforms restore between deploys. So a
 * response can outlive the state it described.
 *
 * For a normal directory read that is a feature — the rows are the same rows.
 * For a question about the SHAPE OF THE SCHEMA it is a trap, and the failure is
 * not subtle. The featured-term probe asks "does `locations.featured_until`
 * exist right now". A cached `200 [{"featured_until":null}]` written before the
 * column was dropped (or, as it happened here, written against a permissive
 * fixture) answers "yes" forever. Every subsequent read then names a column the
 * database does not have, and PostgREST fails the WHOLE query with 42703 —
 * taking down every category, corridor, exit and detail page at once. That is
 * the precise outage the compatibility bridge exists to prevent, walked back in
 * through the cache.
 *
 * Observed, not theorised: a build reused a cached 200 for the probe URL and
 * produced 4,099 prerender failures on pages that had nothing to do with
 * featured placements.
 *
 * Use this ONLY for schema-shape questions. Ordinary reads should keep the
 * cached client — this one costs a round trip every time it is asked.
 */
export function createUncachedStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    },
  );
}
