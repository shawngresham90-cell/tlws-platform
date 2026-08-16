/**
 * The centralized provider-usage guard — POLICY HALF.
 *
 * Everything here is pure: configuration in, decision out. No database, no
 * clock, no environment read at module scope. The half that talks to Postgres
 * is `usage-reservation.ts`, and it contains no rules.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS WHEN THERE ARE ALREADY THREE LIMITERS
 *
 * The route endpoint allows 6/hour/IP, search allows 30/min/IP, and the
 * routing adapter caps live calls per warm instance. All three are real and
 * none of them bounds a monthly bill, for the same reason: they are per-IP or
 * per-process, and a serverless host runs an unknown number of processes for
 * an unknown number of addresses. `public-budget.ts` says this about itself in
 * as many words — "the effective global ceiling is this number multiplied by
 * however many instances the platform decided to run, which is not a number
 * this code can read or cap."
 *
 * So this guard keeps its count in ONE PLACE that every instance shares: a
 * Postgres row. That is the whole design requirement, and it is why an
 * in-memory counter — however carefully written, however "global" the variable
 * looks — cannot substitute. A module-level integer in a serverless function
 * is per-instance state wearing the word global.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS COUNTER IS, AND WHAT IT IS NOT
 *
 * IT IS NOT A MIRROR OF HERE'S BILLING, and nothing may describe it as one.
 * Three specific reasons, each of which makes the two numbers diverge:
 *
 *   1. TWO PRODUCTS, ONE UNIT. Truck routing and Discover search bill against
 *      different HERE products with different quotas. The cost audit records
 *      the search quota as UNDOCUMENTED. Adding them into one "units" figure
 *      is an aggregation this repository invented; HERE does not bill that
 *      way, and the sum has no counterpart on an invoice.
 *   2. WE COUNT REQUESTS WE MAY NOT HAVE MADE. The reservation happens BEFORE
 *      the provider call. A cache hit, a timeout, a request the provider
 *      rejected — each still consumed a unit here. See the no-refund rule.
 *   3. HERE MAY COUNT REQUESTS WE DO NOT SEE AS ONE. Whether a single routing
 *      request with a truck profile is one transaction or several is a
 *      contract detail this repository cannot read.
 *
 * The honest description is: **a conservative upper bound on requests that
 * could have billed.** It should over-count, never under-count, and the
 * threshold is set below the contracted allowance so that the gap absorbs the
 * error rather than the invoice absorbing it.
 *
 * ---------------------------------------------------------------------------
 * THE NO-REFUND RULE
 *
 * A reservation is never given back. Not on a provider timeout, not on a 502,
 * not on a cache hit discovered after the fact.
 *
 * The reasoning is asymmetric and deliberate. When a request fails partway, we
 * do not know whether the provider counted it — a response that never arrived
 * may still have been served and billed. Refunding on failure therefore means
 * under-counting exactly in the situation most likely to be an incident (a
 * provider erroring under load while a script hammers it), which is the worst
 * possible moment for the guard to start under-reporting. Over-counting costs
 * a driver a refusal that a raised threshold fixes in one environment
 * variable. Under-counting costs money that no variable gets back.
 *
 * ---------------------------------------------------------------------------
 * FAIL CLOSED, AND WHERE
 *
 * In `account` and `public` mode, a metered request is REFUSED when:
 *   - the month's global reservation would cross the safety threshold,
 *   - this user's month would cross their per-user limit,
 *   - the configuration is missing, unparseable or self-contradictory,
 *   - the shared store cannot be reached at all.
 *
 * That last one is the uncomfortable one and it is required: a guard that
 * opens when its database is down is not a spending control, it is a spending
 * control that switches itself off under exactly the conditions where nobody
 * is watching.
 *
 * In `pilot` and `closed` the guard is INERT — it neither counts nor refuses.
 * Production runs `pilot`, and this change must not introduce a way for a
 * Supabase hiccup to stop a live pilot driver from getting a route. Pilot
 * access is already bounded by a passcode held by a handful of known drivers,
 * which is a tighter bound than any counter. This is stated again in
 * `docs/operations/navigator-account-mode-rollout.md`.
 */

import { METERED_ENDPOINTS, type MeteredEndpointKey } from './metered-endpoints';
import type { NavigatorAccessMode } from './access-policy';

/* ========================================================================= *
 * 1. THE MONTH
 * ========================================================================= */

/**
 * The bucket key: `YYYY-MM`, always UTC.
 *
 * UTC and not a local zone, because the count is shared by instances in
 * regions this code does not choose. Two servers disagreeing about which month
 * it is would let the last hours of a month be spent twice — once against the
 * old bucket and once against the new — which is precisely the rollover bug a
 * shared counter is supposed to make impossible.
 */
export function usageMonthKey(atMs: number): string {
  const d = new Date(atMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${m < 10 ? '0' : ''}${m}`;
}

/* ========================================================================= *
 * 2. CONFIGURATION
 * ========================================================================= */

export const USAGE_ENV = {
  /** The contracted monthly allowance, for reporting and the sanity check. */
  allowance: 'NAVIGATOR_PROVIDER_MONTHLY_ALLOWANCE',
  /** The number actually enforced. MUST be below the allowance. */
  threshold: 'NAVIGATOR_PROVIDER_MONTHLY_THRESHOLD',
  /** Per-user monthly ceiling. */
  userLimit: 'NAVIGATOR_PROVIDER_USER_MONTHLY_LIMIT',
  /** Optional per-endpoint weight overrides. */
  weightRoute: 'NAVIGATOR_PROVIDER_WEIGHT_ROUTE',
  weightSearch: 'NAVIGATOR_PROVIDER_WEIGHT_SEARCH',
} as const;

export type UsageGuardConfig = Readonly<{
  allowance: number;
  threshold: number;
  userLimit: number;
  weights: Readonly<Record<MeteredEndpointKey, number>>;
}>;

export type UsageConfigResult =
  | { ok: true; config: UsageGuardConfig }
  | { ok: false; problem: string };

/**
 * A positive integer, or null. Deliberately strict: `''`, `'abc'`, `'12.5'`,
 * `'-1'` and `'0'` are all null rather than coerced. A budget ceiling read
 * from a mistyped variable must not silently become a number nobody chose,
 * and `Number('')` is `0` — which as a threshold would refuse every request
 * while looking like a deliberate setting.
 */
export function parsePositiveInt(raw: string | undefined | null): number | null {
  const value = (raw ?? '').trim();
  if (!/^[0-9]+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Read the configuration, refusing anything ambiguous.
 *
 * THE THRESHOLD MUST BE BELOW THE ALLOWANCE, and a deploy that sets them equal
 * is rejected rather than accepted. Equal means zero margin: the first thing
 * anyone learns is that the allowance is gone, which is the same information
 * the invoice would have provided. The margin is the entire purpose of having
 * two numbers, so a configuration that erases it is a configuration error.
 */
export function readUsageConfig(env: Record<string, string | undefined>): UsageConfigResult {
  const allowance = parsePositiveInt(env[USAGE_ENV.allowance]);
  const threshold = parsePositiveInt(env[USAGE_ENV.threshold]);
  const userLimit = parsePositiveInt(env[USAGE_ENV.userLimit]);

  if (allowance === null) return { ok: false, problem: `${USAGE_ENV.allowance} is not set` };
  if (threshold === null) return { ok: false, problem: `${USAGE_ENV.threshold} is not set` };
  if (userLimit === null) return { ok: false, problem: `${USAGE_ENV.userLimit} is not set` };
  if (threshold >= allowance) {
    return {
      ok: false,
      problem: `${USAGE_ENV.threshold} must be strictly below ${USAGE_ENV.allowance}`,
    };
  }

  const weightRoute =
    parsePositiveInt(env[USAGE_ENV.weightRoute]) ??
    METERED_ENDPOINTS['navigator.route'].defaultWeight;
  const weightSearch =
    parsePositiveInt(env[USAGE_ENV.weightSearch]) ??
    METERED_ENDPOINTS['navigator.destination-search'].defaultWeight;

  return {
    ok: true,
    config: {
      allowance,
      threshold,
      userLimit,
      weights: {
        'navigator.route': weightRoute,
        'navigator.destination-search': weightSearch,
      },
    },
  };
}

/** Units one call to this endpoint reserves under this configuration. */
export function weightFor(config: UsageGuardConfig, key: MeteredEndpointKey): number {
  return config.weights[key];
}

/* ========================================================================= *
 * 3. WHERE THE GUARD APPLIES
 * ========================================================================= */

/**
 * Does this access mode enforce the guard?
 *
 * `account` and `public` — the two modes where a caller the operator has never
 * met can reach a metered endpoint.
 *
 * `pilot` and `closed` — no. See the header: production is pilot, and adding a
 * fail-closed dependency on Supabase to the live pilot would create a new way
 * to strand a driver for no bounded-spend benefit that the passcode does not
 * already provide.
 */
export function guardEnforcedIn(mode: NavigatorAccessMode): boolean {
  return mode === 'account' || mode === 'public';
}

/* ========================================================================= *
 * 4. THE DECISION
 * ========================================================================= */

export type ReservationOutcome =
  /** Units were reserved. The provider call may proceed. */
  | { allowed: true; units: number; globalUnits: number; userUnits: number }
  /** Refused. `reason` is internal; `USER_MESSAGE` is what a driver sees. */
  | { allowed: false; reason: ReservationRefusal };

export type ReservationRefusal =
  /** The month's shared threshold is spent. */
  | 'global-threshold'
  /** This driver has spent their own monthly limit. */
  | 'user-limit'
  /** Configuration missing or contradictory. */
  | 'not-configured'
  /** The shared store could not be reached, or answered unusably. */
  | 'guard-unavailable';

/**
 * What the driver is told.
 *
 * NO BILLING AND NO INFRASTRUCTURE DETAIL. Not the threshold, not how much is
 * left, not the provider's name, not that a database is involved, not which of
 * the four refusals fired. Two reasons, and the second is the load-bearing
 * one:
 *
 *   - A driver cannot act on any of it. "The monthly HERE allowance is at
 *     4,850 of 4,900" is not a sentence that helps someone find a truck stop.
 *   - A remaining-budget figure handed to an anonymous caller is a progress
 *     bar for exhausting it. Telling an attacker how close they are is the
 *     one piece of feedback that makes the attack cheaper.
 *
 * The distinction between the four causes is recorded in the response's
 * machine-readable `code` for the operator, never in the prose.
 */
export const USAGE_LIMIT_USER_MESSAGE =
  'The Navigator cannot plan new routes right now. Nothing is wrong with your truck or ' +
  'your route — this is a limit on our side. Your saved setup is safe. Please try again later.';

/**
 * The pure decision, given counts that a caller obtained atomically.
 *
 * This function does NOT do the reserving — it cannot, because deciding and
 * incrementing have to be the same indivisible act or two instances both read
 * "one unit left" and both proceed. `usage-reservation.ts` performs the check
 * and the increment inside a single Postgres statement, and this function
 * exists so the RULE is provable without a database: the same arithmetic the
 * SQL performs, in a form a test can enumerate.
 *
 * Kept in step with the migration by a test that reads both.
 */
export function decideReservation(input: {
  config: UsageGuardConfig;
  units: number;
  /** Units already reserved this month, all endpoints, all users. */
  globalUnitsBefore: number;
  /** Units already reserved this month by this user. */
  userUnitsBefore: number;
}): ReservationOutcome {
  const { config, units, globalUnitsBefore, userUnitsBefore } = input;

  // Per-user first: it is the cheaper refusal and the more common one, and
  // checking it first means one driver exhausting their own limit never
  // touches the shared counter.
  if (userUnitsBefore + units > config.userLimit) {
    return { allowed: false, reason: 'user-limit' };
  }
  if (globalUnitsBefore + units > config.threshold) {
    return { allowed: false, reason: 'global-threshold' };
  }
  return {
    allowed: true,
    units,
    globalUnits: globalUnitsBefore + units,
    userUnits: userUnitsBefore + units,
  };
}

/**
 * Reservations are never returned. This function exists to be the thing a
 * future caller has to argue with by name, the same way
 * `syncFailureBlocksDriving()` does — a comment can be skimmed past, a
 * function called `refundIsPermitted()` returning `false` cannot.
 *
 * See the no-refund rule in the header for why the asymmetry runs this way.
 */
export function refundIsPermitted(): false {
  return false;
}
