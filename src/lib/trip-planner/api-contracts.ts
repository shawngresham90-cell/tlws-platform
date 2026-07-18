import { z } from 'zod';

/**
 * Trip Planner API contracts (Phase 3) — the request/response schemas the
 * Phase 4 route handlers will expose. DESIGN ONLY in this phase: no handler
 * imports these yet, and validating with them performs no I/O. Field names
 * mirror the object models in ./types so serialization is 1:1.
 *
 * Endpoints designed:
 *   POST /api/trip-planner/plan   — full itinerary + costs      (PlanTrip)
 *   POST /api/trip-planner/route  — route quote + quick ETA     (RouteQuote)
 *   POST /api/trip-planner/stops  — ranked stops for a need     (StopSearch)
 *   POST /api/trip-planner/cost   — cost estimate for a route   (CostEstimate)
 *   POST /api/trip-planner/hos    — clock simulation            (HosSimulate)
 */

/* ------------------------------------------------------------ shared parts */

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const truckProfileSchema = z.object({
  lengthFt: z.number().positive().max(120),
  heightFt: z.number().positive().max(20),
  widthFt: z.number().positive().max(12),
  grossWeightLbs: z.number().positive().max(200_000),
  axles: z.number().int().min(2).max(11),
  hazmatClass: z.string().nullable(),
  tankGallons: z.number().positive().max(500),
  mpg: z.number().positive().max(15),
  fuelSafetyFactor: z.number().min(0.4).max(1),
});

export const clockStateSchema = z.object({
  atMs: z.number().int().positive(),
  cycleRule: z.enum(['60/7', '70/8']),
  drivingUsedMin: z
    .number()
    .min(0)
    .max(11 * 60),
  windowElapsedMin: z
    .number()
    .min(-1)
    .max(14 * 60),
  drivingSinceBreakMin: z
    .number()
    .min(0)
    .max(8 * 60),
  restStreakMin: z.number().min(0),
  onDutyByDayMin: z
    .array(
      z
        .number()
        .min(0)
        .max(24 * 60),
    )
    .min(1)
    .max(9),
  dayBucketStartMs: z.number().int().positive(),
});

export const routeLegSchema = z.object({
  seq: z.number().int().min(0),
  from: z.object({ label: z.string(), position: latLngSchema }),
  to: z.object({ label: z.string(), position: latLngSchema }),
  distanceMiles: z.number().positive(),
  avgSpeedMph: z.number().min(10).max(80),
  perStateMiles: z.record(z.string(), z.number().min(0)).optional(),
  tollCents: z.number().int().min(0).nullable().optional(),
});

export const routeSchema = z.object({
  legs: z.array(routeLegSchema).min(1),
  totalMiles: z.number().positive(),
  driveMinutes: z.number().positive(),
});

export const stopCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categorySlug: z.string(),
  position: latLngSchema,
  routeMile: z.number().min(0),
  offRouteMiles: z.number().min(0),
  parkingSpaces: z.number().int().min(0).nullable(),
  overnightParking: z.boolean(),
  reservationUrl: z.string().nullable(),
  amenities: z.array(z.string()),
  fuelBrands: z.array(z.string()),
  coordVerificationStatus: z.string().nullable(),
  state: z.string(),
  interstate: z.string().nullable(),
  exitNumber: z.string().nullable(),
});

export const plannerOptionsSchema = z.object({
  fuelStopMinutes: z.number().int().min(1).max(240),
  breakMinutes: z.number().int().min(30).max(240),
  overnightMinutes: z
    .number()
    .int()
    .min(600)
    .max(24 * 60),
  stopSearchWindowMiles: z.number().min(5).max(200),
  preferredFuelBrands: z.array(z.string()).max(10),
  maxAlternates: z.number().int().min(0).max(10),
});

export const costInputsSchema = z.object({
  fuelPricePerGallonCents: z.number().int().positive().nullable(),
  tollTotalCents: z.number().int().min(0).nullable(),
  tollPerMileCents: z.number().min(0),
  parkingPerNightCents: z.number().int().min(0),
  fixedDailyCents: z.number().int().min(0),
  driverPayPerMileCents: z.number().min(0),
});

/* --------------------------------------------------------------- endpoints */

/** POST /api/trip-planner/plan */
export const planTripRequestSchema = z.object({
  title: z.string().min(1).max(120),
  departAtMs: z.number().int().positive(),
  truck: truckProfileSchema,
  clocks: clockStateSchema,
  route: routeSchema,
  candidates: z.array(stopCandidateSchema).max(5000),
  fuelLevelFraction: z.number().min(0).max(1),
  options: plannerOptionsSchema,
  cost: costInputsSchema,
});
export type PlanTripRequest = z.infer<typeof planTripRequestSchema>;

/** POST /api/trip-planner/route — quick quote, no stop selection. */
export const routeQuoteRequestSchema = z.object({
  departAtMs: z.number().int().positive(),
  clocks: clockStateSchema,
  route: routeSchema,
  options: plannerOptionsSchema,
});
export type RouteQuoteRequest = z.infer<typeof routeQuoteRequestSchema>;

/** POST /api/trip-planner/stops — ranked candidates for a need. */
export const stopSearchRequestSchema = z.object({
  need: z.enum(['fuel', 'break', 'overnight', 'parking']),
  candidates: z.array(stopCandidateSchema).max(5000),
  window: z.object({ fromMile: z.number().min(0), toMile: z.number().min(0) }),
  preferredFuelBrands: z.array(z.string()).max(10).default([]),
  limit: z.number().int().min(1).max(25).default(5),
});
export type StopSearchRequest = z.infer<typeof stopSearchRequestSchema>;

/** POST /api/trip-planner/cost */
export const costEstimateRequestSchema = z.object({
  route: routeSchema,
  totalMinutes: z.number().int().positive(),
  overnightStops: z.number().int().min(0),
  truck: truckProfileSchema,
  inputs: costInputsSchema,
});
export type CostEstimateRequest = z.infer<typeof costEstimateRequestSchema>;

/** POST /api/trip-planner/hos — simulate segments over a starting state. */
export const hosSimulateRequestSchema = z.object({
  clocks: clockStateSchema,
  segments: z
    .array(
      z.object({
        status: z.enum(['driving', 'on-duty', 'off-duty', 'sleeper']),
        minutes: z
          .number()
          .int()
          .min(1)
          .max(48 * 60),
      }),
    )
    .min(1)
    .max(200),
});
export type HosSimulateRequest = z.infer<typeof hosSimulateRequestSchema>;

/* --------------------------------------------------------------- responses */

export type ApiError = { code: string; message: string; problems?: string[] };

export type PlanTripResponse =
  | { ok: true; itinerary: unknown; cost: unknown; warnings: string[] }
  | { ok: false; error: ApiError };

export type RouteQuoteResponse =
  | { ok: true; arriveAtMs: number; totalMinutes: number; rests: number }
  | { ok: false; error: ApiError };

export type StopSearchResponse =
  | {
      ok: true;
      results: {
        candidate: unknown;
        score: { total: number; components: Record<string, number> };
      }[];
    }
  | { ok: false; error: ApiError };

export type CostEstimateResponse = { ok: true; estimate: unknown } | { ok: false; error: ApiError };

export type HosSimulateResponse =
  | {
      ok: true;
      finalState: unknown;
      remaining: unknown;
      violations: { rule: string; atMs: number; detail: string }[];
    }
  | { ok: false; error: ApiError };
