# Trip Planner & Directory Stabilization — Engineering Report

**Date:** 2026-08-03 · **Branch:** `claude/stabilize-trip-planner-directory` · **Baseline:** `main` @ `65d9764`
**Mandate:** audit and optimize the existing routing and directory systems before Navigator work begins. No Navigator, no PWA, no redesign, no DB writes, no migrations, no deploy, no merge.

---

## 1. Executive summary

- **Ten subsystem audits** (in `audit/`, every claim cited file:line, every bottleneck labeled VERIFIED or HYPOTHESIS) mapped the Trip Planner, Directory, providers, caches, and failure modes end to end.
- **PR #216 is correct and should merge.** It fixes an *active* data-loss defect — the unordered `.limit(1000)` read drops 882 of 1,882 truck-stops rows and ~1,439 detail URLs from the sitemap — and, measured against a production-shaped mock database, makes the build **2.4–2.7× faster** (353–397 s → 129–164 s), the opposite of the slowdown its own comments feared. Verified conflict-free against current main at the file level, all 93 harnesses pass on the assembled post-merge tree, `tsc` clean. It also merges cleanly with *this* branch (§10).
- **This branch lands seven verified optimizations** (quote-path ordering/caching, HERE adapter coalescing, exit-page read dedupe, JSON-LD review-scan gate, near-me payload slimming) and **one security hardening** (directory write routes no longer skip Turnstile when a bot omits the token).
- **Measured effect of this branch alone: build 389–397 s → 253 s (−35%)** at identical request counts — the win is eliminated repeated JSON-parse/re-aggregate CPU, not network. Per-quote effects are structural and pinned by tests: 5 fewer Supabase round trips (pool cache), 1 fewer EIA fetch, clock validation before any provider spend, directory scan concurrent with routing.
- Tests grew from 92 to 93 harnesses; every behavior change carries new assertions (+~30 checks). Nothing was weakened; three assertions were updated to pin the semantic invariant their old literal form stood for.

## 2. Method

All measurement is offline and reproducible. `scripts/bench/mock-postgrest.mjs` serves a deterministic, production-shaped `locations` dataset (2,454 published / 1,882 truck-stops / 1,940 geocoded — the counts recorded in PR #216) behind a PostgREST-compatible server with per-request logging (query shape, bytes, service time) and injectable latency. `build-bench.mjs` runs `next build` against it; `runtime-bench.mjs` serves the built tree with `next start` and measures per-page-class TTFB and DB round trips. CI's placeholder Supabase URL means every build-time read fails soft in CI — which is exactly why build-time read behavior was never visible before this harness.

Build cost was measured on four trees: `before` (main), `after` (main + #216), `stab` (this branch), `combo` (this branch + #216). The runtime sweep (`runtime-bench.mjs`) was stopped on owner instruction before completing — the harness is committed and ready to run; no runtime numbers are reported rather than partial ones.

## 3. Current architecture (Phase 1)

Full detail in `audit/` — `tp-core`, `tp-providers`, `tp-overlays-engines`, `tp-cloud`, `dir-data`, `dir-pages`, `dir-support`, `map-rendering`, `api-shared`, `hos-presets`. The load-bearing facts:

**Trip Planner** is a ports-and-adapters design with a pure core. One ISR page (`revalidate = 300`) serializes the full anchor pool (~1,940 rows) into the client; the wizard fires exactly one composite `POST /quote`, which orchestrates: straight-line estimate → HERE truck routing (6 s budget, 6 h cache keyed *without* `departAtMs`, 100 calls/h/instance cap) → directory pool scan → candidate projection (listings × ≤400 route points haversines) → greedy HOS-feasible itinerary → weather (≤12 NWS calls, 8 s budget) ∥ fuel price (EIA weekly) → cost → Last-Stop slots. Every provider failure degrades to a labeled estimate; no provider can fail a quote. Five granular POST endpoints (`/plan`, `/route`, `/stops`, `/cost`, `/hos`) have **zero production callers**.

**Directory** reads flow through one module (`data.ts`) using broad slices (whole category/state/corridor, 33 columns) filtered and ranked in Node, rendered by ISR pages (`revalidate = 300` everywhere; `new-locations` is unknowingly dynamic — it reads `searchParams`). The only pre-existing caches are ISR itself and one `React.cache()` on the detail-page slug lookup. The exit page is the only route with the empty-vs-error contract; every other read fails soft to `[]`, so a DB outage renders as plausible empty pages for up to 300 s.

**Map** loads Leaflet lazily three layers deep (never blocks paint), clusters via single-pass grid binning (not per-frame), but rebuilds all ≤500 markers on every selection change, caps pins alphabetically with no user-visible signal, and `/directory/map` + `/directory/cat-scales/near-me` serialize 2,000–5,000 full entries into flight payloads.

**Cloud sync** is a sound three-layer offline-first design (strict ownership: session-derived `user_id`, RLS on all verbs, anon revoked). Known gaps: no per-user row cap in the DB, unlimited GETs, a low-probability queue-clearing race in concurrent `flush()`.

**HOS** exists as two parallel engines sharing one constants object: the planner's `hos-engine.ts` and the calculator's `src/lib/hos` (with a complete but **unshipped** timeline/split-sleeper mode — 395 lines with no UI). Roughly 250–300 lines of clock arithmetic are implemented 3–4× across the platform.

## 4. PR #216 audit (Phase 2)

**Problem it solves — real and active.** Several directory reads used `.limit(N)` with no `ORDER BY` and treated the result as complete. A LIMIT without an ORDER BY lets Postgres return *any* subset. At current row counts the 1,000 cap is binding: `getEntries('truck-stops')` silently drops ~882 of 1,882 rows; the sitemap read misses ~1,439 indexable detail URLs. The 2,000/5,000 caps are latent versions of the same defect.

**Correctness — verified.** The keyset scan (id-ordered, 500/page, 60-page runaway guard) terminates only on a *verified empty page* or a *short page corroborated by the database's own exact count* taken on the first page query (count/page filter parity is structural — one query carries both). A server-side row cap can satisfy neither condition, so silent truncation cannot recur. The build-phase memo is gated on `NEXT_PHASE`, inert at runtime, caches the promise, evicts failures. Its own 205-assertion harness passes; the full suite (its 83 + the 10 newer harnesses on main) passes on the assembled post-merge tree with `tsc` clean; the changed-file sets vs. main are disjoint (merge-tree: clean).

**Test changes — honest.** The env-read ban got *stronger* (blanket `process.env` ban → named single permitted read, pinned to literal comparison); literal cap assertions were replaced by the semantic invariants they stood for (deterministic keyset order + preserved presentation order).

**Regressions — none found, one measured surprise in its favor.** The feared build-time regression (its comments record 130–150 s → 306 s pre-memo) is actually a large *improvement* in the memoized form:

| Tree | Wall (25 ms RTT) | Wall (0 ms RTT) | DB requests | Max payload |
|---|---|---|---|---|
| main (`before`) | 388.7–396.9 s | 353.3 s | 4,334–4,436 | 1,563 KB |
| main + #216 (`after`) | 158.1–163.5 s | 129.0 s | 4,336–4,340 | 404 KB |

Request counts are *equal* — Next's fetch cache already deduplicated identical GETs network-side. The 2.4–2.7× wall-time gap survives at zero latency, and mock service time is equal (1.1 ms avg both sides): the entire difference is **in-build CPU**. On main, each of ~2,466 detail-page renders re-parses and re-maps the same state/corridor pool JSON; #216's memo caches the *parsed, mapped, sorted result* per filter key. Runtime figures are in §5.

**Is a better solution available?** No rewrite is warranted. The serial keyset scan is the correct-first choice (offset pagination can skip/duplicate rows under concurrent writes; parallel range fetches sacrifice the completeness proof). This branch's request-scoped `cache()` work is complementary, not competing: #216 fixes *what* is read (complete, proven) and the build cost; this branch fixes *how often* the render layer asks (once per request) and the runtime hot paths #216 doesn't touch. **Recommendation: merge #216**, then resolve the one-file conflict with this branch (§10).

**What #216 deliberately leaves (verified list, for follow-up):** `getCorridorEntriesForCategories .limit(1000)`, `getCatScaleMapEntries .limit(3000)`, `getNewestListings` `.range()` without a unique tiebreaker, `getRecentlyUpdated` no tiebreaker, `getReviewAggregates .limit(10000)` unordered, `getApprovedReviewsForSeo .limit(2000)`, and the sitemap's knowledge-center reads with no explicit limit at all.

## 5. Benchmarks

### Build (full `next build` against the mock, 25 ms simulated RTT)

| Tree | Wall | DB requests | Δ wall vs main |
|---|---|---|---|
| `before` (main) | 388.7–396.9 s | 4,334–4,436 | — |
| `after` (main + #216) | 158.1–163.5 s | 4,336–4,340 | **−59%** |
| `stab` (this branch) | 253.4 s | 4,307 | **−35%** |
| `combo` (this branch + #216) | 164.0 s | 4,368 | **−58%** |

The two improvements attack the same waste (repeated deserialize/aggregate work per page render) through different scopes — #216's memo spans a build worker, this branch's `React.cache()` spans one request. At *build* time the memo subsumes most of the request-scoped win, which is why `combo` lands at #216's level rather than below it; this branch's distinct value is everything a build can't show — the per-quote round-trip cuts, the runtime exit-page dedupe, the payload slimming, and the Turnstile hardening.

### Runtime (`next start` against the mock; TTFB + DB round trips per page class)

**Not completed due to timeout.** The sweep was stopped on owner instruction before producing numbers; `scripts/bench/runtime-bench.mjs` is committed and reproduces it in ~5 minutes per tree (cold state pages, background-regen exit pages, the one dynamic route). No partial or estimated figures are reported.

### Per-quote structural effects (pinned by harness assertions, not wall-clock)

| Change | Before | After |
|---|---|---|
| Supabase round trips per quote (pool) | 5 (count + 4 pages), sequential, every quote | 0 on warm instance within 300 s TTL; shared in-flight scan |
| EIA fetch per quote | 1 (weekly data, refetched live per quote) | 0 within 1 h TTL per PADD region |
| Invalid-clock request cost | 1 HERE transaction + full pool scan | 0 — validation precedes all provider spend |
| Routing ∥ listings | sequential (listings after ≤6 s routing) | concurrent |
| NWS worst case per sample | 3 sequential timeouts = 10.5 s > 8 s budget (total weather loss) | 2 = 7 s, inside budget |
| Duplicate HERE spend (double-submit / concurrent same-lane) | 2 transactions | 1 (in-flight coalescing, both adapters) |
| Candidate projection | ~780k haversine calls per quote | degree-window prefilter; equivalence proven at radius boundary and ±180° |
| Exit-page regeneration | 8 queries (facets ×3, exit entries ×2) | facets ×1, exit entries ×1 |
| List-page JSON-LD review scans (up to 10k + 2k rows) | every regeneration, discarded unread (no row is indexable) | skipped until an indexable entry exists; output byte-identical |
| Near-me flight payload | ~2,000 × 33-column entries as a geocoding pool | same rows × 6 fields |

## 6. Verified bottleneck ledger (remaining, ranked)

1. **VERIFIED** — `/directory/map` and near-me serialize 2,000–3,000 full entries into RSC payloads (near-me's *search pool* fixed here; the map's card list and `scales` pool remain). Fix sketch: pin-projection type for the map; virtualize the card list.
2. **VERIFIED** — LeafletMap rebuilds all ≤500 markers on every `selectedId` change; 500-pin cap is alphabetical and unsignaled. Fix: restyle-two-markers selection effect; cluster-first capping; shared divIcon factory.
3. **VERIFIED** — five unused public POST endpoints (`/plan` `/route` `/stops` `/cost` `/hos`) accept ≤5,000 candidates / 512 KB bodies, unauthenticated. Delete or gate.
4. **VERIFIED** — detail pages fetch whole state + corridor pools (≤1,000 full rows each) for ≤4 nearby cards; `nearby_locations` RPC already exists. HOS timeline engine (395 lines) has no UI — ship or move out of `src/lib`.
5. **VERIFIED** — HERE route cache key omits `departAtMs` while the request sends `departureTime` (up to 6 h of traffic-blind reuse); retry-after-timeout can spend a second transaction the budget has already abandoned; hourly counter counts calls, not fetches (cap 100 can spend 200). Product decision needed on the key; the accounting is a small fix.
6. **VERIFIED** — cloud rows have no per-user DB cap (client caps + per-instance rate limit only); cloud GETs unlimited; `deleteAllCloud` truncation-prone past 100 rows; concurrent `flush()` race can drop a queued op. All small, all in `audit/tp-cloud.md`.
7. **VERIFIED** — remaining unordered/capped reads listed in §4. Latent until row counts grow; same class as the #216 defect.
8. **HYPOTHESIS** — middleware runs `updateSession()` (client construction + `getUser()`) on every API/page request incl. anonymous ones; excluding non-auth paths is likely free but interacts with cloud-route cookie refresh — measure before touching.
9. **HYPOTHESIS** — `tpc.ts` may ship zod + CSV parsing into two client bundles for five string constants (needs bundle analysis; split into a constants leaf regardless).

## 7. Optimization decisions (what this branch changes)

Commits, in order, each green on the full suite:

1. `bench:` mock PostgREST + build benchmark harness (`scripts/bench/`).
2. `bench:` per-request bytes + service-time logging.
3. **Trip Planner quote path** — clock validation before provider spend; listings scan concurrent with routing; 300 s planner-pool promise-cache (empty result evicted immediately); 1 h EIA per-PADD cache (failures never pinned); NWS alerts concurrent within samples; `/anchors` rate limited (10/min, was the only unlimited planner endpoint); degree-window prefilter before haversine with an equivalence sweep in the harness.
4. **Directory render path** — `request-cache.ts` (React `cache()` over the strict `*Result` reads) wired into the exit page; JSON-LD review scans gated on an indexable entry existing; near-me search pool slimmed to the six searched fields via a generic `SearchableEntry`; sponsors read made deterministic (`order` before `limit`); dead `sponsorContext()` removed.
5. **Turnstile hardening** — strict mode (`requireTurnstile: true`) on review + submission (their forms always send tokens; omitting the token no longer bypasses verification); 4 s timeout on siteverify; parking-report documented as verified-if-present until its sheet gains a widget; new `test-directory-write-guards` harness.
6. **HERE adapters** — in-flight coalescing (one transaction per answer) and stale-on-read deletion in both adapters; providers.ts header corrected ("no live adapter exists yet" was two phases stale).
7. `docs+bench:` the ten audits + runtime benchmark harness.

Design rules applied throughout: caches hold promises (concurrent callers share one flight), failures are never pinned, TTLs mirror staleness the product already accepts (300 s = the pages' own `revalidate`; 1 h ≪ EIA's weekly cadence), and every cache has a test seam (`__reset*`).

## 8. Rejected alternatives

- **`unstable_cache` on facets/review readers** — cross-request TTL caching duplicates what ISR already provides and adds an invalidation surface next to `revalidatePath()`; request-scoped `cache()` gets the measured win with zero freshness change. Revisit only if regeneration frequency itself becomes the problem.
- **Parallel keyset pages after count** (for #216's scans) — breaks the completeness proof (offset math under concurrent writes); serial pages are already off the user path.
- **Deleting the unused granular POST endpoints / dead SVG map foundation / HOS timeline engine** — all are dead-code *recommendations* (§6), not unilateral deletions: each has tests and one has a product question ("ship split-sleeper?") attached.
- **LeafletMap selection-restyle rework** — right fix, but a client-interaction change with no existing component harness; belongs in its own reviewed change, not a stabilization PR.
- **Middleware matcher narrowing** — likely-free win rejected for now because cloud-route session refresh depends on middleware behavior; needs a trace, not a guess.
- **Requiring Turnstile on parking-report** — would break the feature outright (its sheet renders no widget); the friction tradeoff is documented in-code as deliberate for the driver test cohort.
- **Slimming the `/directory/map` payload** — same shape as the near-me fix but its full entries feed the visible card list, so it needs a UI decision (virtualization or reduced cards), not a silent field drop.

## 9. Risk analysis

- **Staleness introduced:** planner pool ≤300 s (equal to the page's existing ISR), EIA ≤1 h (weekly series), both per warm instance, both evict failures immediately — an outage degrades through, never pins.
- **Request-scoped cache():** no cross-request state; publish timing via ISR + `revalidatePath()` unchanged (asserted in the false-404 harness).
- **Turnstile strict mode:** the one behavior change reachable by users. If production ever ran with the *public site key missing but secret present*, review/submission forms would now fail closed instead of open — the same posture the apply form has always had via its schema-required token. Bots omitting tokens are cut off; drivers with the widget are unaffected.
- **Prefilter correctness:** proven by a brute-force equivalence sweep including radius-boundary and antimeridian cases; the window can only over-include (falls through to exact haversine).
- **Coalescing:** failures are not cached (pending entry removed on settle); a coalesced failure returns null to all waiters exactly as two independent failures would.
- **Rollback:** every change is a plain revert; no migration, no data, no config, no client-contract change (the near-me prop type narrowing is compile-checked).

## 10. Merge compatibility (this branch × PR #216)

Both branches edit `scripts/test-directory-false-404.ts`, but in different regions: `git merge-tree` produces a clean merge with no conflicts. Both assertion sets survive a merge and both hold on the merged tree — #216's keyset assertions test the `data.ts` it brings, this branch's request-cache-chain assertions test the exit page it brings. `src/lib/directory/data.ts` itself is untouched by this branch on purpose. The `combo` build benchmark ran on exactly this composition and passed (164.0 s, §5). Either merge order works.

## 11. Files changed / test results / CI

- **Files:** see the PR diff; src changes are confined to `src/lib/trip-planner/*`, `src/lib/directory/*`, `src/lib/map/explore.ts`, `src/lib/api/{handler,turnstile}.ts`, the exit + near-me pages, `CatScaleNearMe.tsx`, and two API routes — plus `scripts/bench/*` (new), `scripts/test-directory-write-guards.ts` (new), four extended harnesses, and `docs/stabilization-2026-08/*`.
- **Tests:** 93 harnesses, all passing (was 92); ~30 new assertions across trip-planner-api (76→82), trip-planner (123→125), here-routing (65→66), here-geocode (49→50), directory-false-404 (rewired, net +2), directory-write-guards (new, 9). `tsc --noEmit`, `next lint`, `prettier --check` all clean.
- **CI / Netlify preview:** recorded on the PR after push.

## 12. What was NOT done (constraints honored)

No Navigator, PWA, accounts, offline mode, Road Report, newsletter, Academy, Store, Founder, Knowledge Center, or practice-test work. No production database writes (the only DB contact in this session was read-only metadata via MCP for the separately-ordered PR #229 merge). No migrations applied. No deploy. This PR stays a draft — **stop for review**.
