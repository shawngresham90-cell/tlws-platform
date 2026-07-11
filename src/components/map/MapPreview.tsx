'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

/**
 * Small single-marker map preview for listing detail pages (Milestone 20).
 * Reuses the M19 foundation: OpenStreetMap tiles (no API keys), Leaflet
 * dynamically imported in an effect so nothing browser-only runs during SSR —
 * and only once the container actually scrolls near the viewport
 * (IntersectionObserver), so the detail page doesn't pay for Leaflet up
 * front. Renders nothing clever on failure: the static fallback text stays.
 */

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function MapPreview({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import('leaflet')).default as unknown as typeof Leaflet;
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: [lat, lng],
          zoom: 13,
          scrollWheelZoom: false,
          dragging: true,
        });
        L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
        const icon = L.divIcon({ className: '', html: '', iconSize: [34, 34], iconAnchor: [17, 17] });
        const marker = L.marker([lat, lng], { icon, keyboard: true, title: name, alt: name });
        marker.addTo(map);
        // Style the divIcon element directly (no HTML string interpolation).
        const el = marker.getElement();
        if (el) {
          el.textContent = '📍';
          el.style.cssText +=
            ';display:flex;align-items:center;justify-content:center;font-size:17px;' +
            'background:#1f2937;border:2px solid #facc15;border-radius:9999px;' +
            'box-shadow:0 1px 4px rgba(0,0,0,.5);';
        }
        mapRef.current = map;
        setReady(true);
      } catch {
        // Fallback text below keeps rendering; directions links still work.
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Map showing the location of ${name}`}
      className="h-64 w-full overflow-hidden rounded-card border border-line bg-asphalt-800 sm:h-80"
    >
      {!ready && (
        <div className="flex h-full items-center justify-center text-sm text-muted" aria-hidden="true">
          Loading map preview…
        </div>
      )}
    </div>
  );
}
