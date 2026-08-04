All assigned files read end-to-end, plus their callers (`compose-quote.ts`, both API routes, `here-routing.ts`, `route-estimate.ts`, `providers.ts`, `types.ts`, `rate-limit.ts`, `api-contracts.ts`) and the sibling `src/lib/hos/*` engine. Report follows.

# Audit: Overlays + Stop Optimization + Cost/HOS Engines

## Architecture

The subsystem is a **pure-core / injected-edges** design. Every engine (optimizer, cost, HOS, last-stop, directory-layer) is a pure deterministic function of caller-supplied data; all I/O lives behind "port" interfaces (`src/lib/trip-planner/providers.ts:50,86,106`) with null implementations, and the only orchestrator is `composeQuote` (`src/lib/trip-planner/compose-quote.ts:217`), called from `POST /api/trip-planner/quote` (`src/app/api/trip-planner/quote/route.ts:23`).

Data flow per quote request:

1. **Route**: HERE truck routing (`here-routing.ts:247`) or fallback straight-line×1.2 estimate (`route-estimate.ts:37`). Output includes `routePoints` — polyline samples with cumulative route-miles: HERE routes sample every `max(2 mi, totalMiles/400)`, capped at ~400 points (`here-routing.ts:42-43,199`); the estimate samples every 10 miles (`route-estimate.ts:22,57`).
2. **Directory attach**: `loadPlannerListings()` scans the full published+geocoded pool from Supabase (`directory-loader.ts:214`), then `toStopCandidates(listings, routePoints, 5)` projects every listing onto the route (`compose-quote.ts:296`, `directory-layer.ts:77`). Projection is brute-force nearest-sampled-point: for each listing, haversine to **every** route point (`directory-layer.ts:57-70`). **N×M = (full directory pool, ~1,940 rows per the comment at `directory-loader.ts:25`) × (≤400 route points) ≈ up to ~776k haversine evaluations per quote.** Listings >5 mi off-route are dropped; survivors get `routeMile`/`offRouteMiles`.
3. **Itinerary**: `planTrip` (`optimizer.ts:138`) walks the route, generating need events and placing stops.
4. **Overlays (parallel, budgeted)**: NWS weather along route + EIA fuel price race hard budgets of 8s/4s (`compose-quote.ts:316-322`).
5. **Cost**: `estimateTripCost` (`cost-engine.ts:29`).
6. **Last Stop slots**: `selectLastStops` layered over — never replacing — the organic itinerary (`compose-quote.ts:351`, `last-stop.ts:148`).

A second endpoint, `POST /api/trip-planner/plan` (`src/app/api/trip-planner/plan/route.ts:10`), accepts a complete pre-built request (client supplies candidates, ≤5000 per `api-contracts.ts:132`) and runs only `planTrip` + `estimateTripCost` — no I/O at all.

**Weather sampling**: `sampleForWeather` subsamples routePoints to **max 4 evenly-spaced points** (`nws-weather.ts:69-73`). Per sample: `/points/{lat,lng}` → forecast URL → forecast, plus `/alerts/active?point=` — up to 3 requests each, so **≤12 NWS requests per route**, samples concurrent (`nws-weather.ts:100`) but the 3 calls within a sample are sequential (`nws-weather.ts:111,118,137`). Forecasts are time-aligned to the ETA at each sample assuming 50 mph overall progress (`nws-weather.ts:23,109`); only the first forecast period ending after the ETA becomes a band (`nws-weather.ts:120-134`), so ≤4 bands + deduped alerts per quote. Each sample's band spans ± half the inter-sample distance (`nws-weather.ts:96`).

**Fuel prices**: one EIA v2 request per quote — weekly on-highway diesel by PADD sub-region, mapped from the origin state (`eia-fuel.ts:105-113,18-75`); state comes from the first corridor candidate (`compose-quote.ts:318`), unknown state → US-average series (`eia-fuel.ts:76,122`). **No cache** (see Caches).

**Optimizer**: `planTrip` is an event-driven greedy simulation. At each step `nextNeed` computes the earliest of three deadlines — fuel (safety-factored tank range, `optimizer.ts:81-87`), 30-min break (`optimizer.ts:89-103`), overnight (11-hr or 14-hr exhaustion, `optimizer.ts:105-111`) — then `selectStop` ranks candidates in a look-back window `[deadline − 60 mi, deadline]` (`optimizer.ts:117-135`, default window `types.ts:257`) and drives to the winner, or takes a **virtual stop at the deadline with a warning** when the corridor is thin (`optimizer.ts:205-209`). Complexity: O(stops × (legs + C log C)) where C = corridor candidates; iteration hard-capped at 500 with a throw on exhaustion (`optimizer.ts:150,244`). Greedy, single-pass — it does not globally optimize; "optimizer" is really a feasibility scheduler.

**Cost engine**: pure arithmetic, "no invented numbers" — fuel gallons from miles/mpg, fuel/toll components stay `null` when inputs unknown and the total is omitted with explanatory notes (`cost-engine.ts:41-68`). Parking = overnight-stop count × per-night rate; fixed daily and driver-pay per-mile components always computed (`cost-engine.ts:59-61`).

**Last Stop engine**: reachability is a hard filter (`reachWithinClocks`, `last-stop.ts:72-104`) — fails **closed** on non-finite clocks (`last-stop.ts:81-89`), models the 30-min break burning the 14-hr window (`last-stop.ts:94-97`), requires ≥30-min buffer on both clocks. Four named slots (last/best/backup-reservable, last-free) with dedupe (`last-stop.ts:182-222`). The zero-space safety rule (`hasConfirmedTruckParking`, `directory-layer.ts:121-123`) is enforced three times independently: `rankCandidates` (`directory-layer.ts:225`), `recommendParking` (`directory-layer.ts:260`), and `selectLastStops` (`last-stop.ts:163-165`).

## Module inventory

| Module | Lines | Role | Pure? |
|---|---|---|---|
| `src/lib/trip-planner/nws-weather.ts` | 168 | NWS adapter behind WeatherPort; sampling, severity classification | I/O via injected fetch |
| `src/lib/trip-planner/eia-fuel.ts` | 141 | EIA diesel adapter; state→PADD map; parse/validate | I/O via injected fetch |
| `src/lib/trip-planner/directory-layer.ts` | 276 | Listing→candidate projection, scoring, ranking, safety rules | Pure |
| `src/lib/trip-planner/directory-loader.ts` | 297 | Supabase keyset-paginated pool loader (count + pages), fail-soft [] | I/O (anon client) |
| `src/lib/trip-planner/last-stop.ts` | 230 | Named Last Stop slots; conservative reachability filter | Pure |
| `src/lib/trip-planner/cost-engine.ts` | 111 | Null-propagating cost arithmetic | Pure |
| `src/lib/trip-planner/optimizer.ts` | 290 | Greedy need-event itinerary planner + `quickEta` | Pure |
| `src/lib/trip-planner/hos-engine.ts` | 360 | ClockState simulation (§395.3), `advance`/`planDrive`/`remainingClocks` | Pure |
| `src/lib/trip-planner/hos-exceptions.ts` | 238 | Capability manifest + 3 exception stubs + recap projection | Pure — **not imported by any src/ code** (only `scripts/test-hos-hardening.ts` and docs; verified by grep) |
| `src/lib/hos/*` (types, time, clocks, split-sleeper, timeline) | 949 | HOS Calculator UI engine (§395.3 + §395.1(g) split sleeper) | Pure; consumed only by `src/components/tools/HosCalculator.tsx:6-9` |

**Trip-planner HOS vs `src/lib/hos` — duplicate logic, quantified.** Constants are genuinely single-sourced: `src/lib/hos/types.ts:1,21` re-exports `HOS` from `trip-planner/types` ("Owner Decision 8: one engine, no second arithmetic"). But the *arithmetic* is parallel-implemented, not shared:
- **Limiting-clock min-of-four selection: 4 copies** — `hos-engine.ts:188-194` (`remainingClocks`), `clocks.ts:36-42` (`currentClocks`), `split-sleeper.ts:106-115` (`limitingOf`), `timeline.ts:229-238` (identical `limitingOf`, duplicated verbatim within the same package).
- **Cycle cap lookup: 3 copies** — `hos-engine.ts:31-32`, `split-sleeper.ts:42-43`, inline `timeline.ts:175`.
- **11/14/break/cycle violation detection: 3 independent implementations** — `hos-engine.ts:110-157` (stateful advance), `timeline.ts:199-214` (interval arithmetic `clocksFrom`), `split-sleeper.ts:185-245` (quick-split closed form).
- **Break-clock recomputation**: `hos-engine.ts:166-173` vs `timeline.ts:179-190`.
- **Split-sleeper**: fully implemented twice in `src/lib/hos` (`evaluatePair` `split-sleeper.ts:49`, timeline pairing search `timeline.ts:134-165,282-311`) while the trip planner deliberately declines it (`hos-exceptions.ts:117-134`, conservative assumption at `hos-exceptions.ts:65-70`). So the platform simultaneously ships a working §395.1(g) engine (calculator) and a stub (planner) — a divergence risk, not copy-paste: the two engines consume different shapes (ClockState snapshot vs. timeline events), roughly 250–300 lines of parallel clock arithmetic total.

## Caches

| Cache | Location | Policy | Scope |
|---|---|---|---|
| HERE route cache | `here-routing.ts:257` | TTL 6h, max 500 entries, insertion-order eviction (`here-routing.ts:321-327`); key = rounded endpoints + truck attrs + sorted avoidances (`here-routing.ts:224-241`) | Per warm serverless instance (module-level singleton, `quote/route.ts:12-15`) |
| HERE hourly call cap | `here-routing.ts:258-268` | 100 live calls/hr, then null (fallback to estimate) | Per instance |
| Rate limiter buckets | `rate-limit.ts:21-53` | Token bucket per IP, 10k-entry flood eviction | Per instance |
| **NWS** | — | **No cache.** Up to 12 requests per quote, every quote | — |
| **EIA** | — | **No cache**, despite the data being *weekly* (`eia-fuel.ts:8-9`); 1 request per quote | — |
| **Directory pool** | — | **No cache.** Every quote runs 1 COUNT + ~4 page queries (500 rows/page, `directory-loader.ts:77,220-247`); `loadPlannerAnchors` (`directory-loader.ts:285`) re-runs the full scan independently | — |

## Failure modes

| Failure | Behavior | Severity |
|---|---|---|
| Directory unreachable / scan incomplete (`page_error`, `no_progress`, `page_cap`, `short_pool`) | `[]` after structured log; planner emits virtual stops + warnings (`directory-loader.ts:248-262`, `compose-quote.ts:297-301`, `optimizer.ts:205-209`) | **Degraded** (deliberately: complete-or-nothing, `directory-loader.ts:141-205`) |
| Silent pool truncation at 2,000 rows | Fixed by keyset pagination + count floor check (`directory-loader.ts:19-43`) | **Handled** |
| NWS any per-point failure / non-200 / off-domain forecast URL | Point skipped; SSRF guard restricts forecast URL to `api.weather.gov` (`nws-weather.ts:81-89,117`) | **Handled** |
| NWS slow: 3 sequential calls × 3.5s timeout = 10.5s worst case per sample vs 8s weather budget (`quote/route.ts:31`, `compose-quote.ts:316`) | Entire weather result discarded, warning added — even if 3 of 4 samples finished | **Degraded** (all-or-nothing loss of partial data) |
| EIA no key / non-200 / bad row / price outside (0, $20] | `null` → cost fuel component null, total omitted (`eia-fuel.ts:91-130`, `cost-engine.ts:41-46,64-68`) | **Handled** |
| HERE outage / cap / impossible truck / malformed polyline | `null` → labeled straight-line estimate, warning (`here-routing.ts:286-332`, `compose-quote.ts:275-277`) | **Degraded** |
| Corrupt clocks in last-stop | Fail-closed: NaN → not reachable (`last-stop.ts:80-89`) | **Handled** |
| `planTrip` guard exhausted (500 iterations) or `planDrive` guard (1000) | **Throws** (`optimizer.ts:244`, `hos-engine.ts:309`); neither `composeQuote` nor either API route wraps `planTrip` in try/catch (`compose-quote.ts:303`, `plan/route.ts:16`) → unhandled 500 | **Broken** (by design "fail loudly", but surfaces as a bare 500) |
| `fuelGallons` with mpg ≤ 0, negative segment minutes | Throws (`cost-engine.ts:14`, `hos-engine.ts:78-80`) — but zod bounds make these unreachable via API (`compose-quote.ts:97`, `api-contracts.ts:32`) | **Handled** at boundary |
| Same origin/destination | Caught → 422 `bad-route` (`compose-quote.ts:232-237`, `route-estimate.ts:43`) | **Handled** |

## Bottleneck candidates

1. **VERIFIED (structure): N×M candidate projection.** `toStopCandidates` computes haversine from every listing to every route point with no prefilter (`directory-layer.ts:63-66`); N = whole published pool (~1,940 and growing, `directory-loader.ts:25`), M ≤ 400 (`here-routing.ts:43`) → ~776k trig-heavy distance calls per quote. **HYPOTHESIS (magnitude): likely 30–100 ms CPU per quote** — needs measurement (the working tree's `scripts/bench/**` delta suggests benchmarking is underway).
2. **VERIFIED: 5 Supabase round trips per quote** for the directory pool (count + 4 pages at 1,940 rows) with zero reuse across requests (`directory-loader.ts:220-247`). Sequential pages — latency stacks. **HYPOTHESIS: this is the dominant wall-clock cost of a warm quote after route caching.**
3. **VERIFIED: EIA fetched per quote for weekly data** (`eia-fuel.ts:116-130`, no cache) — pure waste and an external SPOF for the fuel component.
4. **VERIFIED: NWS ≤12 requests/quote, no cache, within-sample sequential** (`nws-weather.ts:111-151`); alerts fetch is independent of the points/forecast chain but awaits it.
5. **VERIFIED (bounded): optimizer and last-stop are cheap** — O(stops × C log C) and O(C log C) over corridor-filtered candidates; guards cap iterations. Not a bottleneck.
6. **HYPOTHESIS: memory** — full pool (~1,940 rows × ~18 columns) materialized per request; trivial today, worth watching if the pool grows 10×.

## Simplification opportunities

- **Module-level TTL cache for `loadPlannerListings`** (mirroring the `hereRouting` singleton pattern at `quote/route.ts:12`) — removes 5 DB queries/quote; pool changes at human-review cadence.
- **Cache EIA per PADD region with ~1h TTL** — data is weekly; one line of the same pattern.
- **Bounding-box prefilter before haversine** in `projectOntoRoute` — compare |Δlat|/|Δlng| against the 5-mile threshold first; cuts the N×M trig by orders of magnitude for corridor-shaped routes.
- **Parallelize alerts with the points→forecast chain** inside each NWS sample (`nws-weather.ts:137` is independent of line 111), and/or make weather partial-tolerant rather than all-or-nothing under the budget.
- **Delete or wire `hos-exceptions.ts`** — 238 lines with no production consumer; `recapProjection` (`hos-exceptions.ts:214`, marked IMPLEMENTED) is unused product surface.
- **Extract one shared `limitingClock` helper** — 4 copies today, including a verbatim duplicate inside `src/lib/hos` itself (`split-sleeper.ts:106` vs `timeline.ts:229`).
- **Consolidation direction, not code deletion**: the calculator's timeline engine (`timeline.ts:245`) already implements the split-sleeper semantics the planner's stub declines; when the planner adopts §395.1(g), reuse it rather than writing a third implementation.
- **Score-after-filter** in `selectLastStops` (`last-stop.ts:169-176` scores every candidate, including unreachable ones, before filtering) — micro, but free.

## External calls

| Service | Endpoint | Per quote | Timeout | Auth | Cache |
|---|---|---|---|---|---|
| NWS | `api.weather.gov/points/…`, forecast URL, `/alerts/active?point=…` (`nws-weather.ts:21,112,138`) | ≤12 (4 samples × ≤3) | 3.5s each (`quote/route.ts:31`) | None (User-Agent policy, `nws-weather.ts:25-28`) | None |
| EIA | `api.eia.gov/v2/petroleum/pri/gnd/data` (`eia-fuel.ts:107`) | 1 | 3.5s (`quote/route.ts:35`) | `EIA_API_KEY` in URL query, server-only | None |
| HERE | `router.hereapi.com/v8/routes` (`here-routing.ts:36`) | ≤1 (+1 retry on 5xx only, `here-routing.ts:270-282`) | 5s (`quote/route.ts:13`) | `HERE_API_KEY` in URL; never logged/thrown | 6h TTL + 100/hr cap |
| Supabase | `locations` table via anon static client (`directory-loader.ts:216-247`) | 5 queries (1 count + ~4 pages) | platform default | anon key, RLS published-only | None |

All external failures collapse to null/[] — no provider can fail a quote (verified across all four adapters).

## Open questions

1. **Actual current pool size** — the 1,940 figure is a 2026-07-30 comment (`directory-loader.ts:25`); the N in N×M and page count need a live COUNT to confirm.
2. **Real latency/CPU split of a quote** — projection math vs. Supabase paging vs. NWS budget; the `scripts/bench/**` branch delta suggests this measurement is planned. Nothing here should be optimized before that measurement.
3. **Weather bands are display-only** — `StopKind` includes `'weather'` (`types.ts:56`) but `planTrip` never consumes weather; is a weather-aware planner intended (bands could shift overnight placement)?
4. **`fuelPrice(originState)` uses the first corridor candidate's state** (`compose-quote.ts:318`) — an off-route listing's state, or `''` (US average) on empty corridors. Intended precision, or should the origin's geocoded state be used?
5. **Split-sleeper divergence**: is the plan to lift `src/lib/hos/timeline.ts` semantics into the planner (ledger R6 authorization exists per `split-sleeper.ts:33-34`), or keep the planner permanently conservative? The two-engines-one-constant arrangement is safe today but each new rule now costs two implementations.
6. **Unhandled `planTrip`/`planDrive` throws** produce bare 500s (`plan/route.ts:16`, `compose-quote.ts:303`) — acceptable for "impossible by construction" errors, or should the routes wrap them into structured 500 JSON?