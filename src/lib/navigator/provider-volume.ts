/**
 * Provider-call volume model for the pilot.
 *
 * WHAT THIS ANSWERS, AND WHAT IT DOES NOT
 *
 * It answers: at N drivers, roughly how many routing transactions does
 * Navigator generate in a month, and where does that sit against the
 * allowance the routing adapter documents?
 *
 * It does not answer what that costs. No dollar figure appears anywhere
 * in this module, deliberately — pricing is a contract term that changes
 * without notice, is not readable from this repository, and a number
 * invented here would be quoted back later as if it had been checked.
 *
 * EVERY ASSUMPTION IS AN ARGUMENT
 *
 * The interesting part of a volume model is never the arithmetic; it is
 * the assumptions, and a model that buries them inside the calculation
 * cannot be argued with. So they are one explicit object with one
 * defended default each, and the caller can replace any of them. When
 * Wave 1 produces real per-driver rates, the honest move is to pass those
 * in and re-read the answer — not to rewrite this file.
 *
 * TWO NUMBERS, NOT ONE
 *
 * `expected` models ordinary driving. `worstCase` models every driver
 * exhausting the app's own per-session reroute budget on every trip —
 * which is not a forecast, it is the CEILING THE CODE ENFORCES. The gap
 * between them is the useful part: it is how much headroom the budgets
 * are actually buying.
 *
 * Pure: assumptions in, counts out. No clock, no I/O, no configuration.
 */

import { REROUTE_DEFAULTS } from './reroute-controller';

/**
 * Caps that exist in the code, restated here so the model and the
 * endpoints cannot drift. The test pins each against its source.
 */
export const ROUTE_REQUESTS_PER_HOUR_PER_IP = 6;
export const SEARCHES_PER_MINUTE_PER_IP = 30;
/** Per-instance live-call budget in the routing adapter's free-tier guard. */
export const ADAPTER_CALLS_PER_HOUR = 100;
/**
 * The monthly truck-transaction allowance the routing adapter documents
 * for the free tier. Not a contract term this repository can verify —
 * it is what the adapter's own header says, and the model compares
 * against it so the comparison is visible rather than assumed.
 */
export const DOCUMENTED_FREE_TRUCK_TRANSACTIONS_PER_MONTH = 5000;

export type VolumeAssumptions = Readonly<{
  /** Trips a pilot driver runs in a driving day. */
  tripsPerDriverPerDay: number;
  /** Days a driver actually uses Navigator in a month. */
  drivingDaysPerMonth: number;
  /** Destinations entered per trip, including the ones re-entered. */
  destinationsPerTrip: number;
  /**
   * Provider calls per destination entered. Typeahead is debounced on the
   * client, but a driver typing a warehouse name still produces several
   * calls before they tap a result.
   */
  searchCallsPerDestination: number;
  /** Route plans per trip — the initial one, plus the occasional re-plan. */
  routePlansPerTrip: number;
  /** Off-route events producing a replacement request, per trip. */
  reroutesPerTrip: number;
  /**
   * Hours of driving in a trip. Only the worst case uses it, and it is
   * the reason the worst case is not a per-trip constant — see
   * `worstCaseMonthlyVolume`.
   */
  drivingHoursPerTrip: number;
  /** Fraction of requests that fail at the provider or in transit. */
  failedFraction: number;
}>;

/**
 * Defaults, each defended.
 *
 * These describe a working driver, not a demo. They are estimates and
 * they are labelled as estimates everywhere the output is printed — the
 * only honest source for these numbers is Wave 1, which has not run.
 */
export const DEFAULT_ASSUMPTIONS: VolumeAssumptions = Object.freeze({
  // Two: a run out and a run back, or two deliveries. A driver doing six
  // stops a day is a different product and would need its own model.
  tripsPerDriverPerDay: 2,
  // Twenty-two: a working month with weekends off. Deliberately not 30 —
  // a model that assumes every day is a driving day flatters itself.
  drivingDaysPerMonth: 22,
  // 1.5: most trips have one destination; some are re-entered because the
  // first result was the wrong one of two similarly-named places.
  destinationsPerTrip: 1.5,
  // Four: "walm" … "walmart d" … "walmart dc dal" — a debounced typeahead
  // fires several times before a result is tapped.
  searchCallsPerDestination: 4,
  // 1.2: one plan, plus the occasional re-plan before pulling out.
  routePlansPerTrip: 1.2,
  // 1.5: a missed turn or a closure on roughly every other trip. This is
  // the assumption most worth replacing with a measurement — it is the
  // one that scales worst and the one Wave 1 will measure directly.
  reroutesPerTrip: 1.5,
  // Five: two trips a day at five hours each is a legal driving day.
  drivingHoursPerTrip: 5,
  // 5%: provider errors, timeouts and dead-zone transport failures. Note
  // that transport failures are REFUNDED to the reroute budget by the
  // controller, so they cost a call without buying one.
  failedFraction: 0.05,
});

export type VolumeBreakdown = Readonly<{
  drivers: number;
  tripsPerMonth: number;
  /** Search calls. A different provider product from routing. */
  searchCalls: number;
  /** Initial and re-planned routes. Truck transactions. */
  routePlans: number;
  /** Replacement routes. Truck transactions. */
  reroutes: number;
  /** Of the truck transactions above, how many are expected to fail. */
  failedTruckCalls: number;
  /**
   * Retries the app performs on its own. The reroute controller does NOT
   * auto-retry a failure — it starts a backoff and waits for the next
   * confirmed off-route state — so this is zero by construction rather
   * than by estimate, and the test says so.
   */
  automaticRetries: number;
  /** Everything that lands on the truck-routing product. */
  truckTransactions: number;
  /** Against the allowance the adapter documents. */
  percentOfDocumentedFreeTier: number;
  withinDocumentedFreeTier: boolean;
}>;

const round = (n: number) => Math.round(n * 10) / 10;

function breakdown(
  drivers: number,
  tripsPerMonth: number,
  searchCalls: number,
  routePlans: number,
  reroutes: number,
  failedFraction: number,
): VolumeBreakdown {
  const truckTransactions = routePlans + reroutes;
  return Object.freeze({
    drivers,
    tripsPerMonth: round(tripsPerMonth),
    searchCalls: round(searchCalls),
    routePlans: round(routePlans),
    reroutes: round(reroutes),
    failedTruckCalls: round(truckTransactions * failedFraction),
    automaticRetries: 0,
    truckTransactions: round(truckTransactions),
    percentOfDocumentedFreeTier: round(
      (truckTransactions / DOCUMENTED_FREE_TRUCK_TRANSACTIONS_PER_MONTH) * 100,
    ),
    withinDocumentedFreeTier: truckTransactions <= DOCUMENTED_FREE_TRUCK_TRANSACTIONS_PER_MONTH,
  });
}

/** Ordinary driving, under the stated assumptions. */
export function expectedMonthlyVolume(
  drivers: number,
  a: VolumeAssumptions = DEFAULT_ASSUMPTIONS,
): VolumeBreakdown {
  const trips = drivers * a.tripsPerDriverPerDay * a.drivingDaysPerMonth;
  return breakdown(
    drivers,
    trips,
    trips * a.destinationsPerTrip * a.searchCallsPerDestination,
    trips * a.routePlansPerTrip,
    trips * a.reroutesPerTrip,
    a.failedFraction,
  );
}

/**
 * The ceiling the code enforces, not a forecast.
 *
 * WHY THIS IS AN HOURLY FIGURE AND NOT A PER-SESSION ONE
 *
 * The obvious model would use `maxPerSession` — twelve — as the per-trip
 * ceiling. That is wrong, and the state-combination harness proves it:
 * `sessionCount` is incremented in exactly ONE place, on the SUCCESS
 * path, after the replacement session is swapped in. A trip that never
 * gets a usable route never advances it, so the per-session rail never
 * fires and the only thing bounding provider calls is `maxPerHour`.
 *
 * That makes the two budgets different rails rather than two versions of
 * the same one: `maxPerSession` caps ROUTE CHURN, `maxPerHour` caps
 * SPEND. A spend model has to use the spend rail.
 *
 * The consequence is that the ceiling scales with TRIP LENGTH. Nothing in
 * the app can exceed it without a budget changing, which is the point: it
 * still bounds the blast radius of a defect that reroutes in a loop — it
 * just bounds it per hour rather than per trip.
 *
 * WHICH COLUMN IS ACTUALLY ENFORCED
 *
 * `truckTransactions` — route plans plus reroutes — is the enforced part,
 * and it is the only column the volume document publishes as a ceiling.
 * `searchCalls` is NOT enforced per trip: the search endpoint is rate
 * limited (30 per minute per IP) but has no per-trip or per-session cap,
 * so a driver who keeps typing keeps spending. Its figure here is a
 * REPRESENTATIVE HIGH ESTIMATE — one saturated minute of typing per trip —
 * not a bound the code can hold. Do not quote it as one.
 */
export function worstCaseMonthlyVolume(
  drivers: number,
  a: VolumeAssumptions = DEFAULT_ASSUMPTIONS,
): VolumeBreakdown {
  const trips = drivers * a.tripsPerDriverPerDay * a.drivingDaysPerMonth;
  // One plan per trip, then the hourly rail spent for every hour driven.
  const routePlans = trips;
  const reroutes = trips * a.drivingHoursPerTrip * REROUTE_DEFAULTS.maxPerHour;
  // Estimate, not a ceiling: search has no per-trip or per-session cap, only
  // a per-minute limiter, so nothing stops a driver typing for five minutes
  // and spending five times this. One saturated minute per trip is a
  // defensible high figure; it is not a bound. See the docblock.
  const searchCalls = trips * SEARCHES_PER_MINUTE_PER_IP;
  return breakdown(drivers, trips, searchCalls, routePlans, reroutes, a.failedFraction);
}

/**
 * Where the documented allowance runs out, in drivers.
 *
 * Returned as a number of drivers rather than a yes/no so the answer to
 * "can we add one more?" does not need the whole table re-read.
 */
export function driversWithinFreeTier(a: VolumeAssumptions = DEFAULT_ASSUMPTIONS): {
  expected: number;
  worstCase: number;
} {
  const perDriverExpected = expectedMonthlyVolume(1, a).truckTransactions;
  const perDriverWorst = worstCaseMonthlyVolume(1, a).truckTransactions;
  const cap = DOCUMENTED_FREE_TRUCK_TRANSACTIONS_PER_MONTH;
  return {
    expected: perDriverExpected <= 0 ? Infinity : Math.floor(cap / perDriverExpected),
    worstCase: perDriverWorst <= 0 ? Infinity : Math.floor(cap / perDriverWorst),
  };
}

/** The wave sizes the pilot documents talk about. */
export const MODELLED_WAVES: readonly number[] = Object.freeze([3, 10, 50, 100]);
