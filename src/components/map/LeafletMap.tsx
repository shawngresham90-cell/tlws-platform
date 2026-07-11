'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { getCategory } from '@/lib/directory/categories';
import { clusterMarkers, markersFromEntries } from '@/lib/map/cluster';
import { boundsForPoints } from '@/lib/map/bounds';
import { gridSizeForZoom, directionsUrl, type ExploreResult, type ExploreOrigin } from '@/lib/map/explore';
import { detailHref } from '@/lib/directory/detail-slug';

/**
 * The interactive Leaflet + OpenStreetMap surface (Milestone 19). Leaflet is
 * dynamically imported inside an effect, so nothing browser-only runs during
 * SSR and the library never blocks initial page render. Markers reuse the
 * existing grid-clustering helpers; popup content is built with
 * document.createElement (never innerHTML with data), so listing text cannot
 * inject markup. No API keys — OSM tiles with proper attribution.
 */

type LeafletModule = typeof Leaflet;

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Hard cap on rendered markers, over and above clustering. */
const MAX_MARKERS = 500;

export function LeafletMap({
  results,
  selectedId,
  onSelect,
  origin,
  fitKey,
  focus = null,
  onError,
}: {
  results: ExploreResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin: ExploreOrigin | null;
  /** Changes whenever the map should refit to the current results. */
  fitKey: number;
  /** Deep-link focus (?listing=): zoom to this point instead of fitting all results. */
  focus?: { lat: number; lng: number } | null;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const originLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [zoomTick, setZoomTick] = useState(0);

  // Keep latest props available to map event handlers without re-binding.
  const stateRef = useRef({ results, selectedId, onSelect });
  stateRef.current = { results, selectedId, onSelect };

  /* ------------------------------------------------ init (lazy) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = (await import('leaflet')).default as unknown as LeafletModule;
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: [33.2, -84.3],
          zoom: 6,
          scrollWheelZoom: true,
          worldCopyJump: true,
        });
        L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
        map.on('zoomend', () => setZoomTick((t) => t + 1));
        leafletRef.current = L;
        mapRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        originLayerRef.current = L.layerGroup().addTo(map);
        setReady(true);
      } catch {
        if (!cancelled) onError();
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------ popup builder (escaped) */
  function buildPopup(entry: ExploreResult): HTMLElement {
    const root = document.createElement('div');
    root.style.minWidth = '200px';
    const add = (tag: string, text: string, bold = false) => {
      const el = document.createElement(tag);
      el.textContent = text;
      if (bold) el.style.fontWeight = '700';
      root.appendChild(el);
      return el;
    };
    add('div', entry.name, true);
    const cat = getCategory(entry.category);
    add('div', `${cat ? `${cat.icon} ${cat.title}` : entry.category} · ${entry.city}, ${entry.state}`);
    if (entry.distanceMiles != null) add('div', `${entry.distanceMiles} mi away`);
    if (entry.phone) add('div', `☎ ${entry.phone}`);
    if (entry.amenities?.length) add('div', entry.amenities.slice(0, 6).join(' · '));

    const links = document.createElement('div');
    links.style.marginTop = '6px';
    links.style.display = 'flex';
    links.style.gap = '10px';
    links.style.flexWrap = 'wrap';
    if (entry.detailSlug) {
      const a = document.createElement('a');
      a.href = detailHref(entry.detailSlug);
      a.textContent = 'View details';
      a.style.fontWeight = '700';
      links.appendChild(a);
    }
    if (entry.website) {
      const a = document.createElement('a');
      a.href = entry.website;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Website';
      links.appendChild(a);
    }
    if (entry.tpcUrl) {
      const a = document.createElement('a');
      a.href = entry.tpcUrl;
      a.target = '_blank';
      a.rel = 'sponsored noopener noreferrer';
      a.textContent = 'Reserve a spot';
      links.appendChild(a);
    }
    const dir = directionsUrl(entry);
    if (dir) {
      const a = document.createElement('a');
      a.href = dir;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Directions';
      a.setAttribute('aria-label', `Get directions to ${entry.name} (opens in new tab)`);
      links.appendChild(a);
    }
    root.appendChild(links);
    return root;
  }

  /* ------------------------------------------------ markers + clusters */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!L || !map || !layer || !ready) return;

    layer.clearLayers();
    const capped = results.slice(0, MAX_MARKERS);
    const markerData = markersFromEntries(capped);
    const byId = new Map(capped.map((e) => [e.id, e]));
    const fitted = boundsForPoints(markerData.map((m) => ({ lat: m.lat, lng: m.lng })));
    if (!fitted) return;
    const clusters = clusterMarkers(markerData, fitted, gridSizeForZoom(map.getZoom()));

    for (const cluster of clusters) {
      if (cluster.markers.length === 1) {
        const m = cluster.markers[0];
        const entry = byId.get(m.id);
        const cat = getCategory(m.category);
        const selected = m.id === stateRef.current.selectedId;
        const icon = L.divIcon({
          className: '',
          html: '',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = L.marker([m.lat, m.lng], {
          icon,
          keyboard: true,
          title: m.name,
          alt: `${cat?.title ?? m.category}: ${m.name}`,
        });
        marker.addTo(layer);
        // Style the divIcon element directly (no HTML string interpolation).
        const el = marker.getElement();
        if (el) {
          el.textContent = cat?.icon ?? '📍';
          el.style.cssText +=
            ';display:flex;align-items:center;justify-content:center;font-size:17px;' +
            `background:${selected ? '#facc15' : '#1f2937'};border:2px solid ${
              selected ? '#1f2937' : '#facc15'
            };border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,.5);`;
        }
        if (entry) marker.bindPopup(buildPopup(entry), { closeButton: true });
        marker.on('click', () => stateRef.current.onSelect(m.id));
        if (selected) marker.openPopup();
      } else {
        const icon = L.divIcon({ className: '', html: '', iconSize: [36, 36], iconAnchor: [18, 18] });
        const marker = L.marker([cluster.lat, cluster.lng], {
          icon,
          keyboard: true,
          alt: `${cluster.markers.length} locations — zoom in`,
        });
        marker.addTo(layer);
        const el = marker.getElement();
        if (el) {
          el.textContent = String(cluster.markers.length);
          el.style.cssText +=
            ';display:flex;align-items:center;justify-content:center;font-weight:700;' +
            'font-size:13px;color:#111827;background:#facc15;border:2px solid #1f2937;' +
            'border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,.5);';
        }
        marker.on('click', () =>
          map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 15)),
        );
      }
    }
  }, [results, selectedId, ready, zoomTick]);

  /* ------------------------------------------------ origin marker */
  useEffect(() => {
    const L = leafletRef.current;
    const layer = originLayerRef.current;
    if (!L || !layer || !ready) return;
    layer.clearLayers();
    if (!origin) return;
    const icon = L.divIcon({ className: '', html: '', iconSize: [30, 30], iconAnchor: [15, 15] });
    const marker = L.marker([origin.lat, origin.lng], { icon, alt: `Search origin: ${origin.label}` });
    marker.addTo(layer);
    const el = marker.getElement();
    if (el) {
      el.textContent = '📍';
      el.style.cssText +=
        ';display:flex;align-items:center;justify-content:center;font-size:18px;' +
        'background:#2563eb;border:2px solid #fff;border-radius:9999px;';
    }
  }, [origin, ready]);

  /* ------------------------------------------------ fit to results */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (focus) {
      map.setView([focus.lat, focus.lng], 13);
      return;
    }
    const points = results
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({ lat: e.lat as number, lng: e.lng as number }));
    if (origin) points.push({ lat: origin.lat, lng: origin.lng });
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    const b = boundsForPoints(points);
    if (b) map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready, focus]);

  /* ------------------------------------------------ pan to selection */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const entry = results.find((e) => e.id === selectedId);
    if (entry && entry.lat != null && entry.lng != null) {
      map.panTo([entry.lat, entry.lng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Interactive directory map. Results are also available in the list below."
      className="h-[420px] w-full rounded-card border border-line bg-asphalt-800 sm:h-[540px]"
    >
      {!ready && (
        <div className="flex h-full items-center justify-center text-sm text-muted" aria-hidden="true">
          Loading map…
        </div>
      )}
    </div>
  );
}
