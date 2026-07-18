import type { PlannerAnchor } from './directory-loader';
import type { GeocodeMatch, PlaceKind } from './here-geocode';

/**
 * Unified place-search results (free-text search milestone). Merges two
 * suggestion sources into one labeled, ranked list:
 *
 *   1. Directory anchors — verified truck stops / directory locations the
 *      platform already knows (local, free, instant, offline).
 *   2. HERE geocoding — arbitrary cities, addresses, and ZIP codes.
 *
 * Pure and deterministic so the merge/ranking/labeling is fully testable
 * offline. The UI renders `source` and `kind` so a driver can always tell a
 * directory truck stop from a general address or city.
 */

export type PlaceSource = 'directory' | 'here';

export type PlaceResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  source: PlaceSource;
  /** 'directory' for anchors; the geocode kind for HERE results. */
  kind: 'directory' | PlaceKind;
  stateCode: string | null;
};

const validCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Case/space-insensitive substring match for local directory filtering. */
function anchorMatches(anchor: PlannerAnchor, needle: string): boolean {
  return anchor.label.toLowerCase().includes(needle);
}

/**
 * Filter already-loaded directory anchors by a query (offline, free). Kept
 * separate so the client can suggest directory locations without spending a
 * HERE transaction on every keystroke.
 */
export function filterDirectoryAnchors(
  anchors: PlannerAnchor[],
  query: string,
  limit = 5,
): PlaceResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const out: PlaceResult[] = [];
  for (const a of anchors) {
    if (out.length >= limit) break;
    if (!anchorMatches(a, needle)) continue;
    if (!validCoord(a.lat, a.lng)) continue;
    out.push({
      id: `dir-${a.id}`,
      label: a.label,
      lat: a.lat,
      lng: a.lng,
      source: 'directory',
      kind: 'directory',
      stateCode: a.state || null,
    });
  }
  return out;
}

/** Map validated HERE matches into PlaceResults. */
export function hereMatchesToPlaces(matches: GeocodeMatch[]): PlaceResult[] {
  const out: PlaceResult[] = [];
  for (const m of matches) {
    if (!validCoord(m.position.lat, m.position.lng)) continue;
    out.push({
      id: m.id,
      label: m.label,
      lat: m.position.lat,
      lng: m.position.lng,
      source: 'here',
      kind: m.kind,
      stateCode: m.stateCode,
    });
  }
  return out;
}

/**
 * Merge directory + HERE results into one list. Directory locations rank
 * first (they carry parking/amenity data the planner can use), then HERE
 * matches. De-duplicates by rounded coordinate so a directory stop that HERE
 * also returns is not shown twice.
 */
export function mergePlaceResults(
  directory: PlaceResult[],
  here: PlaceResult[],
  limit = 8,
): PlaceResult[] {
  const seen = new Set<string>();
  const key = (p: PlaceResult) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
  const out: PlaceResult[] = [];
  for (const p of [...directory, ...here]) {
    if (out.length >= limit) break;
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Short UI badge text for a result's source/kind. */
export function placeBadge(p: PlaceResult): string {
  if (p.source === 'directory') return 'Directory';
  switch (p.kind) {
    case 'address':
      return 'Address';
    case 'city':
      return 'City';
    case 'postal':
      return 'ZIP';
    case 'poi':
      return 'Place';
    case 'area':
      return 'Region';
    default:
      return 'Location';
  }
}
