# N8f — Final Approach, Truck Entrance Intelligence & Arrival (implementation record)

Status: **implemented** on branch `claude/navigator-n8f-final-approach`
(stacked on N8e, draft PR, owner review required). The final core
navigation milestone. Design authority: the architecture package (docs
00–10). The Blueprint Extension (Docs 11–15) remains absent from the
repository on every branch.

## Truck entrance intelligence (`truck-entrance.ts`)

The founding rule: **a destination centroid is never assumed
truck-accessible, and an entrance is never fabricated.** The classifier
takes caller-supplied destination metadata (directory rows today, richer
sources later) and returns one of: `verified-truck-entrance` (nearest
verified gate to the route end; multi-gate facilities pick the closest),
`probable-entrance` (reported gates or caller-declared entrance points),
`unverified-entrance` (geocodes), `building-centroid` (centroids or
unknown provenance). Facility-aware arrival radii (`truck-stop`/
`rest-area` 250 m; `truck-terminal`/`industrial-park` 200 m; `warehouse`/
`distribution-center`/`customer-yard` 150 m). Malformed entrance records
are ignored with a note; malformed destinations fall back to the route
end with a note; nothing ever throws.

## Arrival state machine (`arrival-controller.ts`)

`en-route → final-approach → arrival-candidate → (arrived |
destination-unverified)`, with cancellation completing honestly from any
state (`endReason: 'cancelled'`, never dressed as an arrival).

- **Final approach** inside a configurable 0.5 mi window with a 25 mph
  advisory; drives that leave the window fall back to en-route.
- **Arrival requires ALL of**: destination agreement (inside the facility
  radius of the entrance target), route completion (committed mile within
  0.25 mi of the end), sufficient confidence (high/medium — the matcher's
  `low-speed-pull-in` LOW is accepted **only** inside the radius, because
  at the destination the pull-in IS the arrival), speed ≤ 5 mph, and
  **3 consecutive qualifying fixes over ≥ 10 s. Never a single fix.**
- A GPS gap resets arrival evidence (no arrival across missing time);
  drift/speed-up/moving away aborts the candidate back to final approach;
  repeated attempts work cleanly.
- **Honest terminals**: a verified/probable entrance completes as
  `arrived`; an unverified/centroid destination completes as
  `destination-unverified` — physically stopped at the route end, with
  the truth attached. Blocked entrances (loitering outside the radius)
  never arrive and never crash.
- Terminal states are inert and produce a frozen `TripSummary` (routeId,
  end reason, entrance kind, planned miles, final mile, timestamps,
  observation count).

## Session completion (`navigation-session.ts`)

The composition layer wires the whole N8 stack for one trip: session →
matcher → detector → caged rerouter → arrival. On completion (arrival or
cancellation): rerouting is refused, detection and matching stop, and
**every engine reference is released** — a completed session holds
nothing but its frozen summary. No timers exist in the layer at all (the
component layer owns cadence), so "stop navigation timers" is structural.
During final approach and arrival, rerouting is never eligible and the
detector is no longer fed (a truck creeping through a yard is not
off-route). After a mid-trip replacement, the full stack is rebuilt on
the new route.

## Measured (this container, `--expose-gc` — never invented)

Entrance evaluation **1.0 µs**; 100,000-observation hovering-approach
session **63 ms total (0.6 µs/observation)**; arrival detection across
the 4 deciding observations **0.07 ms**; completion + cleanup **0.01 ms**;
retained heap after the 100k-observation session, completion, and GC:
**0.2 MB**.

## Rollback

Delete `truck-entrance.ts`, `arrival-controller.ts`,
`navigation-session.ts`, `test-navigator-arrival.ts`, and this file;
revert the matcher boundary-pin extension. Single squash-revert restores
the N8e state exactly.
