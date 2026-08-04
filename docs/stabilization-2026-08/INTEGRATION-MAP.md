# Integration map — PR #232 × PR #216 × main f2c0f6ac (written before code motion)

## Verified state

| Ref | SHA | Base | Files | +/− | Mergeable |
|---|---|---|---|---|---|
| origin/main | f2c0f6acc2f163a30dba815a89eba7a5c448b0d5 | — | — | — | — |
| PR #232 head | 7303a654b4ef27c5c0eade6da4cd97142390f40e | 65d9764 (stale) | 41 | +2649/−119 | clean |
| PR #216 head | ff084def65f33c92e538593fa29b4b7888886d70 | 46f2a40 (very stale) | 4 | +1317/−66 | clean |

- PWA files present on main (sw.js, manifest.ts, offline.html). #235 merged (f2c0f6ac).
- merge-tree: main+232 CLEAN; main+216 CLEAN; (main+232)+216 CLEAN.
- Neither branch touches supabase/, migrations, or any DB write; every `.delete(` is an
  in-process Map eviction (EIA cache, HERE caches, coalescing map, buildReadMemo).
- Files changed on main since #232's base (31 files: PWA, campaign, shirt): intersection
  with #232 files = ∅, with #216 files = ∅.

## File classification

**Unique to #216 (all still required — caps live on main data.ts: limit(1000)×2, 2000, 5000×3):**
- src/lib/directory/data.ts — collectAllRows keyset pagination; error union +short_pool/
  no_progress/page_cap; count-on-first-page corroborated stop; build-phase promise memo
  (NEXT_PHASE gate), failure-evicted; 5 completeness reads converted.
- scripts/test-directory-complete-read.ts (new, 205 checks)
- scripts/test-m3-switchover.ts (write-ban narrowed around memo's Map ops — stricter)

**Overlapping (both modify, merge-tree clean, hunks disjoint):**
- scripts/test-directory-false-404.ts — #216: env-var ban → NEXT_PHASE-only allowance;
  #232: assertions follow the request-cache chain. Composed file carries both; suite must pass.

**Unique to #232 (all retained):**
- Trip Planner: compose-quote (clock validation before spend, concurrent scan),
  directory-loader/-layer (300s pool promise-cache, failure eviction), eia-fuel (1h PADD cache),
  nws-weather (concurrent alerts), here-routing/here-geocode (in-flight coalescing +
  stale-on-read delete), providers, anchors route (rate limit).
- Directory render: request-cache.ts (React cache() over *Result reads), exit page,
  seo.ts (JSON-LD skip when nothing indexable), sponsors-data (deterministic order),
  explore.ts + CatScaleNearMe (6-field pool).
- Security: turnstile.ts strict mode + 4s siteverify timeout fail-closed; handler.ts;
  review + submission routes strict; parking-report keeps documented widget-less policy.
- Bench: scripts/bench/* (mock PostgREST, build/runtime bench). Docs: audit/ + report.

**Conflicting:** none (three-way merge-tree clean; no semantic narrowing found).

**Obsolete on current main:** none — main's delta since both bases (PWA/campaign/shirt/lead)
touches disjoint files.

**Unsafe to carry forward:** none identified. (#216's Netlify build-time regression is a
known cost, documented, not a safety issue; re-measured in Phase 10.)

**Docs/bench only:** docs/stabilization-2026-08/*, scripts/bench/*.

## The 8 mandated determinations

1. **#232 ⊇ part of #216?** No. #232 never touches data.ts. Zero code duplication.
2. **#216 still required?** Yes — all six caps verified live on main@f2c0f6ac; truck-stops
   1,882 rows vs 1,000 cap is an active truncation.
3. **#232 depends on #216?** No. request-cache.ts wraps four *Result* exports whose
   signatures #216 preserves. Composes either order.
4. **#216 depends on assumptions #232 disproved?** No. #232's audit endorsed #216
   ("correct, should merge") and its mock-DB benchmark measured main+#216 2.4–2.7× faster
   than main. The one open question (#216's Netlify-only regression) is orthogonal and
   re-measured here.
5. **Regression risk to PWA/lead/Store/Academy/RoadReport/Classroom?** File-level: zero
   intersection. Behavior-level: turnstile strict mode is opt-in per route (review,
   submission only); /api/lead path unchanged (verified in Phase 8). SW cache exclusions
   untouched (Phase 9 harness re-run).
6. **#216 pagination × #232 request caching compose?** Yes, by layer separation:
   React cache() = per-request dedupe (render); buildReadMemo = per-build cross-render
   dedupe (NEXT_PHASE-gated, runtime-inert). Stacked they multiply, not fight. Failure
   paths: React cache holds a failed Result only within one request; memo evicts failures.
7. **Build vs runtime caches overlap/conflict?** No. Memo inert at runtime (phase flag
   assigned only by next build); request-cache inert across requests by construction;
   planner pool promise-cache (300s, runtime) lives in trip-planner, keyed separately,
   evicts empty/failed pools. ISR/revalidatePath untouched by all three.
8. **Error unions / fail-soft consistent?** #216 widens DirectoryReadFailure with three
   members; no #232 caller narrows on reason strings (verified by grep; tsc re-verifies).
   Fail-soft callers (sitemap, generateStaticParams, map, planner pool) stay fail-soft;
   strict callers (exit page 404-vs-500) keep the #215 contract.

## Strategy decision (Phase 4)

**Preferred strategy adopted: update PR #232 in place.**
1. Reset branch claude/stabilize-trip-planner-directory to pr/232 head, rebase onto
   origin/main (merge-tree says clean).
2. Cherry-pick #216's four commits in order (bf6eea5 → 2d6c487 → 333ad7f → ff084de),
   preserving its meaningful history. Any replay conflict in the one shared test file
   resolves to the already-computed clean merge-tree content.
3. Add the integration-map + updated report docs; re-run all gates; force-push with lease
   to the same branch so #232 remains the single final candidate.

Rejected: fresh superseding branch — unnecessary (all merges clean, history stays
readable), and it would leave three open candidates instead of one.
