import { z } from 'zod';
import { freshClockState, remainingClocks, validateClockState } from './hos-engine';
import { planTrip } from './optimizer';
import { estimateRoute } from './route-estimate';
import { toStopCandidates, type DirectoryListing } from './directory-layer';
import { estimateTripCost } from './cost-engine';
import {
  DEFAULT_PLANNER_OPTIONS,
  DEFAULT_TRUCK_PROFILE,
  HOS,
  type ClockState,
  type Itinerary,
  type RemainingClocks,
  type TripCostEstimate,
} from './types';
import type { RoutingPort, WeatherAlert, WeatherBand, WeatherPort } from './providers';
import type { FuelPriceResult } from './eia-fuel';
import { latLngSchema } from './api-contracts';
import { TRUCK_LIMITS } from './here-routing';

/**
 * Composite trip quote (Phase 4) — the one call the mobile UI makes. Pure
 * orchestration with INJECTED dependencies (directory loader, weather port,
 * fuel lookup, clock), so the whole flow is offline-testable and every
 * provider failure degrades softly into a warning instead of an error.
 */

/** Driver-friendly clock input: the numbers a driver reads off their ELD. */
export const simpleClocksSchema = z.object({
  cycleRule: z.enum(['60/7', '70/8']).default('70/8'),
  drivingUsedMin: z
    .number()
    .min(0)
    .max(11 * 60)
    .default(0),
  windowElapsedMin: z
    .number()
    .min(-1)
    .max(14 * 60)
    .default(-1),
  drivingSinceBreakMin: z
    .number()
    .min(0)
    .max(8 * 60)
    .default(0),
  cycleUsedMin: z
    .number()
    .min(0)
    .max(70 * 60)
    .default(0),
});
export type SimpleClocks = z.infer<typeof simpleClocksSchema>;

/** Optional truck attributes for live truck routing (bounded, all default). */
export const truckParamsSchema = z.object({
  heightFt: z
    .number()
    .min(TRUCK_LIMITS.heightFt.min)
    .max(TRUCK_LIMITS.heightFt.max)
    .default(DEFAULT_TRUCK_PROFILE.heightFt),
  widthFt: z
    .number()
    .min(TRUCK_LIMITS.widthFt.min)
    .max(TRUCK_LIMITS.widthFt.max)
    .default(DEFAULT_TRUCK_PROFILE.widthFt),
  lengthFt: z
    .number()
    .min(TRUCK_LIMITS.lengthFt.min)
    .max(TRUCK_LIMITS.lengthFt.max)
    .default(DEFAULT_TRUCK_PROFILE.lengthFt),
  grossWeightLbs: z
    .number()
    .min(TRUCK_LIMITS.grossWeightLbs.min)
    .max(TRUCK_LIMITS.grossWeightLbs.max)
    .default(DEFAULT_TRUCK_PROFILE.grossWeightLbs),
  axles: z
    .number()
    .int()
    .min(TRUCK_LIMITS.axles.min)
    .max(TRUCK_LIMITS.axles.max)
    .default(DEFAULT_TRUCK_PROFILE.axles),
  /** US hazmat class placarded ("1".."9", optional subclass), or null. */
  hazmatClass: z
    .string()
    .regex(/^[1-9](\.\d)?$/)
    .nullable()
    .default(null),
});

export const quoteRequestSchema = z.object({
  origin: z.object({ label: z.string().min(1).max(120), position: latLngSchema }),
  destination: z.object({ label: z.string().min(1).max(120), position: latLngSchema }),
  departAtMs: z.number().int().positive(),
  clocks: simpleClocksSchema,
  fuelLevelFraction: z.number().min(0).max(1).default(1),
  mpg: z.number().positive().max(15).default(DEFAULT_TRUCK_PROFILE.mpg),
  tankGallons: z.number().positive().max(500).default(DEFAULT_TRUCK_PROFILE.tankGallons),
  truck: truckParamsSchema.default({}),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

/**
 * Expand driver-entered clock numbers into a full engine ClockState. Cycle
 * minutes spread backwards across day buckets (≤24h each); consistency is
 * enforced (window opens if driving time exists, break ≤ driving, cycle ≥
 * today's driving).
 */
export function clockStateFromSimple(simple: SimpleClocks, atMs: number): ClockState {
  const drivingUsedMin = Math.round(simple.drivingUsedMin);
  const drivingSinceBreakMin = Math.min(Math.round(simple.drivingSinceBreakMin), drivingUsedMin);
  // The 14-hour window can never hold less time than has been driven inside
  // it — clamp driver-entered values up to the physical floor.
  const windowElapsedMin =
    drivingUsedMin > 0
      ? Math.max(drivingUsedMin, Math.round(simple.windowElapsedMin))
      : Math.round(simple.windowElapsedMin);
  const cycleUsedMin = Math.max(Math.round(simple.cycleUsedMin), drivingUsedMin);

  // Day buckets oldest→newest; the NEWEST bucket must stay partial (<24h)
  // so today's driving can accrue into it without breaching the invariant.
  const buckets: number[] = [];
  let remaining = cycleUsedMin;
  while (remaining > 0 && buckets.length < 8) {
    const chunk = Math.min(remaining, HOS.DAY_MIN);
    buckets.push(chunk);
    remaining -= chunk;
  }
  if (buckets.length === 0) buckets.push(0);
  if (buckets[buckets.length - 1] === HOS.DAY_MIN) buckets.push(0);

  const base = freshClockState(atMs, simple.cycleRule);
  return {
    ...base,
    drivingUsedMin,
    windowElapsedMin,
    drivingSinceBreakMin,
    restStreakMin: 0,
    onDutyByDayMin: buckets,
    dayBucketStartMs: atMs - ((buckets[buckets.length - 1] ?? 0) % HOS.DAY_MIN) * 60_000,
  };
}

export type QuoteDeps = {
  loadListings: () => Promise<DirectoryListing[]>;
  weather: WeatherPort;
  fuelPrice: (state: string) => Promise<FuelPriceResult | null>;
  /** Live truck routing (HERE). Omitted/null result → labeled estimate. */
  routing?: RoutingPort;
  /** Hard budgets (ms) for provider calls; defaults 8000 / 4000 / 6000. */
  weatherBudgetMs?: number;
  fuelBudgetMs?: number;
  routingBudgetMs?: number;
};

/** Race a promise against a budget; timer is always cleared. */
async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('provider budget exceeded')), ms);
      }),
    ]);
    return { ok: true, value };
  } catch {
    return { ok: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type QuoteResult = {
  ok: true;
  routeSummary: {
    miles: number;
    driveMinutes: number;
    /** false = live provider route; true = labeled estimate. */
    isEstimate: boolean;
    method: string;
    /** Turn-by-turn instruction texts (live routes only, capped). */
    instructions?: string[];
  };
  remainingAtDeparture: RemainingClocks;
  itinerary: Itinerary;
  cost: TripCostEstimate;
  fuelPrice: FuelPriceResult | null;
  weather: { bands: WeatherBand[]; alerts: WeatherAlert[] };
  candidatesAvailable: number;
  warnings: string[];
  disclaimer: string;
  /** Driver-responsibility routing disclaimer (always present). */
  routingDisclaimer: string;
};

export const HOS_DISCLAIMER =
  'Planning estimate only — this tool is NOT an ELD and produces no record of duty status. ' +
  'Route distance and times are pre-routing estimates. Verify your own clocks, posted ' +
  'restrictions, and parking availability before relying on any plan.';

export const ROUTING_DISCLAIMER =
  'Routing data can be incomplete or out of date. The driver remains responsible for ' +
  'checking posted restrictions, bridge clearances, weight limits, hazmat rules, and road ' +
  'signage — always obey what is posted over what is planned.';

export async function composeQuote(
  input: QuoteRequest,
  deps: QuoteDeps,
): Promise<
  QuoteResult | { ok: false; error: { code: string; message: string; problems?: string[] } }
> {
  const warnings: string[] = [];

  const truck = {
    ...DEFAULT_TRUCK_PROFILE,
    ...input.truck,
    mpg: input.mpg,
    tankGallons: input.tankGallons,
  };

  let estimated;
  try {
    estimated = estimateRoute(input.origin, input.destination);
  } catch (e) {
    return { ok: false, error: { code: 'bad-route', message: (e as Error).message } };
  }

  // Live truck routing first (HERE behind the RoutingPort seam) — it feeds
  // real geometry to everything downstream: HOS planning, weather bands,
  // stop/parking candidates, and fuel math. Any failure (no key, outage,
  // over budget, over the free-tier cap) falls back to the labeled estimate.
  let routeData: {
    route: typeof estimated.route;
    routePoints: typeof estimated.routePoints;
    isEstimate: boolean;
    method: string;
    instructions?: string[];
  } = {
    route: estimated.route,
    routePoints: estimated.routePoints,
    isEstimate: true,
    method: estimated.method,
  };
  if (deps.routing) {
    const routingOutcome = await withTimeout(
      deps.routing.route({
        origin: input.origin.position,
        destination: input.destination.position,
        waypoints: [],
        truck,
        departAtMs: input.departAtMs,
      }),
      deps.routingBudgetMs ?? 6000,
    );
    if (routingOutcome.ok && routingOutcome.value) {
      routeData = {
        route: routingOutcome.value.route,
        routePoints: routingOutcome.value.routePoints,
        isEstimate: false,
        method: routingOutcome.value.provider,
        instructions: routingOutcome.value.instructions,
      };
    } else {
      warnings.push('live truck routing unavailable — distances and times are estimates');
    }
  }

  const clocks = clockStateFromSimple(input.clocks, input.departAtMs);
  const clockProblems = validateClockState(clocks);
  if (clockProblems.length > 0) {
    return {
      ok: false,
      error: { code: 'bad-clocks', message: 'Clock state invalid', problems: clockProblems },
    };
  }

  // Directory candidates — fail-soft.
  let listings: DirectoryListing[] = [];
  try {
    listings = await deps.loadListings();
  } catch {
    listings = [];
  }
  const candidates = toStopCandidates(listings, routeData.routePoints, 5);
  if (candidates.length === 0) {
    warnings.push(
      'no verified directory locations found along this corridor yet — stop recommendations are unassigned',
    );
  }

  const itinerary = planTrip({
    title: `${input.origin.label} → ${input.destination.label}`,
    departAtMs: input.departAtMs,
    truck,
    clocks,
    route: routeData.route,
    candidates,
    fuelLevelFraction: input.fuelLevelFraction,
    options: DEFAULT_PLANNER_OPTIONS,
  });

  // Weather and fuel price fetch in PARALLEL under hard time budgets so a
  // slow provider can never push the whole request into a platform timeout.
  const weatherBudgetMs = deps.weatherBudgetMs ?? 8000;
  const fuelBudgetMs = deps.fuelBudgetMs ?? 4000;
  const originState = candidates[0]?.state ?? '';
  const [weatherOutcome, fuelOutcome] = await Promise.all([
    withTimeout(deps.weather.alongRoute(routeData.routePoints, input.departAtMs), weatherBudgetMs),
    withTimeout(deps.fuelPrice(originState), fuelBudgetMs),
  ]);

  let weather: { bands: WeatherBand[]; alerts: WeatherAlert[] } = { bands: [], alerts: [] };
  if (weatherOutcome.ok) {
    weather = weatherOutcome.value;
    if (weather.bands.length === 0 && weather.alerts.length === 0) {
      warnings.push('no weather data for this route right now');
    }
  } else {
    warnings.push('weather service unavailable — plan proceeds without weather');
  }

  const fuelPrice: FuelPriceResult | null = fuelOutcome.ok ? fuelOutcome.value : null;
  if (!fuelPrice) warnings.push('fuel price unavailable — cost shown without fuel');

  const cost = estimateTripCost(routeData.route, itinerary, truck, {
    fuelPricePerGallonCents: fuelPrice?.centsPerGallon ?? null,
    tollTotalCents: null,
    tollPerMileCents: 0,
    parkingPerNightCents: 0,
    fixedDailyCents: 0,
    driverPayPerMileCents: 0,
  });

  return {
    ok: true,
    routeSummary: {
      miles: routeData.route.totalMiles,
      driveMinutes: routeData.route.driveMinutes,
      isEstimate: routeData.isEstimate,
      method: routeData.method,
      instructions: routeData.instructions,
    },
    remainingAtDeparture: remainingClocks(clocks),
    itinerary,
    cost,
    fuelPrice,
    weather,
    candidatesAvailable: candidates.length,
    warnings: [...itinerary.warnings, ...warnings],
    disclaimer: HOS_DISCLAIMER,
    routingDisclaimer: ROUTING_DISCLAIMER,
  };
}
