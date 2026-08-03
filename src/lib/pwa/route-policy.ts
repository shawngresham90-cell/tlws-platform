/**
 * Route classification for the PWA foundation — the single written policy for
 * what the service worker may and may not touch. public/sw.js mirrors these
 * lists as plain literals (a service worker cannot import TypeScript);
 * scripts/test-pwa-service-worker.ts asserts the two stay in lockstep, so a
 * policy change here that is not carried into the worker fails the suite.
 *
 * Three classes:
 *
 *  - `private-sensitive` — admin surfaces and every API route. The worker
 *    must never intercept these at all: no caching, no offline fallback, no
 *    fetch handling. Auth state, mutations, and personal data live here.
 *
 *  - `dynamic-live` — pages whose value IS their freshness: Trip Planner,
 *    parking availability, HOS calculator, directory listings. They are
 *    served network-only. When the network is gone they get the offline
 *    shell, never a stale copy — a cached parking count or route plan is
 *    worse than no answer, because a driver may act on it.
 *
 *  - `public-static` — marketing, academy, knowledge and store pages. Also
 *    served network-only in this foundation (no page caching at all); the
 *    class exists so a future milestone can safely widen caching for exactly
 *    this set and nothing else.
 *
 * The only things the worker caches are content-hashed build assets
 * (/_next/static/), the font/icon files it precaches, and the offline shell.
 * Every cached URL is same-origin, GET, and carries no user state.
 */

/** URL prefixes the service worker must never intercept (fall through to network). */
export const NEVER_HANDLE_PREFIXES = [
  '/api/',
  '/admin',
  '/go/', // outbound redirect tracker — caching one would freeze a partner link
] as const;

/** Prefixes of routes whose live data must never be served stale. */
export const DYNAMIC_LIVE_PREFIXES = [
  '/trip-planner',
  '/directory',
  '/tools/hos-calculator',
] as const;

/**
 * Asset prefixes the worker may cache. `/_next/static/` names are
 * content-hashed so cache-first is provably safe; fonts and icons are
 * immutable brand assets.
 */
export const CACHEABLE_ASSET_PREFIXES = ['/_next/static/', '/fonts/', '/icons/'] as const;

/** Everything precached at install — the entire offline experience, bounded. */
export const PRECACHE_URLS = [
  '/offline.html',
  '/icons/icon-192.png',
  '/fonts/anton-400.woff2',
  '/fonts/inter-400.woff2',
] as const;

export type RouteClass = 'private-sensitive' | 'dynamic-live' | 'public-static';

/** Classify a same-origin pathname. Unknown paths default to public-static. */
export function classifyRoute(pathname: string): RouteClass {
  if (NEVER_HANDLE_PREFIXES.some((p) => pathname.startsWith(p))) return 'private-sensitive';
  if (DYNAMIC_LIVE_PREFIXES.some((p) => pathname.startsWith(p))) return 'dynamic-live';
  return 'public-static';
}

/** True when the worker is allowed to cache this pathname as a static asset. */
export function isCacheableAsset(pathname: string): boolean {
  return CACHEABLE_ASSET_PREFIXES.some((p) => pathname.startsWith(p));
}
