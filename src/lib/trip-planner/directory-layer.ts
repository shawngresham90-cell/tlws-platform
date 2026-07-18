import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';
import type { StopCandidate, StopKind } from './types';

/**
 * Directory integration layer (Phase 3). Turns geocoded directory listings
 * into ranked stop candidates for the planner. Pure: the caller supplies the
 * listing rows (however it fetched them — server component, snapshot file,
 * test fixture); this module never touches the network or the database.
 *
 * Only listings with VERIFIED-GRADE coordinates should be offered to the
 * planner; `toStopCandidates` enforces that by dropping rows without
 * coordinates and recording provenance on the rest.
 */

/** The subset of a directory listing the planner consumes. */
export type DirectoryListing = {
  id: string;
  name: string;
  categorySlug: string | null;
  lat: number | null;
  lng: number | null;
  state: string | null;
  interstate: string | null;
  exitNumber: string | null;
  parkingSpaces: number | null;
  overnightParking: boolean | null;
  reservationUrl: string | null;
  amenities: string[] | null;
  fuelBrands: string[] | null;
  coordVerificationStatus: string | null;
};

/** A point along the route with its cumulative route-mile. */
export type RoutePoint = { position: LatLng; routeMile: number };

/**
 * Project a listing onto the route: nearest sampled route point wins.
 * Returns null when the listing is farther than `maxOffRouteMiles` from
 * every sampled point (not a usable stop for this trip).
 */
export function projectOntoRoute(
  position: LatLng,
  routePoints: RoutePoint[],
  maxOffRouteMiles: number,
): { routeMile: number; offRouteMiles: number } | null {
  let best: { routeMile: number; offRouteMiles: number } | null = null;
  for (const p of routePoints) {
    const d = haversineMiles(position, p.position);
    if (d <= maxOffRouteMiles && (best === null || d < best.offRouteMiles)) {
      best = { routeMile: p.routeMile, offRouteMiles: Number(d.toFixed(2)) };
    }
  }
  return best;
}

/**
 * Convert listings to route-positioned stop candidates. Drops listings
 * without coordinates and listings too far off route. Sampled route points
 * should be dense enough for the corridor (every few miles).
 */
export function toStopCandidates(
  listings: DirectoryListing[],
  routePoints: RoutePoint[],
  maxOffRouteMiles = 5,
): StopCandidate[] {
  const out: StopCandidate[] = [];
  for (const l of listings) {
    if (l.lat == null || l.lng == null) continue;
    const projected = projectOntoRoute({ lat: l.lat, lng: l.lng }, routePoints, maxOffRouteMiles);
    if (!projected) continue;
    out.push({
      id: l.id,
      name: l.name,
      categorySlug: l.categorySlug ?? 'other',
      position: { lat: l.lat, lng: l.lng },
      routeMile: projected.routeMile,
      offRouteMiles: projected.offRouteMiles,
      parkingSpaces: l.parkingSpaces,
      overnightParking: l.overnightParking ?? false,
      reservationUrl: l.reservationUrl,
      amenities: (l.amenities ?? []).map((a) => a.toLowerCase()),
      fuelBrands: (l.fuelBrands ?? []).map((b) => b.toLowerCase()),
      coordVerificationStatus: l.coordVerificationStatus,
      state: (l.state ?? '').toUpperCase(),
      interstate: l.interstate,
      exitNumber: l.exitNumber,
    });
  }
  return out.sort((a, b) => a.routeMile - b.routeMile);
}

/* ----------------------------------------------------------------- scoring */

export type ScoreBreakdown = {
  total: number;
  components: Record<string, number>;
};

/** Categories that can serve each planner need. */
export const NEED_CATEGORIES: Record<'fuel' | 'break' | 'overnight' | 'parking', string[]> = {
  fuel: ['truck-stops'],
  break: ['truck-stops', 'parking', 'rest-areas', 'restaurants'],
  overnight: ['truck-stops', 'parking', 'hotels-truck-parking', 'rest-areas'],
  parking: ['parking', 'truck-stops', 'rest-areas'],
};

/**
 * Truck-stop scoring: deterministic, explainable, tunable. Higher = better.
 * Components are returned so the UI (later phase) can explain a ranking.
 */
export function scoreCandidate(
  c: StopCandidate,
  need: 'fuel' | 'break' | 'overnight' | 'parking',
  opts: { preferredFuelBrands?: string[] } = {},
): ScoreBreakdown {
  const components: Record<string, number> = {};

  // Category fit: primary category for the need scores highest.
  const cats = NEED_CATEGORIES[need];
  const catIdx = cats.indexOf(c.categorySlug);
  components.category = catIdx === 0 ? 30 : catIdx > 0 ? 18 : 0;

  // Verified coordinates beat unverified — the planner is sending a driver here.
  components.coordinates =
    c.coordVerificationStatus === 'manually-verified'
      ? 15
      : c.coordVerificationStatus === 'machine-checked'
        ? 8
        : 0;

  // Parking capacity (log-ish tiers; overnight cares most).
  const spaces = c.parkingSpaces ?? 0;
  const parkingScore =
    spaces >= 100 ? 15 : spaces >= 50 ? 12 : spaces >= 20 ? 8 : spaces > 0 ? 4 : 0;
  components.parking =
    need === 'overnight' || need === 'parking' ? parkingScore : Math.round(parkingScore / 2);

  // Overnight-specific signals.
  if (need === 'overnight') {
    components.overnightAllowed = c.overnightParking ? 10 : 0;
    components.reservable = c.reservationUrl ? 8 : 0;
  }

  // Amenities relevant to the need.
  const has = (a: string) => c.amenities.includes(a);
  if (need === 'fuel') {
    components.fuelAmenity = has('fuel') ? 10 : 0;
    const preferred = (opts.preferredFuelBrands ?? []).map((b) => b.toLowerCase());
    components.brand =
      preferred.length > 0 && c.fuelBrands.some((b) => preferred.includes(b)) ? 12 : 0;
  }
  if (need === 'break') {
    components.food = has('food') ? 5 : 0;
    components.restrooms = has('restrooms') ? 3 : 0;
  }
  if (need === 'overnight') {
    components.showers = has('showers') ? 6 : 0;
    components.security = has('security') ? 4 : 0;
  }

  // Off-route penalty: each mile off route costs 4 points.
  components.offRoute = -Math.round(c.offRouteMiles * 4);

  const total = Object.values(components).reduce((s, v) => s + v, 0);
  return { total, components };
}

/**
 * Rank candidates for a need within a route-mile window, best first.
 * Deterministic tie-break: score, then fewer off-route miles, then name.
 */
export function rankCandidates(
  candidates: StopCandidate[],
  need: 'fuel' | 'break' | 'overnight' | 'parking',
  window: { fromMile: number; toMile: number },
  opts: { preferredFuelBrands?: string[]; requireCategory?: boolean } = {},
): { candidate: StopCandidate; score: ScoreBreakdown }[] {
  const cats = NEED_CATEGORIES[need];
  return candidates
    .filter((c) => c.routeMile >= window.fromMile && c.routeMile <= window.toMile)
    .filter((c) => ((opts.requireCategory ?? true) ? cats.includes(c.categorySlug) : true))
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, need, opts) }))
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        a.candidate.offRouteMiles - b.candidate.offRouteMiles ||
        a.candidate.name.localeCompare(b.candidate.name),
    );
}

/** Fuel recommendation: best fuel-capable stops in the window. */
export function recommendFuelStops(
  candidates: StopCandidate[],
  window: { fromMile: number; toMile: number },
  preferredFuelBrands: string[] = [],
  limit = 5,
): { candidate: StopCandidate; score: ScoreBreakdown }[] {
  return rankCandidates(candidates, 'fuel', window, { preferredFuelBrands }).slice(0, limit);
}

/** Parking recommendation: best overnight-capable stops in the window. */
export function recommendParking(
  candidates: StopCandidate[],
  window: { fromMile: number; toMile: number },
  limit = 5,
): { candidate: StopCandidate; score: ScoreBreakdown }[] {
  return rankCandidates(candidates, 'overnight', window, {}).slice(0, limit);
}

/** Map a planner need to the StopKind it produces. */
export function stopKindForNeed(need: 'fuel' | 'break' | 'overnight' | 'parking'): StopKind {
  return need === 'break'
    ? 'break'
    : need === 'fuel'
      ? 'fuel'
      : need === 'overnight'
        ? 'overnight'
        : 'parking';
}
