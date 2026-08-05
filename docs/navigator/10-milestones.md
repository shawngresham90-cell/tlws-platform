# 10 — Milestone Plan

Design only. Every milestone is independently mergeable and independently
useful. None requires a migration, a Supabase change, or a deployment decision
unless explicitly stated.

## Ordering constraint

**N4 (safety lock) ships before N5 (driving screen).** Non-negotiable. A screen
designed for use in motion must not exist before the mechanism that governs use
in motion. Retrofitting produces per-component checks that rot.

## Dependency graph

```
N0 ─┬─▶ N1 ─────────────┬─▶ N5 ─┬─▶ N6
    ├─▶ N2 ─▶ N3 ─┬─────┘       ├─▶ N7 ──▶ N15*
    │             │             ├─▶ N8 ──▶ N14*
    └─────────────┴─▶ N4 ───────┘  │
                                   └─▶ N9 ─▶ N10
                                        │
                                        └─▶ N11 ─▶ N12* ─▶ N13*
                              * = blocked on a decision (see §Blocked)
```

---

## N0 — Scaffold & purity gate

| | |
|---|---|
| **Objective** | Create the empty Navigator structure and lock in the purity rule before any code exists to violate it |
| **Files** | `src/lib/navigator/{types,ports}.ts` (types only) · `src/app/(navigator)/layout.tsx` · `scripts/test-navigator-purity.ts` |
| **Dependencies** | None |
| **Complexity** | **XS** |
| **Merge risk** | **None** — no runtime behaviour |
| **Rollback** | Delete the directory |
| **Tests** | `test-navigator-purity.ts` — no React/`next`/`fetch` under `src/lib/navigator/` |

Ships first so every later PR is measured against it.

## N1 — Maneuver data plumb-through

| | |
|---|---|
| **Objective** | Extend the HERE parse to retain full maneuver objects, not just instruction text |
| **Files** | `src/lib/trip-planner/here-routing.ts` (extend `parseHereResponse`, add `Maneuver` type) · `scripts/test-here-maneuvers.ts` |
| **Dependencies** | N0 |
| **Complexity** | **S** |
| **Merge risk** | **Low-medium** — touches a production file the Trip Planner depends on |
| **Rollback** | Revert; the added field is purely additive |
| **Tests** | Fixture-based parse tests; malformed input still returns `null`; **existing `test-trip-planner*.ts` must stay green unchanged** |

**Risk control:** the new data is additive — a new `maneuvers` field alongside
the existing `instructions`. `composeQuote` behaviour must not change. The
existing planner tests passing unmodified is the acceptance criterion.

## N2 — GPSSessionManager

| | |
|---|---|
| **Objective** | The single `watchPosition` owner, with gating. Position display only — no guidance |
| **Files** | `src/lib/navigator/gps-session.ts` · `src/components/navigator/GpsProvider.tsx` · `scripts/test-gps-session.ts` |
| **Dependencies** | N0 |
| **Complexity** | **S** |
| **Merge risk** | **Low** — new surface, nothing existing touched |
| **Rollback** | Remove the provider |
| **Tests** | Gate tests via synthetic fix streams; `test-gps-simulation.ts` generators |

## N3 — RouteTracker

| | |
|---|---|
| **Objective** | Project position onto a route; monotonic route-mile |
| **Files** | `src/lib/navigator/route-tracker.ts` · `scripts/test-route-tracker.ts` · first replay fixtures |
| **Dependencies** | N2 |
| **Complexity** | **S** |
| **Merge risk** | **Low** — pure, wraps existing `projectOntoRoute` |
| **Rollback** | Remove module |
| **Tests** | Cloverleaf back-projection; genuine reversal; replay traces |

## N4 — SafetyLockController + LockGate ⚠ **gate milestone**

| | |
|---|---|
| **Objective** | Motion lock state machine and global enforcement, before any driving UI exists |
| **Files** | `src/lib/navigator/safety-lock.ts` · `src/lib/navigator/actions.ts` (the `UIAction` map) · `src/components/navigator/{SafetyLockProvider,LockGate,MotionLockOverlay,PassengerOverrideDialog}.tsx` · `scripts/test-safety-lock.ts` · `scripts/test-safety-gating.ts` · `scripts/test-safety-invariants.ts` |
| **Dependencies** | N2 |
| **Complexity** | **M** |
| **Merge risk** | **Medium** — the correctness bar is absolute even though the surface is new |
| **Rollback** | Remove provider; no other module depends on it yet |
| **Tests** | **Merge-blocking.** 100 % branch coverage on the controller. All seven invariants from [06](./06-safety.md) §7 |

**This is the most important milestone in the plan.** Everything after it is
built inside a lock that already works.

## N5 — Driving screen + ManeuverEngine (visual only)

| | |
|---|---|
| **Objective** | The driving screen with visual guidance. No voice yet |
| **Files** | `src/lib/navigator/{maneuver-engine,navigation-controller}.ts` · `src/components/navigator/{DrivingScreen,ManeuverCard,ManeuverIcon,NavMap,StatusStrip,OneTouchBar}.tsx` · `src/app/(navigator)/drive/page.tsx` · `scripts/test-maneuver-engine.ts` · `scripts/test-navigator-responsive.ts` |
| **Dependencies** | N1, N3, **N4** |
| **Complexity** | **M** |
| **Merge risk** | **Medium** — first user-facing navigation surface |
| **Rollback** | Route-level feature flag; remove the route |
| **Tests** | Announcement-once; responsive at 320/375/390/428; every interactive element wrapped in `LockGate` |

Ship behind a flag (`NEXT_PUBLIC_NAVIGATOR_ENABLED`), mirroring the existing
`NEXT_PUBLIC_TPC_PLANNER_ENABLED` pattern.

## N6 — HOS strip live tick

| | |
|---|---|
| **Objective** | The permanent HOS countdown — the product differentiator |
| **Files** | `src/components/navigator/{HosStrip,HosWarningLine}.tsx` · controller tick wiring · `scripts/test-navigator-hos-integration.ts` |
| **Dependencies** | N5 |
| **Complexity** | **S** |
| **Merge risk** | **Low** — reuses `hos-engine` unchanged |
| **Rollback** | Hide the strip |
| **Tests** | 60 s cadence; threshold escalation; existing HOS harnesses stay green |

## N7 — VoiceGuidance

| | |
|---|---|
| **Objective** | Spoken maneuvers and critical alerts |
| **Files** | `src/lib/navigator/voice-guidance.ts` · `src/components/navigator/VoiceControls.tsx` · `scripts/test-voice-guidance.ts` |
| **Dependencies** | N5 |
| **Complexity** | **M** |
| **Merge risk** | **Low** — degrades silently where unsupported |
| **Rollback** | Force-mute flag |
| **Tests** | Priority preemption; passive drop; no double-speak; unavailable path |

## N8 — OffRouteDetector + rerouting

| | |
|---|---|
| **Objective** | Detect leaving the route and re-route within budget |
| **Files** | `src/lib/navigator/off-route-detector.ts` · `src/app/api/navigator/route/route.ts` (**NEW-1**) · controller reroute path · `scripts/test-offroute-detector.ts` · `scripts/test-navigator-reroute.ts` · replay fixtures |
| **Dependencies** | N3, N5 |
| **Complexity** | **L** |
| **Merge risk** | **Medium-high** — first metered-provider spend on a new endpoint |
| **Rollback** | Feature flag disables reroute; detection can stay on in observe-only mode |
| **Tests** | `truckstop-pullin` replay asserts **0 reroutes**; budget cap; backoff; offline fails cleanly |

**Recommended:** ship detection in observe-only mode first (log the verdict,
never call the API), validate against real traces, then enable the reroute call.
That splits the risk across two merges without splitting the milestone.

## N9 — Parking / Fuel / Last Legal Stop panels

| | |
|---|---|
| **Objective** | Surface the directory, the zero-space rule and the LLS slots while driving |
| **Files** | `src/app/api/navigator/corridor/route.ts` (**NEW-2**) · `src/components/navigator/{PanelSheet,ParkingPanel,ParkingCard,OvernightChip,SpaceCountBadge,FuelPanel,FuelPriceTag,LastLegalStopPanel,SlotCard,NoReachableStopWarning}.tsx` · `scripts/test-navigator-panels.ts` |
| **Dependencies** | N5 |
| **Complexity** | **M** |
| **Merge risk** | **Low** — reuses `recommendParking`, `recommendFuelStops`, `selectLastStops` unchanged |
| **Rollback** | Hide panels; one-touch bar degrades to fewer buttons |
| **Tests** | Zero-space filter; all three overnight states render; unreachable slots absent, not greyed |

## N10 — Weather refresh on progress

| | |
|---|---|
| **Objective** | Keep weather current as the truck moves; always show age |
| **Files** | `src/app/api/navigator/weather-refresh/route.ts` (**NEW-3**) · `src/components/navigator/{WeatherBanner,WeatherPanel,CacheAgeLabel}.tsx` |
| **Dependencies** | N9 |
| **Complexity** | **S** |
| **Merge risk** | **Low** — fail-soft, reuses `nws-weather.ts` |
| **Rollback** | Fall back to the single quote-time fetch |
| **Tests** | Age display; 6 h suppression; only `warning` interrupts |

## N11 — OfflineManager (route + parking)

| | |
|---|---|
| **Objective** | Guidance and panels work with no network |
| **Files** | `src/lib/navigator/offline-manager.ts` · `src/components/navigator/{OfflineBanner,CachePrompt,StorageBudgetBar}.tsx` · `scripts/test-offline-manager.ts` · `scripts/test-navigator-offline.ts` |
| **Dependencies** | N3, N9 |
| **Complexity** | **L** |
| **Merge risk** | **Medium** — storage APIs vary by platform |
| **Rollback** | Disable caching; online navigation unaffected |
| **Tests** | Round-trip; overnight provenance survives byte-identically; eviction never touches the active route; quota exhaustion |

## N12 — Tile caching ⚠ **blocked**

| | |
|---|---|
| **Objective** | Cached map imagery |
| **Dependencies** | N11 |
| **Complexity** | **L** |
| **Merge risk** | **Medium** |
| **Blocked on** | **Tile provider choice and its caching licence.** Many providers prohibit bulk pre-caching |
| **Rollback** | Disable; neutral grid renders instead |
| **Tests** | Budget enforcement; consent flow; grid fallback |

## N13 — Capacitor shell ⚠ **blocked**

| | |
|---|---|
| **Objective** | Background GPS and real storage headroom |
| **Files** | `capacitor.config.ts` · native adapters for `GPSSessionManager`, `OfflineManager`, `VoiceGuidance` |
| **Dependencies** | N2–N11 |
| **Complexity** | **XL** |
| **Merge risk** | **High** — new build target, app-store review, platform divergence |
| **Blocked on** | **Your go/no-go.** Best decided after N5–N7 produce real driving feedback |
| **Rollback** | Web build is unaffected; the shell is additive |
| **Tests** | Device matrix; background-survival; the pure core's tests run unchanged |

Only three adapters are needed because AD-2 kept the core platform-agnostic.

## N14 — TrafficManager ⚠ **blocked**

| | |
|---|---|
| **Objective** | Traffic incidents along route |
| **Dependencies** | N8 |
| **Complexity** | **M** |
| **Blocked on** | **Provider decision** (commercial) |
| **Rollback** | Null port → empty array; Navigator proceeds |
| **Tests** | Null-port test proves graceful absence |

## N15 — Push-to-talk ⚠ **blocked**

| | |
|---|---|
| **Objective** | Voice input |
| **Dependencies** | N7, N13 |
| **Complexity** | **M** |
| **Blocked on** | ⚠ **`netlify.toml` sets `Permissions-Policy: microphone=()`.** Requires changing a site-wide security header — your approval |
| **Rollback** | Disable; voice output unaffected |
| **Tests** | Denied-permission degradation; closed command grammar |

---

## Summary

| # | Milestone | Cx | Risk | Blocked |
|---|---|---|---|---|
| N0 | Scaffold & purity gate | XS | none | |
| N1 | Maneuver data | S | low-med | |
| N2 | GPSSessionManager | S | low | |
| N3 | RouteTracker | S | low | |
| **N4** | **Safety lock** | **M** | **med** | |
| N5 | Driving screen | M | med | |
| N6 | HOS strip | S | low | |
| N7 | Voice guidance | M | low | |
| N8 | Off-route + reroute | L | med-high | |
| N9 | Panels | M | low | |
| N10 | Weather refresh | S | low | |
| N11 | Offline (route+parking) | L | med | |
| N12 | Tile caching | L | med | ⚠ licence |
| N13 | Capacitor | XL | high | ⚠ decision |
| N14 | Traffic | M | med | ⚠ provider |
| N15 | PTT | M | med | ⚠ header |

**Eleven milestones (N0–N11) are unblocked and can proceed in order.**

## Recommended first milestone

**N0 — Scaffold & purity gate.** XS, zero risk, no runtime behaviour, and it
installs the structural rule (AD-2) that every subsequent PR is measured
against. Establishing the boundary before there is code to violate it is far
cheaper than enforcing it later.

If you would rather see something that moves, **N1 + N2 together** are still
small and produce visible progress (real maneuver data, live position on a map)
without touching any existing surface.

## Cross-cutting rules for every PR

1. One concern per PR.
2. Behind `NEXT_PUBLIC_NAVIGATOR_ENABLED` until N11.
3. `src/lib/navigator/` stays pure — `test-navigator-purity.ts` enforces it.
4. Existing Trip Planner tests must pass **unmodified**. If a Navigator change
   requires editing a planner test, that is a design error, not a test problem.
5. No migration, no Supabase change, no Netlify change without explicit
   approval. N12/N15 are the only milestones that would need one.
6. Every PR states its rollback in the description.
