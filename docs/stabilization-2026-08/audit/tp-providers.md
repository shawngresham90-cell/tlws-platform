All assigned files read end-to-end, plus the wiring call sites (quote route, compose-quote, PlaceCombobox, TripPlannerApp) to answer the caching/duplicate-call questions. Report follows.

---

# PROVIDER PORTS + HERE INTEGRATION — Architecture Audit

Audit target: commit 881fb07. All `src/` paths verified identical to origin/main per task premise.

## Architecture

The provider layer is a classic ports-and-adapters seam:

- **Ports (interfaces)** are declared in `src/lib/trip-planner/providers.ts`: `RoutingPort` (providers.ts:50-54), `WeatherPort` (providers.ts:86-96), `FuelPricePort` (providers.ts:106-113), plus a re-exported `GeocodingPort` aliasing the directory Census geocoder adapter (providers.ts:21). A separate, *different* `GeocodePort` for HERE free-text search is declared in `here-geocode.ts:130-134` and is NOT part of the registry.
- **Null adapters** (`nullRoutingPort` providers.ts:57-60, `nullWeatherPort` providers.ts:99-102, `nullFuelPricePort` providers.ts:116-119) and an `offlineProviders` registry (providers.ts:123-134) let the planner run fully offline. Every port method returns null/empty on "cannot answer" (providers.ts:17-18) — the engine degrades, never fails.
- **Live HERE adapters**: `createHereRoutingPort` (here-routing.ts:247-335) implements `RoutingPort` against HERE Routing API v8 (`https://router.hereapi.com/v8/routes`, here-routing.ts:36); `createHereGeocodePort` (here-geocode.ts:155-223) implements `GeocodePort` against HERE Geocoding & Search v7 (`https://geocode.search.hereapi.com/v1/geocode`, here-geocode.ts:30). Both factories accept an injected `fetchFn` and return a working port even with no API key (it just answers null/[], here-routing.ts:287, here-geocode.ts:195) so wiring never branches.
- **Wiring** happens only in API route modules, at module level so caches/counters survive warm serverless instances: quote/route.ts:12-15 (routing), places/route.ts:29-32 (geocode). `composeQuote` receives the routing port via `QuoteDeps` (compose-quote.ts:149-159) and calls it once per quote with `waypoints: []` (compose-quote.ts:255-266), racing it against a 6000 ms budget (`withTimeout`, compose-quote.ts:161-180, 265).
- **Key handling**: `process.env.HERE_API_KEY` is read only in the two server route modules (quote/route.ts:15, places/route.ts:32). The key is embedded as a URL query param (`apiKey`, here-routing.ts:109; here-geocode.ts:82). Adapters wrap all work in try/catch and collapse every failure to null/[] so no URL (which carries the key) is thrown, logged, or returned (here-routing.ts:329-332, here-geocode.ts:217-220). Client components only hit `/api/trip-planner/*` (PlaceCombobox.tsx:86, TripPlannerApp.tsx:270). VERIFIED: no client-side HERE key path exists in these files.
- **Truck profile on the wire**: `buildHereRouteUrl` (here-routing.ts:91-111) sets `transportMode=truck`, `truck[height]`/`truck[width]`/`truck[length]` in cm (ft × 30.48, rounded), `truck[grossWeight]` in kg (lb × 0.45359237), `truck[axleCount]`, and `truck[shippedHazardousGoods]` mapped from US hazmat placard class 1–9 → HERE enum with unknown→`other` (conservative, here-routing.ts:51-76). `avoid[features]` is whitelist-filtered to `tollRoad|ferry|tunnel|dirtRoad|uTurns` (here-routing.ts:82-88). `departureTime` is ISO from `departAtMs` (here-routing.ts:98). `return=polyline,summary,actions` (here-routing.ts:97). Profiles outside `TRUCK_LIMITS` (here-routing.ts:338-344) are rejected before any network call (here-routing.ts:290).

## Module inventory

| Module | Role | Key exports |
|---|---|---|
| providers.ts (134 lines) | Port interfaces + null adapters + registry | `RoutingPort`:50, `WeatherPort`:86, `FuelPricePort`:106, `offlineProviders`:130 |
| here-routing.ts (344) | Live HERE v8 truck routing adapter | `buildHereRouteUrl`:91, `parseHereResponse`:155, `toRoutePoints`:186, `routeCacheKey`:224, `createHereRoutingPort`:247, `TRUCK_LIMITS`:338, `hazmatToHereGoods`:51 |
| here-geocode.ts (223) | Live HERE v7 free-text geocode adapter | `buildGeocodeUrl`:75, `parseGeocodeResponse`:106, `createHereGeocodePort`:155, `MIN_QUERY_LENGTH`:149 |
| place-search.ts (127) | Pure merge/rank of directory anchors + HERE matches | `filterDirectoryAnchors`:43, `hereMatchesToPlaces`:69, `mergePlaceResults`:92 |
| flexible-polyline.ts (79) | Pure HERE flexible-polyline decoder (decode only) | `decodeFlexiblePolyline`:50 |
| rate-limit.ts (54) | In-memory per-key token bucket | `RateLimiter`:21 |
| api-util.ts (78) | Shared API plumbing: rate limit → size cap → JSON → zod | `guardedParse`:38, `clientKey`:21, module-level `limiter`:13-17 |
| places/route.ts (50) | GET geocode proxy, own 30/min limiter | places/route.ts:21-25, 36-50 |
| anchors/route.ts (13) | GET directory anchors fallback, force-dynamic, **no limiter** | anchors/route.ts:7-13 |

## Caches

1. **Routing cache** (here-routing.ts:257, 292-294, 321-327): in-memory `Map`, TTL 6 h (here-routing.ts:253), max 500 entries, FIFO-ish eviction by insertion order. Key = endpoints rounded to 4 decimals (~11 m), waypoints, quantized truck dims, hazmat class, sorted avoidances (here-routing.ts:224-241). **VERIFIED: the cache key deliberately omits `departAtMs`**, while the request URL includes `departureTime` (here-routing.ts:98) — so a route quoted at 8am is served for a 5pm departure for up to 6 h; time-dependent traffic routing is effectively coarsened away. Stale entries are only skipped, never deleted (here-routing.ts:294) — expired entries occupy slots until eviction pressure.
2. **Geocode cache** (here-geocode.ts:166, 199-200, 209-215): same pattern, TTL 1 h (here-geocode.ts:161), max 500, keyed on normalized query (here-geocode.ts:70-72). Empty result sets are cached too (here-geocode.ts:209) — good negative caching.
3. **Both caches are per-instance** on serverless, documented as a known limitation (here-routing.ts:24-26, rate-limit.ts:4-7).
4. **NOT cached**: `/api/trip-planner/anchors` is `force-dynamic` (anchors/route.ts:7) and calls `loadPlannerAnchors()` → `loadPlannerListings()` → Supabase on every request (anchors/route.ts:10-12, directory-loader.ts:285-287); no memoization anywhere in that chain. `/api/trip-planner/places` responses carry no HTTP cache headers (places/route.ts:49) and are `force-dynamic` (places/route.ts:17), so browser/CDN never caches identical typeahead queries across users.

**Can identical HERE requests be issued twice for one user action?** For one action on one warm instance: no — one quote POST triggers at most one `routing.route()` call (compose-quote.ts:255-266), and repeat submits hit the cache (departAtMs excluded from the key, so the client's `Date.now()` default, TripPlannerApp.tsx:268-269, doesn't defeat it). But VERIFIED duplication paths exist: (a) **no in-flight coalescing** — two concurrent identical requests both miss the cache because `cache.set` happens only after the awaited fetch (here-routing.ts:298 vs 321; same in here-geocode.ts:204 vs 209), so a double-submit or two users quoting the same lane simultaneously spend two transactions; (b) **per-instance caches** — each cold/parallel serverless instance re-issues the same HERE call; (c) **budget-race waste** — the quote fetch timeout is 5000 ms (quote/route.ts:13) with one retry inside `getJson` (here-routing.ts:271-282), so a first-attempt timeout starts a second HERE call at ~5 s while `composeQuote`'s 6000 ms budget (compose-quote.ts:265) expires at 6 s: the user gets the estimate fallback, yet the retry still spends a transaction and populates the cache in the background.

## Failure modes

| Mode | Severity | Evidence |
|---|---|---|
| No HERE key configured | handled — port answers null/[], planner uses labeled estimate | here-routing.ts:287, here-geocode.ts:195, compose-quote.ts:275-277 |
| HERE 4xx (bad request/auth) | handled — no retry, null, fallback estimate | here-routing.ts:275-276 |
| HERE 5xx / network / timeout | handled — one retry then null | here-routing.ts:271-282, here-geocode.ts:179-190 |
| Malformed HERE JSON / polyline | handled — `parseHereResponse` returns null on any anomaly incl. decode throw | here-routing.ts:155-183, 168-175 |
| Impossible truck profile | handled — rejected pre-network | here-routing.ts:290, 118-138 |
| Hourly cap exhausted | degraded (silent) — null/[] with only a generic "estimates" warning; no distinct signal to ops that quota, not HERE, is the cause | here-routing.ts:296, here-geocode.ts:202, compose-quote.ts:276 |
| Stale time-dependent route served (cache key omits departAtMs) | degraded — ETA can reflect wrong departure traffic for up to 6 h | here-routing.ts:224-241 vs 98 |
| Retry-after-timeout doubles transaction spend; hourly counter counts `route()` calls, not fetches → cap of 100 can spend up to 200 transactions/h | degraded (cost accounting) | here-routing.ts:297 (`callsInWindow += 1` once) vs 271 (two attempts) |
| `/anchors` has no rate limiter and no cache → unauthenticated Supabase query amplification | degraded/broken under abuse | anchors/route.ts:7-13 (contrast places/route.ts:21-25, api-util.ts:13-17) |
| Rate limiter shared across ALL guardedParse endpoints (quote/plan/route/stops/hos/cost/cloud share one 20/min bucket per IP) | degraded — legitimate mixed usage of several endpoints contends for one budget | api-util.ts:13-17; grep shows 8 routes importing guardedParse |
| Rate limit per-instance on serverless (cap not global) | degraded, documented | rate-limit.ts:3-7 |
| Spoofable client key when Netlify header absent (last XFF hop mitigates but 'unknown' bucket lumps all headerless clients together) | handled-ish | api-util.ts:21-28 |
| places limiter consumes a token before query validation (garbage q < 3 chars still spends tokens) | trivial/handled | places/route.ts:37-43 |
| HERE key in URL query string | handled in-code (never logged/returned) but the key transits any upstream TLS-terminating infra logs HERE-side | here-routing.ts:109, here-geocode.ts:82, comments here-routing.ts:13-15 |

## Bottleneck candidates

- **VERIFIED — anchors endpoint**: every fallback fetch (TripPlannerApp.tsx:156) runs a full Supabase paginated scan (`loadPlannerListings`, directory-loader.ts:214+) with zero caching and zero rate limiting (anchors/route.ts:7-13). Cheapest amplification target in the subsystem.
- **VERIFIED — per-instance caching**: on scaled-out serverless, HERE cache hit rate falls proportionally to instance count; the 5,000 free truck transactions/month budget (here-routing.ts:20-21) is protected only by per-instance 100/h caps that multiply by instance count.
- **HYPOTHESIS — polyline decode cost**: `decodeFlexiblePolyline` is O(chars) with a per-char Map lookup and materializes the full varint array before positions (flexible-polyline.ts:24-43, 64-78); `parseHereResponse` then re-boxes every position into `{lat,lng}` objects (here-routing.ts:170-172) and `toRoutePoints` computes a haversine per adjacent pair (here-routing.ts:190-193). For a coast-to-coast route (~10⁵ geometry points) this is three O(n) passes with heavy allocation — likely single-digit-to-tens of ms per uncached quote; needs measurement, and is amortized by the 6 h cache.
- **HYPOTHESIS — typeahead volume**: 300 ms debounce (PlaceCombobox.tsx:30, 102) still lets a slow typist emit ~1 geocode call per word fragment; each distinct ≥3-char prefix is a separate cache key (here-geocode.ts:196-200). Whether the 200/h per-instance geocode cap (here-geocode.ts:163) is hit in practice needs traffic data.
- **VERIFIED (mild) — eviction scans**: cache eviction iterates keys from oldest on every insert past 500 (here-routing.ts:322-327); rate limiter eviction scans up to 10k buckets inside a request path (rate-limit.ts:42-51). Both O(n) worst case, bounded, unlikely to matter.

## Simplification opportunities

1. **Duplicated adapter scaffolding**: the TTL cache, hourly-cap window, `getJson` retry loop, and eviction loop are copy-pasted between here-routing.ts:252-282/321-327 and here-geocode.ts:160-190/209-215, near-verbatim. A shared `cachedCappedFetch(key, ttl, cap, fn)` helper would halve both adapters and give one place to add in-flight coalescing.
2. **Two "geocoding port" notions**: providers.ts:21 re-exports the Census `ExternalGeocoderAdapter` as `GeocodingPort`, while the actual live geocoder is `GeocodePort` in here-geocode.ts:130 — neither is in `ProviderRegistry` (providers.ts:123-127). The registry itself (`offlineProviders`) has no non-test consumer found via grep; the routes wire ports directly (quote/route.ts:39-44). Registry + stale re-export could be pruned or unified.
3. **Stale doc header**: providers.ts:4-8 still says "no live adapter exists yet" (Phase 3 comment) — false since Phase 5; same file also documents WeatherPort as null default (providers.ts:98) while nws-weather.ts is live in quote/route.ts:41. Also directory-loader.ts:282 says "Until HERE geocoding arrives" — it has arrived.
4. **`eia-fuel.ts` exports `createEiaFuelPort` (eia-fuel.ts:133) but quote/route.ts:42 passes a bespoke lambda instead** — one of the two shapes is redundant.
5. **Dead `RoutingResult.tollCents`**: always `null` (here-routing.ts:316) despite `return=polyline,summary,actions` never requesting tolls (here-routing.ts:97); either request `tolls` or drop the field.
6. **Expired cache entries**: neither adapter deletes an expired entry on read (here-routing.ts:294), so a 500-slot cache can be full of dead entries evicting live ones; one `cache.delete(key)` on stale hit fixes it.

## External calls

| Provider | Endpoint | Caller | Auth | Rate limit | Caching | Timeout/Retry |
|---|---|---|---|---|---|---|
| HERE Routing v8 | `router.hereapi.com/v8/routes` (here-routing.ts:36) | POST /api/trip-planner/quote → composeQuote → hereRouting (quote/route.ts:12-15, 43; compose-quote.ts:256) | `apiKey` URL param from `HERE_API_KEY` env, server-only (here-routing.ts:109; quote/route.ts:15) | Adapter cap 100 calls/h/instance (here-routing.ts:255, 261-268); endpoint behind shared 20/min/IP limiter (api-util.ts:13-17) | In-memory TTL 6 h, 500 entries, per instance (here-routing.ts:253-257) | fetch abort 5000 ms (quote/route.ts:13); 1 retry on 5xx/network only (here-routing.ts:271-282); overall 6000 ms budget (compose-quote.ts:265) |
| HERE Geocoding v7 | `geocode.search.hereapi.com/v1/geocode` (here-geocode.ts:30) | GET /api/trip-planner/places (places/route.ts:29-32, 48) | Same key, URL param (here-geocode.ts:82) | Adapter cap 200/h/instance (here-geocode.ts:163); route-level 30/min/IP/instance (places/route.ts:21-25) | In-memory TTL 1 h, 500 entries, per instance (here-geocode.ts:161-166) | fetch abort 4000 ms (places/route.ts:31); 1 retry on 5xx/network (here-geocode.ts:179-190) |
| NWS (adjacent) | `api.weather.gov` points/forecast/alerts (nws-weather.ts:21, 112, 138) | quote route via composeQuote (quote/route.ts:30-33, 41) | None; identifying User-Agent (nws-weather.ts:24-26) | Shared 20/min/IP endpoint limiter only | Not audited here | abort 3500 ms (quote/route.ts:31); 8000 ms budget (compose-quote.ts:155) |
| EIA (adjacent) | series URL w/ `api_key` param (eia-fuel.ts:105-108) | quote route (quote/route.ts:34-37, 42) | `EIA_API_KEY` env, server-only (quote/route.ts:42) | Shared endpoint limiter only | Not audited here | abort 3500 ms (quote/route.ts:35); 4000 ms budget (compose-quote.ts:155) |
| Supabase (adjacent) | listings scan (directory-loader.ts:214-219) | GET /api/trip-planner/anchors (anchors/route.ts:10-12) | Static client | **None** | **None** (force-dynamic, anchors/route.ts:7) | None visible in route |

## Open questions

1. **Is omitting `departAtMs` from `routeCacheKey` intentional product policy** (trade traffic accuracy for quota) or an oversight? here-routing.ts:224-241 has no comment addressing it, though avoidances got an explicit comment (here-routing.ts:237-239).
2. **What is real instance fan-out on Netlify?** Every per-instance protection (both caches, both hourly caps, both rate limiters) scales its effective limit by instance count — needs deployment telemetry to know whether the 5,000/mo HERE free tier is actually safe.
3. **Does HERE bill the retry-after-timeout transaction?** If yes, worst-case spend is 2× the `hourlyCap` accounting (here-routing.ts:271-282 vs 297). Measurement/HERE console check needed.
4. **Is `/api/trip-planner/anchors` exposed to abuse in practice** (Supabase quota, latency)? It is the only unthrottled, uncached endpoint in the subsystem (anchors/route.ts:7-13).
5. **`via` waypoints are plumbed** (here-routing.ts:96) **but composeQuote always sends `waypoints: []`** (compose-quote.ts:260) — is multi-stop live routing planned, or is the param dead weight?
6. **Whether HERE geocode `queryScore` should influence merge order** — `mergePlaceResults` ranks directory-then-HERE in provider order only (place-search.ts:92-108); `score` (here-geocode.ts:117-124) is parsed but never used for ranking.