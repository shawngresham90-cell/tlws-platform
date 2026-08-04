# Trip Planner Core Flow — Architecture Audit

Audit target: commit 881fb07 (origin/main); all `src/` files read from the working tree, verified identical to origin/main per task premise. Next.js ^14.2.35 (`package.json`), React 18.3.1, zod ^3.23.8.

## Architecture (data flow, entry points)

**Entry point (SSR/ISR):** `src/app/(directory)/trip-planner/page.tsx` — server component with `export const revalidate = 300` (page.tsx:13; this is the only Next.js segment config on the page; no layout file exists in `src/app/(directory)/` — verified by find, so the root layout is the only wrapper). It awaits `loadPlannerAnchors()` (page.tsx:21), which internally runs the **full paginated directory scan** (`loadPlannerListings`, directory-loader.ts:285-297 → 214-263), and passes the entire anchor array as a prop into the client component `TripPlannerApp` (page.tsx:32). The whole geocoded published directory (~1,940 rows per the in-code note at directory-loader.ts:25) is therefore serialized into the RSC payload of every page load (re-generated at most every 300s).

**Client journey (TripPlannerApp.tsx):** a 3-step wizard (`step` state, TripPlannerApp.tsx:180):

1. **Step 1 — Where to?** Two `PlaceCombobox` instances (origin/destination). Directory anchors are filtered locally per keystroke (memoized, PlaceCombobox.tsx:61); free-text queries ≥3 chars fire a debounced (300 ms) `GET /api/trip-planner/places?q=` (PlaceCombobox.tsx:85-102). Results merged directory-first, deduped by 3-dp coordinate (place-search.ts:92-108). Recents come from localStorage (`useSavedTrips`).
2. **Step 2 — Clocks.** Pure local state: 4 HOS sliders, fuel slider, truck profile fields, presets. No network.
3. **Submit.** Exactly **one** composite call: `POST /api/trip-planner/quote` (TripPlannerApp.tsx:270-287). Body: origin/destination `{label, position}`, `departAtMs` (client falls back to `Date.now()` on empty/unparseable input, lines 268-269), simple clocks (with client-side clamps: `drivingSinceBreakMin = min(sinceBreak, drivingUsed)`, `cycleUsedMin = max(cycleUsed, drivingUsed)`, `windowElapsedMin = -1` sentinel when 0, lines 277-283), fuel fraction, truck.
4. **Step 3 — Render.** The full plan is rendered from the single `QuoteResponse`: route summary + turn-by-turn, legal-window card, `TpcReserveBand` (partner Last-Stop slots), stops timeline, weather, fuel, warnings, disclaimers (TripPlannerApp.tsx:603-806). No further network calls to render.

**Side channels on mount:** (a) anchors resilience refetch — only if the server-rendered list was empty: `GET /api/trip-planner/anchors` (TripPlannerApp.tsx:154-162); (b) `useCloudSync` checks Supabase auth on mount; signed-out users make zero cloud calls (useCloudSync.ts:224-244); signed-in users run an initial merge (2 parallel GETs + queued flush POSTs, useCloudSync.ts:162-221).

**Server orchestration (`composeQuote`, compose-quote.ts:217-378) — the exact order:**

1. `estimateRoute()` — synchronous straight-line × 1.2 circuity fallback, **always computed** (compose-quote.ts:232-236; route-estimate.ts:37-75).
2. `await` HERE truck routing under a 6,000 ms budget (compose-quote.ts:255-278); success replaces route + routePoints; failure → warning + estimate.
3. `clockStateFromSimple` + `validateClockState` — **after** the routing spend (compose-quote.ts:280-287).
4. `await deps.loadListings()` — the full Supabase directory scan, fail-soft `[]` (compose-quote.ts:291-295).
5. `toStopCandidates(listings, routePoints, 5)` — project every listing onto the route polyline (compose-quote.ts:296).
6. `planTrip()` — synchronous CPU walk of the route timeline (compose-quote.ts:303-312; optimizer.ts:138-270).
7. `Promise.all([weather (8,000 ms budget), fuelPrice (4,000 ms budget)])` — the only parallel pair (compose-quote.ts:316-322). Fuel state = `candidates[0]?.state ?? ''` (line 318) → PADD region or US average.
8. `estimateTripCost`, `remainingClocks`, `selectLastStops` — synchronous (compose-quote.ts:337-356).

**Next.js route segment config observed:** page `revalidate = 300`; `/api/trip-planner/anchors` and `/places` declare `export const dynamic = 'force-dynamic'` (anchors/route.ts:7, places/route.ts:17); cloud routes are `force-dynamic` (grep evidence); **the six POST endpoints (quote, plan, route, stops, cost, hos) declare no segment config at all** — dynamic by default for POST, default Node runtime, no `maxDuration`.

## Module inventory

| File | Role | Imported by (within this flow) |
|---|---|---|
| `src/app/(directory)/trip-planner/page.tsx` | ISR page; loads anchors; mounts client app | Next router |
| `src/components/trip-planner/TripPlannerApp.tsx` | Client wizard, single quote call, full render | page.tsx |
| `src/components/trip-planner/PlaceCombobox.tsx` | Origin/destination combobox; local + HERE search | TripPlannerApp |
| `src/components/trip-planner/TpcReserveBand.tsx` | Partner (TPC) Last-Stop band + analytics | TripPlannerApp |
| `src/components/trip-planner/SavedTripsPanel.tsx`, `AccountPanel.tsx` | Saved trips / auth UI | TripPlannerApp |
| `src/components/trip-planner/useSavedTrips.ts` | localStorage store hook (fail-soft) | TripPlannerApp |
| `src/components/trip-planner/useCloudSync.ts` | OTP auth + offline-first cloud sync queue | TripPlannerApp |
| `src/app/api/trip-planner/quote/route.ts` | Composite endpoint; wires providers into `composeQuote` | client (only production caller of planning APIs) |
| `src/app/api/trip-planner/{plan,route,stops,cost,hos}/route.ts` | Granular Phase-3 endpoints | **No production callers.** Only `scripts/test-trip-planner-api.ts` etc. reference them (grep verified) |
| `src/app/api/trip-planner/anchors/route.ts` | Anchor fallback (force-dynamic, full pool scan per hit) | TripPlannerApp fallback effect |
| `src/app/api/trip-planner/places/route.ts` | HERE geocode proxy (force-dynamic, own limiter) | PlaceCombobox |
| `src/lib/trip-planner/compose-quote.ts` | Orchestrator + request schema + budgets | quote/route.ts |
| `src/lib/trip-planner/api-contracts.ts` | Zod schemas for the 5 granular endpoints + shared `latLngSchema` | the 5 granular routes; compose-quote (latLngSchema only, compose-quote.ts:19) |
| `src/lib/trip-planner/api-util.ts` | Shared limiter (20/min/IP/instance) + body guard | all 6 POST routes |
| `src/lib/trip-planner/route-estimate.ts` | Straight-line×1.2 estimate + 10-mi sampled points | compose-quote |
| `src/lib/trip-planner/here-routing.ts` | HERE v8 adapter: cache, hourly cap, retry, truck limits | quote/route.ts, compose-quote (TRUCK_LIMITS) |
| `src/lib/trip-planner/here-geocode.ts` | HERE geocode adapter: cache, cap | places/route.ts |
| `src/lib/trip-planner/place-search.ts` | Pure merge/filter/badge for suggestions | PlaceCombobox, places route |
| `src/lib/trip-planner/directory-loader.ts` | Supabase keyset-paginated pool loader; anchors | page.tsx, quote route, anchors route |
| `src/lib/trip-planner/directory-layer.ts` | Projection, scoring, ranking, zero-space rule | compose-quote, optimizer, last-stop, stops route |
| `src/lib/trip-planner/optimizer.ts` | `planTrip` timeline walker; `quickEta` | compose-quote, plan route, route route |
| `src/lib/trip-planner/hos-engine.ts` | Pure HOS clock math (49 CFR 395.3) | optimizer, compose-quote, hos/plan/route routes |
| `src/lib/trip-planner/last-stop.ts` | Named reservable/free slot selection (reachability filter) | compose-quote |
| `src/lib/trip-planner/cost-engine.ts` | Pure cost arithmetic, never invents prices | compose-quote, plan route, cost route |
| `src/lib/trip-planner/nws-weather.ts` | NWS adapter (≤4 samples, ≤3 calls each) | quote route |
| `src/lib/trip-planner/eia-fuel.ts` | EIA weekly diesel by PADD | quote route |
| `src/lib/trip-planner/rate-limit.ts` | Token bucket, per-instance | api-util, places route |
| `src/lib/trip-planner/types.ts` | Pure domain types + `buildRoute` + HOS constants | everything above |

## Caches

| Cache | Location | Keying | TTL / eviction | Concerns |
|---|---|---|---|---|
| HERE route cache | Module-level port in quote/route.ts:12-15 → Map in here-routing.ts:257 | 4-dp endpoints + waypoints + truck dims + hazmat + sorted avoids (routeCacheKey, here-routing.ts:224-241) | 6 h TTL, max 500, insertion-order eviction (here-routing.ts:253-254, 321-327) | Per-serverless-instance only (acknowledged, here-routing.ts:24-26). `departAtMs` is **not** in the key, so a cached route ignores departure-time traffic differences — VERIFIED, deliberate trade. |
| HERE hourly cap | Same closure | n/a (counter) | 100 calls/rolling-hour window per instance (here-routing.ts:255, 261-268) | Per-instance: N warm instances = N×100/hr against the 5,000/mo free tier. |
| Geocode cache + cap | Module-level in places/route.ts:29-32 → here-geocode.ts:166-177 | normalized lowercase query | 1 h TTL, max 500; 200 calls/hr/instance | Same per-instance caveat. |
| Rate-limit buckets | Module singleton api-util.ts:13-17 | client IP (`x-nf-client-connection-ip`, else last XFF hop) | token bucket 20/min; bucket-map bounded at 10k/5k (rate-limit.ts:42-51) | One shared bucket across **all six** POST endpoints; per-instance so the global cap is instances×20/min. |
| Page ISR | `revalidate = 300` (page.tsx:13) | route | 300 s | Only the anchors list benefits; empty-pool result would also be cached for up to 300 s — mitigated by the client fallback fetch. |
| localStorage | `useSavedTrips` (STORE_KEY) + per-user sync queue (useCloudSync.ts:44) | device | none (caps in saved-trips-store) | Cleared on sign-out for cross-user isolation (TripPlannerApp.tsx:188-190). |
| **Not cached at all** | `loadPlannerListings` (directory-loader.ts:214-263), EIA price (eia-fuel.ts:116-130), NWS (nws-weather.ts:80-167) | — | — | Every `/quote` POST re-runs the full directory scan, an EIA fetch of **weekly** data, and up to 12 NWS requests. See bottlenecks. |

## Failure modes

| Path | Trigger | Behavior | Severity |
|---|---|---|---|
| Any POST endpoint | >20 req/min/IP/instance | 429 `rate-limited` (api-util.ts:42-44); client shows message as generic error | handled |
| guardedParse | oversized (>512 KB) / bad JSON / schema fail | 413 / 400 / 422 with first 10 zod issues (api-util.ts:47-76) | handled |
| composeQuote | origin≈destination (<1 straight mile, route-estimate.ts:43) | 422 `bad-route`; client guards separately at 3-dp rounding (TripPlannerApp.tsx:247-251). Gap: a legitimate very short trip (e.g. 0.8 mi across town) is rejected server-side even though the client guard passes | degraded (edge) |
| composeQuote | invalid derived clock state | 422 `bad-clocks` — but **after** the HERE routing call already ran (compose-quote.ts:255-287), spending quota/latency on a request that fails | degraded (cost) |
| HERE routing | no key / 4xx / 5xx×2 / timeout / cap / impossible truck | `null` → labeled estimate + warning "live truck routing unavailable" (compose-quote.ts:275-277) | degraded, well-labeled |
| Directory pool | Supabase error, short pool, page cap, no progress | `[]` (fail-soft, directory-loader.ts:248-262) → zero candidates → all stops virtual "Unassigned" + warning (compose-quote.ts:297-300; optimizer.ts:205-209); `lastStop.noReservableOnCorridor=true` → TPC fallback card | degraded — plan still legal-time correct but every stop is driver-self-select; silent to ops except `log.error('planner_pool_load_incomplete')` |
| Server-rendered anchors empty | cold cache / directory failure at ISR time | client retries `GET /anchors` once (TripPlannerApp.tsx:154-162); if that also fails, comboboxes work HERE-only | handled |
| NWS / EIA | failure or budget exceeded | warnings; weather section shows "No weather data", fuel shows "unavailable — no estimate" (compose-quote.ts:324-335; TripPlannerApp.tsx:758-783) | handled |
| Places search | HERE down / capped / rate-limited | `[]` or 429 → combobox still shows directory matches (PlaceCombobox.tsx:74, 87-101) | handled |
| Client submit | network failure | synthetic `{ok:false, code:'network'}` alert (TripPlannerApp.tsx:304-305) | handled |
| `/api/trip-planner/anchors` | **no rate limit** on a force-dynamic GET that runs the full count+keyset scan per hit (anchors/route.ts:7-13) | unauthenticated amplification: 1 cheap GET → ~5 Supabase queries + ~200 KB response | degraded (abuse/cost vector) — VERIFIED absence of limiter |
| Quote with past `departAtMs` | schema only requires positive int (compose-quote.ts:94) | plan computed from a past timestamp; UI renders past ETAs | degraded (minor) |
| planTrip guard | >500 loop iterations | throws → unhandled in quote route → Next 500 (optimizer.ts:244). No try/catch around `planTrip` in composeQuote | broken (theoretical; requires pathological route/options) |
| localStorage blocked | private mode | in-memory store, banner via `storageAvailable` (useSavedTrips.ts:60-65) | handled |
| Cloud sync | Supabase auth unreachable | presented as signed-out; planning unaffected (useCloudSync.ts:240-244) | handled |

## Bottleneck candidates

1. **Full directory reload on every quote — VERIFIED structure, HYPOTHESIS timing.** Each `POST /quote` runs `loadPlannerListings()`: 1 head-count query + ceil(pool/500) **sequential** keyset pages (directory-loader.ts:220-247). At ~1,940 rows that is 5 serial Supabase round trips per plan request, plus row mapping. Nothing memoizes this between requests even on a warm instance, while the same data is also loaded by page ISR and the anchors endpoint. Expected 200–700 ms per quote (needs measurement).
2. **Serial routing → listings chain — VERIFIED.** `await routing` (≤6 s budget) completes before `await loadListings()` starts (compose-quote.ts:256-295). The listings load is independent of routing output (only `toStopCandidates` needs routePoints). Running them in `Promise.all` removes the entire listings latency from the critical path.
3. **Clock validation after the routing spend — VERIFIED.** compose-quote.ts:280-287 vs 255-278. Invalid-clock requests burn a HERE transaction and up to 6 s. Pure-function reorder.
4. **NWS worst case — VERIFIED shape.** ≤4 samples in parallel, but within each sample `points → forecast → alerts` is 3 sequential round trips (nws-weather.ts:111-151); `alerts` does not depend on `points` and could run concurrently. Whole thing bounded at 8 s; on a slow NWS day every quote pays it.
5. **EIA fetched per quote — VERIFIED.** Weekly data (eia-fuel.ts:116-130) with a 4 s budget and no cache; a 1-line per-PADD memo would eliminate ~100% of these calls.
6. **`toStopCandidates` CPU — VERIFIED shape, HYPOTHESIS cost.** O(listings × routePoints) haversines: ~1,940 × ≤400 points (here-routing.ts:43) ≈ 780 k haversine evaluations per quote (directory-layer.ts:57-109). Likely tens of ms on Node — measure before optimizing (spatial pre-filter by bounding box would cut it ~10×).
7. **Anchor prop payload — VERIFIED shape, HYPOTHESIS size.** ~1,940 anchors × {id uuid, label, lat, lng, state} serialized into the page HTML/RSC payload for every visitor (page.tsx:21-32), roughly 150–250 KB uncompressed, held in client state and re-shipped again by the fallback endpoint. Fine for search UX, but it is the page's dominant payload.
8. **Quote response over-delivery — VERIFIED.** The server serializes: `itinerary.segments` (never rendered), `violations`, full `StopCandidate` objects for each stop's `candidate` **and up to 3 `alternates`** (types.ts:95-114 — alternates are full candidates with amenities/fuelBrands/etc., while the client type reads only `{name, parkingSpaces}`, TripPlannerApp.tsx:72), plus full candidates inside `lastStop.slots`. ≤60 instruction strings. Response likely tens of KB per plan (measure).
9. **Per-instance caps under scale — HYPOTHESIS.** All rate limits, HERE caps, and caches are per warm serverless instance (rate-limit.ts:2-8, here-routing.ts:24-26). Effectiveness of the caches and the true global HERE spend depend on Netlify instance churn/concurrency — unmeasurable from code.

## Simplification opportunities

1. **Delete or gate the five unused endpoints** (`/plan`, `/route`, `/stops`, `/cost`, `/hos`). Zero production callers (grep verified — only `scripts/test-*.ts`). They are public, unauthenticated CPU endpoints accepting up to 5,000 candidates / 512 KB bodies (api-contracts.ts:132, api-util.ts:19). Risk: low — the pure libs they exercise stay covered by direct unit scripts; api-contracts.ts itself must stay for `latLngSchema`.
2. **Short-TTL in-memory memo around `loadPlannerListings`** (e.g. 60–300 s, matching the page's `revalidate=300`). Removes the per-quote Supabase scan and fixes the anchors-endpoint amplification. Risk: directory edits are up to TTL stale in plans — already true for anchors via ISR.
3. **Hoist `validateClockState` above the routing call** in composeQuote. Risk: none (pure reorder; error shape unchanged).
4. **`Promise.all([routing, loadListings()])`**. Risk: negligible — a wasted listings load only when routing input later fails validation (which #3 also fixes).
5. **Trim the quote response** to the fields the client type declares (drop `segments`, slim `alternates` to name+spaces, slim embedded candidates). Risk: contract change for any future consumer; the response is undocumented-public, so version or do it now while `/quote` has one caller.
6. **Rate-limit `/api/trip-planner/anchors`** with the existing limiter (one-line reuse of `clientKey` + a bucket). Risk: none.
7. **Cache EIA per PADD region** (module-level Map, TTL hours). Risk: none — data is weekly.
8. **Drop the always-computed `estimateRoute`** when routing succeeds is *not* worth it — it is the synchronous fallback needed before the routing attempt and costs microseconds (route-estimate.ts:37-75). Leave as is.

## External calls

| Provider | Endpoint | Caller | Auth | Rate limiting | Caching |
|---|---|---|---|---|---|
| HERE Routing v8 | `https://router.hereapi.com/v8/routes` (here-routing.ts:36) | quote route (server-only), 5 s fetch timeout (quote/route.ts:13) | `apiKey` query param from `HERE_API_KEY`; never logged/thrown (here-routing.ts:329-331) | 100/hr/instance cap; 1 retry on 5xx only | 6 h TTL Map, 500 entries, per instance |
| HERE Geocoding v1 | `https://geocode.search.hereapi.com/v1/geocode` (here-geocode.ts:30) | places route, 4 s timeout | same key | 200/hr/instance + 30/min/IP endpoint limiter | 1 h TTL by normalized query |
| NWS | `api.weather.gov/points/…`, discovered forecast URL (same-origin enforced, nws-weather.ts:117), `alerts/active?point=…` | quote route, 3.5 s/fetch, 8 s overall budget | none; policy User-Agent header (nws-weather.ts:25-28) | none beyond budget; ≤4 samples × ≤3 calls = ≤12 req/quote | none |
| EIA | `api.eia.gov/v2/petroleum/pri/gnd/data` (eia-fuel.ts:105-113) | quote route, 3.5 s timeout, 4 s budget | `api_key` query param from `EIA_API_KEY` | none | none |
| Supabase (PostgREST) | `locations` count + keyset pages via anon static client (directory-loader.ts:220-247; static.ts:8-14) | page ISR, quote route (per request), anchors route (per request) | anon key, RLS published-only | none | ISR only (page) |
| Supabase Auth + cloud routes | `auth.getUser`/OTP; `/api/trip-planner/cloud/*` (force-dynamic) | client `useCloudSync` | Supabase session | server-side (out of this subsystem's scope) | localStorage queue |

## Open questions

1. **Actual latency split of a `/quote` request** (routing vs listings scan vs NWS vs EIA vs CPU) — all timings above are hypotheses; needs a traced measurement (the `scripts/bench/**` delta on this branch suggests that is underway).
2. **Netlify instance behavior**: warm-instance lifetime and concurrency determine whether the HERE caches/caps are effective or effectively cold per request, and whether the aggregate HERE call rate can exceed the free tier despite the 100/hr/instance cap.
3. **Current pool size and growth**: at 500-row pages, the per-quote scan cost grows linearly; at what pool size does the 60-page runaway guard or quote latency become user-visible?
4. **Next 14 fetch caching semantics** for the provider calls inside POST route handlers: the code passes no `cache`/`next` options (quote/route.ts:13, 30-37); confirm these default to no-store on this Netlify runtime (assumed, not verified from code).
5. **Weather/ETA coherence**: NWS time-alignment uses a fixed 50 mph progress model (nws-weather.ts:23, 109) rather than the computed itinerary (which exists only after `planTrip` — currently run before the weather call, so the data *is* available). Is a plan-aligned forecast worth the coupling?
6. **Same-point threshold mismatch**: client 3-dp rounding vs server <1 straight-mile rejection — is sub-mile trip planning a real use case for drivers (e.g. terminal-to-drop within a city)?