'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from 'maplibre-gl';
import type { LatLng } from '@/lib/map/bounds';
import { boundsForPoints, padBounds } from '@/lib/map/bounds';
import { maplibreRasterStyle, resolveMapStyle } from '@/lib/navigator/map-style';
import type { ClockLimitMarker } from '@/lib/trip-planner/clock-limit-marker';
import type { PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import { planMapPoints } from '@/lib/trip-planner/plan-map';

/**
 * The Plan My Day results map.
 *
 * IT DRAWS THE PLAN, IT DOES NOT COMPUTE ONE. Every position here was
 * already cleared by the pure engines: a pin exists only where the
 * provider's timing was tight enough to earn one, a zone is drawn wherever
 * it was not, and a stop is only ever a marker if the driver can reach it
 * inside their buffered window. So there is no branch in this file that
 * decides what is safe to show — only branches that render a decision
 * already made.
 *
 * WHY THE REFUSALS ARE DOM AND NOT JUST MAP LAYERS. A driver whose clock
 * limit could not be placed must be able to READ that, not infer it from
 * an absent marker. The notices below sit outside the WebGL canvas so
 * they survive a failed tile load, a blocked GPU and a screen reader —
 * every state in which the map itself says nothing at all.
 */

/** Same load-once guard the Navigator uses; the package is ESM-only. */
type MaplibreModule = typeof import('maplibre-gl');
let maplibrePromise: Promise<MaplibreModule> | null = null;
function loadMaplibre(): Promise<MaplibreModule> {
  maplibrePromise ??= import('maplibre-gl').then(
    (m) => (m as { default?: MaplibreModule }).default ?? m,
  );
  return maplibrePromise;
}

const ROUTE_SOURCE = 'plan-route';
const ROUTE_LAYER = 'plan-route-line';
const ZONE_SOURCE = 'plan-zones';
const ZONE_LAYER = 'plan-zone-lines';

/** Marker colours, matched to the words beside them in the legend. */
const CLOCK_COLOR = '#F2B33D';
const STOP_COLOR = '#4FB477';
const BREAK_COLOR = '#6FA8DC';
const PARKING_COLOR = '#E8ECF1';

type Pin = { position: LatLng; color: string; title: string };

/** A zone is drawn as a thick segment — a pin would claim a precision we lack. */
type Zone = { from: LatLng; to: LatLng; color: string };

function collect(
  marker: ClockLimitMarker | null,
  color: string,
  title: string,
): { pin: Pin | null; zone: Zone | null } {
  if (marker === null || marker.kind === 'none') return { pin: null, zone: null };
  if (marker.kind === 'pin')
    return { pin: { position: marker.position, color, title }, zone: null };
  return { pin: null, zone: { from: marker.from, to: marker.to, color } };
}

export function PlanMap({ plan }: { plan: PlanMyDay }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<MlMarker[]>([]);
  const [failed, setFailed] = useState(false);

  const clock = collect(plan.clockLimit, CLOCK_COLOR, 'Clock limit');
  const stop = collect(plan.stopTarget, STOP_COLOR, 'Recommended stop');
  const brk = collect(plan.breakMarker, BREAK_COLOR, '30-minute break');

  const pins: Pin[] = [
    ...(clock.pin ? [clock.pin] : []),
    ...(stop.pin ? [stop.pin] : []),
    ...(brk.pin ? [brk.pin] : []),
    ...plan.map.parking.map((p) => ({ position: p.position, color: PARKING_COLOR, title: p.name })),
  ];
  const zones: Zone[] = [
    ...(clock.zone ? [clock.zone] : []),
    ...(stop.zone ? [stop.zone] : []),
    ...(brk.zone ? [brk.zone] : []),
  ];

  /*
   * NOTHING TO DRAW IS ITS OWN ANSWER. With no line, no pin and no zone,
   * a map is an empty grey rectangle that reads as a broken feature. The
   * notice below replaces it and names the reason instead.
   */
  const empty = plan.map.route.length < 2 && pins.length === 0 && zones.length === 0;

  const geoKey = JSON.stringify([plan.map.route.length, pins, zones]);

  useEffect(() => {
    if (empty || failed) return;
    let cancelled = false;
    void (async () => {
      try {
        const maplibre = await loadMaplibre();
        if (cancelled || !containerRef.current) return;
        const style = maplibreRasterStyle(resolveMapStyle('standard'));
        const map =
          mapRef.current ??
          new maplibre.Map({
            container: containerRef.current,
            style: (style ?? { version: 8, sources: {}, layers: [] }) as StyleSpecification,
            center: [-98.35, 39.5],
            zoom: 3,
            attributionControl: { compact: true },
            // A results map is read, not driven by. Rotation and pitch
            // would only let a thumb tilt it into an unreadable angle.
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
          });
        mapRef.current = map;

        const draw = () => {
          if (cancelled) return;
          const line = {
            type: 'FeatureCollection' as const,
            features:
              plan.map.route.length >= 2
                ? [
                    {
                      type: 'Feature' as const,
                      properties: {},
                      geometry: {
                        type: 'LineString' as const,
                        coordinates: plan.map.route.map((p) => [p.lng, p.lat]),
                      },
                    },
                  ]
                : [],
          };
          const zoneGeo = {
            type: 'FeatureCollection' as const,
            features: zones.map((z) => ({
              type: 'Feature' as const,
              properties: { color: z.color },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [z.from.lng, z.from.lat],
                  [z.to.lng, z.to.lat],
                ],
              },
            })),
          };

          const routeSrc = map.getSource(ROUTE_SOURCE);
          if (routeSrc) (routeSrc as maplibregl.GeoJSONSource).setData(line);
          else {
            map.addSource(ROUTE_SOURCE, { type: 'geojson', data: line });
            map.addLayer({
              id: ROUTE_LAYER,
              type: 'line',
              source: ROUTE_SOURCE,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#7FA6C9', 'line-width': 5, 'line-opacity': 0.9 },
            });
          }

          const zoneSrc = map.getSource(ZONE_SOURCE);
          if (zoneSrc) (zoneSrc as maplibregl.GeoJSONSource).setData(zoneGeo);
          else {
            map.addSource(ZONE_SOURCE, { type: 'geojson', data: zoneGeo });
            map.addLayer({
              id: ZONE_LAYER,
              type: 'line',
              source: ZONE_SOURCE,
              layout: { 'line-cap': 'butt' },
              // Deliberately fat and semi-transparent: a zone must read as
              // a stretch of road, never as a precise line on one.
              paint: { 'line-color': ['get', 'color'], 'line-width': 14, 'line-opacity': 0.55 },
            });
          }

          for (const m of markersRef.current) m.remove();
          markersRef.current = pins.map((p) => {
            const el = document.createElement('div');
            el.style.cssText = `width:18px;height:18px;border-radius:9999px;background:${p.color};border:2px solid #0A0E13;box-shadow:0 0 0 1px ${p.color}`;
            el.setAttribute('data-plan-pin', p.title);
            el.setAttribute('aria-hidden', 'true');
            return new maplibre.Marker({ element: el })
              .setLngLat([p.position.lng, p.position.lat])
              .addTo(map);
          });

          const all = planMapPoints(
            plan.map,
            [plan.clockLimit, plan.stopTarget, plan.breakMarker].filter(
              (m): m is ClockLimitMarker => m !== null,
            ),
          );
          const b = boundsForPoints(all);
          if (b !== null) {
            const p = padBounds(b, 0.18);
            map.fitBounds(
              [
                [p.west, p.south],
                [p.east, p.north],
              ],
              { padding: 24, duration: 0, maxZoom: 12 },
            );
          }
        };

        /*
         * THE SAFETY MARKERS MUST NOT DEPEND ON THE BASEMAP.
         *
         * This waited on `load`, which MapLibre fires only after the
         * first visually complete render — and on a connection that
         * cannot reach the tile server, that render never happens. The
         * measured result was a mounted canvas, a legend reading "Clock
         * limit — marked", and ZERO markers actually on the map: the
         * screen claimed to have drawn the driver's clock limit and had
         * not.
         *
         * That is the wrong failure to have in a truck, because bad
         * signal and needing the plan are the same moment. `style.load`
         * fires as soon as the style is parsed, with no tile involved,
         * and `idle` is a second chance for any path that misses it.
         * `draw` is idempotent — it updates existing sources and clears
         * its markers before re-adding them — so running twice is safe
         * and running never is not.
         */
        if (map.isStyleLoaded()) draw();
        else {
          map.once('style.load', draw);
          map.once('load', draw);
          map.once('idle', draw);
        }
      } catch {
        // A renderer that will not start is a rendering failure, not a
        // planning one: the plan above is still correct and still read.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey, empty, failed]);

  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <section
      className="rounded-cockpit border border-line bg-nav-surface p-4"
      aria-labelledby="map-heading"
    >
      <h2 id="map-heading" className="text-xl font-bold text-ink">
        Your day on the map
      </h2>

      {empty || failed ? (
        <p
          className="mt-2 rounded-cockpit border border-line border-l-4 border-l-nav-warn px-3 py-2 text-lg font-semibold text-ink"
          data-map-state={failed ? 'failed' : 'empty'}
        >
          {failed
            ? 'The map could not be drawn on this device. Your plan above is unaffected.'
            : 'There is nothing that can be safely drawn for this trip yet.'}
        </p>
      ) : (
        <div
          ref={containerRef}
          data-plan-map=""
          className="mt-2 h-64 w-full overflow-hidden rounded-cockpit border border-line"
        />
      )}

      {/* The route line's own refusal, always readable as text. */}
      {plan.map.routeProblem === null ? null : (
        <p className="mt-2 text-base leading-snug text-ink/70" data-route-problem="">
          {plan.map.routeProblem}
        </p>
      )}

      {/* The legend doubles as the non-visual record of what was drawn. */}
      <ul className="mt-3 space-y-1 list-none p-0" data-map-legend="">
        <LegendRow color={CLOCK_COLOR} marker={plan.clockLimit} label="Clock limit" />
        <LegendRow color={STOP_COLOR} marker={plan.stopTarget} label="Recommended stop" />
        <LegendRow color={BREAK_COLOR} marker={plan.breakMarker} label="30-minute break" />
        <li className="flex items-center gap-2 text-base text-ink/70">
          <Dot color={PARKING_COLOR} />
          {plan.map.parking.length === 0
            ? 'Parking — none safe enough to map'
            : `Parking you can safely reach (${plan.map.parking.length})`}
        </li>
      </ul>
    </section>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function LegendRow({
  color,
  marker,
  label,
}: {
  color: string;
  marker: ClockLimitMarker | null;
  label: string;
}) {
  const state = marker === null ? 'none' : marker.kind;
  return (
    <li className="flex items-center gap-2 text-base text-ink/70" data-legend={`${label}:${state}`}>
      <Dot color={color} />
      {label} —{' '}
      {state === 'pin'
        ? 'marked'
        : state === 'zone'
          ? 'shown as a zone (timing is coarse here)'
          : 'not placed'}
    </li>
  );
}
