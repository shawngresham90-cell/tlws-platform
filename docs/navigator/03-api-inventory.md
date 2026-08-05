# 03 — API Inventory

Every endpoint on `origin/main` at `46f2a40`, with a Navigator reuse verdict,
then the endpoints that must be added.

**Shared characteristics of the planner API** (`src/lib/trip-planner/api-util.ts`):

- **Auth:** none. The planner API is public and read-only — it never writes.
- **Rate limit:** token bucket, capacity 20, refill 20/min, keyed on client IP.
  **Per serverless instance, not global** — a documented limitation
  (`rate-limit.ts:4`).
- **Body cap:** 512 KB (`MAX_BODY_BYTES`).
- **Validation:** zod on every request; uniform error envelope via `errorJson`.
- **Client key:** Netlify client-IP header first, else the **last**
  `x-forwarded-for` hop (earlier entries are client-spoofable).

---

## Existing endpoints

### `POST /api/trip-planner/quote` — the composite endpoint

The one call the mobile UI makes today. **The single most important endpoint for
Navigator.**

| | |
|---|---|
| **Inputs** | `quoteRequestSchema`: origin/destination `LatLng`, truck params, simple clocks, departure time |
| **Outputs** | Route (HERE or estimated) · route points with cumulative route-mile · directory candidates · HOS itinerary · weather bands + alerts · fuel price · warnings · disclaimers |
| **Auth** | None |
| **Rate limit** | 20/min/IP/instance |
| **Latency** | **Highest of any endpoint.** Fans out to HERE (5 s timeout), NWS (3.5 s), EIA (3.5 s), plus a full directory read. `composeQuote` holds a per-provider budget so one slow upstream cannot consume the function's own limit |
| **Navigator reuse** | **Yes, unchanged, for route preview.** Not suitable for the 1 Hz loop — far too heavy |

Composition is in `src/app/api/trip-planner/quote/route.ts`; HERE and the cache
live at module scope so the route cache and free-tier counter survive across
requests in a warm instance.

### `POST /api/trip-planner/plan`

| | |
|---|---|
| **Inputs** | `planTripRequestSchema`: full route object, clocks, truck, candidates, options |
| **Outputs** | Itinerary + cost + warnings |
| **Auth / limit** | None / 20 per min |
| **Latency** | Pure computation, no I/O — fast |
| **Navigator reuse** | **Yes, unchanged**, for mid-trip re-planning. Caller supplies the route, so it works offline if the client holds the route |

### `POST /api/trip-planner/route`

| | |
|---|---|
| **Inputs** | `routeQuoteRequestSchema` |
| **Outputs** | Quick ETA via `quickEta` |
| **Latency** | Pure computation |
| **Navigator reuse** | **No.** Uses estimate math, not HERE geometry. Navigator computes ETA client-side from the tracked route |

### `POST /api/trip-planner/stops`

| | |
|---|---|
| **Inputs** | `stopSearchRequestSchema`: route, need kind, clocks |
| **Outputs** | Ranked candidates for that need |
| **Navigator reuse** | **Yes, unchanged**, as the online path for panel refresh. Offline uses the cached corridor slice instead |

### `POST /api/trip-planner/cost`

| | |
|---|---|
| **Outputs** | `TripCostEstimate`, unknown components stay null |
| **Navigator reuse** | **Yes, unchanged** — arrival summary only |

### `POST /api/trip-planner/hos`

| | |
|---|---|
| **Outputs** | Clock simulation |
| **Navigator reuse** | **No — but not because it is wrong.** Navigator runs `hos-engine` **client-side** at 60 s. A network round trip for a clock tick is unnecessary and fails offline. Endpoint remains useful for other clients |

### `POST /api/trip-planner/places`

| | |
|---|---|
| **Inputs** | Free-text query |
| **Outputs** | Merged directory anchors + HERE geocode matches, labeled by source |
| **Latency** | HERE geocode with TTL cache + hourly cap |
| **Navigator reuse** | **Yes, unchanged** — destination entry, stationary only |

### `GET /api/trip-planner/anchors`

| | |
|---|---|
| **Outputs** | Directory anchor list for the combobox |
| **Navigator reuse** | **Yes, unchanged** |

### `GET/POST/DELETE /api/trip-planner/cloud/saved-trips`
### `GET/POST/DELETE /api/trip-planner/cloud/truck-presets`

| | |
|---|---|
| **Auth** | **Supabase session required** (`requireUser`) — the only authenticated planner endpoints |
| **Ownership** | Always derived server-side from `auth.uid()`; the payload has no `user_id` field, so cross-user writes are impossible. RLS enforces the same thing again |
| **Navigator reuse** | **Yes, unchanged** — saved trips and truck presets |

### `POST /api/directory/nearby`

| | |
|---|---|
| **Inputs** | Coordinates + radius |
| **Navigator reuse** | **Partial.** Radius-based; Navigator needs corridor-based (along-route). See NEW-2 |

### `POST /api/directory/parking-report`

| | |
|---|---|
| **Navigator reuse** | **Yes, unchanged** — driver reports, **stationary only** |

### `POST /api/revalidate`

Secret-gated ISR revalidation. **Not used by Navigator.**

### Other endpoints (not Navigator-relevant)

`application/step1`, `application/step2`, `directory/review`,
`directory/submission`, `directory/view`, `lead`, `preschool/claim`,
`sponsor-inquiry`, `tests/attempt`, `stripe/webhook` (a placeholder — no live
payments).

---

## Endpoints that must be added

Four. Everything else reuses what exists.

### NEW-1 · `POST /api/navigator/route`

The only genuinely new *routing* need: a route with **full maneuver objects**.

| | |
|---|---|
| **Why** | `here-routing.ts:229` keeps only `instruction` **text**, capped at 60. Turn-by-turn needs maneuver type, route-mile offset, road name, and exit designation |
| **Inputs** | origin, destination, waypoints, truck profile, avoidances, departure |
| **Outputs** | route + polyline + **`Maneuver[]`** + route points |
| **Auth** | None (consistent with the planner API) |
| **Rate limit** | **Stricter than 20/min.** This endpoint spends HERE transactions. Proposal: 6/hour/IP, matching the reroute budget in [05](./05-navigation-engine.md) |
| **Latency target** | p95 < 2.5 s ([08](./08-performance.md)) |
| **Notes** | Extends the existing adapter's parse; does not replace it. `composeQuote` keeps its current behaviour |

### NEW-2 · `POST /api/navigator/corridor`

| | |
|---|---|
| **Why** | Offline caching needs directory rows **along a route**, not within a radius of a point. `directory-loader.ts` reads the full eligible pool — correct for planning, far too heavy for a device |
| **Inputs** | route polyline (or route id) + corridor radius (default 25 mi) |
| **Outputs** | Directory slice with `parking_spaces`, `overnight_status` **and its provenance**, coordinates, exit/interstate |
| **Auth** | None |
| **Rate limit** | 4/hour/IP — called once per trip, not per tick |
| **Latency target** | p95 < 3 s |
| **Notes** | Must carry overnight provenance so the safety vocabulary behaves **identically** offline |

### NEW-3 · `POST /api/navigator/weather-refresh`

| | |
|---|---|
| **Why** | `nws-weather.ts` is fetched once per quote. Navigator needs refresh as the truck progresses |
| **Inputs** | route points ahead of current mile + departure-adjusted time |
| **Outputs** | Bands + alerts, **with an explicit `fetchedAtMs`** |
| **Rate limit** | 12/hour/IP (roughly every 5 min on a long run) |
| **Notes** | `fetchedAtMs` is mandatory — the UI must always be able to show data age |

### NEW-4 · `POST /api/navigator/traffic` *(deferred to N14)*

| | |
|---|---|
| **Why** | No traffic layer exists |
| **Outputs** | Incidents along route with route-mile positions |
| **Notes** | Behind a new `TrafficPort`. Absent provider → empty array; Navigator proceeds. **Blocked on a provider decision** — see [10](./10-milestones.md) |

---

## Rate-limit architecture change

`api-util.ts` instantiates **one** module-level limiter shared by every planner
endpoint. Navigator endpoints have a different cost profile: `/quote` is cheap
to the platform but `/navigator/route` spends a metered provider transaction.

**Proposal:** a second limiter instance for the navigator namespace with its own
capacity, constructed from the same `RateLimiter` class — no change to
`rate-limit.ts` itself.

**Unchanged limitation:** buckets remain per-instance on serverless. Adequate
for abuse protection; **not** a hard spend cap. The real spend guard stays the
one already in `here-routing.ts` — a per-instance hourly call budget plus the
route cache.

## Latency budget for the trip-start sequence

| Step | Endpoint | Target |
|---|---|---|
| 1 | `/api/trip-planner/places` (destination) | p95 < 600 ms |
| 2 | `/api/navigator/route` | p95 < 2.5 s |
| 3 | `/api/navigator/corridor` | p95 < 3 s |
| 4 | `/api/navigator/weather-refresh` | p95 < 1.5 s |
| | **Total to first guidance** | **< 8 s** |

Steps 3 and 4 run **in parallel** with route rendering — the driver sees the
route before caching finishes.

## Security posture (unchanged, and must stay unchanged)

- `HERE_API_KEY` is server-side only; no URL carrying it is ever thrown, logged,
  or returned (`here-routing.ts:14-18`). Navigator's client therefore **cannot**
  call HERE directly — this is what makes offline rerouting impossible (AD-6),
  and it is the correct trade.
- `EIA_API_KEY` likewise server-side.
- `SUPABASE_SERVICE_ROLE_KEY` is never used in any planner or navigator path.
- Cloud-sync ownership always comes from the session, never the payload.
