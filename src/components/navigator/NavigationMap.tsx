'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
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
import { resolveMapStyle, type MapStyleId } from '@/lib/navigator/map-style';
import { vehicleMarkerRotationDeg, vehicleMarkerSvg, VEHICLE_MARKER_PX } from './vehicle-marker';

/**
 * The driving map (map-first milestone). Fills its container — the driving
 * screen gives it the viewport — and carries its own controls: zoom in/out,
 * recenter, route overview.
 *
 * Built on the map foundation this platform already ships: Leaflet over
 * OpenStreetMap raster tiles, no API key, dynamically imported in an effect
 * so nothing browser-only runs during SSR.
 *
 * Read-only by construction: it receives geometry and positions and owns no
 * engine, so it can never advance, replace, or mutate a route. Motion
 * policy is not decided here either — the screen passes `canZoom` down
 * from the shared LockGate, and this component only obeys it.
 */

const CONTROL =
  'flex min-h-16 min-w-16 items-center justify-center rounded-cockpit border border-line ' +
  'bg-nav-surface text-2xl font-semibold text-ink shadow-lg';

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
  /**
   * May the driver pan/zoom and open the overview right now? Decided by
   * the screen's LockGate, never by this component (doc 06 §1: one
   * authority for motion policy).
   */
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const tileRef = useRef<Leaflet.TileLayer | null>(null);
  const routeLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const truckRef = useRef<Leaflet.Marker | null>(null);
  const lastCenteredRef = useRef<LatLng | null>(null);
  const drawnRouteRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Follow state lives in a ref AND state: the ref is read inside Leaflet
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

  // --- create the map once ------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const L = (await import('leaflet')).default as unknown as typeof Leaflet;
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: [39.5, -98.35],
          zoom: 4,
          // Leaflet's own controls are replaced by the large, labelled
          // buttons below — 64 px targets, not 26 px ones.
          zoomControl: false,
          attributionControl: true,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          keyboard: false,
        });
        routeLayerRef.current = L.layerGroup().addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        // Any drag or pinch by the DRIVER detaches follow. Programmatic
        // camera moves set selfMoveRef first, so they never trip this.
        const onUserMove = () => {
          if (selfMoveRef.current) return;
          dispatch({ kind: 'user-panned', tMs: Date.now() });
        };
        map.on('dragstart', onUserMove);
        // Zoom is NOT a pan: it records the driver's zoom and leaves follow
        // mode alone. zoomend (not zoomstart) carries the settled level.
        map.on('zoomend', () => {
          if (selfMoveRef.current) return;
          dispatch({ kind: 'user-zoomed', zoom: map.getZoom() });
        });
        leafletRef.current = L;
        mapRef.current = map;
        setReady(true);
      } catch {
        setFailed(true); // the text guidance keeps working
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
      routeLayerRef.current = null;
      markerLayerRef.current = null;
      truckRef.current = null;
      drawnRouteRef.current = null;
      lastCenteredRef.current = null;
    };
  }, [dispatch]);

  // --- the canvas follows its container -----------------------------------
  /*
   * Leaflet measures its container ONCE, at creation, and re-measures on
   * its own only for a WINDOW resize (trackResize). This surface resizes
   * the CONTAINER without any window event: the parked page's map box
   * becomes the viewport-filling cockpit at trip start, and the
   * portrait ↔ landscape class swap moves it again — all with the map
   * deliberately kept mounted. Left stale, the canvas keeps rendering at
   * the old size: tiles stop partway down the box and the route line's
   * SVG still believes the old height — the pilot's "half the map, half
   * blank" screen, healed only by accident whenever browser chrome fired
   * a real window resize. Reproduced in Chromium at 390x844: tiles
   * covered 43% of the driving map and the overlay SVG was 0px tall
   * until one window resize re-measured it.
   *
   * A ResizeObserver re-measures on every container change instead.
   * Camera policy is untouched: invalidateSize preserves the current
   * center, fires no drag events (so follow state cannot see it as a
   * user pan), and changes no zoom. Guarded: the observer is absent in
   * the node test renders, and a map that failed to load has nothing to
   * re-measure.
   */
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!ready || el === null || map === null) return;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  // --- basemap style ------------------------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || L === null || map === null) return;
    const style = resolveMapStyle(styleId);
    if (style.tileUrl === null) return; // disabled style: keep what is drawn
    tileRef.current?.remove();
    tileRef.current = L.tileLayer(style.tileUrl, {
      attribution: style.attribution,
      maxZoom: style.maxZoom,
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [ready, styleId]);

  // --- gestures follow the lock, never a local speed check ---------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || map === null) return;
    // Two permissions, not one. Zoom rides along with driving; dragging the
    // camera off the truck does not. Both come from the shared LockGate —
    // this component still contains no speed check of its own.
    for (const h of [map.scrollWheelZoom, map.touchZoom, map.doubleClickZoom]) {
      if (canZoom) h.enable();
      else h.disable();
    }
    if (canPan) map.dragging.enable();
    else map.dragging.disable();
  }, [ready, canZoom, canPan]);

  // --- draw the route; redraw only when the ROUTE changes -----------------
  useEffect(() => {
    const L = leafletRef.current;
    const layer = routeLayerRef.current;
    if (!ready || L === null || layer === null) return;
    const key = `${routeId ?? 'none'}:${geometry.length}`;
    if (drawnRouteRef.current === key) return;
    layer.clearLayers();
    if (geometry.length >= 2) {
      const line = geometry.map((p) => [p.lat, p.lng] as [number, number]);
      // Route line per the design blueprint: electric cyan over a dark
      // casing so it reads over any tile. Cyan replaced the previous
      // yellow, which sat one hue from the TLWS brand yellow the blueprint
      // bans from the drive map. Same geometry, same weights, same redraw
      // rules — only the paint changed.
      L.polyline(line, { color: '#0f172a', weight: 12, opacity: 0.55 }).addTo(layer);
      L.polyline(line, { color: '#33C7FF', weight: 6, opacity: 1 }).addTo(layer);
      // Pre-drive briefing overview (design blueprint Phase 3): a route
      // drawn BEFORE guidance is live is framed whole, origin to
      // destination, so the flight-briefing map answers "where does this
      // go?" at a glance. Live guidance is untouched — with `navigating`
      // true this never runs, and the follow logic keeps sole authority
      // over the mid-drive camera.
      const map = mapRef.current;
      if (!navigating && map !== null) {
        selfMoveRef.current = true;
        map.fitBounds(L.latLngBounds(line), { padding: [40, 40], animate: false });
        selfMoveRef.current = false;
      }
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
    const L = leafletRef.current;
    const layer = markerLayerRef.current;
    if (!ready || L === null || layer === null) return;
    layer.clearLayers();
    // 36px boxes: the blueprint's pin floor — nothing on the map renders
    // smaller than a glanceable target, matching the vehicle badge's size.
    const pin = (at: LatLng, glyph: string, label: string, bg: string) => {
      const marker = L.marker([at.lat, at.lng], {
        icon: L.divIcon({ className: '', html: '', iconSize: [36, 36], iconAnchor: [18, 18] }),
        interactive: false,
        title: label,
        alt: label,
      }).addTo(layer);
      const el = marker.getElement();
      if (el) {
        el.textContent = glyph;
        el.style.cssText +=
          ';display:flex;align-items:center;justify-content:center;font-size:18px;' +
          `background:${bg};color:#0A0E13;border:2px solid #f8fafc;border-radius:9999px;` +
          'box-shadow:0 1px 4px rgba(0,0,0,.5);';
      }
    };
    // Blueprint semantics: the next-maneuver pin wears the route color, the
    // destination wears the good/open green. Dark glyphs on both so the
    // symbol survives daylight glare.
    if (nextManeuver !== null) pin(nextManeuver, '↱', 'Next maneuver', 'var(--nav-route)');
    if (destination !== null) pin(destination, '🏁', 'Destination', 'var(--nav-good)');
  }, [ready, destination, nextManeuver]);

  // --- the truck, and following it ---------------------------------------
  // Guidance going live hands the camera straight back to the truck: the
  // briefing overview (above) may have framed the whole route, and the
  // recenter threshold would otherwise hold that framing until the truck
  // had travelled far enough to trip it. Clearing the last-centered
  // memory makes the next tick center immediately — in the old flow the
  // camera was already on the truck, so this is a same-spot no-op there.
  const wasNavigatingRef = useRef(navigating);
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (navigating && !wasNavigatingRef.current) lastCenteredRef.current = null;
    wasNavigatingRef.current = navigating;
    if (!ready || L === null || map === null || position === null) return;

    if (truckRef.current === null) {
      truckRef.current = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
          className: '',
          html: '',
          iconSize: [VEHICLE_MARKER_PX, VEHICLE_MARKER_PX],
          iconAnchor: [VEHICLE_MARKER_PX / 2, VEHICLE_MARKER_PX / 2],
        }),
        interactive: false,
        zIndexOffset: 1000,
        title: 'Your truck',
        alt: 'Your truck',
      }).addTo(map);
    } else {
      truckRef.current.setLatLng([position.lat, position.lng]);
    }
    const el = truckRef.current.getElement();
    if (el) {
      // Heading-up: the marker points where the truck is going. The canvas
      // itself stays north-up so road labels remain readable.
      const rotate = vehicleMarkerRotationDeg(headingDeg);
      // The branded TL marker replaces the generic blue arrow. Same box,
      // same anchor, same rotation — only the artwork changed. The badge
      // draws its own ring and body, so the circle/border/background that
      // used to be CSS lives in the SVG now; the drop shadow stays here
      // because it has to fall outside the artwork.
      el.innerHTML = vehicleMarkerSvg(rotate);
      el.style.cssText +=
        ';display:flex;align-items:center;justify-content:center;' +
        'filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));';
      el.style.transform += ` rotate(${rotate}deg)`;
    }

    const now = Date.now();
    if (navigating && shouldAutoRecenter(followRef.current, now)) {
      dispatch({ kind: 'recenter' });
      return; // the recenter effect below moves the camera
    }
    if (!shouldTrackPosition(followRef.current)) return;
    if (shouldRecenter(position, lastCenteredRef.current)) {
      selfMoveRef.current = true;
      map.setView(
        [position.lat, position.lng],
        followZoom(followRef.current, navigationZoom(speedMph)),
        { animate: false },
      );
      selfMoveRef.current = false;
      lastCenteredRef.current = { ...position };
    }
  }, [ready, position, headingDeg, speedMph, navigating, dispatch]);

  // --- overview: fit the whole route --------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || L === null || map === null) return;
    if (follow.mode !== 'overview' || geometry.length < 2) return;
    selfMoveRef.current = true;
    map.fitBounds(L.latLngBounds(geometry.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [40, 40],
      animate: false,
    });
    selfMoveRef.current = false;
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
    // A button zoom is the same intent as a pinch: keep following, keep the
    // driver's level. No Recenter prompt, because nothing detached.
    dispatch({ kind: 'user-zoomed', zoom: map.getZoom() });
  };

  const recenter = () => {
    const map = mapRef.current;
    dispatch({ kind: 'recenter' });
    if (map !== null && position !== null) {
      selfMoveRef.current = true;
      map.setView([position.lat, position.lng], navigationZoom(speedMph), { animate: false });
      selfMoveRef.current = false;
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
          strip and the Stop/voice row, and a bottom-pinned stack sat
          underneath them. Center-right is clear of the maneuver card
          above and the control row below at every tested size, and on
          the parked page box it reads the same. */}
      <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
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
