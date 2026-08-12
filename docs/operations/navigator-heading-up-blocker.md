# Navigator heading-up — measured technical blocker (RESOLVED)

> **STATUS: RESOLVED by the MapLibre GL migration.** The owner authorized
> path B below (known-limitations owner decision 6), and live guidance is
> heading-up now: MapLibre carries a real camera bearing, so tiles, road
> labels, the route line and every marker rotate together around the
> truck. **This document is kept as the record of why the renderer had to
> change** — the measurements are what justified adding a mapping
> dependency, and the CSS-rotation findings in §2 remain a standing
> prohibition (a harness pins that no map container is ever CSS-rotated).
> Leaflet itself stays in the repository: the directory and parking maps
> still use it.

**Original status: NOT IMPLEMENTED, on purpose.** The pilot milestone
asked for heading-up live navigation — the truck's direction of travel
pointing to the top of the screen, the map rotating around the followed
truck. The required technical investigation was performed first, the
blocker below was measured, and per the milestone's own instruction the
feature was **not** faked. Live navigation remained north-up, with the
truck **marker** rotating to the real heading — and this document existed
precisely so that nobody mistook a rotating icon for heading-up.

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

Neither was done at the time. **Recorded as open owner decision 6 in
`navigator-known-limitations.md`**, and until it was decided live guidance
stayed north-up.

### What the owner chose, and what shipped

**Path B.** The Navigator's renderer is MapLibre GL. What that decision
actually cost and preserved, now that it is done:

| | Outcome |
| --- | --- |
| Tiles | **Unchanged** — the same keyless OpenStreetMap raster, expressed as a MapLibre raster style. `{s}` becomes the `tiles` array MapLibre uses for the same subdomain rotation. No vector-tile provider was needed: bearing is a camera property, not a tile format. |
| Attribution | **Unchanged and stronger** — the OSM credit now rides on the tile SOURCE in the style document, so it cannot be lost by editing the component. |
| Routing / search providers | **Untouched.** Tiles and routing were always cleanly separated; HERE never entered this decision. |
| Dependency | `maplibre-gl` added. `leaflet` **stays**: the directory and parking maps still use it, and removing it would break features this milestone never touched. |
| Cockpit tile treatment | The old `saturate(0.78)` CSS filter became the renderer's `raster-saturation` paint property — MapLibre draws tiles, route and markers onto one canvas, so a CSS filter would have repainted the route line and the truck too. |
| Re-proved on the new renderer | #301 half-map sizing, #302 restore with zero re-spend, #303 one-tap startup, #304 full-screen map, #305 HOS strip, #307 map-top search. |

## 5. Reproducing the measurement

```
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
node scripts/bench/navigator-rotation-probe.mjs
```

The probe builds a Leaflet map from the installed `leaflet` package in a
blank page (no tile network, nothing leaves the machine), asks for the
rotation API, applies the CSS rotation, and prints the two measurements
quoted above.
