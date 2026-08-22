/**
 * The parked Navigator's destination-first contract (NAV-ENTRY-2).
 *
 * WHY THIS MODULE EXISTS. The milestone's acceptance target is a fact about
 * a rendered page — "the parked destination entry is visible without
 * vertical scrolling at six named viewports" — and facts about rendered
 * pages are measured in a browser, not asserted in a unit test. But the
 * RULE that turns a measurement into a verdict is pure, and if the bench
 * owns it privately then the deterministic harness cannot test the rule and
 * the two can drift until they disagree about what passing means.
 *
 * So the rule lives here, the bench feeds it real measurements, and the
 * harness feeds it the numbers actually recorded before and after the
 * change. The before-numbers must FAIL and the after-numbers must PASS —
 * which is a much stronger statement than either file could make alone.
 *
 * WHAT THE RULE REFUSES TO ACCEPT. Three different ways a destination box
 * can be present and still useless, all of them observed on the shipped
 * build rather than imagined:
 *
 *   1. Below the fold. The box is in the document but under the viewport,
 *      so the driver scrolls to find it.
 *   2. Clipped by an ancestor. The box is inside the viewport's coordinate
 *      range but an overflow container above it is shorter than the content
 *      it holds, so none of the box is painted. This is the one that
 *      shipped: the search sat 541 px down inside a 286 px scroller, and
 *      measured a VISIBLE HEIGHT OF 0 px at every required viewport while
 *      its document coordinates looked almost reasonable.
 *   3. Covered. The box is painted but something opaque is over it — the
 *      site's fixed mobile tool bar being the one that reaches this screen.
 *
 * A rule that only compared `top` against `viewportHeight` would have
 * called the shipped build a pass at three of the six viewports. That is
 * why `visibleHeight` and `obstructionTop` are required inputs and not
 * optional refinements.
 *
 * Pure: no DOM, no clock, no I/O. Every number arrives as an argument.
 */

/** One viewport the milestone names, in CSS pixels. */
export type RequiredViewport = Readonly<{
  name: string;
  width: number;
  height: number;
  /** Phone-shaped cases are emulated with touch and a mobile UA. */
  mobile: boolean;
}>;

/**
 * The six viewports the acceptance target names. Portrait phones from a
 * small Android through a large iPhone, both landscape phone shapes, and
 * one laptop — the last so a regression that only shows up with room to
 * spare is still caught.
 */
export const REQUIRED_VIEWPORTS: readonly RequiredViewport[] = Object.freeze([
  Object.freeze({ name: '360x740', width: 360, height: 740, mobile: true }),
  Object.freeze({ name: '390x844', width: 390, height: 844, mobile: true }),
  Object.freeze({ name: '430x932', width: 430, height: 932, mobile: true }),
  Object.freeze({ name: '844x390', width: 844, height: 390, mobile: true }),
  Object.freeze({ name: '932x430', width: 932, height: 430, mobile: true }),
  Object.freeze({ name: '1280x800', width: 1280, height: 800, mobile: false }),
]);

/**
 * The floor the milestone sets for the destination input and its primary
 * interaction target. It is the accessibility minimum, not the goal.
 */
export const MIN_DESTINATION_TARGET_PX = 44;

/**
 * What the Navigator's own blueprint asks for, and what the shipped input
 * already measures (`min-h-16`). The milestone says to prefer a larger
 * glove-friendly target where layout permits, and here it does — so a drop
 * from this to the bare minimum is a regression worth naming even though it
 * would still clear the floor.
 */
export const NAVIGATOR_TOUCH_FLOOR_PX = 64;

/**
 * The parked hierarchy, in the order a driver meets it. This is the
 * milestone's requirement stated as data so it can be asserted rather than
 * described: destination first, then the map, then the controls that spend
 * a route, and only then the supporting material.
 */
export const PARKED_HIERARCHY: readonly string[] = Object.freeze([
  'destination-search',
  'map',
  'route-start-controls',
  'trip-planning',
  'motion-status',
  'map-style',
]);

/** A measurement of the destination entry, taken from a real render. */
export type DestinationMeasurement = Readonly<{
  /** Top edge in VIEWPORT coordinates, before any scrolling. */
  top: number;
  /** Bottom edge in viewport coordinates. */
  bottom: number;
  /** The control's own height — the touch target. */
  height: number;
  /**
   * How much of the control is actually painted after every ancestor's
   * clip box is intersected with the viewport. Zero means present in the
   * document and invisible on the screen.
   */
  visibleHeight: number;
  /** The viewport's height in CSS pixels. */
  viewportHeight: number;
  /**
   * The top edge of the nearest fixed element covering the bottom of the
   * screen (the site's mobile tool bar), or the viewport height when
   * nothing covers it.
   */
  obstructionTop: number;
}>;

export type DestinationVerdict = Readonly<{
  ok: boolean;
  /** Every rule that failed, in a stable order, for a report to print. */
  reasons: readonly string[];
}>;

/**
 * Does this measurement satisfy the parked destination-first contract?
 *
 * Every rule is a separate reason rather than an early return, so a report
 * can say all of what is wrong instead of the first thing.
 */
export function destinationEntryUsable(m: DestinationMeasurement): DestinationVerdict {
  const reasons: string[] = [];
  if (m.height < MIN_DESTINATION_TARGET_PX) {
    reasons.push(`target ${Math.round(m.height)}px is under the ${MIN_DESTINATION_TARGET_PX}px floor`);
  }
  if (m.top < 0) {
    reasons.push(`top ${Math.round(m.top)}px is above the viewport`);
  }
  if (m.bottom > m.viewportHeight) {
    reasons.push(
      `bottom ${Math.round(m.bottom)}px is below the ${Math.round(m.viewportHeight)}px fold`,
    );
  }
  /*
   * The clipping rule, and the reason it is stated as "the whole control"
   * rather than "some of it". A destination box with its label showing and
   * its input cut off is not a destination box a driver can use, and the
   * shipped build's failure mode was the extreme version of exactly this.
   */
  if (m.visibleHeight < m.height - 1) {
    reasons.push(
      `only ${Math.round(m.visibleHeight)}px of ${Math.round(m.height)}px is painted — an ancestor clips it`,
    );
  }
  if (m.bottom > m.obstructionTop + 1) {
    reasons.push(`covered by fixed chrome starting at ${Math.round(m.obstructionTop)}px`);
  }
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/**
 * Is the destination entry not merely visible but DOMINANT — the first
 * thing on the parked screen rather than something reachable near the top?
 *
 * The milestone asks for both, and they are different questions: a box that
 * clears the fold by a pixel at the bottom of a screen full of setup passes
 * the visibility rule and fails the point of the milestone. The threshold
 * is a fraction of the viewport rather than a pixel count, because "near
 * the top" means something different on a 390 px landscape phone than on a
 * 932 px portrait one.
 */
export const DOMINANCE_FRACTION = 0.5;

export function destinationEntryDominant(m: DestinationMeasurement): boolean {
  return destinationEntryUsable(m).ok && m.top <= m.viewportHeight * DOMINANCE_FRACTION;
}

/**
 * Check a rendered block order against the parked hierarchy.
 *
 * Only the blocks the caller actually found are considered, so a surface
 * that legitimately has no planning prompt (the driver already answered)
 * is not failed for its absence — what is checked is that whatever IS
 * present appears in the contracted order.
 */
export function parkedOrderViolations(order: readonly string[]): readonly string[] {
  const rank = new Map(PARKED_HIERARCHY.map((name, i) => [name, i]));
  const violations: string[] = [];
  let highest = -1;
  let highestName = '';
  for (const name of order) {
    const r = rank.get(name);
    if (r === undefined) continue;
    if (r < highest) violations.push(`${name} renders after ${highestName}`);
    else {
      highest = r;
      highestName = name;
    }
  }
  return Object.freeze(violations);
}
