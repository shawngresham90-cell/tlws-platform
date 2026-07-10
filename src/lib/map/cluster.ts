import type { DirectoryEntry } from '@/lib/directory/types';
import { boundsContain, projectToUnit, type LatLngBounds, type LatLng } from './bounds';

/**
 * Marker + clustering model for the future directory map. Pure functions —
 * no provider SDK — so the same clustering works whether the final map is
 * SVG, canvas, or a vendor map, and it's unit-testable today.
 */

export type MapMarkerDatum = {
  id: string;
  name: string;
  /** Directory category slug — drives icon + filtering. */
  category: string;
  lat: number;
  lng: number;
  featured: boolean;
};

export type MarkerCluster = {
  /** Cluster centroid. */
  lat: number;
  lng: number;
  markers: MapMarkerDatum[];
};

/** Entries that can appear on a map (published rows with coordinates). */
export function markersFromEntries(entries: DirectoryEntry[]): MapMarkerDatum[] {
  return entries
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      lat: e.lat as number,
      lng: e.lng as number,
      featured: e.featured ?? false,
    }));
}

/** Category filter for markers; empty selection means "show everything". */
export function filterMarkers(
  markers: MapMarkerDatum[],
  activeCategories: string[],
): MapMarkerDatum[] {
  if (activeCategories.length === 0) return markers;
  const active = new Set(activeCategories);
  return markers.filter((m) => active.has(m.category));
}

/**
 * Grid clustering: the viewport is cut into `gridSize` × `gridSize` cells and
 * markers in the same cell merge into one cluster at their centroid. Simple,
 * deterministic, and fast enough for tens of thousands of markers; the final
 * map can raise gridSize as the user zooms in.
 */
export function clusterMarkers(
  markers: MapMarkerDatum[],
  bounds: LatLngBounds,
  gridSize = 12,
): MarkerCluster[] {
  const cells = new Map<string, MapMarkerDatum[]>();
  for (const m of markers) {
    const p: LatLng = { lat: m.lat, lng: m.lng };
    if (!boundsContain(bounds, p)) continue;
    const { x, y } = projectToUnit(bounds, p);
    const key = `${Math.min(gridSize - 1, Math.floor(x * gridSize))}:${Math.min(
      gridSize - 1,
      Math.floor(y * gridSize),
    )}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(m);
  }
  return [...cells.values()].map((cellMarkers) => ({
    lat: cellMarkers.reduce((sum, m) => sum + m.lat, 0) / cellMarkers.length,
    lng: cellMarkers.reduce((sum, m) => sum + m.lng, 0) / cellMarkers.length,
    markers: cellMarkers,
  }));
}
