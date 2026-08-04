import { cache } from 'react';
import {
  getDirectoryFacetsResult,
  getEntriesByExitResult,
  getEntriesByStateResult,
  getEntriesByInterstateResult,
} from './data';

/**
 * Request-scoped dedupe for the directory's hottest reads.
 *
 * A single page render can ask the same question several times —
 * generateMetadata and the page body both resolve the same exit, and the exit
 * page's own body needs the facets a third time. Each ask used to be its own
 * PostgREST round trip: the exit page ran the full-table facet scan 3× and
 * the exit-entries read 2× per regeneration.
 *
 * React's `cache()` collapses those into one read per REQUEST — the same
 * pattern the location detail page already uses for its slug lookup
 * (location/[slug]/page.tsx). It is deliberately request-scoped, not a TTL
 * cache: ISR (`revalidate = 300`) plus the admin's `revalidatePath()` purges
 * stay the sole cross-request freshness mechanism, so a newly published
 * location appears on exactly the same schedule as before.
 *
 * These wrappers are for page/metadata callers. Non-render code (scripts,
 * API routes) should keep importing ./data directly — `cache()` outside a
 * React render is a no-op passthrough at best.
 */
export const cachedDirectoryFacetsResult = cache(getDirectoryFacetsResult);
export const cachedEntriesByExitResult = cache(getEntriesByExitResult);
export const cachedEntriesByStateResult = cache(getEntriesByStateResult);
export const cachedEntriesByInterstateResult = cache(getEntriesByInterstateResult);
