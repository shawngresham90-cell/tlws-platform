# TLWS PWA Foundation

**The TLWS PWA Foundation does not provide offline truck navigation.** No
route, weather, fuel, parking or Hours of Service data is ever stored for
offline use. Offline, every page is replaced by a shell that says exactly
that. This is the foundation's load-bearing safety property, and the test
suite enforces it.

## What this milestone delivers

- **Installable.** A web app manifest (`src/app/manifest.ts`, served at
  `/manifest.webmanifest`) plus an icon set scaled from the existing approved
  favicon mark (`src/app/icon.tsx` — "TL." with the thumbnail-yellow period;
  regenerate with `node scripts/generate-pwa-icons.mjs`). Android/desktop
  Chromium offers "Install app"; iOS Add to Home Screen produces a real
  standalone app. Theme and splash use the asphalt token `#141414`.
- **Install surface.** `src/components/pwa/InstallCard.tsx` on `/apps`, the
  first UI wired to the previously-inert detection module
  `src/lib/pwa/install-prompt.ts` (reused, not duplicated). It fails closed:
  in-app webviews, alternative iOS browsers and unsupported desktops see
  nothing.
- **A conservative service worker** (`public/sw.js`), hand-written — see
  "Why not Workbox" below.
- **A branded offline shell** (`public/offline.html`), self-contained (inline
  CSS, precached local fonts, no external requests).
- **Update lifecycle** and **network status** in
  `src/components/pwa/PwaLifecycle.tsx` + `src/lib/pwa/lifecycle.ts`: a new
  worker installs and *waits* (no `skipWaiting` at install, no
  `clients.claim`), a `tlws:sw-update-ready` window event and analytics event
  fire when an update is parked, and a site-wide banner appears the moment
  connectivity drops, warning that live road data is unavailable.

## Caching policy (the whole point)

Single source of truth: `src/lib/pwa/route-policy.ts`. The worker mirrors its
lists as literals (a SW can't import TS); `scripts/test-pwa-foundation.ts`
fails the suite if the two drift.

| Class | Examples | Worker behaviour |
| --- | --- | --- |
| private-sensitive | `/api/*`, `/admin*`, `/go/*` | **Never intercepted.** No caching, no fallback — as if no worker existed. |
| dynamic-live | `/trip-planner`, `/directory*`, `/tools/hos-calculator` | Network-only. Offline → shell. Never served stale. |
| public-static | marketing, academy, knowledge, store | Also network-only in this foundation; the class exists so a future milestone can widen caching for exactly this set. |

What *is* cached: content-hashed build assets (`/_next/static/` — the hash
makes cache-first provably safe), local fonts and PWA icons, and the four
precached offline-shell files. The runtime cache is bounded (80 entries,
trimmed oldest-first) and only stores clean same-origin `200` responses. **No
page HTML is ever cached**, which is why nothing stale can ever be shown —
including on the Trip Planner.

## Why a hand-written worker (architecture decision)

- The policy is "cache almost nothing" — Workbox's routing/expiration
  machinery would be more code than the worker itself, and `next-pwa` is
  unmaintained against current App Router. A ~120-line worker is fully
  auditable, which matters more here than generated tooling.
- Netlify serves `public/` at the origin root, so `/sw.js` gets root scope
  with no header tricks. `netlify.toml` pins `max-age=0, must-revalidate` on
  `/sw.js` and `/offline.html` so updates roll out on the next visit, and
  registration uses `updateViaCache: 'none'`.
- Registration is production-only (`src/lib/pwa/lifecycle.ts`) so a dev
  session can never be poisoned by a stale worker.

## Rollback

The worker is designed so that reverting it is a normal deploy, not an
incident. Three levels, cheapest first:

1. **Revert the commit.** `public/sw.js` and `public/offline.html` are served
   with `max-age=0, must-revalidate` (netlify.toml), so the next visit
   revalidates and picks up the reverted worker. Because no page HTML is ever
   cached, a client running the old worker still sees live pages in the
   meantime — a stale worker cannot serve stale content.
2. **Change what a released worker caches.** Bump `VERSION` in
   `public/sw.js`. `activate` deletes every `tlws-*` cache that is not in
   `KNOWN_CACHES`, so the previous version's caches are dropped wholesale on
   the next activation.
3. **Disable the PWA entirely.** Ship a `public/sw.js` whose body is
   `self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.map((n) => caches.delete(n)))).then(() => self.registration.unregister())));`
   That self-uninstalls on every installed client and clears its caches.
   Deleting the file is *not* equivalent: a 404 leaves already-installed
   workers running indefinitely.

Removing the manifest or the icons is safe at any time — it only stops new
installs; it does not affect already-installed clients or cached data.

## Boundaries honoured

No Navigator work, no turn-by-turn, no push notifications, no background
location, no Capacitor, no user accounts. Homepage untouched (conflict-free
with PR #234). Trip Planner, Directory eligibility, HOS math, Road Report,
Store, Founder Wall, Academy and Supply the Classroom logic untouched.

## Tests

`scripts/test-pwa-foundation.ts` (manifest fields + real PNG dimensions,
policy↔worker parity, worker safety greps against comment-stripped code,
route classification, offline-shell self-containment and claim discipline,
lifecycle decisions, layout/netlify wiring) and the pre-existing
`scripts/test-pwa-install-prompt.ts` (69 detection cases). Both run in
`npm test`.
