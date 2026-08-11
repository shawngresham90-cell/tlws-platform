# Navigator map provider — owner decision packet

**Research/audit only. No provider was contacted, no account created, no
money spent, no code changed.** Everything in the "what we have" section
is established from this repository. Everything about a provider's
current pricing, licensing terms, or feature set is marked **UNKNOWN**
unless it can be read out of our own code, because provider contracts
cannot be verified from authoritative documentation in this environment
and a guess in this document would become a decision.

## 1. What we actually run today

| Layer | What it is | Evidence |
| --- | --- | --- |
| Map renderer | **Leaflet 1.9** (`leaflet` dependency), raster tiles only | `package.json:25`; `NavigationMap.tsx` imports `leaflet/dist/leaflet.css` |
| Basemap tiles | **OpenStreetMap standard raster** `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, no key, `maxZoom: 19` | `src/lib/navigator/map-style.ts:46` |
| Satellite | **Present in the style seam, disabled**, carrying `SATELLITE_REQUIREMENT` | `map-style.ts:36–59` |
| Routing | **HERE Routing API v8**, server-side key | `src/lib/trip-planner/here-routing.ts:36`; key read only in API routes (`process.env.HERE_API_KEY`) |
| Place search | **HERE Discover**, same key, first-party proxied | `src/app/api/navigator/destination-search/route.ts:52` |
| Other Leaflet+OSM consumers | `src/components/map/LeafletMap.tsx`, `MapPreview.tsx` — the **directory and parking maps**, outside Navigator | grep of `tile.openstreetmap` |

**Two providers, cleanly separated:** tiles (OSM, keyless) and routing +
search (HERE, keyed). *Nothing about the routing/search side has to
change to change the tile side.* That separation is the single most
important fact in this packet.

## 2. What is actually blocking each blueprint map goal

| Blueprint goal (§7) | Blocked by |
| --- | --- |
| Deep-slate road styling | Raster tiles are **pre-rendered images**. Colors are baked in; only whole-image CSS filters are possible (Phase 2 ships a conservative `saturate(0.78)`; anything stronger degrades label contrast). Requires **vector tiles + a style spec**. |
| Road hierarchy by brightness | Same — needs per-feature styling, i.e. vector. |
| Truck-restricted roads dashed red | Vector styling **plus** a truck-restriction dataset we do not have (separate from the tile decision). |
| Custom POI layers, zoom-gated | Needs both a POI data source and per-feature control. Phase 2 audited this: the drive map has only 3 navigation markers, nothing to gate. |
| Terrain / hillshade | Not in the OSM standard raster set. Needs a provider offering a terrain layer. |
| 3D ahead-up camera | **Leaflet itself cannot do this** — no tilt, no canvas rotation of raster tiles. Requires a different rendering engine (MapLibre GL / Mapbox GL / HERE's own SDK), not merely different tiles. |
| Zoom-controlled data layers | Possible in Leaflet for *our own* markers today; for basemap features, vector. |

**Conclusion:** every remaining blueprint map goal reduces to one
decision — *do we move the Navigator's rendering from Leaflet+raster to
a vector engine, and if so on whose tiles?*

## 3. Realistic paths

For each: what is knowable from here, and what is explicitly UNKNOWN.

### Path 0 — Stay as we are (no change)
- **Unlocks:** nothing new. Keeps the current calm, legible, keyless map.
- **Vector:** no. **Commercial use:** already in production under OSM's
  attribution requirement, which we honor (Phase 2 pinned the credit
  un-hideable).
- **Truck-routing impact:** none. **Satellite:** none.
- **Scope:** zero. **Migration risk:** zero.
- **HERE routing unchanged:** yes.
- **Owner decision:** none. This is the default if nothing is decided.

### Path 1 — MapLibre GL (open-source engine) + a vector tile source
- **Unlocks:** true custom styling (slate basemap, road hierarchy), 3D
  tilt/ahead-up camera, per-feature zoom gating, and a path to
  truck-restriction rendering *if* we ever hold that data.
- **Vector tiles supported:** yes — that is the engine's purpose.
- **The catch:** MapLibre is the *renderer*, not the *tiles*. It still
  needs a vector tile source, which is either a paid host or
  self-hosted. **Which hosts, at what price, under what terms: UNKNOWN.**
- **Commercial use / attribution:** engine is BSD-licensed (readable
  fact); **tile-source terms UNKNOWN and source-specific**.
- **Truck-routing implications:** none — HERE routing is untouched.
- **Satellite:** not included; a separate imagery source and license.
- **Scope estimate:** replace `NavigationMap.tsx`'s Leaflet internals
  behind its existing props (it is already an isolated leaf component),
  author a style, re-verify follow/recenter/overview and the road-tested
  camera behavior. The two non-Navigator maps could stay on Leaflet.
- **Migration risk:** **high** — the camera/follow behavior is
  road-tested safety-adjacent work.
- **Owner decision:** pick and license a vector tile source.

### Path 2 — HERE's own map tiles / SDK (we already have a HERE account)
- **Unlocks:** potentially vector tiles, satellite, and truck-specific
  cartography from the provider that already routes us — one vendor
  relationship instead of two.
- **Vector tiles supported:** **UNKNOWN** — must be read from HERE's
  current product documentation.
- **Whether our existing HERE plan includes map tiles at all, at what
  incremental cost, under what attribution and caching terms:
  UNKNOWN.** Our repo proves only that we hold a key used for Routing
  and Discover.
- **Truck-routing implications:** none directly, but consolidating
  vendors increases exposure to a single provider's pricing changes.
- **Scope:** similar renderer work to Path 1 unless HERE's JS SDK is
  adopted, which would be a larger rewrite.
- **Migration risk:** high, same camera concern.
- **Owner decision:** verify HERE map-tile product terms with HERE
  directly, then decide.

### Path 3 — Mapbox / other commercial vector platform
- **Unlocks:** the full blueprint style plus satellite in one vendor.
- **Vector / commercial terms / pricing: UNKNOWN.** Widely believed to
  be usage-priced with attribution requirements, but *believed* is not
  *verified*, and this document will not pretend otherwise.
- **Truck-routing implications:** none if we keep HERE for routing;
  significant if anyone later proposes consolidating routing too —
  truck-profile routing coverage is proven work and must not move
  casually.
- **Scope / risk:** as Path 1.
- **Owner decision:** account, licensing, and cost.

### Path 4 — Raster styling only (stay Leaflet, better tiles)
- Some providers publish *pre-styled dark raster* tiles. This would get
  a darker basemap **without** a renderer migration — no 3D, no
  per-feature control, but a real visual step.
- **Which providers, keyless or keyed, terms, price: UNKNOWN.**
- **Scope:** one entry in `MAP_STYLES` (`map-style.ts` is already built
  as a multi-style seam with per-style attribution). **Lowest risk of
  any path that changes anything** — the camera code never moves.
- **Owner decision:** pick a source and accept its terms.

## 4. What must be verified before any decision

1. HERE map-tile availability, terms, and incremental cost on **our**
   plan.
2. For any vector path: the tile source's commercial terms, attribution
   obligations, and caching/offline restrictions.
3. Whether satellite is bundled or separately licensed (it is a
   *separate* open decision already on file).
4. Whether the chosen path forbids the offline caching a future offline
   mode would need — deciding tiles now silently constrains that later.

None of these can be verified from this environment. **They are owner
actions, not engineering tasks.**

## 5. Recommendation (engineering view, not a purchase)

If the goal is the blueprint's cockpit *look*, **Path 4 is the cheapest
honest experiment**: one style entry, no camera risk, revert in one line
— and it answers "does a darker basemap actually help at arm's length?"
before anyone signs anything. If the answer is yes and 3D/ahead-up is
genuinely wanted, **Path 1 or 2** becomes worth its migration risk —
and that migration should be its own road-tested pilot, never bundled
with a design phase.

**No migration is proposed in this packet, and none should be started
until an owner has verified the terms above.**
