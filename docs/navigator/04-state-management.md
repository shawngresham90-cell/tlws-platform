# 04 — State Management

Design only.

## Principle

**One owner per state domain. One writer. Many readers.**

`NavigationController` is the only module that mutates session state. Everything
else is pure, or observes. This is what makes the whole system replayable in
tests ([09](./09-testing.md)) and is why the existing planner core can be reused
untouched.

## Top-level shape

```ts
type NavigationState = {
  phase: 'idle' | 'preview' | 'navigating' | 'rerouting' | 'arrived' | 'paused';
  session: NavigationSession | null;
  position: PositionState;
  progress: ProgressState;
  maneuvers: ManeuverState;
  clocks: HosState;
  panels: PanelCaches;
  offline: OfflineState;
  lock: LockState;
  errors: ErrorState[];
};
```

Immutable snapshots. Subscribers receive a new object per tick; components
select the slice they need (see the rendering discipline in
[02](./02-component-inventory.md)).

---

## 1. Navigation session

```ts
type NavigationSession = {
  id: string;                    // client-generated, stable
  createdAtMs: number;
  origin: PlaceRef;
  destination: PlaceRef;
  waypoints: PlaceRef[];
  truck: TruckProfile;           // frozen at start
  route: Route;                  // HERE geometry — never an estimate (AD-8)
  routePoints: RoutePoint[];     // cumulative route-mile
  maneuvers: Maneuver[];
  plannedStops: PlannedStop[];
  departedAtMs: number;
  routeProvider: string;         // 'here' — gates guidance
  rerouteCount: number;
};
```

**Frozen at start:** truck profile and destination. Changing either mid-trip
invalidates the route (different truck → different legal roads) and forces a new
session. This is enforced, not advisory.

### Session lifecycle

```
idle ──start()──▶ preview ──confirm()──▶ navigating
                                            │  │
                        reroute() ──────────┘  │
                             ▼                 │
                        rerouting ─────────────┘
                                            │
                              arrive() ────▶ arrived ──▶ idle
                                            │
                              pause() ────▶ paused ──resume()──▶ navigating
```

### Session recovery

Persisted to IndexedDB on every phase change and every 60 s while navigating
(not at 1 Hz — that would thrash storage). On launch, a session younger than
12 h with unreached destination offers "Resume trip".

**Recovery restores route, stops, and clocks. It does not restore position** —
position is re-acquired from GPS (AD-7: no position history).

---

## 2. GPS session

```ts
type PositionState = {
  fix: PositionFix | null;       // latest gated fix
  health: 'good' | 'degraded' | 'lost' | 'denied' | 'unavailable';
  lastFixMs: number;
  accuracyM: number;
  speedMph: number | null;
  headingDeg: number | null;
  deadReckoning: boolean;
};
```

Owned solely by `GPSSessionManager`. Gates applied before anything downstream
sees a fix:

| Gate | Rule | Result |
|---|---|---|
| Accuracy | `accuracy > 50 m` | Discard; hold last good; `degraded` |
| Staleness | no fix for > 10 s | `lost`; guidance mutes |
| Speed | prefer `coords.speed`; else derive from consecutive fixes | never from one fix |
| Jump | implies > 100 mph | Discard as spurious |
| Dead reckoning | `lost` and previously on-route | Advance along polyline at last speed, max 60 s, flagged |

**In memory only.** No fix is ever persisted (AD-7).

---

## 3. Route progress

```ts
type ProgressState = {
  routeMile: number;             // monotonic, smoothed
  remainingMi: number;
  offRouteM: number;
  bearingDeltaDeg: number;
  confidence: 'high' | 'low';
  etaMs: number;
  arrivalCountdownMin: number;
};
```

`routeMile` is **monotonic by construction** — `RouteTracker` never lets it move
backwards, which is what protects against back-projection at cloverleafs and
self-intersecting routes.

---

## 4. Reroute state

```ts
type RerouteState = {
  verdict: 'on-route' | 'candidate' | 'confirmed';
  consecutiveOffFixes: number;
  rerouteCount: number;
  lastRerouteMs: number;
  budgetExhausted: boolean;
  cooldownUntilMs: number;
};
```

Budget: **6 reroutes/hour**, exponential backoff (30 s, 60 s, 120 s …). On
exhaustion the phase does **not** fail — Navigator continues on the stale route
and shows "Off route — navigation paused". Honest and cheap beats a retry storm
against a metered provider.

---

## 5–7. Panel caches (parking, weather, fuel)

```ts
type PanelCaches = {
  parking: Cached<StopCandidate[]>;
  fuel:    Cached<StopCandidate[]>;
  weather: Cached<{ bands: WeatherBand[]; alerts: WeatherAlert[] }>;
  lastLegalStop: Cached<LastStopSlot[]>;
};

type Cached<T> = {
  data: T;
  fetchedAtMs: number;
  computedAtMile: number;
  source: 'network' | 'offline-cache';
  stale: boolean;
};
```

**Every cache carries `fetchedAtMs` and a `stale` flag, and every panel renders
its age.** Weather is the acute case: stale weather presented as current is a
safety defect, not a UX blemish.

| Cache | Recompute trigger | Stale after |
|---|---|---|
| Parking | every 5 route-miles | 30 min |
| Fuel | every 5 route-miles | 60 min |
| Last Legal Stop | every 5 route-miles **or** any clock change | 15 min |
| Weather | every 50 route-miles | 60 min; **suppressed** > 6 h |

Recompute is **pure** where possible: `recommendParking`, `recommendFuelStops`
and `selectLastStops` all run client-side against the cached corridor slice. A
network call is needed only to *extend* the corridor.

---

## 8. HOS state

```ts
type HosState = {
  clockState: ClockState;        // the engine's own type, unchanged
  remaining: RemainingClocks;
  nextRequiredAction: { kind: 'break' | 'reset' | 'none'; inMinutes: number };
  violations: HosViolation[];
  splitEligible: boolean;
};
```

Advanced client-side by `hos-engine.advance()` every 60 s. **This works only
because the engine is pure and takes time as a parameter** — the property
`types.ts:3` establishes.

**Driver-stated, not measured.** Navigator does not observe duty status; it
projects from what the driver entered. The disclaimer from `hos-engine.ts:14`
(planning mode, not an ELD, no record of duty status) is permanent UI, not a
footnote.

---

## 9. UI state

```ts
type UiState = {
  activePanel: 'none' | 'parking' | 'fuel' | 'legal' | 'weather' | 'hos';
  mapMode: 'heading-up' | 'north-up' | 'overview';
  followPosition: boolean;
  voiceMuted: boolean;
  nightMode: boolean;
  overrideExpiresMs: number | null;
};
```

Ephemeral, not persisted, except `voiceMuted` and `nightMode` (device
preferences).

---

## 10. Offline & synchronization

```ts
type OfflineState = {
  online: boolean;
  cachedRouteIds: string[];
  corridorCached: boolean;
  tilesCached: boolean;
  storageUsedMb: number;
  storageLimitMb: number;
  pendingSync: PendingItem[];
};
```

**Sync applies only to user data** — saved trips, truck presets, driver reports.
Never to position.

The merge discipline already exists in `cloud-sync.ts` and is reused verbatim:
de-dup by stable client id, fall back to normalized name + coordinates,
newest-wins **only** when identity is clearly the same, genuinely distinct
records both preserved, first sign-in never deletes local data.

Queued driver reports submit on reconnect; failure keeps them queued and never
blocks navigation.

---

## State flow — one tick

```
                    ┌──────────────────┐
                    │  GPS hardware     │
                    └────────┬─────────┘
                             ▼
                  ┌────────────────────┐
                  │ GPSSessionManager  │  gates: accuracy, staleness, jump
                  └────────┬───────────┘
                           ▼ PositionFix
                  ┌────────────────────┐
                  │ NavigationController│ ◀── the ONLY writer
                  └───┬────┬────┬──────┘
          ┌───────────┘    │    └───────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
   │ RouteTracker│  │ManeuverEngine│ │SafetyLock    │
   │  (pure)     │  │  (pure)      │ │  (pure)      │
   └──────┬──────┘  └──────┬───────┘ └──────┬───────┘
          │                │                │
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
   │OffRoute     │  │VoiceGuidance│  │  LockGate    │
   │Detector     │  │  (effect)   │  │  (render)    │
   └──────┬──────┘  └─────────────┘  └──────────────┘
          │ confirmed
          ▼
   ┌─────────────┐
   │ reroute req │──▶ NavigationController (budget-checked)
   └─────────────┘

   Every 60 s:  hos-engine.advance()  ──▶ HosState
   Every 5 mi:  recommendParking / recommendFuelStops / selectLastStops
   Every 50 mi: weather refresh (network)
```

Boxes marked **(pure)** contain no I/O and no clock read — they are the units
that replay tests exercise directly.

## Persistence summary

| State | Where | Why |
|---|---|---|
| Session (route, stops, clocks) | IndexedDB | Crash recovery |
| Saved trips, truck presets | `saved_trips`, `truck_presets` + local | Cross-device |
| Corridor slice, tiles, weather snapshot | IndexedDB / Cache Storage | Offline |
| Voice mute, night mode | localStorage | Preference |
| **Position, speed, heading, route trace** | **Nowhere** | AD-7 |
| **Override grants** | **Memory only** | Must not survive a restart |
