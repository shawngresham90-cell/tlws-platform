# 05 — Navigation Engine

Architecture only. No implementation.

## Cadence table

Everything in the engine runs on one of five clocks. Getting these wrong is the
difference between an 11-hour battery and a 3-hour one.

| Loop | Frequency | Cost | Owner |
|---|---|---|---|
| GPS / position | **1 Hz** | CPU only | `GPSSessionManager` |
| Maneuver evaluation | **1 Hz** | pure, trivial | `ManeuverEngine` |
| Off-route evaluation | **1 Hz** | pure, trivial | `OffRouteDetector` |
| Safety lock evaluation | **1 Hz** | pure, trivial | `SafetyLockController` |
| HOS advance | **60 s** | pure | `hos-engine` |
| Panel recompute | **every 5 route-miles** | pure, over cached slice | controller |
| Weather refresh | **every 50 route-miles** | **network** | `TrafficManager`/weather |
| Reroute | **event-driven, budgeted** | **network + metered** | controller |
| Session persist | **60 s + phase change** | IndexedDB write | controller |

Only two loops touch the network. That is deliberate.

---

## 1. GPS update loop

```
watchPosition({ enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 })
        │
        ▼
  ┌──────────────────────────────────────────┐
  │ 1. accuracy > 50 m       → discard, degraded
  │ 2. implied speed > 100 mph → discard, spurious
  │ 3. age > 10 s            → health = lost
  │ 4. speed: coords.speed ?? derive(prev, cur)
  │ 5. heading: coords.heading ?? bearing(prev, cur)
  └──────────────────┬───────────────────────┘
                     ▼
              emit PositionFix
```

**Dead reckoning.** On `lost` while previously on-route, advance `routeMile`
along the polyline at last known speed for **up to 60 s**, flagged
`deadReckoning: true` and surfaced in the UI. Beyond 60 s, guidance mutes and the
map shows last known position. Navigator never silently pretends to know where
the truck is.

**Permission denied** → `health: 'denied'`, navigation cannot start, and the
safety lock **stays engaged** (fail-safe — see [06](./06-safety.md)).

---

## 2. Route progress

`RouteTracker.update(fix)` wraps the existing
`directory-layer.projectOntoRoute` and adds statefulness for one reason only:
**monotonic smoothing**.

```
candidateMile = projectOntoRoute(fix, routePoints)

if candidateMile < lastMile - TOLERANCE_MI (0.15):
    // Back-projection. Two causes:
    //  (a) self-intersecting geometry (cloverleaf) — reject
    //  (b) genuine reversal (driver backed up / U-turn) — accept only after
    //      3 consecutive consistent fixes
    hold lastMile, increment backwardCount
else:
    lastMile = candidateMile, backwardCount = 0
```

Without this, a cloverleaf ramp that passes under the mainline can snap position
2 miles backwards and re-fire a maneuver announcement.

**Outputs:** `routeMile`, `remainingMi`, `offRouteM`, `bearingDeltaDeg`,
`confidence`.

**ETA** = remaining drive time from `hos-engine.planDrive()` over remaining
distance, **including required rest**. This is the differentiator: Navigator's
ETA is HOS-aware, so it answers "when will I actually get there, legally" rather
than "when would I arrive if I never stopped."

---

## 3. Maneuver timing

Announcement thresholds scale with speed, because a fixed distance is wrong at
both ends of the range.

| Trigger | Speed ≥ 50 mph | Speed < 50 mph |
|---|---|---|
| Prepare | 2.0 mi | 0.5 mi |
| Approach | 0.5 mi | 0.15 mi |
| Execute | 0.1 mi | 200 ft |

```
for each maneuver ahead:
    d = maneuver.routeMile - currentMile
    if d <= threshold[tier] and not fired[maneuver.id][tier]:
        fired[maneuver.id][tier] = true
        emit announcement(tier, maneuver)
```

**Fired-flags are per (maneuver, tier)** and never reset. Combined with
monotonic `routeMile`, this makes double-announcement structurally impossible —
the failure mode every driver notices and hates.

**Chained maneuvers.** When two maneuvers fall within the prepare threshold of
each other ("take the exit, then turn right"), they are announced as one
combined instruction and the second maneuver's prepare tier is suppressed.

---

## 4. Reroute algorithm

### Off-route detection

```
CANDIDATE  when offRouteM > 75 for 4 consecutive fixes
CONFIRMED  when CANDIDATE
           and |bearingDelta| > 45°
           and distance to every planned stop > 150 m
           and confidence == 'high'          (never reroute on a degraded fix)
```

The planned-stop exclusion is essential: pulling into a truck stop **is**
leaving the route line, and must never trigger a reroute.

### Reroute execution

```
on CONFIRMED:
  1. budget check — rerouteCount < 6 in trailing hour, else PAUSE
  2. cooldown check — now > cooldownUntilMs, else defer
  3. phase = 'rerouting'; keep old route rendered (never blank the map)
  4. POST /api/navigator/route  (current position → unchanged destination,
                                 remaining waypoints preserved, same truck)
  5. on success: swap route, recompute stops via optimizer.replanFrom(),
                 reset trackers, announce "New route"
  6. on failure: exponential backoff (30 s → 60 s → 120 s), stay on old route
  7. rerouteCount++, cooldownUntilMs = now + backoff
```

**Offline** → step 4 fails immediately (AD-6). Banner: "Off route — reconnect to
reroute." Guidance continues along the stale route, which is still better than
nothing because the driver can see where they left it.

**Destination is never changed by a reroute.** Only the path to it changes.

---

## 5. Parking refresh

Every 5 route-miles, **pure and local**:

```
candidates = cachedCorridorSlice
  |> toStopCandidates(routePoints)      // drops rows without coordinates
  |> filter(hasConfirmedTruckParking)   // ZERO-SPACE SAFETY RULE
  |> filter(routeMile > currentMile)    // ahead only
  |> rankCandidates(need='parking', clocks)
```

No network unless the corridor slice needs extending (driver has progressed
beyond the cached window, or rerouted onto new roads).

The zero-space rule is a **filter, not a weight** — `hasConfirmedTruckParking`
requires a finite positive count. Null and zero both mean "not confirmed
parkable" and can never be recommended.

## 6. Last Legal Stop refresh

Recomputed on the same 5-mile cadence **and immediately on any clock change**
(driver logs a break, changes duty status).

`selectLastStops()` is reused unchanged. Its safety invariant holds by
construction: reachability is a filter, never a score weight, so a stop that
cannot be reached within `min(11-hour driving, 14-hour window)` minus the safety
buffer **cannot appear in any slot**, regardless of commercial ranking.

If no slot is reachable, that is a **critical** escalation — voice-announced,
not a passive banner.

## 7. Fuel refresh

Every 5 route-miles: `recommendFuelStops` over the cached slice, with the range
ring computed from `truck.mpg` and remaining fuel. Price comes from the cached
EIA figure; when absent the UI says "price unknown" rather than guessing
(`cost-engine.ts:3` — no price is ever invented).

## 8. Weather refresh

Every 50 route-miles, network:

```
POST /api/navigator/weather-refresh { routePointsAhead, departureAdjustedTime }
→ { bands, alerts, fetchedAtMs }
```

Only `warning` severity may interrupt the driver. `advisory` and `watch` update
the banner passively. **Age is always displayed**, and a snapshot older than 6 h
is suppressed entirely rather than shown stale.

## 9. HOS refresh

Every 60 s:

```
clockState = hos-engine.advance(clockState, elapsedMin, dutyStatus='driving')
remaining  = remainingClocks(clockState)
next       = nextRequiredAction(remaining)
```

Runs **client-side**, offline-capable, because the engine is pure. Crossing a
threshold (30-min break due, 11-hour or 14-hour exhaustion approaching) triggers
a `critical` voice announcement and escalates the Last Legal Stop panel.

---

## Arrival & completion

```
ARRIVAL when  distanceToDestination < 150 m
        and   speed < 5 mph sustained 10 s
```

On arrival: guidance stops, voice silences, wake lock releases, phase →
`arrived`, arrival screen renders.

On trip completion: summary written to `saved_trips` (`last_planned_at`),
session cache evicted after 24 h, **session destroyed with no position history
retained** (AD-7).

## Failure-mode summary

| Condition | Engine behaviour |
|---|---|
| GPS lost < 60 s | Dead-reckon, flagged |
| GPS lost > 60 s | Mute guidance, show last position |
| GPS denied | Cannot start; lock stays engaged |
| Accuracy > 50 m | Discard fix, `degraded`, no reroute decisions |
| Off-route, online | Reroute within budget |
| Off-route, offline | Pause guidance, keep route |
| Reroute budget spent | Pause guidance, honest banner |
| Route provider returns null | **Guidance never starts** (AD-8) |
| Weather unavailable | Panel shows unavailable; navigation unaffected |
| Fuel price unavailable | "Price unknown"; navigation unaffected |
| Corridor cache miss | Panels show "extend coverage"; navigation unaffected |
| Storage full | Offline caching declines; online navigation unaffected |

**Every degradation is announced, none is silent.** That principle is inherited
from the overnight-status model, where "unknown" is stated out loud rather than
hidden.
