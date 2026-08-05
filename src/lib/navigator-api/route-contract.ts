/**
 * Navigator route request contract (milestone N8a) — the NEW-1 endpoint's
 * input schema and its provider-neutral serialization, doc 03. Pure:
 * bounds-checked shapes in, a `RoutingRequest` out. The HERE-specific URL
 * serialization stays in the shared adapter (`buildHereRouteUrl`), which
 * this milestone pins field-by-field in tests so no truck restriction can
 * silently vanish from the wire.
 */

import { z } from 'zod';
import { haversineMiles } from '@/lib/map/geo';
import type { RoutingRequest, RouteAvoidance } from '@/lib/trip-planner/providers';
import type { TruckProfile } from '@/lib/trip-planner/types';

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Shape-level truck bounds. Deliberately WIDE — the strict plausibility
 * judgment (impossible dimensions, trailer combinations, hazmat
 * divisions) belongs to `truck-validation.ts`, which produces field-level
 * reasons instead of a generic schema failure.
 */
const truckShapeSchema = z.object({
  lengthFt: z.number(),
  heightFt: z.number(),
  widthFt: z.number(),
  grossWeightLbs: z.number(),
  axles: z.number(),
  hazmatClass: z.string().nullable(),
  tankGallons: z.number().positive().max(500).default(200),
  mpg: z.number().positive().max(15).default(6.5),
  fuelSafetyFactor: z.number().min(0.4).max(1).default(0.8),
});

export const NAVIGATOR_MAX_WAYPOINTS = 6;

export const navigatorRouteRequestSchema = z.object({
  origin: latLngSchema,
  destination: latLngSchema,
  waypoints: z.array(latLngSchema).max(NAVIGATOR_MAX_WAYPOINTS).default([]),
  truck: truckShapeSchema,
  departAtMs: z.number().int().positive(),
  avoid: z
    .array(z.enum(['tollRoad', 'ferry', 'tunnel', 'dirtRoad', 'uTurns']))
    .max(5)
    .optional(),
});

export type NavigatorRouteRequest = z.infer<typeof navigatorRouteRequestSchema>;

/** Below this great-circle distance the request is not a navigable trip. */
export const MIN_TRIP_MILES = 0.2;

/**
 * Request-level (non-truck) sanity that zod shapes cannot express.
 * Non-empty result must prevent the provider request.
 */
export function validateRouteRequest(req: NavigatorRouteRequest): string[] {
  const problems: string[] = [];
  if (haversineMiles(req.origin, req.destination) < MIN_TRIP_MILES) {
    problems.push('origin and destination are the same place — nothing to navigate');
  }
  for (const [i, w] of req.waypoints.entries()) {
    if (
      haversineMiles(w, req.origin) < MIN_TRIP_MILES / 2 ||
      haversineMiles(w, req.destination) < MIN_TRIP_MILES / 2
    ) {
      problems.push(`waypoint ${i + 1} duplicates an endpoint`);
    }
  }
  return problems;
}

/** Provider-neutral serialization consumed by the shared routing adapter. */
export function toRoutingRequest(req: NavigatorRouteRequest): RoutingRequest {
  const truck: TruckProfile = {
    lengthFt: req.truck.lengthFt,
    heightFt: req.truck.heightFt,
    widthFt: req.truck.widthFt,
    grossWeightLbs: req.truck.grossWeightLbs,
    axles: req.truck.axles,
    hazmatClass: req.truck.hazmatClass,
    tankGallons: req.truck.tankGallons,
    mpg: req.truck.mpg,
    fuelSafetyFactor: req.truck.fuelSafetyFactor,
  };
  return {
    origin: req.origin,
    destination: req.destination,
    waypoints: req.waypoints,
    truck,
    departAtMs: req.departAtMs,
    avoid: req.avoid as RouteAvoidance[] | undefined,
  };
}
