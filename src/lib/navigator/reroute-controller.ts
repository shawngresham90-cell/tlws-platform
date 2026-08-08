/**
 * Controlled truck rerouting (milestone N8e) — the FIRST module permitted
 * to request a replacement route after navigation has started, and the
 * only one that ever may. Every request is gated, budgeted, and every
 * answer is validated exactly like the original route before it can
 * replace the session; a failure of any kind keeps the truck navigating
 * its current route.
 *
 * Trigger discipline: replacement may be requested ONLY from the N8d
 * detector's CONFIRMED state. Suspected, recovering, on-route, and
 * recovered never spend; a degraded position fix never spends (a reroute
 * computed from a bad origin is worse than none).
 *
 * What is preserved on every replacement, verbatim from the session:
 * the truck profile (all legal restrictions), the destination, and the
 * feature avoidances. Only the path changes — never where the truck is
 * going, never what the truck is.
 *
 * Pure: the replacement fetch is an injected port (the app wires the
 * flag-gated /api/navigator/route endpoint; tests inject scripts); time
 * arrives as arguments. No I/O, no clock, no timers in this module.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { RouteAvoidance } from '@/lib/trip-planner/providers';
import { validateNavigatorTruckProfile } from './truck-validation';
import { createRouteSession, type RouteSession } from './route-session';
import type { OffRouteState } from './off-route-detector';

export type ReplacementRequest = {
  /** Where the truck is NOW — the only field that may differ per attempt. */
  origin: LatLng;
  /** The session destination, verbatim. Never changed by a reroute. */
  destination: LatLng;
  /** The session truck profile, verbatim — every legal restriction rides. */
  truck: RouteSession['truck'];
  /** The session avoidances, verbatim. */
  avoid: readonly RouteAvoidance[];
  departAtMs: number;
};

/** What the injected port returns: the N8a-validated route material. */
export type ReplacementFetchResult =
  | {
      kind: 'route';
      positions: readonly LatLng[];
      distanceMiles: number;
      durationSeconds: number;
      maneuvers: readonly {
        action: string;
        instruction: string;
        direction: string | null;
        offset: number;
      }[];
      /** The N8a verdict for the replacement (valid / valid-with-warning / …). */
      validationState: string;
      warnings?: readonly string[];
    }
  | { kind: 'failure'; reason: string };

export type ReplacementPort = (req: ReplacementRequest) => Promise<ReplacementFetchResult>;

export type RerouteRefusal =
  | 'not-confirmed'
  | 'degraded-position'
  | 'cooldown'
  | 'hourly-budget'
  | 'session-budget'
  | 'duplicate'
  | 'no-session';

export type RerouteResult =
  | { outcome: 'replaced'; session: RouteSession }
  | { outcome: 'refused'; reason: RerouteRefusal; retryAtMs: number | null }
  | { outcome: 'rejected'; problems: { code: string; message: string }[] }
  | { outcome: 'provider-failure'; reason: string }
  | { outcome: 'stale-dropped' };

export type RerouteStats = {
  requested: number;
  refused: Record<RerouteRefusal, number>;
  /** Actual port invocations — the number that costs money. */
  providerCalls: number;
  coalesced: number;
  duplicatesSuppressed: number;
  successes: number;
  rejectedReplacements: number;
  providerFailures: number;
  /**
   * Transport failures refunded to the budget — a request that never
   * reached the provider costs nothing, so it must not ration a later one
   * that could actually succeed. Counted so the refund is auditable
   * rather than invisible.
   */
  budgetRefunds: number;
  staleDropped: number;
  hourlyWindowCount: number;
  sessionCount: number;
};

export type RerouteControllerInput = {
  detectorState: OffRouteState;
  currentPosition: LatLng;
  /** Position accuracy of the current fix, meters (null = unknown). */
  accuracyM: number | null;
  tMs: number;
};

export type RerouteController = {
  /** The session currently navigating (replacements swap it). */
  currentSession(): RouteSession;
  requestReroute(input: RerouteControllerInput): Promise<RerouteResult>;
  /**
   * Abandon an in-flight request older than the timeout. The eventual
   * response is then discarded as stale. Callers invoke this from their
   * tick loop with the current time.
   */
  expireInFlight(tMs: number): boolean;
  stats(): RerouteStats;
  /** Cooldown end, epoch ms (0 = none) — for honest UI later. */
  cooldownUntilMs(): number;
};

export type RerouteConfig = {
  maxPerHour: number;
  maxPerSession: number;
  /** Escalating cooldowns after failures; last entry repeats. */
  failureBackoffMs: readonly number[];
  /** Cooldown after a successful replacement. */
  successCooldownMs: number;
  /** Identical requests inside this window are suppressed. */
  duplicateWindowMs: number;
  /** In-flight requests older than this can be expired by the caller. */
  inFlightTimeoutMs: number;
  /** Reroutes are never computed from fixes worse than this. */
  maxPositionAccuracyM: number;
};

export const REROUTE_DEFAULTS: RerouteConfig = {
  maxPerHour: 6, // doc 05 §4: budget 6 in the trailing hour
  maxPerSession: 12,
  failureBackoffMs: [30_000, 60_000, 120_000], // doc 05 §4 backoff ladder
  successCooldownMs: 15_000,
  duplicateWindowMs: 30_000,
  inFlightTimeoutMs: 15_000,
  maxPositionAccuracyM: 30,
};

const HOUR_MS = 3_600_000;

/**
 * Failure reasons that mean the request never reached the provider, and
 * therefore cost nothing. `network` is the route port's fetch/timeout
 * outcome; `port-threw` is a port that raised before any call. Anything
 * else — a malformed route, a rejected replacement, an HTTP status —
 * got as far as the provider and stays charged.
 */
const TRANSPORT_FAILURES: ReadonlySet<string> = new Set(['network', 'port-threw']);

function requestKey(origin: LatLng, destination: LatLng): string {
  return `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}|${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
}

export function createRerouteController(
  initialSession: RouteSession,
  port: ReplacementPort,
  config: Partial<RerouteConfig> = {},
): RerouteController {
  const cfg: RerouteConfig = { ...REROUTE_DEFAULTS, ...config };

  let session = initialSession;
  let epoch = 0; // bumps on replacement; stale responses carry an old epoch
  let inFlight: { promise: Promise<RerouteResult>; startedMs: number; seq: number } | null = null;
  let seqCounter = 0;
  let expiredSeq = -1;
  let cooldownUntil = 0;
  let consecutiveFailures = 0;
  let sessionCount = 0;
  let callTimes: number[] = [];
  let lastFailedKey: string | null = null;
  let lastFailedKeyMs = 0;

  const stats: RerouteStats = {
    requested: 0,
    refused: {
      'not-confirmed': 0,
      'degraded-position': 0,
      cooldown: 0,
      'hourly-budget': 0,
      'session-budget': 0,
      duplicate: 0,
      'no-session': 0,
    },
    providerCalls: 0,
    coalesced: 0,
    duplicatesSuppressed: 0,
    successes: 0,
    rejectedReplacements: 0,
    providerFailures: 0,
    budgetRefunds: 0,
    staleDropped: 0,
    hourlyWindowCount: 0,
    sessionCount: 0,
  };

  function refuse(reason: RerouteRefusal, retryAtMs: number | null): RerouteResult {
    stats.refused[reason] += 1;
    return { outcome: 'refused', reason, retryAtMs };
  }

  function failureCooldown(tMs: number): void {
    const ladder = cfg.failureBackoffMs;
    const backoff = ladder[Math.min(consecutiveFailures, ladder.length - 1)];
    consecutiveFailures += 1;
    cooldownUntil = tMs + backoff;
  }

  async function execute(
    input: RerouteControllerInput,
    mySeq: number,
    key: string,
  ): Promise<RerouteResult> {
    const request: ReplacementRequest = {
      origin: { ...input.currentPosition },
      destination: { ...session.destination },
      truck: { ...session.truck },
      avoid: [...session.avoid],
      departAtMs: input.tMs,
    };
    // Belt: the preserved truck must still be routable — free to check,
    // and a mangled profile must never reach the provider.
    const truckIssues = validateNavigatorTruckProfile(request.truck);
    if (truckIssues.length > 0) {
      failureCooldown(input.tMs);
      return {
        outcome: 'rejected',
        problems: truckIssues.map((i) => ({ code: `truck:${i.code}`, message: i.message })),
      };
    }

    const myEpoch = epoch;
    stats.providerCalls += 1;
    callTimes.push(input.tMs);

    let fetched: ReplacementFetchResult;
    try {
      fetched = await port(request);
    } catch (e) {
      fetched = { kind: 'failure', reason: e instanceof Error ? 'port-threw' : 'port-threw' };
    }

    // Stale rejection: superseded (expired by the caller) or the session
    // changed while we were waiting — this answer belongs to a world that
    // no longer exists. It must not replace anything.
    if (mySeq <= expiredSeq || myEpoch !== epoch) {
      stats.staleDropped += 1;
      return { outcome: 'stale-dropped' };
    }

    if (fetched.kind === 'failure') {
      stats.providerFailures += 1;
      /*
       * A request that never reached the provider costs nothing, so it is
       * refunded to the budget.
       *
       * The budgets exist to cap provider SPEND. Charging a failed fetch
       * against them protects nothing and costs the driver the thing the
       * budget was never meant to ration: a truck goes off-route in a
       * dead-signal stretch — a canyon, a mountain pass, exactly where a
       * wrong turn is most likely — and every attempt fails at the
       * transport layer while still burning one of the six calls an hour.
       * By the time signal returns, the app knows the truck is off route
       * and has no budget left to fix it.
       *
       * Only transport failures qualify. A malformed or rejected route
       * DID reach the provider and stays charged. The escalating failure
       * cooldown is untouched either way — that is the rate limiter, and
       * this is the money limiter. They are not the same rail.
       */
      if (TRANSPORT_FAILURES.has(fetched.reason)) {
        stats.providerCalls -= 1;
        const at = callTimes.lastIndexOf(input.tMs);
        if (at >= 0) callTimes.splice(at, 1);
        stats.budgetRefunds += 1;
      }
      failureCooldown(input.tMs);
      return { outcome: 'provider-failure', reason: fetched.reason };
    }

    const created = createRouteSession({
      routeId: `${session.routeId}-r${sessionCount + 1}`,
      truck: request.truck,
      origin: request.origin,
      destination: request.destination,
      positions: fetched.positions,
      distanceMiles: fetched.distanceMiles,
      durationSeconds: fetched.durationSeconds,
      maneuvers: fetched.maneuvers,
      avoid: request.avoid,
      validationState: fetched.validationState,
      warnings: fetched.warnings,
    });
    if (!created.ok) {
      // A rejected replacement NEVER touches the current session.
      stats.rejectedReplacements += 1;
      lastFailedKey = key;
      lastFailedKeyMs = input.tMs;
      failureCooldown(input.tMs);
      return { outcome: 'rejected', problems: created.problems };
    }

    // Success: swap the session, bump the epoch, reset the ladder.
    session = created.session;
    epoch += 1;
    sessionCount += 1;
    stats.sessionCount = sessionCount;
    stats.successes += 1;
    consecutiveFailures = 0;
    lastFailedKey = null;
    cooldownUntil = input.tMs + cfg.successCooldownMs;
    return { outcome: 'replaced', session };
  }

  function requestReroute(input: RerouteControllerInput): Promise<RerouteResult> {
    stats.requested += 1;

    // Coalescing / single-flight: while a request is pending, every
    // caller shares it. Concurrent provider requests are impossible.
    if (inFlight !== null) {
      stats.coalesced += 1;
      return inFlight.promise;
    }

    // Gate 1 — trigger discipline: CONFIRMED only.
    if (input.detectorState !== 'confirmed') {
      return Promise.resolve(refuse('not-confirmed', null));
    }
    // Gate 2 — position quality: never compute a route from a bad origin.
    if (input.accuracyM === null || input.accuracyM > cfg.maxPositionAccuracyM) {
      return Promise.resolve(refuse('degraded-position', null));
    }
    // Gate 3 — cooldown / backoff.
    if (input.tMs < cooldownUntil) {
      return Promise.resolve(refuse('cooldown', cooldownUntil));
    }
    // Gate 4 — session budget.
    if (sessionCount >= cfg.maxPerSession) {
      return Promise.resolve(refuse('session-budget', null));
    }
    // Gate 5 — trailing-hour budget.
    callTimes = callTimes.filter((t) => input.tMs - t < HOUR_MS);
    stats.hourlyWindowCount = callTimes.length;
    if (callTimes.length >= cfg.maxPerHour) {
      return Promise.resolve(refuse('hourly-budget', callTimes[0] + HOUR_MS));
    }
    // Gate 6 — duplicate suppression: the same request that just failed
    // validation will fail again; do not spend on it inside the window.
    const key = requestKey(input.currentPosition, session.destination);
    if (lastFailedKey === key && input.tMs - lastFailedKeyMs < cfg.duplicateWindowMs) {
      stats.duplicatesSuppressed += 1;
      return Promise.resolve(refuse('duplicate', lastFailedKeyMs + cfg.duplicateWindowMs));
    }

    const mySeq = ++seqCounter;
    const promise = execute(input, mySeq, key).finally(() => {
      if (inFlight !== null && inFlight.seq === mySeq) inFlight = null;
    });
    inFlight = { promise, startedMs: input.tMs, seq: mySeq };
    return promise;
  }

  function expireInFlight(tMs: number): boolean {
    if (inFlight === null) return false;
    if (tMs - inFlight.startedMs < cfg.inFlightTimeoutMs) return false;
    expiredSeq = Math.max(expiredSeq, inFlight.seq);
    inFlight = null;
    failureCooldown(tMs);
    stats.providerFailures += 1;
    return true;
  }

  return {
    currentSession: () => session,
    requestReroute,
    expireInFlight,
    stats: () => ({ ...stats, refused: { ...stats.refused } }),
    cooldownUntilMs: () => cooldownUntil,
  };
}
