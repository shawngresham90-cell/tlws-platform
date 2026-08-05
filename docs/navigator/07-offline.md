# 07 — Offline Strategy

Design only.

## What "offline" means here

**Offline guidance along a pre-cached route. Not offline routing.**

The HERE key is server-side only (`here-routing.ts:14-18`) — a correct security
posture that must not be relaxed. Therefore:

- ✅ Guidance along a route cached **before departure** works fully offline.
- ✅ Parking, fuel, Last Legal Stop and HOS all work offline — those computations
  are pure and run client-side over a cached directory slice.
- ❌ Rerouting requires connectivity.
- ❌ New destinations require connectivity.
- ❌ Live weather requires connectivity.

This must be stated plainly in product copy. A driver who believes they have
offline rerouting and does not is worse off than one who knows the limit.

---

## Cached assets

| Asset | Store | Typical size | Lifetime |
|---|---|---|---|
| Route (polyline, maneuvers, stops) | IndexedDB | 200 KB – 2 MB | Trip + 24 h |
| Directory corridor slice | IndexedDB | 1 – 5 MB | Trip + 24 h |
| Map tiles | Cache Storage | **50 – 300 MB** | LRU, user-managed |
| Weather snapshot | IndexedDB | < 100 KB | 6 h hard expiry |
| Fuel prices | IndexedDB | < 50 KB | 7 days (EIA is weekly) |
| Truck presets, saved trips | IndexedDB + Supabase | < 100 KB | Indefinite |

### 1. Cached routes

Stored at trip start, before the first mile:

```ts
type CachedRoute = {
  sessionId: string;
  route: Route;                 // HERE geometry only — never an estimate
  routePoints: RoutePoint[];    // cumulative route-mile
  maneuvers: Maneuver[];
  plannedStops: PlannedStop[];
  truck: TruckProfile;
  cachedAtMs: number;
  provider: string;
};
```

**Prerequisite for everything else.** Without the route there is no route-mile,
and route-mile is the coordinate system the whole engine uses.

### 2. Cached parking

The corridor slice from `NEW-2 /api/navigator/corridor` — directory rows within
25 mi of the route.

**Must carry, per row:** id, name, coordinates, `parking_spaces`,
`overnight_status` **and its source + verified-at**, interstate, exit, category,
city/state.

Carrying overnight provenance is not optional. The overnight vocabulary
(`src/lib/directory/overnight.ts`) distinguishes confirmed / prohibited /
unknown, and a driver offline must see exactly the same three states with the
same evidence backing as online. An offline cache that drops provenance would
silently downgrade a safety-relevant claim.

Same for `parking_spaces`: the zero-space rule filters on a positive count, so
the count must be cached, not approximated.

**Sizing:** ~2,800 directory rows total; a 25-mile corridor on a 600-mile route
typically captures 150–400 rows ≈ 1–3 MB as JSON.

### 3. Cached maps

The dominant cost, and the only asset requiring an explicit user decision.

| Zoom | Coverage | Purpose |
|---|---|---|
| z8–z10 | Full corridor | Route overview |
| z11–z12 | Corridor ± 10 mi | Normal driving |
| z13–z14 | Corridor ± 2 mi + around each stop | Maneuver detail |

**Never cache z15+ along the whole route** — the size grows unusably.

**Two hard requirements before this ships (N12):**
1. **Explicit user consent with a size estimate shown before download.**
2. **The tile provider's caching terms must be verified.** Many tile services
   prohibit bulk pre-caching. This is a licensing question, not an engineering
   one, and it gates the milestone.

Uncached areas render as a neutral grid with "Map not downloaded for this
area" — never a blank screen, which reads as a crash.

### 4. Cached weather

```ts
type CachedWeather = {
  bands: WeatherBand[];
  alerts: WeatherAlert[];
  fetchedAtMs: number;    // MANDATORY
  routeMileFrom: number;
  routeMileTo: number;
};
```

**Age is always displayed. Suppressed entirely after 6 hours.** Stale weather
presented as current is a safety defect — the one place where showing nothing
beats showing something.

### 5. Cached fuel

EIA publishes weekly, so a 7-day cache is honest. Prices display with their
period ("EIA weekly retail diesel, week of …"). Absent price renders as "price
unknown" — `cost-engine.ts:3` already establishes that no price is ever
invented.

---

## Synchronization

Sync covers **user data only**. Never position (AD-7).

| Data | Direction | Conflict rule |
|---|---|---|
| Saved trips | Bidirectional | `cloud-sync.ts` merge |
| Truck presets | Bidirectional | `cloud-sync.ts` merge |
| Driver reports | Upload only | Queued, retried |
| Session recovery | Local only | Not synced |

The merge discipline already exists in `cloud-sync.ts` and is reused verbatim:

- de-dup by stable client id; fall back to normalized name + coordinates;
- newest `updatedAt` wins **only** when identity is clearly the same item;
- genuinely distinct records are both preserved;
- **first sign-in never deletes local data** (union merge).

Queued driver reports flush on reconnect. Failure keeps them queued and **never
blocks navigation**.

---

## Storage limits

| Platform | Realistic budget |
|---|---|
| iOS Safari PWA | ~50 MB before eviction pressure; unreliable |
| Android Chrome PWA | ~6 % of free disk, commonly 500 MB+ |
| Capacitor (N13) | Effectively device storage |

**This asymmetry is a primary argument for Capacitor.** Meaningful tile caching
is not achievable on iOS Safari.

**Default budget: 250 MB**, user-adjustable 50 MB – 2 GB. Always show used vs
limit before a download.

`navigator.storage.persist()` is requested before the first cache; if denied,
offline still works but the browser may evict — and the user is told so.

---

## Eviction

Priority order — first evicted first:

1. Tiles for completed trips (> 24 h)
2. Weather snapshots > 6 h
3. Corridor slices for completed trips (> 24 h)
4. Routes for completed trips (> 24 h)
5. Tiles for the oldest cached upcoming trip
6. **Never: the active session's route, corridor, or tiles**

Triggers: quota error (evict until 20 % headroom) · trip completion + 24 h ·
manual "clear offline data" · budget lowered.

Rule: **the active route is never evicted, even under quota pressure.** If space
cannot be freed, decline the *new* download rather than break the current trip.

---

## Pre-trip download flow

```
Route preview
   │
   ▼  "Download for offline"
┌────────────────────────────────┐
│ Route + stops        1.2 MB    │
│ Parking (25 mi)      2.8 MB    │
│ Weather              0.1 MB    │
│ Maps (z8–z14)      178.0 MB    │  ← dominant
│ ─────────────────────────────  │
│ Total              182.1 MB    │
│ Available          412.0 MB    │
│  [ Download ]  [ Route only ]  │
└────────────────────────────────┘
```

"Route only" (≈ 4 MB) is offered prominently — it delivers full guidance, HOS,
parking and Last Legal Stop offline, and omits only the map imagery. For many
drivers that is the right trade, and it should not be buried.

Download is resumable, cancellable, and never blocks starting the trip online.

---

## Offline capability matrix

| Capability | Route only | Route + tiles | No cache |
|---|---|---|---|
| Turn-by-turn guidance | ✅ | ✅ | ❌ |
| Voice guidance | ✅ | ✅ | ❌ |
| HOS clocks | ✅ | ✅ | ✅ (pure) |
| Parking ahead | ✅ | ✅ | ❌ |
| Last Legal Stop | ✅ | ✅ | ❌ |
| Fuel stops | ✅ | ✅ | ❌ |
| Map imagery | ❌ grid | ✅ | ❌ |
| Weather | ✅ cached | ✅ cached | ❌ |
| Rerouting | ❌ | ❌ | ❌ |
| New destination | ❌ | ❌ | ❌ |

HOS works with no cache at all because `hos-engine` is pure and needs only the
driver's stated clocks.
