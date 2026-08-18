import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';
import type { Route } from './types';
import { buildRoute } from './types';
import type { RoutePoint } from './directory-layer';

/**
 * Estimated routing (Phase 4, pre-HERE). Until a truck-routing provider is
 * approved, routes are ESTIMATES: great-circle distance × a documented road
 * circuity factor, at a conservative average truck speed. Every consumer
 * must label the output as an estimate — the UI carries the disclaimer, and
 * the RoutingPort seam replaces this wholesale when HERE is approved.
 *
 * Circuity: US highway networks average ~1.15–1.25× straight-line distance
 * (long-haul interstate trips sit near the low end). 1.2 is the deliberate,
 * clearly-labeled planning default — an estimate, not provider data.
 */

export const ROAD_CIRCUITY_FACTOR = 1.2;
export const DEFAULT_TRUCK_SPEED_MPH = 55;
/** Sample spacing for route points (directory matching density). */
const SAMPLE_MILES = 10;

export type EstimatedRoute = {
  route: Route;
  routePoints: RoutePoint[];
  /** Always true here — this module never returns provider-grade routes. */
  isEstimate: true;
  method: string;
};

/**
 * Straight-line corridor estimate between two points. Route points are
 * linear interpolations spaced every ~10 route-miles (adequate for corridor
 * candidate matching; replaced by real polylines with HERE).
 */
export function estimateRoute(
  origin: { label: string; position: LatLng },
  destination: { label: string; position: LatLng },
  opts: { avgSpeedMph?: number } = {},
): EstimatedRoute {
  const straight = haversineMiles(origin.position, destination.position);
  if (straight < 1) throw new Error('origin and destination are the same point');
  const distanceMiles = Number((straight * ROAD_CIRCUITY_FACTOR).toFixed(1));
  const avgSpeedMph = opts.avgSpeedMph ?? DEFAULT_TRUCK_SPEED_MPH;

  const route = buildRoute([
    {
      seq: 0,
      from: origin,
      to: destination,
      distanceMiles,
      avgSpeedMph,
    },
  ]);

  const steps = Math.max(2, Math.ceil(distanceMiles / SAMPLE_MILES) + 1);
  const routePoints: RoutePoint[] = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return {
      position: {
        lat: origin.position.lat + (destination.position.lat - origin.position.lat) * t,
        lng: origin.position.lng + (destination.position.lng - origin.position.lng) * t,
      },
      routeMile: Number((distanceMiles * t).toFixed(1)),
    };
  });

  return {
    route,
    routePoints,
    isEstimate: true,
    method: `straight-line × ${ROAD_CIRCUITY_FACTOR} circuity at ${avgSpeedMph} mph avg (pre-HERE estimate)`,
  };
}

/**
 * Estimate through one via stop (TP-2): two chained straight-line legs.
 *
 * Exists so a via request whose live routing fails does not silently
 * report the DIRECT origin→destination distance, which understates a
 * dog-leg corridor. Still an ESTIMATE in every sense above — no HOS
 * marker, break, parking eligibility or trip plan is ever computed from
 * it (the timing seam refuses estimates wholesale).
 */
export function estimateRouteVia(
  origin: { label: string; position: LatLng },
  via: { label: string; position: LatLng },
  destination: { label: string; position: LatLng },
  opts: { avgSpeedMph?: number } = {},
): EstimatedRoute {
  const first = estimateRoute(origin, via, opts);
  const second = estimateRoute(via, destination, opts);
  const firstMiles = first.route.totalMiles;

  const route = buildRoute([
    { ...first.route.legs[0], seq: 0 },
    { ...second.route.legs[0], seq: 1 },
  ]);
  const routePoints: RoutePoint[] = [
    ...first.routePoints,
    // The via point itself already ends the first leg; skip the duplicate.
    ...second.routePoints.slice(1).map((p) => ({
      position: p.position,
      routeMile: Number((firstMiles + p.routeMile).toFixed(1)),
    })),
  ];
  return { route, routePoints, isEstimate: true, method: first.method };
}
