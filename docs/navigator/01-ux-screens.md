# 01 — Navigator UX & Screens

Design only. No implementation.

## Screen map

```
                        ┌───────────────┐
                        │ LAUNCH        │  permissions, resume prompt
                        └───────┬───────┘
                                ▼
                        ┌───────────────┐
              ┌────────▶│ TRIP SETUP    │  destination, truck, clocks
              │         └───────┬───────┘
              │                 ▼
              │         ┌───────────────┐
              │         │ ROUTE PREVIEW │  route, stops, cost, warnings
              │         └───────┬───────┘
              │                 │ Start
              │                 ▼
              │         ┌───────────────┐◀────────────┐
              │         │ DRIVING       │             │
              │         └───┬───┬───┬───┘             │
              │             │   │   │                 │
              │      ┌──────┘   │   └──────┐          │
              │      ▼          ▼          ▼          │
              │  ┌────────┐ ┌────────┐ ┌────────┐     │
              │  │PARKING │ │ FUEL   │ │ LEGAL  │─────┘  (sheets, dismissible)
              │  └────────┘ └────────┘ └────────┘
              │             │
              │             ▼ arrive
              │         ┌───────────────┐
              │         │ ARRIVAL       │
              │         └───────┬───────┘
              │                 ▼
              │         ┌───────────────┐
              └─────────│ TRIP SUMMARY  │  new trip
                        └───────────────┘

  Overlays (any screen): OFFLINE BANNER · ERROR STATE · PERMISSION DIALOG
```

**Rule:** only DRIVING and the three sheets are usable in motion. Everything
else is gated by `SafetyLockController` (see [06](./06-safety.md)).

---

## 1. Launch screen

First surface. Its whole job is to get to a usable state without asking for
anything it does not yet need.

**Contents**
- Large "Start a trip" primary action
- "Resume trip" card when an interrupted session exists (see
  [04](./04-state-management.md) §Session recovery)
- Saved trips list (from `saved_trips`, reusing `SavedTripsPanel`)
- Offline badge when the last sync is stale

**Permission policy:** location is **not** requested here. It is requested at
"Start" on the Route Preview screen, where the reason is obvious. Asking on
launch produces denials.

**States:** first-run (no saved trips) · returning · interrupted-session ·
offline.

## 2. Trip setup

**Contents**
- Destination input — `PlaceCombobox` (existing), merging directory anchors and
  HERE geocode results with `source`/`kind` badges so a driver can tell a
  verified truck stop from an arbitrary address
- Origin — defaults to current position ("Use my location"), overridable
- Truck profile selector — from `truck_presets`; shows height/weight/length/axles/hazmat
- HOS clocks — reuse the existing Trip Planner clock entry
- Optional: avoidances (tolls, ferries), departure time

**Validation before proceeding:** `validateTruckProfileForRouting()`
(`here-routing.ts:114`) rejects implausible profiles *before* a provider call is
spent. `validateClockState()` rejects impossible clock states.

**States:** empty · partial · validating · invalid-profile · invalid-clocks · ready.

## 3. Route preview

The last screen before motion, and therefore the last chance to show everything
at leisure.

**Contents**
- Map with full route polyline, origin/destination, planned stops
- Summary: distance, drive time, ETA, arrival day
- **Planned stops list** — each with kind (break / fuel / overnight), route-mile,
  arrival time, and the reason it exists ("30-minute break due at 8h")
- **Last Legal Stop slots** — the four named slots from `last-stop.ts`
- Cost estimate — `cost-engine.ts`; components with unknown inputs render as
  "unknown", never as a fabricated number
- Weather bands along the route
- **Warnings block** — HOS violations, unsupported-provision notices from
  `hos-exceptions.ts`, provider degradations
- **Route source badge** — "HERE truck route" or "Estimated route". If
  estimated, the **Start** button is disabled for turn-by-turn (AD-8) and
  offers "Preview only".

**Primary action:** Start navigation → requests location permission → DRIVING.

**States:** loading · live-route · estimated-route (guidance disabled) ·
unroutable · provider-degraded · offline-cached.

## 4. Driving screen

```
┌─────────────────────────────────────────────┐
│ ⬆  In 1.2 mi                                │  MANEUVER CARD
│    Take exit 369 toward Watt Rd              │  ≥ 30% of viewport height
│    then Right onto Watt Rd                   │  next-maneuver preview
├─────────────────────────────────────────────┤
│                                             │
│              [ MAP ]                        │  heading-up, position centred
│      route · own position · next 3 stops     │  lower third of route visible
│                                             │
├─────────────────────────────────────────────┤
│  DRIVE 6:42 ▓▓▓▓▓▓░░░  ON-DUTY 9:15         │  HOS STRIP (permanent)
│  ⚠ Break required in 1:48                    │
├─────────────────────────────────────────────┤
│ ETA 4:35p │ 187 mi │ 3:12 │ 62 mph          │  STATUS STRIP
├─────────────────────────────────────────────┤
│  [ P PARKING ]  [ ⛽ FUEL ]  [ ⏱ LEGAL ]      │  ONE-TOUCH BAR
└─────────────────────────────────────────────┘
```

**Non-negotiable layout rules**
- Maneuver card is the largest element and never scrolls out of view.
- HOS strip is permanent. This is the product's differentiator: no consumer
  truck GPS shows the driver's own clocks against the route, and TLWS already
  computes them exactly.
- Exactly three one-touch targets, each ≥ 64 px tall, bottom-anchored for thumb
  reach.
- Minimum type size 20 px; maneuver text 32 px+.
- Contrast ≥ 7:1 (day) and a true dark mode for night.
- **No text input exists on this screen at all.**

**Elements**

| Element | Source | Update |
|---|---|---|
| Maneuver card | `ManeuverEngine` | 1 Hz |
| Upcoming turn preview | `ManeuverEngine.next` | 1 Hz |
| Map position | `GPSSessionManager` | 1 Hz |
| Route line | cached route | static per route |
| ETA | `RouteTracker` + `hos-engine` | 60 s |
| Arrival countdown | derived from ETA | 60 s |
| Remaining distance | `RouteTracker.remainingMiles()` | 1 Hz |
| Remaining drive time | `remainingClocks().driveMin` | 60 s |
| Remaining on-duty | `remainingClocks().windowMin` | 60 s |
| Current speed | fix `coords.speed`, else derived | 1 Hz |
| Weather banner | `nws-weather` cache | on progress |

**States:** navigating · rerouting · off-route · position-lost · position-degraded ·
tunnel (dead-reckoning) · offline · arrived · paused.

## 5. Parking panel (sheet)

Slides over the driving screen; the maneuver card stays visible above it.

- Ranked by `rankCandidates`, filtered by `hasConfirmedTruckParking`
- Ordered by **route-mile ahead**, never crow-flies distance
- Each card: name · exit · miles ahead · detour minutes · confirmed space count ·
  overnight chip (`Overnight confirmed` / `Overnight prohibited` /
  `Overnight unknown` — all three stated explicitly, per
  `src/lib/directory/overnight.ts`)
- Rows without a positive space count **never appear** — the zero-space rule is
  a filter, not a ranking penalty
- Actions: "Add as stop" (re-plans), "Navigate here" (changes destination —
  **stationary only**)

**States:** results · none-ahead · offline-cached (with cache age) · loading.

## 6. Fuel panel (sheet)

- `recommendFuelStops` output, range ring rendered on the map
- Price per gallon from `eia-fuel.ts`, attributed ("EIA weekly retail diesel,
  week of …"); **absent price renders as "price unknown", never as a guess**
- Sorted by route-mile; shows gallons needed to reach each

**States:** results · out-of-range-warning · price-unknown · offline · loading.

## 7. Last Legal Stop panel (sheet)

Renders `last-stop.ts` directly and makes its safety invariant literal.

- Four slots: `best-reservable`, `last-reservable`, `backup-reservable`, `last-free`
- Each: name · route-mile · projected arrival · minutes of margin against the
  binding clock
- **Explains the reasoning in plain language** — e.g. "your drive to this stop
  crosses the 8-hour break clock, so the required 30-minute break burns your
  14-hour window on the way" (the trap `last-stop.ts:10` documents)
- Unreachable stops are **absent**, not greyed — reachability is a filter, so
  commission can never outrank safety by construction

**States:** slots-available · no-reachable-stop (escalates to a critical
warning) · offline.

## 8. Weather panel

- Bands and alerts from `nws-weather.ts`, keyed to route-mile
- Only `warning` severity may interrupt the driver; `advisory`/`watch` render
  passively in the banner
- **Always displays data age.** Stale weather shown as current is a safety
  defect ([07](./07-offline.md))

**States:** clear · advisory · watch · warning · stale · unavailable.

## 9. HOS panel

Expanded view of the permanent strip; stationary-only.

- Full clock breakdown: 11-hour drive, 14-hour window, 30-minute break,
  60/7 or 70/8 cycle
- Recap projection (`hos-exceptions.ts` `recapProjection`)
- Split-sleeper eligibility (`assessSplitSleeper`) when stopping
- Unsupported provisions surfaced as data with citation and conservative
  guidance — never silence (`hos-exceptions.ts:8`)
- **Disclaimer, permanent:** planning mode only; not an ELD; produces no record
  of duty status (`hos-engine.ts:14`)

## 10. Arrival screen

Triggered at < 150 m and < 5 mph for 10 s.

- "Arrived" confirmation, guidance stops, voice silences
- Destination name and address
- Actual vs estimated arrival
- Prompt: end trip · continue to another stop

## 11. Trip summary

- Distance, duration, stops taken
- HOS state at arrival, time remaining on each clock
- Cost estimate (`cost-engine.ts`), unknown components shown as unknown
- Actions: save as favourite (`saved_trips`), report a stop, start a new trip
- **No route trace is stored** (AD-7)

## 12. Offline mode

Not a separate screen — a persistent banner plus per-panel degradation.

| Surface | Offline behaviour |
|---|---|
| Driving screen | Full guidance along the cached route |
| Map | Cached tiles only; uncached areas render as a neutral grid, never blank |
| Parking | Cached corridor slice, banner shows cache age |
| Fuel | Cached stops; prices marked stale |
| Weather | Cached snapshot with prominent age; suppressed if older than 6 h |
| Reroute | **Unavailable.** Banner: "Off route — reconnect to reroute" |
| Destination change | Unavailable |

## 13. Error states

| Error | Presentation | Recovery |
|---|---|---|
| No route found | Route preview blocking state | Adjust profile/destination |
| Truck profile implausible | Inline on setup, per field | Fix field |
| Invalid clock state | Inline, lists each problem | Fix clocks |
| Provider degraded (HERE null) | Preview banner "Estimated route" | Guidance disabled (AD-8) |
| Weather unavailable | Panel shows "unavailable" | Non-blocking |
| Fuel price unknown | "Price unknown" | Non-blocking |
| Rate limited | "Too many requests, retrying" + backoff | Automatic |
| Reroute budget exhausted | "Off route — navigation paused" | Manual resume |
| GPS permission denied | Blocking on start; **UI stays locked** | Settings deep-link |
| GPS lost > 10 s | "Position unknown", guidance mutes | Auto-recovers |
| GPS accuracy > 50 m | "Position approximate" | Auto-recovers |
| Storage quota exceeded | Cache prompt with size breakdown | Evict or decline |
| Session crash | Resume card on launch | Resume or discard |

**Universal rule:** an error never silently degrades a safety-relevant claim. If
Navigator cannot confirm something, it says so — the same discipline the
overnight-status model already uses.

## 14. Permission dialogs

| Permission | When asked | If denied |
|---|---|---|
| Location | On "Start navigation", not on launch | Navigation cannot start; UI **stays locked** (fail-safe); route preview still usable |
| Notifications | Never in v1 | — |
| Microphone | Only if PTT ships (N15) | PTT unavailable; everything else unaffected |
| Storage / persistence | Before first offline cache, with size estimate | Offline unavailable; online navigation unaffected |
| Wake lock | Implicit at navigation start | Screen may sleep; warn once |

Each dialog is preceded by a plain-language rationale screen explaining what is
used and what is **not** stored (AD-7).

## Mobile

Web/PWA first, Capacitor second, never React Native (AD-5). The driving screen
is designed for a phone in a dash mount at 390 px wide; all layouts must hold at
320 px. Landscape is supported but the maneuver card keeps priority.
