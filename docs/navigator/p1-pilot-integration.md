# P1 — Navigator Integration & Pilot Readiness (implementation record)

Status: **implemented** on branch `claude/navigator-p1-pilot-integration`
(stacked on N8f, draft PR, owner review required). NO new navigation
features: this milestone only connects the finished engines into one
complete navigation session and prepares — without performing — real-world
pilot testing. Design authority: the architecture package (docs 00–10).
The Blueprint Extension (Docs 11–15) remains absent from the repository
on every branch.

## What was integrated (and what already existed)

| Piece | Milestone | P1 role |
| --- | --- | --- |
| Destination entry | N4 LockGate slot | Pilot coordinate+facility form, stationary-only |
| Route creation | N8a/N8b endpoint | Client port → `POST /api/navigator/route` |
| Truck profile | Trip planner | `DEFAULT_TRUCK_PROFILE` rides every request |
| GPS feed | N2 GpsProvider | Unchanged single-watch owner drives ticks |
| Navigation session | N8f composition | Created at `startNavigation`, released at completion |
| Reroute engine | N8e caged controller | Requested only from lifecycle `off-route` |
| Arrival engine | N8f | Drives `final-approach` / `arrived` lifecycle states |
| Driving view | N5 controller | Rebuilt per route via `sessionToControllerRoute` |

## The lifecycle orchestrator (`navigation-lifecycle.ts`)

One pure module owns the trip lifecycle:

```
idle → planning → route-ready → navigating ⇄ off-route → rerouting
     → final-approach → arrived → completed → idle
```

Every state change passes through a single `transition()` gate that
consults the explicit `LIFECYCLE_TRANSITIONS` legality table. An illegal
move is refused (state unchanged) and recorded in a violation audit that
the harness requires to be EMPTY across every scenario — guarded entry
points (`plan`, `startNavigation`, `complete`, …) refuse cleanly from the
wrong state before any transition is attempted. Engine truth is mapped
each tick: arrival phases outrank the detector (a truck creeping toward
its gate is not "off route"), `rerouting` holds while the replacement
request is in flight, and a refused/failed reroute lands wherever the
engines honestly are. Reference-idempotent ticks survive React StrictMode
double renders without double-counting evidence.

Completion discipline: `cancel()` / `complete()` release the navigation
session (which already nulled matcher/detector/rerouter/arrival), the N5
controller, and the route session. `resourcesReleased()` makes cleanup
observable; no timers exist anywhere in the engine layer (the component
layer owns cadence), so nothing can tick after completion.

## Pilot Mode (`pilot-mode.ts`) — feature flag only, previews only

Two independent rails, both required: `NEXT_PUBLIC_NAVIGATOR_ENABLED`
must be exactly `'true'` (it is UNSET in production — no environment
change is part of this milestone), AND the resolved hostname must not be
`truckinglifewithshawn.com` or any subdomain. Even a mistaken future flag
set in production keeps Pilot Mode off there; unknown hostnames (SSR)
resolve inactive, default-deny. Debug logging rides pilot activation: a
bounded 500-entry ring buffer whose storage layer coordinate-redacts
every string (AD-7 — positions never reach a log), rendered in a
`<details>` block for road-test debugging. No production users: the
`/drive` page 404s without the flag, the route endpoint 404s without the
flag, and Pilot Mode refuses production hosts on top of both.

## Component wiring

`DrivingScreen` owns ONE `NavigationLifecycle` (browser ports injected:
plan + replacement adapters in `route-port.ts`, the only Navigator client
code that touches the network, both aimed exclusively at the flag-gated
endpoint). Ticks ride the existing GpsProvider 1 s cadence; the off-route
state triggers a single caged reroute request (re-entry structurally
impossible); Stop and unmount both cancel the live trip. Without Pilot
Mode the screen renders exactly the N5 preview, placeholder text and all.
`PilotTripControls` (coordinate + facility entry, start/discard/cancel/
complete/reset) mounts inside the stationary-only `edit-destination`
LockGate slot — motion policy unchanged, typed destinations carry
`positionSource: 'unknown'` so unverified arrivals complete honestly as
`destination-unverified`.

## Verified by `scripts/test-navigator-pilot.ts` (174 checks)

Full lifecycle (exact transition order asserted), reroute lifecycle
(replaced / provider-failure / session-budget / hourly cage with six
replacements then refusal), arrival lifecycle, cancellation from every
stage (never dressed as arrival), GPS loss (no arrival across missing
time; tunnel gaps never confirm off-route), long session (100k ticks),
repeated reroutes, cleanup after arrival, tick idempotency, transition
table sanity, Pilot Mode resolution, log redaction, and structural
source checks on the component wiring.

## Measured (this container, `--expose-gc` — never invented)

100,000-tick session: **1.6 s total (16 µs/tick)**; active-session heap
delta **0.2 MB**; retained heap after cancel + GC **0.10 MB**; arrival
completion + engine release **0.003 ms**.

## Pilot testing preparation (prepared, NOT performed)

Road testing is a human decision and is not part of this branch. What a
tester needs on a preview deployment:

1. **Parked-truck test** — open `/drive` on the preview URL, enable
   location, enter a nearby destination's coordinates + facility type,
   plan, start; verify lifecycle line, HOS strip label, debug log; cancel
   and confirm "cancelled" summary. No motion required.
2. **Passenger test** — passenger operates while a driver drives; verify
   motion lock keeps destination entry locked in motion, Stop stays
   available, off-route → reroute happens at most once per cooldown, and
   the debug log holds no raw coordinates.
3. **Road test (arrival)** — end a short route at a reachable yard;
   verify final-approach advisory, honest `destination-unverified`
   completion for typed destinations, and trip summary contents.

Calibration knobs (detector/reroute/arrival thresholds) are all
constructor config, changeable per preview build without engine changes.

## Known limitations

- Destination entry is raw coordinates + facility class — geocoding,
  search, and saved destinations are later milestones (P1 adds no
  features).
- Typed destinations have no entrance data, so pilots complete as
  `destination-unverified` unless entrance records are supplied.
- Per-leg trip summaries after a mid-trip replacement (documented N8f
  limitation) — the final summary covers the last leg's route.
- The truck profile is the trip-planner default; profile editing on the
  driving screen is out of scope.

## Rollback

Delete `pilot-mode.ts`, `navigation-lifecycle.ts`, `route-port.ts`,
`PilotTripControls.tsx`, `test-navigator-pilot.ts`, and this file; revert
`DrivingScreen.tsx` to its N5/N6 form. Single squash-revert restores the
N8f state exactly. Production behavior is identical before and after
either way: the flag is unset, every surface 404s.
