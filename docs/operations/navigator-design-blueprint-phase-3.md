# Navigator Design Blueprint — Phase 3 record

**Scope shipped:** the Route Preview / flight briefing — the pre-drive
planning surface at `route-ready` — as presentation over route state that
already existed. Continues the Phase 1 and Phase 2 records; everything
deferred there stays deferred. No routing, validation, reroute, GPS,
voice, HOS, auth, or rate-limit behavior changed.

## What the briefing is

The old route-ready surface was one sentence ("Route ready: 128.4 mi"),
the plausibility advisory, and two equal buttons. It is now a briefing:

| Section | Real source |
| --- | --- |
| Destination name/address/facility | The `DestinationCandidate` the driver picked in search — already held by the trip controls; coordinate entry states itself honestly instead |
| Entrance honesty line | The provenance fact that is true of every plannable route today (`positionSource: 'unknown'` by construction): the pin is the provider's front door, not a checked truck entrance. Stated quietly — a permanent amber banner would teach drivers to ignore amber |
| Distance | `lifecycle.view().totalMi` — provider-reported, same value the old sentence showed |
| Time | The session's provider `durationSeconds`, formatted by the same `formatHM` the HOS strip uses |
| Arrive | The same `formatEta` derivation Drive Mode already trusts (remaining = full route, departing now) |
| Truck | `TruckProfilePanel` fed by the SESSION's own profile via the new read-only `routeBrief()` — the numbers the plan request actually carried, still labelled pilot defaults, with the routed-around / not-routed-around disclosure intact |
| Major roads | `summarizeRouteRoads`: the provider's own instruction road names (the banner's existing parser) at the provider's own route miles — consecutive-maneuver mile deltas, never geometry guessing. Driving order, ≥1 mi to qualify, four roads maximum |
| Warnings | Only what the app genuinely has: session `warnings` the validator let through as `valid-with-warning` (amber edge + ⚠ beside the words), and the unchanged `assessRoutePlausibility` advisory. Both collapse to nothing when clean |
| Start navigation | The SAME `lifecycle.startNavigation` transition, now as the blueprint's single big green primary (72px). Discard keeps its words and its behavior at deliberately lower visual weight |

Map: at route-ready the existing map now frames the whole route
(`fitBounds`, animation off) — a parked-camera change only. Guidance
going live hands the camera straight back to the truck; the mid-drive
follow/recenter/overview logic is untouched and keeps sole authority.

## New read surfaces (additive, read-only)

- `NavigationLifecycle.routeBrief()` — the briefing's projection, built
  exactly like `mapData()`: plain frozen copies, no engine reference
  escapes, nothing can advance or mutate a route through it.
- `src/lib/navigator/route-brief.ts` — the pure corridor summarizer.

## One design pin inverted, by owner instruction

`test-navigator-pilot-integration` check 12 pinned the truck panel as
idle-only — correct for the thin confirmation screen it protected. The
Phase 3 instruction requires the truck profile ON the preview, so the
check now asserts the briefing shows the session's own profile with its
disclosure. Every other pin in that harness is untouched.

## Blueprint briefing items deferred — recorded, not faked

### Route alternatives (§6.2 "Fastest / Easiest / Truck Preferred")
1. The blueprint envisions selectable route options.
2. The route contract deliberately requests ONE route; alternatives
   multiply provider transactions and sit behind the unresolved
   paid-alternatives question from the Phase 1 record.
3. Seam: the plan port / route contract (a schema version, not a UI
   hack); the briefing's single-route layout extends to a chooser.
4. Owner: provider spend and product decision. Until then the screen is
   designed cleanly around the one real route.

### HOS fit indicator (§6.2 green "fits your clock")
1. A green/amber/red "fits your clock" verdict on the briefing.
2. The duration is real, but the clocks are the fresh-driver ASSUMPTION
   the HOS strip already discloses (no ELD linked). A green light built
   on an assumed-full clock would tell a mid-shift driver a lie with a
   safety color.
3. Seam: `hos-strip`'s existing engine + the briefing's summary row —
   pure arithmetic once real duty status exists.
4. Owner: ELD/duty-status linkage decision. Deferred rather than faked.

### Hazard timeline, grade strip, fuel plan chips, toll total (§6.2)
1. The blueprint's full flight-briefing panels.
2. No positioned hazard data, no elevation data, no fuel prices; tolls
   are not parsed from the provider response today.
3. Seam: the briefing's section list — each panel slots between roads
   and warnings when its data exists; tolls would come through the route
   contract like any provider field (authoritative evidence + approval).
4. Owner/provider decisions per the Phase 1 record.

Unchanged and still open: Barlow assets, amber TL marker, vector-tile
provider, day/night switching, satellite/entrance datasets, Phase 2 tile
desaturation judgment.
