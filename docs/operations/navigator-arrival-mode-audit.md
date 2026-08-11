# Arrival Mode — dependency audit (decision document, no implementation)

**Audit only.** Nothing was implemented, no provider was contacted, no
account or billing changed. This records what the blueprint's Arrival
Mode (at 0.5 mi: satellite view, entrance pin, dock/gate notes card)
would actually require, sorted by what exists versus what is a decision.
Every claim below was verified against the repository with file:line
evidence during the audit; the headline facts are cited inline.

## The two headline findings

1. **The trigger already exists, road-tested, at exactly 0.5 miles.**
   `arrival-controller.ts` ships a `final-approach` state with
   `finalApproachMi: 0.5` in `ARRIVAL_DEFAULTS`, gated on matcher
   confidence, with hysteresis (exit only past 1.0 mi) and a live
   `distanceToTargetM`. It flows through the navigation session into the
   lifecycle and is already consumed by the driving screen. Reroutes are
   refused once arrival is underway, so nothing Arrival Mode draws can be
   yanked away mid-approach. **Arrival Mode needs zero new distance
   math.**
2. **Everything visual it would switch TO is missing, and one switch is
   a silent no-op today.** Satellite is deliberately disabled with the
   reason shipped as data (`SATELLITE_REQUIREMENT`), and — important for
   any future implementer — `resolveMapStyle()` falls back to standard
   for a disabled id while `NavigationMap` early-returns on a null
   `tileUrl`: an auto-switch to satellite today would *visibly do
   nothing*. Any real implementation must check `enabled` first and must
   restore the driver's manual style choice afterwards.

## Classification

### AVAILABLE TODAY
- 0.5-mile detection, hysteresis, confidence gating, `finalApproach`
  flag, meters-to-target (`arrival-controller.ts`).
- A map style-switching seam (`map-style.ts` + `NavigationMap`) and the
  36px `pin()` renderer that already draws destination and maneuver pins
  — an entrance pin is one more call with a real coordinate.
- The entrance *classifier*: `truck-entrance.ts` fully implements
  verified/reported/unverified evaluation and per-facility arrival radii
  — **it is complete logic starved of data**. Production code only ever
  constructs `positionSource: 'unknown'` with no `entrances`; every
  `'entrance'` value in the repo is a test fixture.
- The slide-up card pattern and calm motion tokens (Phase 1), and the
  LockGate motion policy that would keep a notes card from becoming a
  moving-state modal.

### AVAILABLE FROM CURRENT PROVIDER BUT NOT IMPLEMENTED
- Nothing qualifies. HERE Discover's parsed response carries no
  entrance/access field, and **no repo evidence shows the held HERE free
  tier includes satellite imagery** — that claim must not be assumed.

### REQUIRES PROVIDER/ACCOUNT DECISION
- **Satellite imagery** (open owner decision #4; ties into the vector
  map provider packet — same vendor conversation).
- **Caching imagery for the last half mile** — the service worker
  deliberately never caches cross-origin responses, and whether imagery
  tiles MAY be cached is a term of whichever imagery license is chosen.
- **Persisting an arrival telemetry event** — the pilot-event system is
  in-memory by owner decision #5; an `'arrival'` event name already
  exists in the allowlist.

### REQUIRES NEW DATASET
- **Entrance coordinates** (the pin's payload). No producer exists; the
  directory's `locations` table stores a point with no entrance column,
  and the known-limitations doc's line about entrance data "from the
  directory" is aspirational — no such code path exists.
- **Dock/gate notes content.** No model, no field, no storage anywhere.
  Nearest carriers if ever built: `DestinationEntrance.label` and the
  directory's `description` column.
- **Facility polygons/footprints.** PostGIS is installed so the
  *capability* exists, but `locations.geo` is a point and no polygon
  data exists.

### REQUIRES USER-GENERATED DATA
- Driver-submitted entrances/dock notes — and here the repo already
  proves the pattern: the parking-report path (strict schema →
  `location_submissions` with `status='pending'` → human admin review →
  **no auto-apply, ever**). An entrance-submission feature would follow
  it exactly. **One bright line:** the Navigator itself persists nothing
  by stated policy ("position is never stored"); a submission flow must
  live on the parked/directory side, never as a Navigator-screen write.

### UNKNOWN / MUST VERIFY
- Whether 0.5 mi is the *right* Arrival Mode distance — the entrance
  constants are marked "road testing will calibrate" and no calibration
  record exists.
- The silent-no-op style switch (verified bad today; must be handled
  explicitly by any implementation).

## Safest future seams (recorded for whoever implements)

1. **Trigger:** read `ArrivalSnapshot.finalApproach` / the lifecycle's
   `final-approach` — never a second distance computation, never a
   hardcoded 0.5 in a component. A distinct Arrival-Mode threshold, if
   ever wanted, is one field in `ArrivalConfig`.
2. **Style switch:** a real satellite entry in `MAP_STYLES`; the
   auto-switch lives beside the existing `styleId` state in
   `DrivingScreen`, guards on `resolveMapStyle(id).enabled`, and restores
   the driver's manual choice.
3. **Pin:** pass an `entrance` coordinate prop to `NavigationMap` and
   reuse `pin()`; the coordinate comes from `EntranceEvaluation.target`,
   which is already the honest never-invented value.
4. **Data ingress:** `PilotTripControls` is the single `DestinationInfo`
   construction site — one lookup wired there feeds the entire existing
   classifier and arrival machine with zero downstream changes. The
   Route Briefing's "entrance unverified" line must become conditional
   the same day.
5. **Notes storage:** extend the proven submission path (new migration +
   `location_submissions` fields), keeping the no-auto-apply rule.
6. **Telemetry:** add an event NAME to the allowlist; persistence stays
   owner decision #5.
7. **Never:** fake an Arrival Mode by re-styling ordinary destination
   coordinates, cache tiles by editing `sw.js` without its policy mirror
   and the imagery license in hand, or write from the driving screen to
   any store.

## Owner decisions required before any implementation

1. Satellite/imagery provider and licensing (shared with the map
   provider packet).
2. Entrance-data source: curated dataset, provider product, or the
   driver-submission pattern (which itself needs a moderation-capacity
   decision).
3. Whether dock/gate notes are worth their storage, moderation, and
   liability surface at pilot scale.
4. Arrival telemetry persistence (existing decision #5).
5. A road-test calibration pass for the 0.5-mile window and facility
   radii once any of the above exists.
