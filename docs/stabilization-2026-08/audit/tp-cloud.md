All assigned files read end-to-end. Report follows.

# Cloud Sync + Saved Trips + Truck Presets — Architecture Audit (commit 881fb07)

## Architecture

**Layering (VERIFIED).** The subsystem is a strict three-layer, offline-first design:

1. **Pure local store** — `src/lib/trip-planner/saved-trips-store.ts` is a side-effect-free state module (module doc, saved-trips-store.ts:11-15): every operation takes `(store, ..., now)` and returns a new store. It never touches localStorage/React/network directly.
2. **React hooks** — `useSavedTrips.ts` binds the pure store to localStorage (useSavedTrips.ts:53-83); `useCloudSync.ts` adds Supabase email-OTP auth + a queued push/pull sync protocol (useCloudSync.ts:63-353).
3. **Server routes** — `cloud/saved-trips/route.ts` and `cloud/truck-presets/route.ts` are thin GET/POST/DELETE handlers over two RLS-guarded Supabase tables created in `supabase/migrations/044_saved_trips_cloud.sql`.

**What syncs vs what doesn't (VERIFIED).** Only favorites (saved trips) and truck presets sync; recent places and planned-trip history are explicitly never uploaded (useCloudSync.ts:22-24, 044_saved_trips_cloud.sql:7-8, AccountPanel.tsx:117-120). Signed-out users make zero cloud requests (useCloudSync.ts:153 — `enqueue` returns early with no userId; useCloudSync.ts:20-22).

**Sync protocol (VERIFIED).**
- *Pull + merge*: on sign-in (`initialSync`, useCloudSync.ts:162-221) the client (a) drains the offline queue first so pending deletes reach the cloud before the read-back (useCloudSync.ts:168-171), (b) treats still-queued deletes as tombstones filtered out of the cloud snapshot (useCloudSync.ts:172-180, 193-198), (c) GETs both lists, (d) runs a pure union merge (`mergeFavorites`/`mergePresets`, cloud-sync.ts:208-237), (e) writes the merged result back locally via `applyMerged` (useCloudSync.ts:205), and (f) enqueues upserts for everything the cloud lacks or the local edit won (useCloudSync.ts:208-215).
- *Push*: after the first merge (`syncReady`), a centralized diff effect in `TripPlannerApp.tsx:214-235` compares favorites-by-`updatedAt` and presets-by-value-signature against a baseline ref and enqueues per-item `upsert-*`/`delete-*` ops. Ops go into a per-user localStorage queue (`tlws:tp:syncq:<userId>`, useCloudSync.ts:44) and `flush()` (useCloudSync.ts:83-148) batches them into at most 4 HTTP calls (trips-upsert, trips-delete, presets-upsert, presets-delete).
- *Conflict rule*: identity = stable client id, fallback = normalized name (+ rounded coordinates for trips); newest `updatedAt` wins, ties keep the incumbent (cloud, since cloud is considered first), genuinely distinct records are both kept, first sign-in never deletes local data (cloud-sync.ts:164-206, 19-24).
- *Queue semantics*: `dedupeQueue` collapses to the latest op per `(family, clientId)`, so a delete cancels a pending upsert and vice versa (cloud-sync.ts:253-258).

**Identity/auth model (VERIFIED).** Public auth is a plain Supabase email-OTP session (useCloudSync.ts:270-293), deliberately separate from admin auth (useCloudSync.ts:26-28). Server routes resolve the user exclusively via `supabase.auth.getUser()` on the anon-key + cookie client (`requireUser`, cloud-api.ts:22-37; server.ts:9-14 — never service role). `user_id` is injected server-side into every row (cloud-sync.ts:274-277, saved-trips/route.ts:44-47) and RLS enforces `user_id = auth.uid()` on all four verbs as defense in depth (044:80-116), with all anon access revoked (044:119-120).

**Cross-user hygiene (VERIFIED).** Sign-out clears the entire local store so the next user on the device sees nothing (useCloudSync.ts:251-258; TripPlannerApp.tsx:188-190 `onSignedOut: saved.clearAll`).

**Presets → form (VERIFIED).** `applyPreset` (TripPlannerApp.tsx:199-205) copies the five preset fields into form state; wired from SavedTripsPanel "Apply" (TripPlannerApp.tsx:829, SavedTripsPanel.tsx:218) and from favorite re-plan, which also auto-submits (TripPlannerApp.tsx:313-321).

**Polling/interval work (VERIFIED: none).** There is no `setInterval`/polling anywhere in this subsystem. Sync fires only on: mount/auth-change (useCloudSync.ts:224-259), local mutation via the diff effect, the browser `online` event (useCloudSync.ts:260-261), and the manual "Sync now" button (AccountPanel.tsx:122, mapped to `initialSync` at useCloudSync.ts:347). PlaceCombobox does one debounced (300 ms, min 3 chars) geocode fetch per query change (PlaceCombobox.tsx:29-30, 75-107); TpcReserveBand fires exactly one analytics event per plan result via a ref guard (TpcReserveBand.tsx:98-104).

## Module inventory

| Module | Role | Key facts |
|---|---|---|
| `src/lib/trip-planner/saved-trips-store.ts` | Pure local store: types, caps, migrate/cleanup, all mutations | Caps at :21-26; stale cutoff 90 d at :29; fail-soft `deserialize` :430-437 |
| `src/lib/trip-planner/cloud-sync.ts` | Pure sync logic: zod payload schemas, local↔cloud↔row mappers, union merge, queue dedupe | Merge :164-237; queue :253-258; row mappers :274-337 |
| `src/lib/trip-planner/cloud-api.ts` | Server-only auth helper (`requireUser`) | Session-derived identity :22-37 |
| `src/lib/trip-planner/tpc-analytics.ts` | TPC funnel events, bucketed non-PII payloads | HOS/detour buckets :16-27; 3 events :9-13 |
| `src/lib/trip-planner/api-util.ts` (support) | Rate limit + body cap + zod guard shared by planner routes | 20 req/min/IP/instance :13-17; 512 KiB cap :19 |
| `src/components/trip-planner/useSavedTrips.ts` | SSR-safe hook over the store; localStorage persistence | Synchronous ref-composed `persist` :73-83 |
| `src/components/trip-planner/useCloudSync.ts` | Auth lifecycle, offline queue, flush, initial merge, deleteAllCloud | 353 lines, described above |
| `src/components/trip-planner/AccountPanel.tsx` | OTP sign-in UI + sync status + delete-cloud-data | Status labels :28-34; two-step confirm delete :125-150 |
| `src/components/trip-planner/SavedTripsPanel.tsx` | Favorites/presets/recents list UI, purely presentational | Callbacks-only, no I/O :25-47 |
| `src/components/trip-planner/PlaceCombobox.tsx` | Origin/destination combobox; local directory filter + debounced HERE geocode; recents as empty-field suggestions | :61-67, :75-107 |
| `src/components/trip-planner/TpcReserveBand.tsx` | Partner (TPC) reserve band; env kill switch | `NEXT_PUBLIC_TPC_PLANNER_ENABLED` :37; render-only, no fetch |
| `src/app/api/trip-planner/cloud/saved-trips/route.ts` | GET (limit 100) / POST upsert / DELETE by clientIds | :21-73 |
| `src/app/api/trip-planner/cloud/truck-presets/route.ts` | Same, GET limit 50 | :16-63 |
| `supabase/migrations/044_saved_trips_cloud.sql` | `saved_trips` + `truck_presets` tables, indexes, RLS, triggers | :15-122 |

## Caches/persistence

**localStorage keys (VERIFIED).**
- `tlws:trip-planner:v1` — the whole `PlannerStore` JSON, one key, rewritten in full on every mutation (saved-trips-store.ts:17, useSavedTrips.ts:79). Shape: `{version:1, recentPlaces[], plannedTrips[], favorites[], truckPresets[], updatedAt}` (saved-trips-store.ts:77-84).
- `tlws:tp:syncq:<userId>` — per-user offline op queue, JSON array of `SyncOp` (useCloudSync.ts:44-61). Never cleaned up on sign-out (intentionally serves as tombstones for the next sign-in of the same user, useCloudSync.ts:172-180), but also never garbage-collected for accounts that never sign back in.

**Caps (VERIFIED).** Local: 10 recent places, 10 planned trips, 20 favorites, 10 presets (saved-trips-store.ts:21-26); enforced on every load via `cleanup` (:247-258) plus per-mutation slicing. 90-day staleness applies only to recents/planned trips (:29, :248-254). Cloud request bounds: upsert batches ≤ 20 trips / ≤ 10 presets (cloud-sync.ts:78-83), deletes ≤ 100 ids (:84-86); GET reads capped at 100 trips / 50 presets (saved-trips/route.ts:28, truck-presets/route.ts:23).

**DB (VERIFIED).** Composite unique `(user_id, client_id)` powers idempotent upsert (044:36, 60); indexes on `user_id` and `(user_id, updated_at desc)` match both the RLS predicate and the GET's `order by updated_at desc` (044:39-41, 63-65; routes order at saved-trips/route.ts:26-27). `updated_at` maintained by a shared BEFORE UPDATE trigger (044:68-74); the client's timestamps are discarded server-side (`tripToRow` omits created_at/updated_at, cloud-sync.ts:287; `presetToRow` :312-323). Coordinate/dimension CHECK constraints mirror the zod ranges (044:31-34, 56-59). **There is no per-user row cap in the database** — the only caps are per-request batch sizes (see Bottlenecks/Security).

**Payload sizes (VERIFIED).** A `CloudSavedTrip` is ~300-600 bytes (labels ≤ 200 chars, cloud-sync.ts:32-38); a full 20-trip upsert is roughly ≤ 12 KB, presets smaller — far under the 512 KiB body cap (api-util.ts:19). GET responses are bounded by the 100/50 row limits.

## Failure modes

| Mode | Severity | Behavior |
|---|---|---|
| localStorage blocked (private mode) | **handled** | In-memory fallback + visible notice (useSavedTrips.ts:60-65, SavedTripsPanel.tsx:96-100) |
| Corrupt/unknown stored JSON | **handled** | Fail-soft `deserialize`/`migrate` → empty store, v0 shape migrated (saved-trips-store.ts:152-165, 430-437) |
| localStorage quota exceeded mid-session | **degraded** | Silently keeps in-memory copy only; `storageAvailable` stays true so the user gets no warning (useSavedTrips.ts:80-82) |
| Supabase unreachable at load | **handled** | Presents as signed-out, planner keeps working locally (useCloudSync.ts:240-244) |
| Offline / fetch failure during flush | **handled** | Queue retained, status `offline`/`error`, retried on `online` event or next mutation (useCloudSync.ts:144-147, 260-261) |
| Partial batch failure (e.g. trips POST ok, presets DELETE 429) | **degraded** | `results.every(r => r.ok)` is all-or-nothing: on any failure the *entire* queue is kept and status is `error`; already-succeeded ops re-send next flush (safe because upserts/deletes are idempotent) but with no backoff (useCloudSync.ts:136-143) |
| Concurrent flushes racing (VERIFIED race) | **degraded/broken (rare)** | `flush` has no in-flight guard and clears the queue wholesale on success (`queue = []; saveQueue(...)`, useCloudSync.ts:138-139). Sequence: flush A reads `[op1]` and is in-flight → `enqueue(op2)` writes `[op1,op2]` and starts flush B → flush B's request fails, flush A's succeeds → A overwrites the queue with `[]`, dropping op2 without it ever being delivered. Same class of race exists across two tabs sharing the queue key. Low probability, silent local/cloud divergence until the next `initialSync` |
| Preset edited while signed out, then sign in | **degraded** | `mergePresets` is called with the default `updatedAt = () => 0` (cloud-sync.ts:228, useCloudSync.ts:202), so every preset conflict is a tie and the incumbent (cloud, considered first at cloud-sync.ts:190) wins — the local signed-out edit is silently reverted. Local `TruckPreset` has no timestamps (saved-trips-store.ts:52), so this is structural |
| Client clock skew | **degraded (HYPOTHESIS on impact)** | Merge compares local `updatedAt` (client `Date.now()`, useSavedTrips.ts:38-40) against cloud `updated_at` (DB trigger time). A device with a fast clock always wins conflicts; a slow one always loses (cloud-sync.ts:186, 044:68-74) |
| Rate-limit 429 on flush | **degraded** | Treated as generic `error`; retry only on next mutation/online/sign-in — no scheduled retry, so a lone queued op can sit indefinitely on an idle tab (useCloudSync.ts:141-143) |
| >100 cloud trips (see cap gap) | **degraded** | GET truncates at 100 (saved-trips/route.ts:28); `deleteAllCloud` deletes only the rows the GET returned, so "Delete cloud data" can leave residue while reporting success (useCloudSync.ts:307-332) |
| Cap eviction during initial merge | **degraded (minor)** | `mergeFavorites` slices merged to 20 (cloud-sync.ts:220-221) and the baseline effect deliberately absorbs merge writes (TripPlannerApp.tsx:223-226), so evicted cloud rows are never deleted server-side — orphaned rows accumulate up to the GET limit |
| OTP send/verify failure | **handled** | Inline error messages, planner unaffected (useCloudSync.ts:270-293, AccountPanel.tsx:69-88) |
| DB error in routes | **handled** | 502 with generic message, detail logged server-side only (saved-trips/route.ts:29-33) |

## Bottleneck candidates

- **VERIFIED — full-store rewrite per keystroke-adjacent action**: every mutation (including each recent-place record on pick) serializes the entire `PlannerStore` to one localStorage key (useSavedTrips.ts:73-83). With caps (≤ 50 small records) this is a few KB — negligible in practice, but structurally a full rewrite where a delta would do.
- **VERIFIED — `initialSync` is a full-list pull + full merge on every sign-in AND every "Sync now" click** (useCloudSync.ts:162-221, 347; AccountPanel.tsx:122). No `If-Modified-Since`/version cursor; two sequential await waves (flush, then parallel GETs). At the 100/50 row bound this is small; it is the correct simplicity trade-off at current scale.
- **VERIFIED — flush storm from the diff effect**: the diff loop calls `enqueue` once per changed item, and each `enqueue` calls `void flush()` (useCloudSync.ts:150-159; TripPlannerApp.tsx:228-231). N changed items → N overlapping flushes each re-reading the queue and issuing HTTP calls (idempotent, but redundant requests and the race above). A microtask-debounced flush would collapse these.
- **VERIFIED — O(n·m) merge push-detection**: `mergeCollections` does `cloud.find(...)` inside the merged loop (cloud-sync.ts:199-202). Quadratic, but n ≤ ~120 given the caps — harmless. Noted only because the maps to make it O(n) already exist in the function.
- **VERIFIED — no rate limit on GET**: `guardedParse` (and thus the token bucket) guards only POST/DELETE; the GET handlers call only `requireUser` (saved-trips/route.ts:21-28, truck-presets/route.ts:16-23). Each GET performs an authenticated DB read; an authenticated client can hammer it. Small blast radius (indexed, ≤ 100 rows) but inconsistent with the "rate-limited like the rest of the planner API" comment at saved-trips/route.ts:14-15.
- **HYPOTHESIS — per-instance rate limiting under serverless fan-out**: the limiter is per-instance memory (rate-limit.ts:3-7, documented as a known limitation); effective global write throughput per IP is 20/min × instance count. Needs deployment-level measurement; matters mainly for the unbounded-rows issue below.
- **HYPOTHESIS — `auth.getUser()` per request**: every route call validates the session against Supabase Auth (cloud-api.ts:23-27), adding an upstream round-trip per sync call. Fine at this traffic; would be the first latency line-item to measure if sync calls grew.

## Simplification opportunities

1. **Drop the unused `from` tracking in `mergeCollections`** — `from` is computed and then explicitly voided (cloud-sync.ts:171-204, `void from` at :203); the push decision re-derives membership by scanning `cloud`. Either use `from` (making push-detection O(1) and removing the quadratic scan) or delete it.
2. **Debounce/serialize `flush`** — a single in-flight promise + trailing re-run would eliminate the flush storm and the queue-clearing race at useCloudSync.ts:138-139 with ~5 lines.
3. **`presetToCloud` fabricates `createdAt/updatedAt = 0`** (cloud-sync.ts:123-124) solely to satisfy `cloudTruckPresetSchema` (:72-73); the server discards both (presetToRow :312-323). Making them optional-on-input (or giving local presets a real `updatedAt`, which also fixes the preset conflict gap) would remove a confusing sentinel.
4. **Clear the sync queue key on successful sign-out** for the departing user once it's empty — today an empty-but-present array lingers per userId forever (useCloudSync.ts:55-61, 251-258).
5. **`deleteAllCloud` could be a single server endpoint** (`DELETE ... where user_id = auth.uid()`): the current client-side GET-then-DELETE round-trip (useCloudSync.ts:304-336) is 4 requests, is truncation-prone past 100 rows, and duplicates ids into a request body only to have the server re-filter by user anyway.
6. **SavedTripsPanel's private-device notice is stale** — it states data is "never uploaded, and not tied to any account" (SavedTripsPanel.tsx:244-248), which the cloud-sync milestone made false for favorites/presets; AccountPanel's copy (AccountPanel.tsx:117-120, 168-171) is the corrected version. UI copy inconsistency, not code risk.

## Security notes

- **Strong ownership model (VERIFIED)**: identity from session only (cloud-api.ts:8-13, 22-37); `user_id` injected server-side per row (cloud-sync.ts:274-277); DELETE filtered by `user_id` (saved-trips/route.ts:63-67); RLS on all four verbs with `to authenticated` and anon fully revoked (044:80-122); anon-key client, never service role (server.ts:6-8). Three independent layers must all fail for cross-user access.
- **VERIFIED gap — no per-user row cap in the DB**: zod caps only the *batch* (20 trips/request, cloud-sync.ts:78-80), and `client_id` is client-chosen (≤ 120 chars). An authenticated user scripting POSTs with fresh client_ids can insert ~20 rows × 20 req/min *per rate-limiter instance* indefinitely; nothing in 044 bounds rows per user. Blast radius is contained (GETs limit 100/50, per-row size bounded by zod string caps) so this is a storage-bloat/abuse issue, not a data-integrity one. A trigger-enforced per-user cap or a count check in the route would close it.
- **VERIFIED — input validation is dual-layered**: zod ranges (cloud-sync.ts:28-49) mirrored by DB CHECK constraints (044:31-34, 56-59); body size capped at 512 KiB with declared-length pre-check and byte re-check (api-util.ts:47-59).
- **VERIFIED — no PII in analytics**: TPC events carry only bucketed HOS/detour and counts, never coordinates or place strings (tpc-analytics.ts:4-8, 29-44); dispatch is vendor-agnostic window-global with no direct network call (analytics.ts:8-22).
- **VERIFIED — error hygiene**: DB error detail logged server-side, generic codes to clients (saved-trips/route.ts:30-32).
- **Minor (VERIFIED)** — queue trust: `loadQueue` casts parsed JSON to `SyncOp[]` without per-item validation (useCloudSync.ts:46-54). It's same-origin localStorage, so the only writer is the app itself (or the user via devtools against their own account); a malformed op is dropped by the flush switch (:104-111). Negligible risk.
- **Minor** — `clientKey` falls back to the last `x-forwarded-for` hop or `'unknown'` (api-util.ts:21-28); off Netlify, all clients missing the header share one `'unknown'` bucket. Deployment-dependent (HYPOTHESIS as to whether any such path exists in prod).

## Open questions

1. **Is a shared rate-limit store planned?** rate-limit.ts:3-8 documents per-instance buckets as adequate for a "read-only" API, but the cloud routes added writes; combined with no per-user DB cap, the effective write ceiling is instance-count-dependent (needs deployment measurement).
2. **Preset conflict policy**: is cloud-wins-on-tie for presets (cloud-sync.ts:225-237 with the `() => 0` default) an accepted trade-off, or should local presets grow an `updatedAt`? The schema already carries the fields end-to-end.
3. **Orphaned cloud rows**: is the accumulation of merge-evicted favorites (never deleted server-side, bounded only by the GET's `limit(100)`) acceptable, or should the initial merge also enqueue deletes for evicted cloud-side items?
4. **Supabase Auth settings** (OTP rate limits, `shouldCreateUser: true` sign-up abuse surface, session lifetime) live outside the repo — not verifiable from code; worth confirming dashboard-side throttles since sendOtp is invocable by any anonymous visitor (useCloudSync.ts:270-280).
5. **Cross-tab sync**: two tabs share `tlws:trip-planner:v1` but neither hook listens to the `storage` event (useSavedTrips.ts:53-66), so tabs can silently diverge until reload; is single-tab usage an accepted assumption?