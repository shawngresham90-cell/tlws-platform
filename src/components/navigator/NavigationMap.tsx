'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from 'maplibre-gl';
import type { LatLng } from '@/lib/map/bounds';
import { navigationZoom, shouldRecenter } from '@/lib/navigator/map-view';
import {
  followReducer,
  recenterVisible,
  shouldAutoRecenter,
  shouldTrackPosition,
  INITIAL_FOLLOW_STATE,
  followZoom,
  type FollowState,
} from '@/lib/navigator/map-follow';
import {
  cameraBearing,
  followPadding,
  headingStep,
  resetHeading,
  routeBearingAt,
  shortestDelta,
  INITIAL_HEADING_STATE,
  type HeadingState,
} from '@/lib/navigator/heading';
import { maplibreRasterStyle, resolveMapStyle, type MapStyleId } from '@/lib/navigator/map-style';
import { vehicleMarkerRotationDeg, vehicleMarkerSvg, VEHICLE_MARKER_PX } from './vehicle-marker';
import { MAP_VOID_COLOR } from '@/lib/navigator/display-mode';
import { useDisplayMode } from './DisplayModeProvider';

/**
 * The driving map — MapLibre GL, heading-up (owner decision 6, resolved).
 *
 * WHY THE RENDERER CHANGED: the pilot's road complaint was a map that
 * pointed north while the truck drove south, so a spoken "turn left"
 * appeared on the RIGHT of the screen. Fixing that means rotating the
 * whole world around the truck, and Leaflet cannot: it has no bearing
 * API, and CSS-rotating its container desynchronizes its coordinate math
 * and inverts panning (measured — see the heading-up blocker memo). This
 * component is the migration: MapLibre owns the camera, including a real
 * `bearing`, so tiles, road labels, the route line and every marker
 * rotate together as one picture.
 *
 * WHAT DID NOT CHANGE: the tile source (the same keyless OpenStreetMap
 * raster the platform already ships, expressed as a MapLibre raster
 * style), its attribution, the routing and search providers, and this
 * component's read-only contract — it receives geometry and positions,
 * owns no engine, and can never advance, replace or mutate a route.
 * Motion policy still arrives as `canZoom`/`canPan` from the shared
 * LockGate; there is no speed check here.
 *
 * ROTATION IS THE CAMERA'S, NEVER THE DRIVER'S: every rotate gesture is
 * disabled. Bearing comes from the heading controller — GPS course while
 * moving, the route's forward bearing when the receiver publishes none,
 * the last reliable heading while stopped, and north-up when there is no
 * honest evidence at all.
 */

const CONTROL =
  'flex min-h-16 min-w-16 items-center justify-center rounded-cockpit border border-line ' +
  'bg-nav-surface text-2xl font-semibold text-ink shadow-lg';

/** Route paint, unchanged from the Leaflet build: dark casing, cyan line. */
const ROUTE_CASING = '#0f172a';
const ROUTE_LINE = '#33C7FF';

/**
 * Camera easing. Long enough that rotation reads as the world turning
 * rather than snapping, short enough that the picture is never behind the
 * truck: at the 1 Hz fix cadence this settles before the next fix.
 */
const CAMERA_EASE_MS = 450;
/** Below this bearing change, moving the camera at all is just noise. */
const BEARING_DEADBAND_DEG = 0.75;

const EMPTY_ROUTE = {
  type: 'FeatureCollection' as const,
  features: [] as unknown[],
};

function routeGeoJson(geometry: readonly LatLng[]) {
  if (geometry.length < 2) return EMPTY_ROUTE;
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: geometry.map((p) => [p.lng, p.lat]),
        },
      },
    ],
  };
}

/**
 * Load the renderer once, tolerating either module shape.
 *
 * WHY THIS IS NOT JUST `import('maplibre-gl')`: the package has shipped
 * two different shapes. The single-file build (the one this app pins)
 * exposes a DEFAULT export; the split ESM build exposes named exports and
 * no default. Reading `.default` on the wrong one yields `undefined`, and
 * the only symptom is a map that silently never appears — measured
 * exactly that way in Chromium before this helper existed. The promise is
 * cached so the marker call sites share one module instance.
 */
type MaplibreModule = typeof import('maplibre-gl');
let maplibrePromise: Promise<MaplibreModule> | null = null;
function loadMaplibre(): Promise<MaplibreModule> {
  maplibrePromise ??= import('maplibre-gl').then(
    (m) => ((m as { default?: MaplibreModule }).default ?? m) as MaplibreModule,
  );
  return maplibrePromise;
}

/**
 * Put the route source and its two line layers on a map that does not
 * have them yet, carrying whatever route data is current.
 *
 * Called on the map's first load AND after any basemap style swap: a
 * MapLibre style document owns its sources, so replacing the style takes
 * the route with it. Idempotent by construction — an existing source
 * means there is nothing to do, and the data keeps flowing through
 * setData rather than through a rebuild.
 */
function ensureRouteLayers(map: MlMap, data: unknown): void {
  if (map.getSource('route')) return;
  map.addSource('route', { type: 'geojson', data: data as never });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ROUTE_CASING, 'line-width': 12, 'line-opacity': 0.55 },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ROUTE_LINE, 'line-width': 6 },
  });
}

/**
 * Put the current route data on the map, and say whether it LANDED.
 *
 * The honesty this returns is the point. `getSource` answers undefined
 * while the style document is still being parsed, and an optional call
 * against that (`source?.setData?.()`) fails silently — the route
 * quietly never draws, and the caller, believing it had drawn, caches
 * the route key and never tries again. Measured exactly that way in
 * Chromium: layers present, source present, zero features, no line on
 * screen. So the caller only records the route as drawn when this
 * returns true, and simply tries again on the next render when it does
 * not.
 */
function applyRouteData(map: MlMap, data: unknown): boolean {
  const source = map.getSource('route') as { setData?: (d: unknown) => void } | undefined;
  if (source !== undefined && typeof source.setData === 'function') {
    source.setData(data);
    return true;
  }
  if (map.isStyleLoaded()) {
    ensureRouteLayers(map, data);
    return true;
  }
  return false;
}

/** A round pin as a DOM element — MapLibre markers are plain DOM. */
function pinElement(glyph: string, label: string, bg: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', label);
  el.setAttribute('title', label);
  el.textContent = glyph;
  // 36px: the blueprint's pin floor — nothing on the map renders smaller
  // than a glanceable target, matching the vehicle badge's size.
  el.style.cssText =
    'width:36px;height:36px;display:flex;align-items:center;justify-content:center;' +
    `font-size:18px;background:${bg};color:#0A0E13;border:2px solid #f8fafc;` +
    'border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,.5);pointer-events:none;';
  return el;
}

export function NavigationMap({
  geometry,
  position,
  headingDeg,
  speedMph,
  destination,
  nextManeuver,
  routeId,
  styleId = 'standard',
  canZoom = false,
  canPan = false,
  navigating = false,
  overviewToggleKey = 0,
  bottomInsetPx = 0,
}: {
  geometry: readonly LatLng[];
  position: LatLng | null;
  headingDeg: number | null;
  speedMph: number | null;
  destination: LatLng | null;
  nextManeuver: LatLng | null;
  /** Changes on every route replacement — the redraw trigger. */
  routeId: string | null;
  styleId?: MapStyleId;
  /** LockGate: may the driver change zoom right now? */
  canZoom?: boolean;
  /** LockGate: may the driver drag the camera off the truck right now? */
  canPan?: boolean;
  /** True while guidance is live — enables heading-up and auto-recenter. */
  navigating?: boolean;
  /**
   * Increments when the driver presses Route overview. The button itself
   * lives on the screen inside its own LockGate, so this component never
   * decides whether overview is permitted.
   */
  overviewToggleKey?: number;
  /**
   * How much of the bottom of the surface the cockpit's own overlay band
   * occupies, measured by the driving screen. The follow camera keeps
   * the truck ABOVE it — without this the "lower middle" position puts
   * the truck under the trip strip on several real layouts.
   */
  bottomInsetPx?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const truckRef = useRef<MlMarker | null>(null);
  const truckElRef = useRef<HTMLElement | null>(null);
  const destMarkerRef = useRef<MlMarker | null>(null);
  const maneuverMarkerRef = useRef<MlMarker | null>(null);
  const lastCenteredRef = useRef<LatLng | null>(null);
  const drawnRouteRef = useRef<string | null>(null);
  /**
   * The route data currently on the map. A style swap replaces the whole
   * style document — sources included — so the layers have to be rebuilt
   * afterwards, and they must come back carrying the CURRENT route rather
   * than an empty one.
   */
  const routeDataRef = useRef<unknown>(EMPTY_ROUTE);
  const styledRef = useRef<MapStyleId | null>(null);
  /*
   * The driver's palette. Read through the provider rather than passed as a
   * prop: the map is mounted by the driving screen, which does not otherwise
   * care what colour anything is, and threading a theme prop through it would
   * give a second component a chance to disagree about the answer.
   */
  const { theme } = useDisplayMode();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
   * The heading controller's state. A REF, not React state: it is stepped
   * on every gated position update (1 Hz) and only the camera consumes
   * it, so putting it in state would re-render the whole surface once a
   * second to change nothing that renders.
   */
  const headingRef = useRef<HeadingState>(INITIAL_HEADING_STATE);
  /** What the camera is currently rotated to, so tiny deltas are skipped. */
  /** The inset the camera last actually eased with — see the note below. */
  const appliedInsetRef = useRef<number | null>(null);
  const appliedBearingRef = useRef(0);

  // Follow state lives in a ref AND state: the ref is read inside map
  // event handlers (which close over their creation render), the state
  // drives the Recenter button's visibility.
  const [follow, setFollow] = useState<FollowState>(INITIAL_FOLLOW_STATE);
  const followRef = useRef(follow);
  followRef.current = follow;
  // Set while the code itself moves the camera, so the programmatic move
  // does not register as the driver panning.
  const selfMoveRef = useRef(false);

  const dispatch = useCallback((event: Parameters<typeof followReducer>[1]) => {
    setFollow((prev) => followReducer(prev, event));
  }, []);

  // --- create the map ONCE ------------------------------------------------
  /*
   * One instance per mounted surface, for the life of the mount. Nothing
   * below ever recreates it: a route becoming ready, navigation starting,
   * the bearing changing, overview opening, a reroute replacing geometry
   * — all of them update sources, markers or the camera on the SAME map.
   * The creation guard (`mapRef.current`) also makes React Strict Mode's
   * double-invoked effect a no-op rather than a second map, a second set
   * of controls and a second attribution.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const maplibre = await loadMaplibre();
        if (cancelled || !containerRef.current || mapRef.current) return;
        const style = maplibreRasterStyle(resolveMapStyle(styleId));
        const map = new maplibre.Map({
          container: containerRef.current,
          style: (style ?? { version: 8, sources: {}, layers: [] }) as StyleSpecification,
          center: [-98.35, 39.5],
          zoom: 3,
          bearing: 0,
          pitch: 0,
          // The driver's controls are the large labelled buttons below —
          // 64 px targets, not MapLibre's 29 px ones.
          attributionControl: { compact: false },
          // Rotation belongs to the heading controller, never to a
          // gesture: a driver who twists the map by accident would be
          // looking at a world that disagrees with the spoken turn.
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          keyboard: false,
          // Handlers start OFF; the lock effect below turns on exactly
          // what the shared permission map allows.
          dragPan: false,
          scrollZoom: false,
          doubleClickZoom: false,
          touchZoomRotate: false,
          // Guidance is a live picture, not a slideshow: never let the
          // renderer skip frames while the truck is moving.
          fadeDuration: 0,
          refreshExpiredTiles: false,
        });
        map.touchZoomRotate?.disableRotation();

        // Any drag or pinch by the DRIVER detaches follow. Programmatic
        // camera moves set selfMoveRef first, so they never trip this.
        map.on('dragstart', () => {
          if (selfMoveRef.current) return;
          dispatch({ kind: 'user-panned', tMs: Date.now() });
        });
        // Zoom is NOT a pan: it records the driver's zoom and leaves
        // follow mode alone. zoomend carries the settled level.
        map.on('zoomend', () => {
          if (selfMoveRef.current) return;
          dispatch({ kind: 'user-zoomed', zoom: map.getZoom() });
        });
        map.on('load', () => {
          if (cancelled) return;
          ensureRouteLayers(map, routeDataRef.current);
          setReady(true);
        });
        map.on('error', () => {
          /* a failed tile must never break guidance; the text keeps working */
        });
        mapRef.current = map;
        // The map was CREATED with this style. Recording it here is what
        // stops the style effect below from immediately calling setStyle
        // on a map that already has the right one — a swap that would
        // silently take the route source and its layers with it.
        styledRef.current = styleId;
      } catch {
        setFailed(true); // the text guidance keeps working
      }
    })();
    return () => {
      cancelled = true;
      // remove() tears down the canvas, the worker, every control and
      // every listener this component attached.
      truckRef.current?.remove();
      destMarkerRef.current?.remove();
      maneuverMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      truckRef.current = null;
      truckElRef.current = null;
      destMarkerRef.current = null;
      maneuverMarkerRef.current = null;
      drawnRouteRef.current = null;
      lastCenteredRef.current = null;
      styledRef.current = null;
      headingRef.current = INITIAL_HEADING_STATE;
    };
    // styleId is read once at creation; the style effect below owns changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // --- the canvas follows its container (PR #301) -------------------------
  /*
   * The half-map protection, carried across the migration unchanged in
   * intent. This surface resizes its CONTAINER without any window event:
   * the parked page's map box becomes the viewport-filling cockpit at
   * trip start, and the portrait ↔ landscape class swap moves it again —
   * all with the map deliberately kept mounted. A renderer that measured
   * once at creation renders at the old size: tiles stop partway down the
   * box and the route's geometry believes the old height. MapLibre has
   * the same exposure as Leaflet did, so it gets the same fix: a
   * ResizeObserver re-measures on every container change. No timers, no
   * arbitrary delays — the observer fires when the box actually changes.
   */
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!ready || el === null || map === null) return;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  // --- basemap style ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    if (styledRef.current === styleId) return;
    const next = maplibreRasterStyle(resolveMapStyle(styleId));
    if (next === null) return; // disabled style: keep what is drawn
    styledRef.current = styleId;
    // Changing the basemap keeps the SAME map instance and the same
    // camera; only the style DOCUMENT is swapped. That document owns the
    // sources, so the route has to be put back — with its current data —
    // as soon as the new style is in place.
    map.setStyle(next as StyleSpecification, { diff: true });
    map.once('styledata', () => {
      ensureRouteLayers(map, routeDataRef.current);
    });
  }, [ready, styleId]);

  /*
   * --- display theme: the VOID colour only (NAV-ENTRY-1) -----------------
   *
   * What shows through where a tile has not loaded yet. It follows the
   * driver's Automatic/Night/Day choice through a single `setPaintProperty`
   * call — not `setStyle`, so there is no style swap, no source rebuild, no
   * route re-add, no camera touch and no remount. Switching the display mode
   * mid-drive changes one colour and nothing else, which is what makes it
   * presentation rather than route state.
   *
   * THE BASEMAP ITSELF IS NOT RETHEMED, deliberately. OpenStreetMap raster
   * tiles are day tiles and there is no night tile set behind them; inverting
   * or dimming them would repaint roads into something a driver could mistake
   * for information. The existing mild desaturation stays identical in both
   * modes, so labels, the route line and the truck marker keep exactly the
   * contrast they were tested with.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    try {
      if (map.getLayer('background') !== undefined) {
        map.setPaintProperty('background', 'background-color', MAP_VOID_COLOR[theme]);
      }
    } catch {
      /* a style mid-swap has no background layer yet; the next pass paints it */
    }
  }, [ready, theme, styleId]);

  // --- gestures follow the lock, never a local speed check ---------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    // Two permissions, not one. Zoom rides along with driving; dragging
    // the camera off the truck does not. Both come from the shared
    // LockGate — this component still contains no speed check of its own.
    if (canZoom) {
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      // Zoom only: a pinch must never spin the world.
      map.touchZoomRotate.disableRotation();
    } else {
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    }
    if (canPan) map.dragPan.enable();
    else map.dragPan.disable();
  }, [ready, canZoom, canPan]);

  // --- draw the route; update DATA, never the map -------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    const key = `${routeId ?? 'none'}:${geometry.length}`;
    if (drawnRouteRef.current === key) return;
    routeDataRef.current = routeGeoJson(geometry);
    // Not drawn yet? Leave the key unrecorded so the next render retries.
    if (!applyRouteData(map, routeDataRef.current)) return;

    // Pre-drive briefing overview: a route drawn BEFORE guidance is live
    // is framed whole, origin to destination, so the flight briefing
    // answers "where does this go?" at a glance. Live guidance is
    // untouched — the follow logic keeps sole authority mid-drive.
    if (!navigating && geometry.length >= 2) {
      selfMoveRef.current = true;
      map.fitBounds(boundsOf(geometry), { padding: 40, animate: false, bearing: 0 });
      selfMoveRef.current = false;
    }
    // A replacement route means new guidance: never leave the camera
    // parked on the old one.
    if (drawnRouteRef.current !== null && geometry.length >= 2) {
      dispatch({ kind: 'route-replaced' });
    }
    drawnRouteRef.current = key;
  }, [ready, geometry, routeId, navigating, dispatch]);

  // --- destination + next maneuver ---------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    // Blueprint semantics: the next-maneuver pin wears the route color,
    // the destination wears the good/open green. Dark glyphs on both so
    // the symbol survives daylight glare. Markers are MOVED, not
    // recreated, so a fix cannot churn DOM at 1 Hz.
    if (nextManeuver === null) {
      maneuverMarkerRef.current?.remove();
      maneuverMarkerRef.current = null;
    } else if (maneuverMarkerRef.current === null) {
      void loadMaplibre().then((maplibre) => {
        if (mapRef.current === null || maneuverMarkerRef.current !== null) return;
        maneuverMarkerRef.current = new maplibre.Marker({
          element: pinElement('↱', 'Next maneuver', 'var(--nav-route)'),
        })
          .setLngLat([nextManeuver.lng, nextManeuver.lat])
          .addTo(mapRef.current);
      });
    } else {
      maneuverMarkerRef.current.setLngLat([nextManeuver.lng, nextManeuver.lat]);
    }

    if (destination === null) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
    } else if (destMarkerRef.current === null) {
      void loadMaplibre().then((maplibre) => {
        if (mapRef.current === null || destMarkerRef.current !== null) return;
        destMarkerRef.current = new maplibre.Marker({
          element: pinElement('🏁', 'Destination', 'var(--nav-good)'),
        })
          .setLngLat([destination.lng, destination.lat])
          .addTo(mapRef.current);
      });
    } else {
      destMarkerRef.current.setLngLat([destination.lng, destination.lat]);
    }
  }, [ready, destination, nextManeuver]);

  // --- the truck, the heading, and following it ---------------------------
  // Guidance going live hands the camera straight back to the truck: the
  // briefing overview may have framed the whole route, and the recenter
  // threshold would otherwise hold that framing until the truck had
  // travelled far enough to trip it.
  const wasNavigatingRef = useRef(navigating);
  useEffect(() => {
    const map = mapRef.current;
    if (navigating && !wasNavigatingRef.current) lastCenteredRef.current = null;
    if (!navigating && wasNavigatingRef.current) {
      // The trip genuinely ended. Its heading ends with it — the next
      // trip must earn an orientation from its own travel evidence.
      headingRef.current = resetHeading();
      appliedBearingRef.current = 0;
      if (map !== null) {
        selfMoveRef.current = true;
        map.setBearing(0);
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        selfMoveRef.current = false;
      }
    }
    wasNavigatingRef.current = navigating;
    if (!ready || map === null || position === null) return;

    /*
     * THE HEADING, one step per gated fix. The route bearing is computed
     * here because this is where both the polyline and the matched
     * position are — the controller itself stays pure.
     */
    headingRef.current = headingStep(headingRef.current, {
      gpsHeadingDeg: headingDeg,
      speedMph,
      routeBearingDeg: navigating ? routeBearingAt(geometry, position) : null,
      tMs: Date.now(),
    });
    const bearing = cameraBearing(headingRef.current, navigating);

    // The truck marker. Its rotation is set in MAP space
    // (rotationAlignment 'map'), so the icon and the world turn together:
    // on a heading-up camera the nose points up the screen because the
    // map is rotated to the same angle, not because the icon was spun
    // independently of the road under it.
    const markerRotation = vehicleMarkerRotationDeg(headingRef.current.heading ?? headingDeg);
    if (truckRef.current === null) {
      const el = document.createElement('div');
      el.setAttribute('aria-label', 'Your truck');
      el.setAttribute('title', 'Your truck');
      el.style.cssText =
        `width:${VEHICLE_MARKER_PX}px;height:${VEHICLE_MARKER_PX}px;` +
        'display:flex;align-items:center;justify-content:center;pointer-events:none;' +
        'filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));';
      truckElRef.current = el;
      void loadMaplibre().then((maplibre) => {
        if (mapRef.current === null || truckRef.current !== null) return;
        truckRef.current = new maplibre.Marker({
          element: el,
          rotationAlignment: 'map',
          pitchAlignment: 'map',
        })
          .setLngLat([position.lng, position.lat])
          .setRotation(markerRotation)
          .addTo(mapRef.current);
      });
    } else {
      truckRef.current.setLngLat([position.lng, position.lat]);
      truckRef.current.setRotation(markerRotation);
    }
    if (truckElRef.current !== null) {
      // The artwork's internal counter-rotation keeps the wordmark
      // upright ON SCREEN, which is the marker's rotation MINUS the map's
      // bearing — north-up (bearing 0) reduces to exactly what it was.
      truckElRef.current.innerHTML = vehicleMarkerSvg(markerRotation - bearing);
    }

    const now = Date.now();
    if (navigating && shouldAutoRecenter(followRef.current, now)) {
      dispatch({ kind: 'recenter' });
      return; // the recenter path moves the camera
    }
    if (!shouldTrackPosition(followRef.current)) return;

    const bearingMoved =
      Math.abs(shortestDelta(appliedBearingRef.current, bearing)) >= BEARING_DEADBAND_DEG;
    /*
     * A CHANGED BOTTOM INSET IS ALSO A REASON TO MOVE THE CAMERA.
     *
     * This effect re-runs when `bottomInsetPx` changes, and then used to
     * return here — because the truck had not moved and the bearing had
     * not turned — so the new padding was computed and thrown away. The
     * camera kept whatever padding it applied on the LAST position
     * change, which at startup is the ease that ran before the layout had
     * measured itself: an inset of 0, and a truck parked at 71% of the
     * viewport with the cockpit band starting at 70%.
     *
     * That is the other half of the marker obstruction. The band being
     * measured correctly (DrivingScreen's one observed wrapper) is only
     * useful if a change in that measurement reaches the camera, and the
     * driver changes it constantly: hiding the clocks, an urgent band
     * appearing, a rotation, the browser chrome sliding away.
     *
     * Compared against what was APPLIED, not against the previous prop,
     * so this re-eases exactly once per real change and never on a
     * re-render that carries the same number.
     */
    const insetChanged = appliedInsetRef.current !== bottomInsetPx;
    if (!shouldRecenter(position, lastCenteredRef.current) && !bearingMoved && !insetChanged) {
      return;
    }

    const height = containerRef.current?.clientHeight ?? 0;
    selfMoveRef.current = true;
    map.easeTo({
      center: [position.lng, position.lat],
      zoom: followZoom(followRef.current, navigationZoom(speedMph)),
      bearing,
      // The truck rides the lower middle while guidance is live, so the
      // screen above it belongs to the road ahead.
      padding: followPadding(height, navigating, bottomInsetPx),
      duration: navigating ? CAMERA_EASE_MS : 0,
      essential: true,
    });
    selfMoveRef.current = false;
    appliedBearingRef.current = bearing;
    appliedInsetRef.current = bottomInsetPx;
    lastCenteredRef.current = { ...position };
  }, [ready, position, headingDeg, speedMph, navigating, geometry, bottomInsetPx, dispatch]);

  // --- overview: fit the whole route, north-up ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    if (follow.mode !== 'overview' || geometry.length < 2) return;
    // An overview answers "where does the whole route go?", and that
    // question is easiest to read north-up: the padding and the bearing
    // both stand down for it.
    selfMoveRef.current = true;
    map.fitBounds(boundsOf(geometry), {
      padding: 40,
      animate: false,
      bearing: 0,
      pitch: 0,
    });
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    selfMoveRef.current = false;
    appliedBearingRef.current = 0;
    // The camera is deliberately off the truck now: the next fix must not
    // quietly slide it back.
    lastCenteredRef.current = null;
  }, [ready, follow.mode, geometry]);

  // --- overview requested by the screen's gated button --------------------
  const lastOverviewKeyRef = useRef(overviewToggleKey);
  useEffect(() => {
    if (overviewToggleKey === lastOverviewKeyRef.current) return;
    lastOverviewKeyRef.current = overviewToggleKey;
    dispatch({ kind: 'overview', tMs: Date.now() });
  }, [overviewToggleKey, dispatch]);

  // --- imperative control handlers ----------------------------------------
  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (map === null) return;
    selfMoveRef.current = true;
    map.setZoom(map.getZoom() + delta);
    selfMoveRef.current = false;
    // A button zoom is the same intent as a pinch: keep following, keep
    // the driver's level. No Recenter prompt, because nothing detached.
    dispatch({ kind: 'user-zoomed', zoom: map.getZoom() });
  };

  /**
   * Recenter: back to the truck, back to heading-up, no provider call.
   * It restores the follow POSITION (lower middle) and the follow
   * BEARING together — a recenter that returned the truck to the middle
   * of a north-up map would be the bug this milestone exists to fix.
   */
  const recenter = () => {
    const map = mapRef.current;
    dispatch({ kind: 'recenter' });
    if (map !== null && position !== null) {
      const bearing = cameraBearing(headingRef.current, navigating);
      selfMoveRef.current = true;
      map.easeTo({
        center: [position.lng, position.lat],
        zoom: navigationZoom(speedMph),
        bearing,
        padding: followPadding(containerRef.current?.clientHeight ?? 0, navigating, bottomInsetPx),
        duration: 0,
        essential: true,
      });
      selfMoveRef.current = false;
      appliedBearingRef.current = bearing;
      lastCenteredRef.current = { ...position };
    }
  };

  return (
    /* nav-map scopes the cockpit tile/attribution treatment defined in
       navigator-design.css — presentation only, tiles and provider
       untouched. */
    <div className="nav-map relative h-full w-full">
      <div
        ref={containerRef}
        role="region"
        aria-label="Navigation map showing your truck, its route, and the destination"
        className="h-full w-full bg-asphalt-800"
      />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center text-lg text-muted">
          {failed ? 'Map unavailable — guidance continues below.' : 'Loading map…'}
        </div>
      ) : null}

      {/* Controls sit ON the map, right side, thumb-reachable — anchored
          at the vertical CENTER, not the bottom corner: on the
          full-screen driving surface the bottom band belongs to the trip
          strip and the Stop/voice row. They are SCREEN furniture, not map
          content: the world rotates underneath them and they stay
          upright, where the driver's thumb left them.

          CENTRED IN THE MAP THE DRIVER CAN SEE, not in the viewport.
          `top-1/2` measured the whole surface, and the cockpit band is
          the bottom fifth of it — so on a short screen the lower half of
          this column was UNDER the band. Measured in Chromium during
          guidance: the zoom-out button's centre hit the band, not the
          button, at 320x568 (column 216-352 against a band starting at
          316), 844x390 (127-263 against 181) and 932x430 (147-283
          against 221). A driver could not zoom out at all on either
          landscape shape or the smallest phone.

          `bottomInsetPx` is the same measured number the camera reserves
          — the distance from the band's top edge to the bottom of the
          surface — so this column and the followed truck are placed from
          one measurement of the real overlay, not from two guesses. At
          zero reserve (the parked map, which has no band) the container
          is the whole map and this is exactly the old centring. */}
      <div
        className="pointer-events-none absolute right-3 flex flex-col justify-center gap-2"
        style={{ top: '0.5rem', bottom: `calc(${bottomInsetPx}px + 0.5rem)` }}
      >
        {recenterVisible(follow) ? (
          <button
            type="button"
            onClick={recenter}
            className={`pointer-events-auto ${CONTROL} px-3 text-lg`}
            aria-label="Recenter the map on your truck"
          >
            Recenter
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => zoomBy(1)}
          className={`pointer-events-auto ${CONTROL}`}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          className={`pointer-events-auto ${CONTROL}`}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

/** Route bounds as MapLibre's [[w,s],[e,n]] pair. */
function boundsOf(geometry: readonly LatLng[]): [[number, number], [number, number]] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of geometry) {
    if (p.lng < w) w = p.lng;
    if (p.lng > e) e = p.lng;
    if (p.lat < s) s = p.lat;
    if (p.lat > n) n = p.lat;
  }
  return [
    [w, s],
    [e, n],
  ];
}
