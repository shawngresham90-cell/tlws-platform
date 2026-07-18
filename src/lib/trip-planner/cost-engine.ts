import type { CostInputs, Itinerary, Route, TripCostEstimate, TruckProfile } from './types';

/**
 * Cost engine (Phase 3). Pure arithmetic over caller-supplied prices —
 * NO price is ever invented here. When a component's inputs are unknown
 * (null fuel price, unknown tolls), the component and the total stay null
 * and the estimate says so in `notes`, instead of fabricating a number.
 */

export const CENTS = 100;

/** Gallons needed for a distance at the truck's real-world mpg. */
export function fuelGallons(miles: number, truck: TruckProfile): number {
  if (truck.mpg <= 0) throw new Error('mpg must be positive');
  return Number((miles / truck.mpg).toFixed(1));
}

/** Calendar days an itinerary spans (minimum 1). */
export function tripDays(itinerary: Pick<Itinerary, 'totalMinutes'>): number {
  return Math.max(1, Math.ceil(itinerary.totalMinutes / (24 * 60)));
}

/** Count overnight stops for parking cost. */
function overnightCount(itinerary: Pick<Itinerary, 'stops'>): number {
  return itinerary.stops.filter((s) => s.kind === 'overnight').length;
}

/** Trip cost estimate — components stay null when their inputs are unknown. */
export function estimateTripCost(
  route: Route,
  itinerary: Pick<Itinerary, 'totalMinutes' | 'stops'>,
  truck: TruckProfile,
  inputs: CostInputs,
): TripCostEstimate {
  const notes: string[] = [];
  const miles = route.totalMiles;
  const days = tripDays(itinerary);

  const gallons = fuelGallons(miles, truck);
  let fuelCents: number | null = null;
  if (inputs.fuelPricePerGallonCents != null) {
    if (inputs.fuelPricePerGallonCents <= 0) throw new Error('fuel price must be positive');
    fuelCents = Math.round(gallons * inputs.fuelPricePerGallonCents);
  } else {
    notes.push('fuel price unknown — supply a price (EIA adapter or manual) for a fuel total');
  }

  let tollCents: number | null;
  if (inputs.tollTotalCents != null) {
    tollCents = inputs.tollTotalCents;
  } else if (inputs.tollPerMileCents > 0) {
    tollCents = Math.round(miles * inputs.tollPerMileCents);
    notes.push('tolls estimated per-mile — provider toll data will replace this');
  } else {
    tollCents = null;
    notes.push('tolls unknown — no toll data supplied');
  }

  const parkingCents = overnightCount(itinerary) * Math.max(0, inputs.parkingPerNightCents);
  const fixedCents = days * Math.max(0, inputs.fixedDailyCents);
  const driverPayCents = Math.round(miles * Math.max(0, inputs.driverPayPerMileCents));

  const knownParts = [parkingCents, fixedCents, driverPayCents];
  const allKnown = fuelCents != null && tollCents != null;
  const totalCents = allKnown
    ? (fuelCents as number) + (tollCents as number) + knownParts.reduce((s, v) => s + v, 0)
    : null;
  if (!allKnown) notes.push('total omitted while any component is unknown — no invented figures');

  return {
    fuelGallons: gallons,
    fuelCents,
    tollCents,
    parkingCents,
    fixedCents,
    driverPayCents,
    totalCents,
    perMileCents: totalCents != null && miles > 0 ? Number((totalCents / miles).toFixed(1)) : null,
    days,
    perDayCents: totalCents != null ? Math.round(totalCents / days) : null,
    notes,
  };
}

/** Daily cost breakdown: spread the trip estimate across its days. */
export function dailyCosts(estimate: TripCostEstimate): { day: number; cents: number | null }[] {
  return Array.from({ length: estimate.days }, (_, i) => ({
    day: i + 1,
    cents: estimate.perDayCents,
  }));
}

/** Cost-per-mile from explicit totals (owner-operator dashboard use). */
export function costPerMileCents(totalCents: number, miles: number): number {
  if (miles <= 0) throw new Error('miles must be positive');
  return Number((totalCents / miles).toFixed(1));
}

/** Validate cost inputs at the API boundary. Empty = valid. */
export function validateCostInputs(inputs: CostInputs): string[] {
  const problems: string[] = [];
  if (inputs.fuelPricePerGallonCents != null && inputs.fuelPricePerGallonCents <= 0)
    problems.push('fuelPricePerGallonCents must be positive when supplied');
  if (inputs.tollTotalCents != null && inputs.tollTotalCents < 0)
    problems.push('tollTotalCents cannot be negative');
  if (inputs.tollPerMileCents < 0) problems.push('tollPerMileCents cannot be negative');
  if (inputs.parkingPerNightCents < 0) problems.push('parkingPerNightCents cannot be negative');
  if (inputs.fixedDailyCents < 0) problems.push('fixedDailyCents cannot be negative');
  if (inputs.driverPayPerMileCents < 0) problems.push('driverPayPerMileCents cannot be negative');
  return problems;
}
