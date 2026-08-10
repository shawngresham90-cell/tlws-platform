/**
 * Maneuver glyph — the arrow beside the distance on the Drive Mode banner
 * (Design Blueprint §5, Phase 1).
 *
 * The glyph is derived ONLY from the provider's structured `action` and
 * `direction` fields, never by parsing instruction prose: free text like
 * "Keep left to stay on I-75" contains words a matcher would misread, and
 * an arrow pointing the wrong way at 70 mph is worse than no arrow at all.
 *
 * The safety rule is therefore OMIT ON UNKNOWN. Every (action, direction)
 * pair this map does not explicitly recognize renders no glyph — the
 * instruction text, which is the provider's own wording and the banner's
 * primary signal, simply stands alone. The glyph is reinforcement, never
 * the meaning (blueprint law 9), and the banner renders it aria-hidden so
 * assistive tech reads the instruction exactly as before.
 *
 * Roundabout actions are deliberately unmapped: one arrow cannot carry
 * "take the third exit", and a plain curve glyph next to a countdown reads
 * as "turn here". Prose does that job better until a dedicated roundabout
 * treatment is designed.
 *
 * Pure: strings in, string-or-null out. No clock, no I/O, no globals.
 */

const STRAIGHT = '↑'; // ↑
const TURN_LEFT = '↰'; // ↰
const TURN_RIGHT = '↱'; // ↱
const BEAR_LEFT = '↖'; // ↖
const BEAR_RIGHT = '↗'; // ↗
const UTURN_LEFT = '↩'; // ↩
const UTURN_RIGHT = '↪'; // ↪
const ARRIVE = '⚑'; // ⚑

/** Actions whose glyph is the direction-agnostic straight arrow. */
const STRAIGHT_ACTIONS: ReadonlySet<string> = new Set(['depart', 'continue']);

/** Actions where left/right means a hard turn. */
const TURN_ACTIONS: ReadonlySet<string> = new Set(['turn']);

/** Actions where left/right means bearing off at a shallow angle. */
const BEAR_ACTIONS: ReadonlySet<string> = new Set(['keep', 'fork', 'exit', 'ramp', 'merge']);

const UTURN_ACTIONS: ReadonlySet<string> = new Set(['uturn']);

/**
 * The banner glyph for a maneuver, or null when no glyph is safe to show.
 * Null is the correct answer for every unrecognized input — including a
 * recognized action whose direction is missing when the action needs one.
 */
export function maneuverGlyph(
  action: string | null | undefined,
  direction: string | null | undefined,
): string | null {
  if (typeof action !== 'string') return null;
  const act = action.trim().toLowerCase();
  if (act === '') return null;
  const dir = typeof direction === 'string' ? direction.trim().toLowerCase() : null;

  if (act === 'arrive') return ARRIVE;
  if (STRAIGHT_ACTIONS.has(act)) return STRAIGHT;
  if (dir !== 'left' && dir !== 'right') return null;
  if (TURN_ACTIONS.has(act)) return dir === 'left' ? TURN_LEFT : TURN_RIGHT;
  if (BEAR_ACTIONS.has(act)) return dir === 'left' ? BEAR_LEFT : BEAR_RIGHT;
  if (UTURN_ACTIONS.has(act)) return dir === 'left' ? UTURN_LEFT : UTURN_RIGHT;
  return null;
}
