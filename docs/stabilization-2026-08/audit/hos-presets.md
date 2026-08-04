# Audit Report — HOS Engine, HosCalculator Page, saved_trips/truck_presets Schema

## src/lib/hos architecture

Five files, 949 lines total, all pure TypeScript with zero I/O:

- `src/lib/hos/types.ts` (170 lines) — re-exports the platform's single `HOS` constants object from `@/lib/trip-planner/types` (types.ts:1,21) rather than redefining limits, and defines split-specific constants `SPLIT_LONG_MIN`/`SPLIT_SHORT_MIN`/`SPLIT_PAIR_TOTAL_MIN` (types.ts:24-28) plus all result shapes.
- `src/lib/hos/time.ts` (30 lines) — `parseHM`/`formatHM`/`isValidMinutes`. **There is no timezone or DST handling anywhere in the engine, and that is a design strength, not a gap**: the engine operates entirely in relative integer minutes from an arbitrary zero (types.ts:35-41 "Absolute minutes from the timeline's own zero"); no `Date` object is constructed anywhere in `src/lib/hos/`. Decimal hours are banned (time.ts:2-4), so there is no float rounding either. Minute rounding risk is confined to the UI's `parseHM`, which is a strict regex `^(\d{1,3})(?::([0-5]?\d))?$` that fails closed (time.ts:12-13) — no silent coercion.
- `src/lib/hos/clocks.ts` (50 lines) — "current clocks" mode: validates 4 driver-entered remaining values, sorts them, returns min as limiting clock (clocks.ts:36-43). Deliberately does no rule arithmetic (clocks.ts:5-8).
- `src/lib/hos/split-sleeper.ts` (304 lines) — quick-mode: `evaluatePair` (§395.1(g)(1) qualification, split-sleeper.ts:49-104) and `calculateQuickSplit` (split-sleeper.ts:121-304) covering full-reset detection (161-208), violation detection (237-246), clock derivation from the end-of-first-qualifying-period anchor (248-256), and a split-vs-no-split gains comparison (261-274).
- `src/lib/hos/timeline.ts` (395 lines) — full timeline mode: validation (28-60), rest-block grouping (63-99), pairing enumeration (134-165), per-candidate clock computation (167-227), best-pairing selection (295-311).

**VERIFIED — server-side usage: none.** Grep over the whole repo shows the engine is imported only by the `'use client'` component `src/components/tools/HosCalculator.tsx:6-9` and the test script `scripts/test-hos-calculator.ts:11-16`. The page `src/app/(marketing)/tools/hos-calculator/page.tsx` is a server component but renders only static prose plus `<HosCalculator />` (page.tsx:43); no API route touches `src/lib/hos`. All HOS computation ships to and runs in the browser.

**VERIFIED — timeline.ts is dead code in the app.** `calculateTimeline`, `validateTimeline`, and `restBlocks` are exercised only by `scripts/test-hos-calculator.ts:13` (515-line test file, ~10 timeline cases). No component or route imports them. The shipped calculator UI exposes only quick-split and current-clocks modes (HosCalculator.tsx:536-543).

## Timeline/split-sleeper complexity

Let n = number of timeline events, B = number of rest blocks (B ≤ n).

- `validateTimeline`: single pass, O(n) (timeline.ts:33-58).
- `restBlocks`: single pass with an inner pass per block, O(n) total (timeline.ts:93-97).
- Candidate generation: double loop over usable rest blocks, `pairingsOf` is O(1) → **O(B²) candidates** (timeline.ts:284-288), up to 2 per pair (both long-first and long-second orientations, timeline.ts:134-165).
- Per candidate, `clocksFrom` does 3× `minutesOf` (each O(n), timeline.ts:102-116), one break-run scan O(n) (180-189), and — redundantly — a full `restBlocks(events)` rebuild plus reverse to find the last 34-h restart (timeline.ts:194). So each candidate is O(n).

**VERIFIED total: O(B² · n), worst case O(n³) when every other event is a rest block.** For the realistic domain (an 8-day timeline is at most a few dozen duty-status changes; B ≲ 16 rest blocks → ≲ 240 candidates × ~50-event scans ≈ 10⁴ operations) this is microseconds. The cubic bound is a theoretical smell, not a practical bottleneck — and it currently runs nowhere in production (see above).

Obvious constant-factor waste: the restart search at timeline.ts:194 (`restBlocks(events)` + reverse + find) is loop-invariant across all candidates and identical to the `blocks` already computed at timeline.ts:274; it is recomputed once per candidate.

**Correctness risk spots (VERIFIED code facts, regulatory interpretation flagged as HYPOTHESIS):**

1. **Window exclusion uses the whole second rest block, not the qualifying period.** `excludedMin: b.totalMin` (timeline.ts:147,161) while `pairTotalMin` uses `a.maxConsecutiveSleeperMin + b.totalMin` (timeline.ts:145). If the second block is, e.g., 2 h off-duty + 7 h sleeper + 30 min off (9.5 h total, not a reset), the entire 9.5 h is excluded from the 14-h window even though the qualifying long half is only the 7-h sleeper run. This is lenient in the driver's favor — HYPOTHESIS: over-credits window time relative to a strict §395.1(g)(1) reading; needs a compliance-ledger check, not measurement.
2. **Single-pair model only.** `calculateTimeline` selects exactly one pairing; rolling recalculation across chained splits (pair 2 reusing pair 1's second period as its first) is not modeled. The window arithmetic excludes only the chosen second block (timeline.ts:177). Documented scope choice, but a real multi-split week will be scored pessimistically.
3. **Quick mode's reset branch** (split-sleeper.ts:161-208): when only the first period is ≥10 h, the second rest counts fully against the window (177) and the break clock resets only if the second rest ≥30 min (179-181) — internally consistent; the asymmetric handling is correct per §395.3(a).
4. **`evaluatePair` tie behavior**: when both periods are ≥7 h sleeper (each <10 h), the first is arbitrarily taken as the long half (split-sleeper.ts:79-81). Order-independent in outcome since both pass; no bug, just an unstated invariant.
5. Duplicated `limitingOf` in split-sleeper.ts:106-115 and timeline.ts:229-238 (identical bodies) — within-module duplication on top of the cross-module duplication the prior auditor quantified.

## HosCalculator render cost

`src/components/tools/HosCalculator.tsx` is a 595-line client component. Cost profile:

- **No per-keystroke engine execution.** `calculateQuickSplit` runs only inside the `calculate` click handler (HosCalculator.tsx:254-291, button at 404-410); `currentClocks` likewise (435-451, button 481-487). Results live in `useState` (251, 431), so typing never recomputes HOS math.
- **Per-keystroke work is one `setForm({ ...form, f: v })` object spread** (e.g. 315, 342) that re-renders the whole `QuickSplit` subtree: 8 `HmField`s, 2 selects, 3 preset buttons, and (if present) the `ResultPanel`. Each `HmField` re-runs `parseHM` (a single regex) on render (HosCalculator.tsx:32). No `useMemo`/`useCallback`/`memo` anywhere — and none is warranted at this node count (~30 DOM-light elements). VERIFIED: render cost is trivial; adding memoization here would be pure overhead.
- State shape is a single flat string-valued form object (238-250, 425-430) — parse-on-submit, fail-closed with a field-specific error (268-273). Sound pattern.
- Mode switching remounts `QuickSplit` via `key={mode}` (587), resetting form state per preset — intentional, cheap.
- Minor nit: list keys are the message strings themselves (`key={v}` at 195, `key={line}` at 214). The engine can emit duplicate strings only if two identical violation messages occur (currently impossible — each is unique per result), so this is latent, not live.
- Bundle note (HYPOTHESIS, needs a bundle measurement): the component imports only `time`, `split-sleeper`, `clocks`, and types — `timeline.ts` (395 lines) should tree-shake out of the client bundle since nothing imports it.

## saved_trips/truck_presets schema review

Migration `supabase/migrations/044_saved_trips_cloud.sql`; consumed by `src/app/api/trip-planner/cloud/saved-trips/route.ts` and `.../truck-presets/route.ts` via mappers in `src/lib/trip-planner/cloud-sync.ts` and auth helper `src/lib/trip-planner/cloud-api.ts`.

**Tables** (044:15-37, 44-61): owner-scoped, `user_id → auth.users on delete cascade`, client-generated `client_id` unique per user (`unique (user_id, client_id)`, 044:36, 60), CHECK constraints bounding coordinates (044:31-34) and truck dimensions (044:56-59). `updated_at` maintained by the shared `tlws_set_updated_at` trigger (044:68-74; function defined in `supabase/migrations/010_housekeeping_rls.sql:5`).

**Indexes vs. actual queries — VERIFIED match, with one redundancy:**
- GET: `select … order by updated_at desc limit 100` under RLS `user_id = auth.uid()` (saved-trips/route.ts:24-28; presets limit 50 at truck-presets/route.ts:19-23) → served exactly by `(user_id, updated_at desc)` (044:40-41, 64-65).
- POST upsert `onConflict: 'user_id,client_id'` (saved-trips/route.ts:50, truck-presets/route.ts:40) → served by the unique constraint's index (044:36, 60).
- DELETE `eq user_id` + `in client_id` (saved-trips/route.ts:63-67) → also the unique index.
- **`saved_trips_user_id_idx` (044:39) and `truck_presets_user_id_idx` (044:63) are redundant**: `user_id` is the leading column of both the unique constraint index and the `(user_id, updated_at)` index. Two dead indexes adding write cost.

**RLS — VERIFIED sound.** All four operations per table are covered with both `using` and `with check` where applicable, `to authenticated` only (044:81-116); `revoke all … from anon` (044:119-120). Defense in depth in the routes: `user_id` is injected from the session (`tripToRow(auth.userId, …)`, cloud-sync.ts:274-276; schemas contain no user_id field, cloud-sync.ts:52-74), DELETE additionally filters `eq('user_id', auth.userId)` (saved-trips/route.ts:66), and `requireUser` uses `auth.getUser()` with the anon-key client — service role never used (cloud-api.ts:22-37). Layering is correct.

**Caps — VERIFIED gap: per-user row totals are NOT enforced at the database.** Enforcement exists only at (a) the client store: `LIMITS = { favorites: 20, truckPresets: 10 }` (`src/lib/trip-planner/saved-trips-store.ts:21-26`, applied at 255-256, 410-411), and (b) per-request batch size: `z.array(...).max(LIMITS.favorites)` / `.max(LIMITS.truckPresets)` / delete `.max(100)` (cloud-sync.ts:78-86). A hostile authenticated client can POST repeatedly with fresh `client_id`s (each ≤120 chars, cloud-sync.ts:53) and accumulate unbounded rows per user; the only brakes are the in-memory, per-instance 20 req/min/IP token bucket (`src/lib/trip-planner/api-util.ts:13-17`) — which does not survive serverless multi-instance fan-out — and the GET `limit(100)`/`limit(50)` that merely hides the overflow. No DB trigger or policy counts rows. Also note **GET is not rate-limited at all** — `guardedParse` runs only on POST/DELETE; GET calls only `requireUser` (saved-trips/route.ts:21-28).

**Other schema notes:**
- `truck jsonb not null default '{}'` (044:26) has no DB-level shape validation; only the zod `cloudTruckSchema` guards the write path (cloud-sync.ts:40-49). `rowToTrip` blind-casts it (`(r.truck ?? {}) as CloudSavedTrip['truck']`, cloud-sync.ts:305), so a row inserted through any other path (SQL console, future migration) round-trips malformed truck data into typed client code.
- Client-supplied `createdAt`/`updatedAt` are accepted by the schema but discarded by `tripToRow`/`presetToRow` (cloud-sync.ts:274-289, 312-323) — server stamps its own times. Correct for integrity, but the merge algorithm compares local `Date.now()` ms against server timestamps (cloud-sync.ts:186, 202), so client/server clock skew can cause repeated no-op pushes (HYPOTHESIS: benign ping-pong, bounded by the 20-item cap).

## Failure modes

1. **Unbounded per-user row growth** in both cloud tables (see caps above) — storage abuse vector for any authenticated user; rate limiting is per-instance memory only (api-util.ts:13-17). VERIFIED gap.
2. **Unrate-limited GET** on both cloud routes (saved-trips/route.ts:21, truck-presets/route.ts:16) — each hit costs a Supabase auth check + query.
3. **Lenient window exclusion** in timeline pairing (`excludedMin = b.totalMin`, timeline.ts:147) could tell a driver they have more 14-h window than a strict reading allows — currently latent because timeline mode has no UI, but it's tested and presented as correct.
4. `parseHM` accepts up to 999 hours (time.ts:12) — a typo like `700` (meaning 7:00) parses as 700 hours and produces a confident wrong answer in current-clocks mode, where inputs are trusted verbatim (clocks.ts:5-8). No plausibility ceiling on any field.
5. `rowToTrip` blind jsonb cast (cloud-sync.ts:305) — malformed legacy rows crash or corrupt the client store silently.
6. Engine violation messages are keyed as React list keys (HosCalculator.tsx:195) — duplicate messages would throw duplicate-key warnings; latent.

## Bottleneck candidates

- **VERIFIED — none in the HOS engine at production scale.** Quick-split is O(1); current-clocks is O(1); both run client-side on explicit button click only.
- **VERIFIED — timeline `clocksFrom` recomputes `restBlocks(events)` per candidate** (timeline.ts:194), making pairing selection O(B²·n) with an avoidable O(n) factor; loop-invariant hoist would make it O(B² + n·B²→ still O(B²·n) for minutesOf but ~4× fewer scans). Irrelevant until timeline mode ships a UI.
- **HYPOTHESIS — cloud GET on every planner load**: `order by updated_at desc limit 100` per user is index-served and cheap, but with no GET rate limit and `force-dynamic` (saved-trips/route.ts:19), a chatty client could multiply Supabase round-trips. Needs traffic measurement.
- **HYPOTHESIS — redundant `user_id` indexes** (044:39, 63) add marginal write amplification on upsert-heavy sync; measurable only under load, safe to drop regardless.

## Simplification opportunities

1. Delete or ship `timeline.ts` — 395 lines + its 200+ lines of tests maintained for a feature with no UI (only importer is scripts/test-hos-calculator.ts:13). Either wire it into the calculator or move it out of `src/lib`.
2. Collapse the two identical `limitingOf` implementations (split-sleeper.ts:106-115, timeline.ts:229-238) into one export — same shape as `currentClocks`'s min-selection (clocks.ts:36-43), i.e., a third within-`src/lib/hos` copy of the pattern the prior auditor counted across modules.
3. Drop `saved_trips_user_id_idx` and `truck_presets_user_id_idx` (044:39, 63) — fully covered by the composite indexes.
4. Hoist the restart lookup out of `clocksFrom` into `calculateTimeline` (timeline.ts:194 vs 274) — it's per-timeline, not per-candidate.
5. Add a plausibility cap to `parseHM` (e.g., ≤ 80:00) or per-field maxima in the UI — one-line change in time.ts:12 removes failure mode 4.
6. Enforce the 20/10 per-user cap at the DB (a `before insert` count trigger or a policy-checked count) so the client-side `LIMITS` stop being the only real cap.

## Open questions

1. Is timeline mode intentionally shelved (awaiting the ledger's "human eCFR click-through row" noted at split-sleeper.ts:34) or forgotten? Determines whether to delete or finish it.
2. Is `excludedMin = b.totalMin` (whole-block window exclusion, timeline.ts:147) a documented ledger decision or an oversight? The ledger (`docs/compliance/split-sleeper-rule-ledger.md`) was out of my file scope.
3. What is the intended per-user ceiling for cloud rows — is "client caps + rate limit" an accepted risk, or should the DB enforce 20/10?
4. Does the deploy target run multiple serverless instances (making the in-memory `RateLimiter` at api-util.ts:13 near-inert), and is there an edge-level rate limit in front of it?
5. Is the absence of a GET rate limit on the cloud routes deliberate (authenticated-only, so bounded by account creation) or an omission relative to the POST/DELETE path?