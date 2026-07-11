import type { DirectoryEntry } from '@/lib/directory/types';
import { getEntriesWithCoordinates } from '@/lib/directory/data';
import {
  boundsForPoints,
  padBounds,
  STATE_BOUNDS,
  INTERSTATE_BOUNDS,
  US_BOUNDS,
  type LatLngBounds,
} from './bounds';
import { markersFromEntries, clusterMarkers, type MarkerCluster } from './cluster';

/**
 * Map data pipeline (Milestone 17): fetch coordinate-ready published
 * listings, filter them, and turn them into framed + clustered marker sets.
 * This is the connective tissue between the DB and the map foundation
 * components — the public map itself stays unmounted.
 */

export type MapScope = {
  category?: string;
  /** Two-letter state code. */
  state?: string;
  /** Interstate designation, e.g. "I-75". */
  interstate?: string;
};

/* ---------------- pure entry filters (unit-tested) ---------------- */

export function filterEntriesByCategory(
  entries: DirectoryEntry[],
  category: string,
): DirectoryEntry[] {
  return entries.filter((e) => e.category === category);
}

export function filterEntriesByState(
  entries: DirectoryEntry[],
  stateCode: string,
): DirectoryEntry[] {
  const code = stateCode.toUpperCase();
  return entries.filter((e) => e.state.toUpperCase() === code);
}

export function filterEntriesByInterstate(
  entries: DirectoryEntry[],
  designation: string,
): DirectoryEntry[] {
  const wanted = designation.toUpperCase();
  return entries.filter((e) => (e.interstate ?? '').toUpperCase() === wanted);
}

export function applyScope(entries: DirectoryEntry[], scope: MapScope): DirectoryEntry[] {
  let out = entries;
  if (scope.category) out = filterEntriesByCategory(out, scope.category);
  if (scope.state) out = filterEntriesByState(out, scope.state);
  if (scope.interstate) out = filterEntriesByInterstate(out, scope.interstate);
  return out;
}

/**
 * Framing bounds for a scope: data-driven when there are markers (padded so
 * edge markers don't hug the frame), fixed state/corridor presets when a
 * scope is named but empty, US fallback otherwise.
 */
export function boundsForScope(entries: DirectoryEntry[], scope: MapScope): LatLngBounds {
  const points = entries
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({ lat: e.lat as number, lng: e.lng as number }));
  const fitted = boundsForPoints(points);
  if (fitted) return padBounds(fitted, 0.15);
  if (scope.state && STATE_BOUNDS[scope.state.toUpperCase()])
    return STATE_BOUNDS[scope.state.toUpperCase()];
  if (scope.interstate && INTERSTATE_BOUNDS[scope.interstate.toUpperCase()])
    return INTERSTATE_BOUNDS[scope.interstate.toUpperCase()];
  return US_BOUNDS;
}

export type MapDataset = {
  entries: DirectoryEntry[];
  bounds: LatLngBounds;
  clusters: MarkerCluster[];
};

/** Cluster a scoped entry set into a render-ready dataset (pure). */
export function buildMapDataset(
  entries: DirectoryEntry[],
  scope: MapScope,
  clusterGridSize = 12,
): MapDataset {
  const scoped = applyScope(entries, scope);
  const bounds = boundsForScope(scoped, scope);
  const clusters = clusterMarkers(markersFromEntries(scoped), bounds, clusterGridSize);
  return { entries: scoped, bounds, clusters };
}

/** Server-side: fetch coordinate-ready listings and build the dataset. */
export async function getMapDataset(scope: MapScope = {}, clusterGridSize = 12) {
  const entries = await getEntriesWithCoordinates(scope);
  // Scope filters already applied by the query; re-applying is a no-op that
  // keeps the pure path and the fetch path identical.
  return buildMapDataset(entries, scope, clusterGridSize);
}
