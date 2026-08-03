All files read end-to-end. Compiling the report.

# Map Rendering Subsystem — Architecture Audit (tlws-platform @ 881fb07)

## Architecture (load path, bundle impact)

**Component inventory and who uses what**

- `src/components/map/LeafletMap.tsx` — the real interactive Leaflet map. Consumed by exactly two client islands, both via `next/dynamic` with `ssr: false`: `src/components/map/MapExplorer.tsx:35-42` and `src/components/directory/CatScaleNearMe.tsx:23-30`.
- `src/components/map/MapPreview.tsx` — single-marker detail-page map, mounted at `src/app/(directory)/directory/location/[slug]/page.tsx:16,403`.
- `src/components/map/MapCanvas.tsx` + `MapMarker.tsx` + `index.ts` — a dependency-free SVG "map foundation" that is **dead code in production**: the only importer of `MapCanvas` is `src/components/map/index.ts:1`, and nothing imports from `@/components/map` (index) anywhere in `src/` (grep verified; `MapCanvas.tsx:19` even self-describes as "intentionally unrouted").
- `src/lib/map/data.ts` (`getMapDataset`/`buildMapDataset`, lines 86-103) — also **dead in production**: no importer outside the file itself (grep over `src/` found only self-references; presumably unit tests use it).

**Leaflet load path (VERIFIED, three layers of laziness)**

1. Page → island: `MapExplorer` and `CatScaleNearMe` load `LeafletMap` via `next/dynamic(..., { ssr: false })` (`MapExplorer.tsx:35`, `CatScaleNearMe.tsx:23`), so the LeafletMap chunk is code-split out of the page's initial client bundle.
2. Component → library: the `leaflet` package itself is only ever loaded by a runtime `await import('leaflet')` inside a `useEffect` (`LeafletMap.tsx:71`, `MapPreview.tsx:51`). The top-level `import type * as Leaflet from 'leaflet'` (`LeafletMap.tsx:5`, `MapPreview.tsx:5`) is type-only — zero runtime bytes.
3. Viewport gating (detail pages only): `MapPreview` additionally defers the leaflet import behind an `IntersectionObserver` with `rootMargin: '200px'` (`MapPreview.tsx:26-44`), so detail pages don't pay for Leaflet unless the map scrolls near view. `LeafletMap` has no such gate — it loads Leaflet on mount.

**Bundle impact (VERIFIED from node_modules)**

- `leaflet@^1.9.4` (`package.json`), package `main: dist/leaflet-src.js` (450 KB unminified UMD; no `module`/`exports` fields, so no tree-shaking — the whole library bundles). Reference minified build `dist/leaflet.js` is 147.5 KB raw / **42.6 KB gzip**; Next's own minification of `leaflet-src.js` should land in the same range. `leaflet.css` is 14.8 KB raw / 3.6 KB gzip, imported statically at `LeafletMap.tsx:4` and `MapPreview.tsx:4` (ships with the respective client chunks).
- Net: Leaflet never blocks first paint of any route. This is a genuinely good load architecture.

**SSR handling (VERIFIED safe)**

All map components are `'use client'` (`LeafletMap.tsx:1`, `MapCanvas.tsx:1`, `MapExplorer.tsx:1`, `MapPreview.tsx:1`, `CatScaleNearMe.tsx:1`). Browser globals are touched only inside effects: `window.location` at `MapExplorer.tsx:90` (deliberately instead of `useSearchParams`, to keep the page prerenderable — comment at `MapExplorer.tsx:86-88`), `'IntersectionObserver' in window` at `MapPreview.tsx:29`, `navigator.geolocation` inside click handlers (`MapExplorer.tsx:156`, `CatScaleNearMe.tsx:62`). `/directory/map` is static + ISR with `revalidate = 300` (`map/page.tsx:25`), as is the cat-scales near-me page (`near-me/page.tsx:13`).

**Trip planner: no map.** `src/components/trip-planner/TripPlannerApp.tsx` renders no map component and imports nothing from `components/map` or leaflet (grep verified; its only "Map" hit is the JS `Map` data structure at `TripPlannerApp.tsx:211`). The trip planner reuses only the pure geo library — `haversineMiles`/`LatLng` from `lib/map/geo.ts`/`bounds.ts` (`src/lib/trip-planner/directory-layer.ts:1-2`, `route-estimate.ts:1-2`, `here-routing.ts:1-2`, `types.ts:9`). The trip planner is a text/list experience; the "map" subsystem is directory-only.

## Rendering pipeline (markers, clustering, re-render triggers)

**Data in.** `/directory/map/page.tsx:28` fetches `getEntriesWithCoordinates()` — published, non-deleted, non-null lat/lng, `limit(2000)`, ordered by name (`src/lib/directory/data.ts:334-355`) — and serializes the full `DirectoryEntry[]` (all ~30 fields per row incl. `description`, per `toEntry` at `data.ts:62-106`) into the RSC payload as props to `MapExplorer` (`map/page.tsx:62-67`). The cat-scales near-me page fetches **two** pools: `getCatScaleMapEntries()` capped at 3000 (`data.ts:633-651`) plus the full 2000-row `getEntriesWithCoordinates()` used purely as a geocoder substitute for the city/ZIP box (`near-me/page.tsx:29-33`, `CatScaleNearMe.tsx:42-43,81`).

**Filtering.** All filtering is client-side over the serialized pool: `applyExploreFilters` (`src/lib/map/explore.ts:63-99`) runs one O(n) filter pass, then (with an origin) an O(n) haversine-decorating map + O(n log n) sort. Memoized on `[entries, filters, origin, serverDistances]` (`MapExplorer.tsx:108-118`). "Use my location" also POSTs to `/api/directory/nearby` (radius 250 mi, limit 100) to overlay server-computed distances (`MapExplorer.tsx:174-186`).

**Marker construction — full teardown/rebuild, not incremental (VERIFIED).** The marker effect at `LeafletMap.tsx:162-234`:

1. `layer.clearLayers()` — destroys every existing marker DOM node (`:168`).
2. Caps input at `MAX_MARKERS = 500` (`:33`, `:169`).
3. `markersFromEntries` O(n) (`cluster.ts:28-39`), builds a `Map` byId O(n), `boundsForPoints` O(n) over the **data** (not the viewport) (`:172`).
4. `clusterMarkers(markerData, fitted, gridSizeForZoom(map.getZoom()))` (`:174`).
5. Creates one `L.divIcon` + one `L.marker` per cluster/singleton, adds each to the layer, then styles the live DOM element via `getElement()` + `style.cssText` and builds popups with `document.createElement` (`:182-232`, popup builder `:99-159`). XSS-safe by construction (textContent only) — good.

**Clustering is real and cheap (VERIFIED).** `clusterMarkers` (`src/lib/map/cluster.ts:57-79`) is single-pass grid binning: project each marker into the unit square of the data bounds (equirectangular, `bounds.ts:94-98`), bucket into a `gridSize × gridSize` cell map, then emit centroid clusters. Complexity O(n + cells) per invocation — **not** O(n²), and **not** per-frame. Grid resolution scales with zoom via `gridSizeForZoom` (`explore.ts:160-166`): 12 → 256 cells across zooms <6 → ≥12; at zoom ≥12 the 256-grid effectively de-clusters everything.

**Re-render triggers (VERIFIED — the important nuance):**

- **Pan does NOT recluster.** The only map event handler is `zoomend` (`LeafletMap.tsx:80`), which bumps `zoomTick`. There is no `moveend`/viewport handler at all — clustering is computed against the *data bounds* (`:172`), not the viewport, so panning is free. This also means all ≤500 markers/clusters exist as DOM nodes at all times regardless of viewport.
- **Every zoom step = full marker teardown + rebuild** (effect deps `[results, selectedId, ready, zoomTick]`, `:234`). `zoomend` fires once per zoom gesture step — O(n) per event, not per frame. No debounce, but none needed at this event granularity.
- **Every selection change = full teardown + rebuild of all ≤500 markers**, just to restyle one marker yellow and open its popup (`selectedId` in the deps at `:234`; per-marker selected styling at `:181,201-203,207`). Clicking a marker calls `onSelect` → parent state → new `selectedId` → complete rebuild.
- **Every filter/origin/serverDistances change = new `results` array identity** (`MapExplorer.tsx:108-118`) → full rebuild, plus a `fitKey` bump (`MapExplorer.tsx:121-123`) → `fitBounds` refit (`LeafletMap.tsx:259-285`).
- Cluster click zooms in 2 levels (`:229-231`) → `zoomend` → recluster at finer grid. That's the drill-down mechanic.

**Marker cap semantics (VERIFIED).** With no origin, `results` sorts featured-then-alphabetical (`explore.ts:93-96`); `slice(0, 500)` (`LeafletMap.tsx:169`) therefore shows an *alphabetical* subset of up to 2000 entries with no geographic logic and no user-visible indication that 75% of pins are missing. The list below the map still shows all results (`MapExplorer.tsx:439-448`).

**Icon cost (VERIFIED).** Every marker gets its own fresh `L.divIcon({ html: '' })` (`:182-187`, `:209-214`, origin `:243`) — icons are not shared/cached even though singleton icons differ only in 2 colors and cluster icons are identical. divIcon with empty html is cheap (one div per marker); the two-phase "create marker → getElement() → mutate cssText" pattern forces style recalc per marker but avoids HTML-string injection. Per rebuild: ≤500 divs created + ≤500 destroyed.

## Caches

- **ISR page cache:** `revalidate = 300` on both map-bearing pages (`map/page.tsx:25`, `near-me/page.tsx:13`) — the 2000/3000-row fetches run at most once per 5 min per page, not per visitor. This is the subsystem's only data cache.
- **React memos:** `results`, `cities`, `categoriesPresent` in MapExplorer (`MapExplorer.tsx:102-118`); `clusters` in the dead MapCanvas (`MapCanvas.tsx:45-48`); `results` in CatScaleNearMe (`CatScaleNearMe.tsx:91-95`).
- **Refs as instance cache:** Leaflet map/module/layers held in refs across renders (`LeafletMap.tsx:54-58`); `stateRef` keeps latest props visible to stale event closures without re-binding (`:62-64`).
- **No caching of:** cluster results in LeafletMap (recomputed each effect run — fine at n≤500), divIcons, popups (rebuilt per marker per rebuild), or the geolocation fix (`maximumAge: 60000` at `MapExplorer.tsx:200` vs `maximumAge: 0` at `CatScaleNearMe.tsx:75` — inconsistent).
- **No memory of tiles beyond Leaflet's own tile cache** (OSM public tiles, `LeafletMap.tsx:28`, `MapPreview.tsx:16`).

## Failure modes

- **Leaflet import failure:** caught; `onError()` swaps in a static fallback panel and the full list remains (`LeafletMap.tsx:86-88`, `MapExplorer.tsx:405-408`, `CatScaleNearMe.tsx:193-197`). `MapPreview` silently keeps its "Loading map preview…" placeholder forever on failure (`MapPreview.tsx:79-81,98-105`) — a stuck loading message rather than a fallback, minor UX wart.
- **DB failure:** `getEntriesWithCoordinates` fail-softs to `[]` (`data.ts:350-353`) → the map page renders "0 locations" as if the directory were empty. This is exactly the empty-vs-error ambiguity the codebase itself documents as having caused a cached-404 incident (`data.ts:117-131`) — the map page does not use the strict `*Result` variants.
- **Empty results:** marker effect clears the layer then returns early when `boundsForPoints` is null (`LeafletMap.tsx:172-173`) — correct; fit effect no-ops on 0 points (`:270`).
- **Latent mutation hazard (HYPOTHESIS, currently unreachable):** `MapExplorer.tsx:111-116` mutates `r.distanceMiles` on the result objects. When `origin` is set, `applyExploreFilters` returns fresh copies (`explore.ts:81-87`) so it's safe; but if any future code path leaves `serverDistances` set while `origin` is null, the mutation would write onto the shared server-serialized `entries` objects and persist across filter changes. Today `clearAll` (`:144-152`) and `runSearch` (`:215`) clear both together.
- **`fitKey` effect fires on mount** (`MapExplorer.tsx:121-123` runs once with initial deps), so `fitKey` starts at 1 — harmless, first fit is intended anyway.
- **Deep-link `?listing=` with a stale slug** silently does nothing (`MapExplorer.tsx:89-100`) — acceptable.
- **OSM tile policy:** direct `tile.openstreetmap.org` usage with attribution but no self-identifying user agent possible from browser; heavy production traffic against the public OSM tile servers is a terms-of-use risk, not a code bug (`LeafletMap.tsx:28`, `MapPreview.tsx:16`).

## Bottleneck candidates

1. **VERIFIED — RSC payload weight, not render CPU, is the dominant cost.** `/directory/map` serializes up to 2000 full `DirectoryEntry` objects — including `description`, `address`, `amenities`, `website`, all metadata (`data.ts:62-113`, `map/page.tsx:28,62`) — into the static HTML/flight payload, twice effectively (SSR HTML for the 2000-card list at `MapExplorer.tsx:440-448` + flight data). The near-me page is worse: up to 3000 scales + 2000 search-pool entries (`near-me/page.tsx:29-33`), where the 2000-entry `searchPool` exists solely so `searchLocation` can resolve a typed city/ZIP to coordinates (`CatScaleNearMe.tsx:81`; `explore.ts:112-157` uses only `city/state/zip/name/lat/lng` — ~6 of ~30 serialized fields). **HYPOTHESIS needing measurement:** actual payload size (depends on live row count and description lengths; at 2000 rows × ~0.5-1 KB serialized this is plausibly 1-2 MB uncompressed).
2. **VERIFIED — full marker teardown/rebuild on every `selectedId` change** (`LeafletMap.tsx:168,234`): ≤500 DOM nodes destroyed and recreated to restyle one pin. At the 500 cap this is O(n) DOM churn per click. **HYPOTHESIS:** perceptible jank on low-end mobile; needs profiling — at n≤500 it may well be under a frame budget on desktop.
3. **VERIFIED — the 2000-card `<ul>` re-renders on every filter keystroke/chip toggle** (`MapExplorer.tsx:440-448`; `MapResultCard` is not memoized, `:454`). React reconciles up to 2000 list items per filter change. **HYPOTHESIS:** this out-costs the map rebuild.
4. **VERIFIED — no rendering issue with clustering itself:** O(n) grid binning (`cluster.ts:57-79`), run only on zoomend/filter change, never per frame, never during pan.
5. **VERIFIED — Leaflet bundle (~42 KB gzip JS + 3.6 KB CSS) is fully lazy** on all routes; not a first-load bottleneck anywhere.

## Simplification opportunities

- **Delete the dead SVG foundation:** `MapCanvas.tsx`, `MapMarker.tsx`, `components/map/index.ts`, and `lib/map/data.ts` (`buildMapDataset`/`getMapDataset`/`applyScope` chain, `data.ts:30-103`) are unrouted scaffolding superseded by LeafletMap; `filterMarkers` (`cluster.ts:41-49`) is used only by MapCanvas. Keeping them costs comprehension, tests, and drift risk.
- **Split marker styling from marker existence:** keep a `Map<id, L.Marker>` and, on `selectedId` change, restyle two markers instead of rebuilding 500 (`LeafletMap.tsx:162-234`). Deps become `[results, ready, zoomTick]` + a tiny selection effect.
- **Slim the near-me `searchPool`:** serialize only `{city, state, zip, name, lat, lng}` (what `searchLocation` reads, `explore.ts:112-157`) instead of full `DirectoryEntry[]` — likely the single biggest payload win on that page. Same idea applies to `/directory/map` if the card list dropped rarely-used fields or virtualized.
- **Hoist a shared divIcon factory** (2 fixed cluster/origin styles + 2 singleton color states) instead of one `L.divIcon` per marker per rebuild (`LeafletMap.tsx:182-187,209-214,243`).
- **Surface the 500-marker cap** ("showing 500 of N on the map") or cap geographically (cluster first, cap clusters) rather than alphabetically (`LeafletMap.tsx:33,169` + sort at `explore.ts:93-96`).
- **Unify `MapPreview` and `LeafletMap` init** (duplicated tile URL/attribution/divIcon-styling blocks, `MapPreview.tsx:16-18,60-76` vs `LeafletMap.tsx:28-30,182-204`), and give `LeafletMap` the same IntersectionObserver gate MapPreview already has.

## Open questions

1. Actual live row counts: how many published coordinate-ready rows exist today? The 2000/3000 `limit()`s (`data.ts:349,645`) are silent truncation points — if the directory outgrows them, listings vanish from the map with no signal. Needs a DB count (out of scope for this read-only audit).
2. Measured `/directory/map` HTML + flight payload size and hydration time with the real dataset (bottleneck candidate 1).
3. Frame cost of the 500-marker rebuild on selection/zoom on a mid-tier phone (bottleneck candidate 2) — the `scripts/bench/**` delta on this branch suggests someone is already instrumenting; these two are the measurements worth taking.
4. Is the SVG foundation (`MapCanvas` et al.) intentionally retained as a documented fallback/testbed (comments say "before a map provider is chosen", `MapCanvas.tsx:13-19` — a decision since made), or forgotten?
5. OSM tile-usage policy compliance at production traffic levels (operational, not code).