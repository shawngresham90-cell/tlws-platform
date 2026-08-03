/**
 * TLWS service worker — the conservative foundation, not an offline app.
 *
 * Policy (mirrored from src/lib/pwa/route-policy.ts, which documents the
 * reasoning; scripts/test-pwa-service-worker.ts asserts the mirror is exact):
 *
 *  - Never intercepts /api/, /admin or /go/ — no caching, no fallback,
 *    nothing. Auth, mutations, personal data and redirect tracking pass
 *    straight through to the network exactly as if no worker existed.
 *  - Page navigations are NETWORK-ONLY. No HTML is ever cached, so no page
 *    can ever be stale — a driver can never see yesterday's parking counts,
 *    route plans, weather or HOS math. If the network is unreachable, the
 *    response is the precached offline shell, which says plainly that live
 *    data is unavailable.
 *  - The only cached responses are same-origin GET requests for
 *    content-hashed build assets (/_next/static/ — the hash in the filename
 *    makes cache-first provably safe), local fonts and PWA icons. The asset
 *    cache is bounded and trimmed oldest-first.
 *  - Update lifecycle is the safe default: a new worker installs, then WAITS
 *    until every open tab from the old version is gone. No skipWaiting on
 *    install, no clients.claim — a running page is never hijacked mid-session
 *    by a worker it didn't start with. The SKIP_WAITING message hook exists
 *    for a future explicit "update now" UI and is only honoured when a page
 *    asks for it.
 *
 * Bump VERSION whenever precache contents or caching policy change; activate
 * deletes every tlws-* cache from older versions.
 */

const VERSION = 'v1';
const PRECACHE = `tlws-precache-${VERSION}`;
const ASSETS = `tlws-assets-${VERSION}`;
const KNOWN_CACHES = [PRECACHE, ASSETS];

/** Keep in lockstep with PRECACHE_URLS in src/lib/pwa/route-policy.ts. */
const PRECACHE_URLS = [
  '/offline.html',
  '/icons/icon-192.png',
  '/fonts/anton-400.woff2',
  '/fonts/inter-400.woff2',
];

/** Keep in lockstep with NEVER_HANDLE_PREFIXES in route-policy.ts. */
const NEVER_HANDLE_PREFIXES = ['/api/', '/admin', '/go/'];

/** Keep in lockstep with CACHEABLE_ASSET_PREFIXES in route-policy.ts. */
const CACHEABLE_ASSET_PREFIXES = ['/_next/static/', '/fonts/', '/icons/'];

/** Bound on the runtime asset cache — trimmed oldest-first past this. */
const ASSET_CACHE_MAX = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tlws-') && !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});

/** Explicit opt-in hook for a future "update now" control. Never automatic. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_HANDLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Navigations: network-only, offline shell as the only fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Static assets: cache-first, because the URL names the exact content.
  if (CACHEABLE_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(assetCacheFirst(request));
    return;
  }

  // Everything else (images, RSC payloads, data requests) — untouched.
});

async function assetCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Only store clean, complete, same-origin successes — never errors,
  // redirects, opaque responses or partial content.
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(ASSETS);
    await cache.put(request, response.clone());
    trimCache(cache, ASSET_CACHE_MAX);
  }
  return response;
}

/** Delete oldest entries (insertion order) beyond `max`. Fire-and-forget. */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) {
    await cache.delete(key);
  }
}
