'use client';

import { useMemo } from 'react';
import { projectToUnit, type LatLngBounds } from '@/lib/map/bounds';
import {
  clusterMarkers,
  filterMarkers,
  type MapMarkerDatum,
  type MarkerCluster,
} from '@/lib/map/cluster';
import { MapMarker, ClusterMarker } from './MapMarker';

/**
 * Map foundation canvas — NOT the final interactive map. A dependency-free
 * SVG surface that projects markers into given bounds (equirectangular),
 * clusters them on a grid, and supports category filtering. It exists so the
 * marker/cluster/filter/bounds model is real and testable before a map
 * provider is chosen; swapping in a vendor map later means replacing this
 * component's rendering only. No API keys, intentionally unrouted.
 */

const VIEW_W = 800;
const VIEW_H = 500;

export function MapCanvas({
  bounds,
  markers,
  activeCategories = [],
  clusterGridSize = 12,
  onMarkerClick,
  onClusterClick,
  ariaLabel = 'Directory map',
}: {
  /** Framing bounds — a STATE_BOUNDS / INTERSTATE_BOUNDS entry or boundsForPoints(). */
  bounds: LatLngBounds;
  markers: MapMarkerDatum[];
  /** Category slugs to show; empty = all. */
  activeCategories?: string[];
  /** Grid resolution for clustering; raise as the final map zooms. */
  clusterGridSize?: number;
  onMarkerClick?: (marker: MapMarkerDatum) => void;
  onClusterClick?: (cluster: MarkerCluster) => void;
  ariaLabel?: string;
}) {
  const clusters = useMemo(
    () => clusterMarkers(filterMarkers(markers, activeCategories), bounds, clusterGridSize),
    [markers, activeCategories, bounds, clusterGridSize],
  );

  const toSvg = (lat: number, lng: number) => {
    const { x, y } = projectToUnit(bounds, { lat, lng });
    return { x: x * VIEW_W, y: y * VIEW_H };
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full rounded-card border border-line bg-asphalt-800"
    >
      {clusters.length === 0 && (
        <text
          x={VIEW_W / 2}
          y={VIEW_H / 2}
          textAnchor="middle"
          fontSize={16}
          fill="currentColor"
          opacity={0.6}
        >
          No mappable locations yet — coordinates load with a future geocoding pass.
        </text>
      )}
      {clusters.map((cluster, i) => {
        if (cluster.markers.length === 1) {
          const marker = cluster.markers[0];
          const { x, y } = toSvg(marker.lat, marker.lng);
          return <MapMarker key={marker.id} marker={marker} x={x} y={y} onClick={onMarkerClick} />;
        }
        const { x, y } = toSvg(cluster.lat, cluster.lng);
        return (
          <ClusterMarker key={`c-${i}`} cluster={cluster} x={x} y={y} onClick={onClusterClick} />
        );
      })}
    </svg>
  );
}
