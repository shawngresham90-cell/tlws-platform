'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import type { LatLng } from '@/lib/map/bounds';
import { navigationZoom, shouldRecenter } from '@/lib/navigator/map-view';

/**
 * Live navigation map (pilot round 1). The first road test ran text-only;
 * a driver must be able to see where they are, what road they are on, and
 * where they are going.
 *
 * Deliberately built on the map foundation this platform already ships —
 * Leaflet with OpenStreetMap tiles, no API key, dynamically imported in an
 * effect so nothing browser-only runs during SSR. It renders the route
 * line, the truck (rotated to heading), the next maneuver, and the
 * destination; it FOLLOWS the truck rather than rotating the whole canvas,
 * which keeps road labels upright and readable.
 *
 * Read-only by construction: it receives geometry and positions, and owns
 * no engine. It cannot advance, replace, or mutate a route.
 */

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function NavigationMap({
  geometry,
  position,
  headingDeg,
  speedMph,
  destination,
  nextManeuver,
  routeId,
}: {
  /** The route line, in order. Empty renders an honest empty map. */
  geometry: readonly LatLng[];
  /** The truck. Null before the first fix. */
  position: LatLng | null;
  headingDeg: number | null;
  speedMph: number | null;
  destination: LatLng | null;
  nextManeuver: LatLng | null;
  /** Changes on every route replacement — the redraw trigger. */
  routeId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const routeLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const truckRef = useRef<Leaflet.Marker | null>(null);
  const lastCenteredRef = useRef<LatLng | null>(null);
  const drawnRouteRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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
          zoomControl: false,
          attributionControl: true,
          // A driving surface: no accidental pans or pinches from a hand
          // braced on the phone. The map follows the truck instead.
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          keyboard: false,
        });
        L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        leafletRef.current = L;
        mapRef.current = map;
        setReady(true);
      } catch {
        setFailed(true); // the text guidance below keeps working
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      markerLayerRef.current = null;
      truckRef.current = null;
      drawnRouteRef.current = null;
      lastCenteredRef.current = null;
    };
  }, []);

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
      // Casing under the route line so it stays legible over any tile.
      L.polyline(line, { color: '#0f172a', weight: 11, opacity: 0.55 }).addTo(layer);
      L.polyline(line, { color: '#facc15', weight: 6, opacity: 1 }).addTo(layer);
    }
    drawnRouteRef.current = key;
  }, [ready, geometry, routeId]);

  // --- destination + next maneuver ---------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const layer = markerLayerRef.current;
    if (!ready || L === null || layer === null) return;
    layer.clearLayers();
    const pin = (at: LatLng, glyph: string, label: string, bg: string) => {
      const marker = L.marker([at.lat, at.lng], {
        icon: L.divIcon({ className: '', html: '', iconSize: [30, 30], iconAnchor: [15, 15] }),
        interactive: false,
        title: label,
        alt: label,
      }).addTo(layer);
      const el = marker.getElement();
      if (el) {
        el.textContent = glyph;
        el.style.cssText +=
          ';display:flex;align-items:center;justify-content:center;font-size:15px;' +
          `background:${bg};border:2px solid #f8fafc;border-radius:9999px;` +
          'box-shadow:0 1px 4px rgba(0,0,0,.5);';
      }
    };
    if (nextManeuver !== null) pin(nextManeuver, '↱', 'Next maneuver', '#1d4ed8');
    if (destination !== null) pin(destination, '🏁', 'Destination', '#166534');
  }, [ready, destination, nextManeuver]);

  // --- follow the truck ---------------------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || L === null || map === null || position === null) return;

    if (truckRef.current === null) {
      truckRef.current = L.marker([position.lat, position.lng], {
        icon: L.divIcon({ className: '', html: '', iconSize: [36, 36], iconAnchor: [18, 18] }),
        interactive: false,
        zIndexOffset: 1000,
        title: 'Your truck',
        alt: 'Your truck',
      }).addTo(map);
    } else {
      truckRef.current.setLatLng([position.lat, position.lng]);
    }
    // Heading rides on the marker as rotation — the arrow points where the
    // truck is going, which is the part of "rotate with heading" a driver
    // actually reads. Labels stay upright.
    const el = truckRef.current.getElement();
    if (el) {
      el.textContent = '➤';
      el.style.cssText +=
        ';display:flex;align-items:center;justify-content:center;font-size:20px;color:#0f172a;' +
        'background:#38bdf8;border:3px solid #f8fafc;border-radius:9999px;' +
        'box-shadow:0 2px 6px rgba(0,0,0,.6);';
      // The glyph points east at rest, so subtract a quarter turn.
      const rotate = headingDeg === null || !Number.isFinite(headingDeg) ? 0 : headingDeg - 90;
      el.style.transform += ` rotate(${rotate}deg)`;
    }

    if (shouldRecenter(position, lastCenteredRef.current)) {
      map.setView([position.lat, position.lng], navigationZoom(speedMph), { animate: false });
      lastCenteredRef.current = { ...position };
    }
  }, [ready, position, headingDeg, speedMph]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Navigation map showing your truck, its route, and the destination"
      className="h-72 w-full overflow-hidden rounded-card border border-line bg-asphalt-800 sm:h-96"
    >
      {!ready ? (
        <div className="flex h-full items-center justify-center text-lg text-muted">
          {failed ? 'Map unavailable — guidance continues below.' : 'Loading map…'}
        </div>
      ) : null}
    </div>
  );
}
