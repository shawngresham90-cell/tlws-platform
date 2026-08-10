# Navigator Design Blueprint — Phase 2 record

**Scope shipped:** the warning/status rail as a presentational read of
states that already exist, map refinement within what the shipped
Leaflet + OpenStreetMap implementation legitimately supports, and the
zoom-gating audit. Continues the Phase 1 record
(`navigator-design-blueprint-phase-1.md`); everything deferred there stays
deferred here. No navigation, safety, voice, GPS, or privacy behavior
changed — the rail is classes and glyphs around lines that already
rendered, decided by a pure read-only mapping
(`src/lib/navigator/status-severity.ts`).

## The warning rail — what it is and is not

The blueprint's rail is implemented as SEVERITY DRESS on the driving
screen's existing honest lines, not as a new surface:

| Real state (authority) | Rail treatment |
| --- | --- |
| `navigating` / `arrived` / `no-route` / `acquiring` | **Quiet.** The status line stays a plain 16px one-liner — the always-on status text is a pinned honesty invariant, and a rail that decorates good news trains drivers to ignore it. No chrome, no glyph, no color. |
| `position-degraded`, `position-lost` (navigation controller) | **Advisory.** Amber left edge + ⚠ beside the unchanged words. |
| `denied`, `position-unavailable` (navigation controller) | **Critical.** Red left edge + ⛔ beside the unchanged words — red only where guidance genuinely is not running. |
| Offline (`offlineNotice`, renders only when the network is really down) | **Advisory.** Amber edge + ⚠ beside the existing sentence. |
| Off-route / rerouting / holding-for-safe-replacement (#272 lifecycle) | **Advisory.** Kept exactly as Phase 1 shipped it — amber edge, the pinned OFF ROUTE wording, never an instruction — now with the same ⚠ shape as its siblings. |
| HOS `warning` / `notice` → amber, `critical` → red (`hos-strip` severities) | Edge treatment on `HosWarningLine`, beside its pinned "Warning:" / "Urgent:" words; the aria-live escalation (`assertive` only when critical) is byte-identical. |

Rules the implementation holds to:

- **No new state machine.** Severity is a pure function of the
  controller's existing status; nothing is debounced, queued, reordered,
  or remembered. If two things are wrong at once, both lines show —
  exactly as they did before, just dressed.
- **No voice.** The rail originates zero speech requests and touches no
  announcer; voice arbitration, anti-chatter, and the watchdog are
  untouched.
- **No new live regions.** The screen still has exactly three
  `aria-live="polite"` regions; the glyphs are aria-hidden; the off-route
  line stays deliberately non-live per its #272 rationale.
- **Never color alone.** Every treated line keeps its full sentence and
  gains a distinct shape (⚠ vs ⛔). TLWS yellow appears nowhere.
- **Collapsed when healthy.** In the ordinary navigating state the only
  change from Phase 1 is nothing at all.

### Warning states NOT visually supported, and why

- **Wrong-way as its own banner.** Wrong-way detection exists inside the
  off-route detector and the #272 reversal guard as INPUTS to the
  off-route lifecycle — by design there is no separately surfaced
  "wrong way" driver state, because the honest driver-facing form of it
  is the off-route line ("state, never an instruction"). Inventing a
  distinct wrong-way banner would mean re-deriving safety state in the
  view layer. The rail therefore shows wrong-way as what the system
  actually reports: OFF ROUTE.
- **Provider/reroute failure as its own banner.** A failed or refused
  replacement keeps the lifecycle in off-route with the
  "Continue safely while a new route is calculated." line and the reroute
  controller's own budgets/cooldowns. That existing surface IS the
  failure state; a second banner would be a cosmetic queue.
- **Speeding, low clearance, restrictions ahead, weigh/parking/fuel
  states.** No data (Phase 1 record) — nothing to dress.

## Map refinement — what actually changed

1. **Conservative tile desaturation** — `.nav-map .leaflet-tile
   { filter: saturate(0.78) }`. OSM's pastel land-use quiets toward the
   blueprint's subdued base; labels and road geometry keep full contrast.
   Deliberately saturation-only: no invert, no hue-rotate, no brightness
   drop — a filter that repaints roads could read as information, and a
   fake night map fails the one-second rule. **One line to revert; the
   owner judges it on a phone like everything else.**
2. **Attribution restyled, never hidden.** OpenStreetMap's required
   credit now sits on the cockpit surface with readable dim text and
   brighter links (12px legal chrome, not driver information).
3. **36px pin floor.** The next-maneuver and destination markers grew
   from 30px to the blueprint's minimum pin size, matching the 36px
   vehicle badge; glyphs to 18px.
4. Everything else was already blueprint-true after Phase 1: cyan route
   over dark casing, cockpit-surface controls, semantic marker colors.

### Map blueprint requirements still deferred (provider/data limits)

Unchanged from Phase 1: custom slate vector tiles, truck-restriction
rendering, terrain hillshading (OSM raster ships none — enabling it is
the same vector-provider decision), 3D tilted camera and heading-up
canvas (not supported by the shipped raster map; the road-tested camera,
follow, recenter and overview behavior is protected and was not touched),
satellite, offline tiles.

## Zoom-gated pins — the audit result

The Navigator drive map renders exactly three markers: **the truck, the
next maneuver, and the destination.** All three are navigation-critical
and exempt from gating by the blueprint's own rule ("active maneuver and
destination remain available"). There are **no POI pins on the drive
map** — truck stops, fuel, parking, weigh stations are all in the
deferred-data list — so zoom gating has nothing real to gate. Per the
Phase 2 instruction, this is recorded instead of simulated: **no gating
code ships**, and the harness pins that no marker is ever hidden by zoom
level. Zoom gating becomes meaningful work the day a real POI source
lands, through the same POI/search port seam Phase 1 recorded.

## Owner decisions still open after Phase 2

1. **Barlow Semi Condensed** — unchanged; the `--font-data` seam waits on
   the font-asset decision.
2. **Amber TL vehicle marker** — unchanged and protected; re-skinning is
   an explicit owner call.
3. **Tile desaturation** — new this phase: approve or revert
   `saturate(0.78)` after seeing it on a phone in daylight.
4. **Day/night switching** — the day palette remains dormant.
5. **Vector-tile provider** — the gate in front of every deferred map
   item above.
