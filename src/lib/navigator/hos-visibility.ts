import type { HosCompactView } from './hos-compact';

/**
 * Whether the driving screen shows the clocks — and what it still owes
 * the driver when it does not.
 *
 * WHY THIS EXISTS. Road-test feedback was specific: the live screen is
 * too busy, and the HOS strip takes permanent space a driver did not
 * always ask for. The strip is genuinely useful — it is the only place
 * the app says how much drive time is left — but "useful" and "on screen
 * every second of every mile" are different claims, and only the driver
 * knows which one applies to their day.
 *
 * WHAT HIDING MAY AND MAY NOT MEAN. Hiding is a PRESENTATION change and
 * nothing else. The clocks keep running, the single mounted HosStrip
 * keeps owning the state, the 60-second advance keeps advancing and the
 * voice announcer keeps announcing. A driver who hides the strip has
 * asked for less to look at, not for the app to stop counting — and an
 * app that quietly stopped counting because a panel was closed would be
 * lying about the one number that has legal weight.
 *
 * THE ONE THING HIDING MAY NOT HIDE. A clock at URGENT or already OVER
 * is not decoration. `hosPresentation` therefore has three states, not
 * two: the full strip, a compact warning when the driver has hidden the
 * strip and a clock has gone urgent anyway, and — only when every clock
 * is calm — the bare control. The driver's preference is remembered
 * through all of it; the override is about the moment, not the setting,
 * so nothing is silently rewritten on their behalf.
 *
 * This module is pure: no clock, no storage, no DOM. The preference
 * arrives as a value and the urgency arrives as a view.
 */

/** The driver's saved choice. */
export type HosVisibility = 'shown' | 'hidden';

/**
 * FIRST USE SHOWS THE CLOCKS.
 *
 * The measured argument, not a preference: at the reference 390x844
 * phone the expanded strip costs about 8% of the viewport, and a driver
 * who has never seen it cannot know it exists to ask for it. Defaulting
 * to hidden would make the app's only hours display an easter egg, and
 * the road-test complaint was that the strip was too PERMANENT, not that
 * it was unwanted. So the default is the honest one — visible, with an
 * obvious way out — and the driver's choice is remembered from the first
 * time they make it.
 */
export const HOS_VISIBILITY_DEFAULT: HosVisibility = 'shown';

/** The control's two labels. Plain words, never a bare chevron. */
export const HIDE_CLOCKS_LABEL = 'Hide clocks';
export const SHOW_CLOCKS_LABEL = 'Show clocks';

/**
 * Said beside the collapsed control, so "no clocks on screen" cannot be
 * mistaken for "no clocks running".
 */
export const CLOCKS_HIDDEN_NOTE = 'Clocks are still running.';

/**
 * What the hidden-state warning says if the engine ever reports an
 * urgent cell without a sentence to go with it.
 *
 * It should be unreachable: a cell reaches `urgent` or `over` only when
 * its own minutes are at or below the critical threshold, and the
 * binding clock `hosWarning` picks is by definition the smallest of
 * them, so it is critical too and always carries text. This exists
 * because "unreachable" and "cannot happen" are different claims, and
 * the one branch a driver must never see is a blank red box.
 */
export const CLOCKS_URGENT_FALLBACK = 'Hours limit reached — check your clocks.';

/** What the driving screen should render for the HOS area. */
export type HosPresentation =
  /** The compact strip, exactly as it has always been. */
  | { kind: 'full' }
  /**
   * The driver hid the strip and a clock went urgent or overdue anyway.
   * A compact warning appears over the map — the words, the severity and
   * the ELD line, and nothing else. Deliberately NOT the strip: this is
   * a moment, not a settings change, and it must not become a second
   * permanent panel.
   */
  | { kind: 'warning' }
  /** Hidden and calm: the smallest useful control, and nothing more. */
  | { kind: 'control' };

/**
 * Is any clock urgent or already over?
 *
 * Read from the SAME compact view the strip renders, so the collapsed
 * state and the expanded state can never disagree about whether a driver
 * is in trouble. A null view means no clocks were entered — which is not
 * an emergency, it is silence, and it stays silent.
 */
export function hasUrgentClock(view: HosCompactView | null): boolean {
  if (view === null) return false;
  return view.cells.some((c) => c.state === 'urgent' || c.state === 'over');
}

/**
 * The one decision, in one place, so the strip, the control and the
 * warning cannot be wired to three different opinions.
 */
export function hosPresentation(
  visibility: HosVisibility,
  view: HosCompactView | null,
): HosPresentation {
  if (visibility === 'shown') return { kind: 'full' };
  return hasUrgentClock(view) ? { kind: 'warning' } : { kind: 'control' };
}

/** The label the toggle should carry right now. */
export function clocksToggleLabel(visibility: HosVisibility): string {
  return visibility === 'shown' ? HIDE_CLOCKS_LABEL : SHOW_CLOCKS_LABEL;
}

/** The other choice — what a tap switches to. */
export function toggledVisibility(visibility: HosVisibility): HosVisibility {
  return visibility === 'shown' ? 'hidden' : 'shown';
}

/** Narrow an unknown (a stored record, a URL, anything) to a choice. */
export function asVisibility(value: unknown): HosVisibility | null {
  return value === 'shown' || value === 'hidden' ? value : null;
}
