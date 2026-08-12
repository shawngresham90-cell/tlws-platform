# Navigator heading-up — measured technical blocker

**Status: NOT IMPLEMENTED, on purpose.** The final pilot milestone asked
for heading-up live navigation — the truck's direction of travel pointing
to the top of the screen, the map rotating around the followed truck. The
required technical investigation was performed first, the blocker below
was measured, and per the milestone's own instruction the feature was
**not** faked. Live navigation remains north-up. The truck **marker**
still rotates to the real heading (`vehicle-marker.ts`, unchanged since
its own milestone) — and this document exists precisely so that nobody
mistakes a rotating icon for heading-up.

Everything below was measured on **2026-08-12** against the shipped
renderer, with the probe committed at
`scripts/bench/navigator-rotation-probe.mjs` so the numbers can be
reproduced rather than trusted.

---

## 1. The renderer has no rotation

The Navigator's one map renderer is **Leaflet 1.9.4** (raster tiles; see
the map provider decision packet). Probed directly on a live map
instance:

```
native rotation API: {"hasBearing":false,"keys":[],"leafletVersion":"1.9.4"}
```

- `map.setBearing` does not exist; no `bearing` option exists.
- No method or option matching `/bearing|rotat/i` exists anywhere on the
  Map prototype.
- Leaflet's public API has no concept of map bearing at all — this is a
  design property of the library, not a version gap.

## 2. CSS rotation measurably breaks the map — this is the forbidden fake

The obvious "cheap" implementation is `transform: rotate(θ)` on the map
container. The probe applied `rotate(45deg)` to a real Leaflet container
and measured what the milestone instruction predicted:

**Coordinate math desynchronizes.** Leaflet's projection has no idea the
container was rotated:

```
marker: leaflet coords vs real screen position:
  {"leafletSays":{"x":200,"y":300},"screenIs":{"x":368,"y":363}}
```

`latLngToContainerPoint` for the marker answers **(200, 300)** while the
marker's real screen position is **(368, 363)** — a 168 px error at 45°
on a 400×600 viewport. Every consumer of that math is now wrong: tap hit
testing, popup and tooltip anchoring, `elementFromPoint` obstruction
checks (which the full-map bench relies on), and any overlay positioned
from projected coordinates.

**Touch input inverts.** Dragging straight UP on the rotated map moved
the center **south**:

```
drag straight UP on a 45-deg rotated map -> center delta:
  {"dLat":-0.011882,"dLng":-0.000019}
```

(Re-runs jitter `dLng` by a few micro-degrees; the finding is the **sign
of `dLat`**: dragging up moved the map **south**, every run.)

Unrotated, an upward drag moves the center north (`dLat > 0`). Under
rotation the finger's direction and the map's response disagree by the
rotation angle — at 180° (southbound truck) panning would be fully
inverted. For a driver, a map that moves against the finger is worse
than a north-up map.

**Tile loading follows the same failure.** Leaflet computes the visible
tile range from the unrotated viewport rectangle, so a rotated container
shows unloaded corners at 45° — a direct consequence of finding 1, not
separately measured.

The milestone instruction said: *do not fake rotation with a fragile CSS
transform that breaks coordinates, markers, touch input, hit testing,
tile loading, overlays, or accessibility.* Measured: it breaks at least
four of those, immediately. It was not shipped.

## 3. Rotating only the truck icon does not satisfy the requirement

The truck marker already points along the direction of travel. That is
**not** heading-up: the requirement is that a spoken "turn left" branches
visually LEFT on the screen, which requires rotating the **world** around
the truck. No claim is made that the existing marker rotation satisfies
this milestone, and the PR that carries this document says so plainly.

## 4. The two real paths — both are owner decisions

Both paths add or replace a mapping dependency, which this milestone
explicitly barred without stopping and documenting the blocker first.
This document is that stop.

| Path | What it is | What is known from here | What is UNKNOWN from here |
| --- | --- | --- | --- |
| **A. `leaflet-rotate` plugin** | A third-party plugin that patches Leaflet's internal transform pipeline to add bearing | It exists; it monkey-patches core positioning internals, so every Navigator regression fix that touches map geometry (#301 ResizeObserver sizing, marker anchoring, the obstruction bench) would need re-verification on the patched pipeline | Maintenance health, correctness under Leaflet 1.9.4, touch behavior at scale — cannot be audited from this environment without adding the dependency |
| **B. MapLibre GL migration** | Replace the Navigator's renderer with a vector engine that has native `bearing` (and tilt) | This is Path 1 of the existing map provider decision packet; it also unlocks the blueprint's styling goals; HERE routing/search are unaffected (tiles and routing are cleanly separated) | Tile source licensing/cost for vector tiles; the full migration burden (markers, overlays, controls, offline behavior, and re-proving #301/#302/#303/#304/#305 on the new renderer) |

Neither was done. **Recorded as open owner decision 6 in
`navigator-known-limitations.md`.** Until it is decided, live guidance is
north-up, and the maneuver card, glyphs, and voice remain the
turn-direction authority — which they already were.

## 5. Reproducing the measurement

```
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
node scripts/bench/navigator-rotation-probe.mjs
```

The probe builds a Leaflet map from the installed `leaflet` package in a
blank page (no tile network, nothing leaves the machine), asks for the
rotation API, applies the CSS rotation, and prints the two measurements
quoted above.
