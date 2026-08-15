import type { LatLng } from '@/lib/map/bounds';
import type { ClockLimitMarker } from './clock-limit-marker';
import type { ParkingChoice } from './plan-my-day';

/**
 * What the results map is allowed to draw, decided before any pixel.
 *
 * Pure. No clock, no I/O, no MapLibre.
 *
 * THE MAP DRAWS FROM THE PLAN, NOT FROM THE ROUTE. Every position that
 * reaches this module has already survived the safety filters: the
 * clock-limit marker is a pin only where the provider's timing was tight
 * enough to earn one, and a parking pin exists only for a stop the driver
 * can actually reach inside their buffered window. So the renderer never
 * has to decide what is safe to show — that decision is finished by the
 * time it gets here, and this type is the record of it.
 *
 * The route line is held to the same standard. A straight-line estimate
 * has no road geometry, and drawing the great-circle path between two
 * truck stops would render a confident line across country that no truck
 * can drive. So an estimate produces no line at all and says why.
 */

/** The sentence shown in place of a route line when there is none. */
export const NO_ROUTE_LINE =
  'The road route cannot be drawn — the provider did not return route geometry.';

/**
 * The most points the map will draw.
 *
 * A HERE polyline for a full day's drive runs to several thousand
 * coordinates. At phone width that is far more detail than a 390px map
 * can resolve, and it is paid for twice: once in the JSON crossing a cab
 * data connection, once in the render. Every third or tenth point traces
 * the same visible line.
 */
export const MAX_ROUTE_POINTS = 400;

export type PlanMapParking = {
  id: string;
  name: string;
  position: LatLng;
};

export type PlanMapLayers = {
  /** Provider road geometry, thinned. Empty when none may be drawn. */
  route: LatLng[];
  /** Why there is no line, when there is none. Null when there is one. */
  routeProblem: string | null;
  /** Only stops that cleared the safety filter — never the full candidate set. */
  parking: PlanMapParking[];
};

/**
 * Thin a polyline to at most `max` points, keeping both ends.
 *
 * Fixed-stride rather than shape-aware: this line is decoration around
 * the markers that carry the meaning, and a Douglas-Peucker pass would
 * spend cycles preserving corners nobody is navigating by. The endpoints
 * are kept explicitly so the drawn line still starts and finishes where
 * the route does.
 */
export function thinRoute(points: readonly LatLng[], max = MAX_ROUTE_POINTS): LatLng[] {
  if (points.length <= max) return [...points];
  if (max <= 2) return [points[0], points[points.length - 1]];
  const stride = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max - 1; i++) out.push(points[Math.round(i * stride)]);
  out.push(points[points.length - 1]);
  return out;
}

export function planMapLayers(input: {
  positions: readonly LatLng[];
  isEstimate: boolean;
  parking: readonly ParkingChoice[];
}): PlanMapLayers {
  /*
   * An estimated route is refused before its geometry is even looked at.
   * `isEstimate` is the same flag that keeps HOS markers, break placement
   * and parking eligibility off a straight-line guess, and the map is not
   * an exception to it.
   */
  const drawable = input.isEstimate ? [] : input.positions;
  return {
    route: thinRoute(drawable),
    routeProblem: drawable.length >= 2 ? null : NO_ROUTE_LINE,
    parking: input.parking.map((p) => ({
      id: p.candidate.id,
      name: p.candidate.name,
      position: p.candidate.position,
    })),
  };
}

/** Every position the map will draw, for fitting the camera. */
export function planMapPoints(
  layers: PlanMapLayers,
  markers: readonly ClockLimitMarker[],
): LatLng[] {
  const pts: LatLng[] = [...layers.route, ...layers.parking.map((p) => p.position)];
  for (const m of markers) {
    if (m.kind === 'pin') pts.push(m.position);
    else if (m.kind === 'zone') pts.push(m.from, m.to);
  }
  return pts;
}
