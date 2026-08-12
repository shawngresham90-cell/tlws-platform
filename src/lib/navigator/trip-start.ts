/**
 * The one-tap trip start (pilot round 3 — startup simplification).
 *
 * The simplified parked flow is: choose a destination → tap START. That
 * single tap is the real user gesture that requests location permission
 * (the component layer calls the GPS provider's start() inside the click
 * handler — permission handling stays at the browser boundary, exactly
 * where doc 04 put it). This module is the PURE part: given the gated
 * position state the GPS session already publishes, what may the attempt
 * do next — and the guard that makes "one Start tap = at most one plan
 * request" structural rather than hopeful.
 *
 * WHAT THIS MODULE REFUSES TO DO, by design:
 *
 *   - It never reads a clock (AD-2: `Date` is banned in this layer) and
 *     it owns NO timer. The only timeout in the flow is the platform's
 *     own watchPosition bound (WATCH_OPTIONS.timeoutMs, 15 s): when the
 *     browser gives up it says so through the error channel, the GPS
 *     session turns that into health, and `assessStartFix` reads the
 *     health. An attempt therefore ends exactly when the PLATFORM's
 *     evidence ends it — never on a duration this code invented.
 *
 *   - It never fabricates an origin. 'plan' is returned ONLY while the
 *     session holds a fix whose health is 'good' or 'degraded' — the
 *     same predicate the navigation lifecycle uses to feed its engines.
 *     'lost' (a fix gone stale, doc 04 §2) and 'unavailable' are
 *     refusals, never fallbacks: a stale, guessed or default origin must
 *     never reach the route request.
 *
 * The attempt guard exists because the double-tap is real: a gloved hand
 * in a cab taps twice, and each tap must not become a second GPS watch
 * or a second HERE transaction. `begin()` claims the single slot
 * synchronously (React state is async; a ref-held guard is not) and
 * `claimPlan()` hands out the attempt's one plan ticket. The lifecycle's
 * own idle-only plan() rule stands behind this as the structural
 * backstop.
 */

import type { PositionState } from './types';

/** Honest progress, in the driver's terms — one line per phase. */
export const GETTING_LOCATION_TEXT = 'Getting location…';
export const PLANNING_ROUTE_TEXT = 'Planning truck route…';
export const STARTING_NAVIGATION_TEXT = 'Starting navigation…';

/** The recovery lines. One clear sentence each, and always a way back. */
export const LOCATION_DENIED_TEXT =
  'Location permission is denied, so a route cannot start from where you are. ' +
  'Allow location for this site in your browser settings, then tap Start again.';
export const LOCATION_UNAVAILABLE_TEXT =
  "Your device couldn't get a GPS fix, so nothing was planned. " +
  'Move somewhere with a clearer view of the sky and tap Start again.';
export const NO_DESTINATION_TEXT = 'Search for a destination and choose it from the list.';

/**
 * What a locating attempt may do next, given the gated position state
 * and two provider flags: `acquiring` (true from start() until the
 * platform's first fix or first error — provider state, because the pure
 * session cannot tell "never asked" from a real POSITION_UNAVAILABLE)
 * and `watching` (a live watch exists).
 *
 * `watching` is what tells "nothing YET" apart against "nothing, and
 * that is the answer": the cold pre-watch state and the post-timeout state carry
 * the identical position snapshot (no fix, health 'unavailable'), and
 * only a live watch whose acquisition has ended has genuinely been
 * ANSWERED by the platform. Without it, an attempt racing its own
 * watch-start (commit ordering is not guaranteed across renderers)
 * could read the cold state as a platform refusal and fail a Start that
 * was milliseconds old. 'wait' with no watch cannot hang: the Start tap
 * itself starts the one watch, and denial tears the watch down THROUGH
 * the 'denied' health this checks first.
 */
export type StartFixAssessment =
  /** A usable origin exists: plan now, from this fix. */
  | 'plan'
  /** The platform has not answered yet (permission prompt open, or first
   *  fix still acquiring): keep waiting — the platform's own timeout
   *  bounds this. */
  | 'wait'
  /** Permission is denied. Terminal for the attempt; recovery is the
   *  driver changing browser settings, never a retry loop. */
  | 'denied'
  /** The platform answered and could not produce a usable fix (timeout,
   *  unavailable, or a fix gone stale). End the attempt honestly and
   *  offer retry. */
  | 'unusable';

export function assessStartFix(
  position: PositionState,
  acquiring: boolean,
  watching: boolean,
): StartFixAssessment {
  if (position.health === 'denied') return 'denied';
  if (position.fix !== null && (position.health === 'good' || position.health === 'degraded')) {
    return 'plan';
  }
  if (acquiring || !watching) return 'wait';
  return 'unusable';
}

export type StartAttempt = {
  /** Claim the single attempt slot. False = an attempt is already live
   *  (the duplicate tap), and the caller must do nothing. */
  begin(): boolean;
  /** The attempt's ONE plan ticket. True exactly once per begin(). */
  claimPlan(): boolean;
  /** Release the slot — success, failure and cancellation all end here. */
  end(): void;
  /** True while an attempt holds the slot. */
  active(): boolean;
};

export function createStartAttempt(): StartAttempt {
  let active = false;
  let planClaimed = false;
  return {
    begin() {
      if (active) return false;
      active = true;
      planClaimed = false;
      return true;
    },
    claimPlan() {
      if (!active || planClaimed) return false;
      planClaimed = true;
      return true;
    },
    end() {
      active = false;
      planClaimed = false;
    },
    active: () => active,
  };
}
