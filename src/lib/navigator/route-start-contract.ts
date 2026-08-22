/**
 * The parked route-start contract (NAV-ENTRY-3).
 *
 * WHAT THIS IS FOR. NAV-ENTRY-2 got the destination box in front of the
 * driver. What it left behind is the rest of that sentence: a driver taps a
 * search result and then has to work out, unaided, whether the tap landed
 * and what to do next. Measured on main at 86b417e, after choosing a
 * destination the confirmation sat 819-1114 px down and Start 859-1182 px
 * down, both with a PAINTED HEIGHT OF ZERO, behind 315-541 px of scrolling.
 *
 * Two rules live here, both pure, both shared by the deterministic harness
 * and the browser bench so the two can never drift into disagreeing about
 * what passing means.
 *
 * RULE 1 — THE ROUTE-SPEND LEDGER. A route request is the thing that costs
 * money. Ten journey steps must spend exactly zero of them, and exactly one
 * deliberate Start must spend exactly one. The reason this is data rather
 * than a pile of assertions is that the interesting failures are not "a
 * route was requested" but "a route was requested HERE" — and a ledger can
 * say which step broke without the caller having to know in advance.
 *
 * Search requests are counted SEPARATELY and are never conflated with route
 * requests. A search is cheap and expected while typing; a route is not. A
 * contract that lumped them together could be satisfied by a change that
 * quietly bought a route on every keystroke.
 *
 * RULE 2 — THE SELECTION MUST BE ACKNOWLEDGED. "I picked the place, now
 * what?" is answered by two things being simultaneously true on screen: the
 * chosen destination is named, and the control that acts on it is reachable
 * without scrolling. Either alone is not enough — a confirmation with the
 * button below the fold still leaves the driver hunting, and a button with
 * no confirmation leaves them unsure the tap registered.
 *
 * Pure: no DOM, no clock, no I/O. Every number arrives as an argument.
 */

/** A step in the parked journey, and what it is allowed to cost. */
export type JourneyStep = Readonly<{
  /** What the driver did, in the words the report will print. */
  action: string;
  /** Route requests observed during this step. */
  routeRequests: number;
  /** Destination-search requests observed during this step. */
  searchRequests: number;
}>;

/**
 * The actions that must never, under any circumstance, cost a route
 * request. This is the milestone's route-spend invariant stated as data.
 *
 * Note what is NOT here: typing. Typing legitimately spends SEARCH
 * requests, which is a different budget, and pretending otherwise would
 * make the contract unsatisfiable by the shipped search.
 */
export const ZERO_ROUTE_ACTIONS: readonly string[] = Object.freeze([
  'open /drive',
  'tap START DRIVING',
  'open /drive/navigate',
  'focus destination field',
  'type a destination query',
  'select a destination result',
  'open Settings',
  'return from Settings',
  'open Plan My Trip',
  'return from Plan My Trip',
]);

/** The one action allowed to buy a route, and the exact number it may buy. */
export const DELIBERATE_START_ACTION = 'deliberate Start on a valid destination';
export const DELIBERATE_START_ROUTE_COST = 1;

export type SpendVerdict = Readonly<{
  ok: boolean;
  violations: readonly string[];
}>;

/**
 * Check an observed journey against the ledger.
 *
 * Every step is judged, and every failure is reported, rather than stopping
 * at the first: a change that starts buying routes tends to buy them in
 * more than one place, and a report naming one of three is a report that
 * gets half-fixed.
 */
export function routeSpendViolations(steps: readonly JourneyStep[]): SpendVerdict {
  const violations: string[] = [];
  for (const step of steps) {
    if (ZERO_ROUTE_ACTIONS.includes(step.action)) {
      if (step.routeRequests !== 0) {
        violations.push(
          `${step.action} spent ${step.routeRequests} route request(s), must spend 0`,
        );
      }
    } else if (step.action === DELIBERATE_START_ACTION) {
      if (step.routeRequests !== DELIBERATE_START_ROUTE_COST) {
        violations.push(
          `${step.action} spent ${step.routeRequests} route request(s), must spend exactly ${DELIBERATE_START_ROUTE_COST}`,
        );
      }
    } else {
      /*
       * An unrecognised step is a violation, not a pass. The ledger is the
       * whole list of things a parked driver can do; a step nobody wrote
       * down is a step nobody decided the cost of.
       */
      violations.push(`${step.action} is not a step this contract knows the price of`);
    }
    if (step.searchRequests < 0) {
      violations.push(`${step.action} reported a negative search count`);
    }
  }
  const covered = new Set(steps.map((s) => s.action));
  for (const required of ZERO_ROUTE_ACTIONS) {
    if (!covered.has(required)) violations.push(`${required} was never measured`);
  }
  if (!covered.has(DELIBERATE_START_ACTION)) {
    violations.push(`${DELIBERATE_START_ACTION} was never measured`);
  }
  return Object.freeze({ ok: violations.length === 0, violations: Object.freeze(violations) });
}

/** What the screen shows once a destination has been chosen. */
export type SelectionState = Readonly<{
  /** The chosen place is named on screen. */
  confirmationVisible: boolean;
  /** …and every pixel of that naming is painted, not clipped. */
  confirmationFullyPainted: boolean;
  /** The primary action is inside the initial viewport, no scrolling. */
  ctaInViewport: boolean;
  /** …and every pixel of it is painted. */
  ctaFullyPainted: boolean;
  /** Its touch target, in CSS pixels. */
  ctaHeight: number;
  /** Nothing opaque is on top of it. */
  ctaUncovered: boolean;
  /** No ancestor scroller hides it behind an inner scrollbar. */
  ctaFreeOfScrollTrap: boolean;
  /** The driver can still change the destination without retyping. */
  destinationStillEditable: boolean;
}>;

/** The floor for the primary action's touch target, in CSS pixels. */
export const MIN_CTA_TARGET_PX = 44;

/**
 * Is "I picked the place — now what?" actually answered?
 *
 * Stated as a list of reasons rather than a boolean so a failing bench can
 * print which half of the answer is missing.
 */
export function selectionAnswered(s: SelectionState): SpendVerdict {
  const violations: string[] = [];
  if (!s.confirmationVisible) violations.push('the chosen destination is not named on screen');
  if (!s.confirmationFullyPainted) violations.push('the confirmation is clipped');
  if (!s.ctaInViewport) violations.push('the primary action is not in the initial viewport');
  if (!s.ctaFullyPainted) violations.push('the primary action is clipped');
  if (s.ctaHeight < MIN_CTA_TARGET_PX) {
    violations.push(
      `the primary action is ${Math.round(s.ctaHeight)}px, under the ${MIN_CTA_TARGET_PX}px floor`,
    );
  }
  if (!s.ctaUncovered) violations.push('something is painted on top of the primary action');
  if (!s.ctaFreeOfScrollTrap) violations.push('the primary action is inside an inner scroller');
  if (!s.destinationStillEditable) violations.push('the destination can no longer be changed');
  return Object.freeze({ ok: violations.length === 0, violations: Object.freeze(violations) });
}
