/**
 * The Navigator entry surface (NAV-ENTRY-1) — what a driver is offered the
 * moment the access gate lets them through, and what the app does about a
 * truck they have not set up.
 *
 * THE PROBLEM THIS SOLVES. The screen behind the password was the whole
 * cockpit at once: a name field, a region picker, a five-row truck editor
 * with a confirmation the driver had to tap before any route could be
 * requested, route preferences, an HOS clock form, a motion-lock banner, a
 * destination search and a Start button underneath all of it. Every one of
 * those was defensible on its own. Together they are a setup wizard standing
 * between a driver and the road, and the driver's own report was that it took
 * too long to get moving.
 *
 * So the entry surface is now three questions — drive, plan, or change
 * something — and everything else moved behind the third one.
 *
 * Pure: no storage, no clock, no DOM. The launcher renders this list, the
 * harness asserts against this list, and neither can drift from the other.
 */

import { formatFeetInches } from '@/lib/trip-planner/here-truck-params';
import type { EditableProfile } from './truck-profile';

/* ------------------------------------------------------------- launcher */

export type LauncherActionId = 'start-driving' | 'plan-my-trip' | 'settings';

export type LauncherAction = {
  id: LauncherActionId;
  /** The word on the button, exactly as the driver reads it. */
  label: string;
  /** The one line underneath that says what happens next. */
  supporting: string;
  /** Where it goes. Real routes, so a long-press still offers "open in new tab". */
  href: string;
};

/**
 * THREE. Not "three or so".
 *
 * The count is the feature. A fourth action — however reasonable, however
 * small — turns a choice into a menu, and a menu is the thing this milestone
 * exists to remove. `LAUNCHER_ACTION_COUNT` is asserted by the harness
 * against this array's own length, so adding an entry here fails the suite
 * rather than quietly widening the screen.
 */
export const LAUNCHER_ACTIONS: readonly LauncherAction[] = Object.freeze([
  Object.freeze({
    id: 'start-driving' as const,
    label: 'START DRIVING',
    supporting: 'Open Navigator and enter your destination.',
    href: '/drive/navigate',
  }),
  Object.freeze({
    id: 'plan-my-trip' as const,
    label: 'PLAN MY TRIP',
    supporting: 'Plan routes, stops, clocks, and parking.',
    href: '/trip-planner',
  }),
  Object.freeze({
    id: 'settings' as const,
    label: 'SETTINGS',
    supporting: 'Truck, clocks, voice, display, units, and route preferences.',
    href: '/drive/settings',
  }),
] as LauncherAction[]);

export const LAUNCHER_ACTION_COUNT = 3;

/**
 * Controls that must NEVER appear on the launcher, as substrings the harness
 * and the bench both search the rendered surface for.
 *
 * Written as data rather than as a paragraph in a review comment because the
 * failure mode is gradual: nobody adds a setup wizard back in one commit,
 * they add "just the clocks, they're quick". The list is the tripwire.
 */
export const LAUNCHER_FORBIDDEN_COPY: readonly string[] = Object.freeze([
  'passenger',
  'press and hold',
  'gross weight',
  'axles',
  'hazmat',
  'first name',
  'enable location',
  'confirm your truck',
]);

/* ----------------------------------------------------- the standard setup */

/**
 * The owner-approved standard truck, in the words a driver reads on a cab
 * card. Derived from the profile rather than typed, so a change to the
 * shipped default cannot leave this sentence describing the old one.
 *
 * `formatFeetInches` renders 13′6″ with prime marks, which is right on a
 * dense summary row and wrong in a sentence someone reads once at 5 a.m. —
 * so the entry copy spells the units out. Same number, same authority, two
 * renderings for two jobs.
 */
export function plainFeetInches(ft: number): string {
  const marks = formatFeetInches(ft);
  const match = /^(\d+)′(\d+)″$/.exec(marks);
  if (match === null) return marks;
  return `${match[1]} ft ${match[2]} in`;
}

export function plainPounds(lbs: number): string {
  return `${lbs.toLocaleString('en-US')} lb`;
}

/** "13 ft 6 in · 80,000 lb" — the two numbers the owner asked to be visible. */
export function standardSetupSpecs(profile: EditableProfile): string {
  return `${plainFeetInches(profile.heightFt)} · ${plainPounds(profile.grossWeightLbs)}`;
}

export const STANDARD_SETUP_HEADLINE = 'STANDARD SETUP LOADED';

export const STANDARD_SETUP_BODY =
  'Voice is on. Display follows your phone. Make sure this matches your truck. ' +
  'Change anything anytime in Settings.';

/** The compact parked-map line that replaces the old truck panel. */
export function truckSummaryLine(profile: EditableProfile): string {
  return `Truck: ${standardSetupSpecs(profile)} · Change in Settings`;
}

/**
 * What Start Driving should do about the truck it finds.
 *
 * `saved` is whatever the storage authority returned — and that authority
 * already treats an unreadable, wrong-version or shape-failing record as
 * ABSENT, which is why "invalid truck" and "no truck" arrive here as the
 * same `null`. That is deliberate: the decision below is identical for both,
 * and a caller that had to tell them apart would need a second copy of the
 * validation rules.
 *
 *   'seed-standard'  no usable truck: write the shipped standard, confirmed,
 *                    and show the first-time notice once.
 *   'keep-saved'     a usable truck exists: leave it completely alone. No
 *                    overwrite, no re-confirmation, no notice.
 *
 * THE SAFETY NOTE, stated rather than buried. Seeding writes a CONFIRMED
 * profile, so Start Route is available without a separate confirm tap — the
 * owner's decision, because the confirm step was a wall in front of a screen
 * most drivers reached with the standard trailer anyway. What replaces it is
 * not silence: the notice states the height and the weight and asks the
 * driver to check them, and the values it states are the ones that reach the
 * provider. The fingerprint rule that protects a RESTORED record is
 * untouched — a truck nobody checked still cannot arrive from storage
 * already confirmed.
 */
export type StandardSetupDecision = 'seed-standard' | 'keep-saved';

export function standardSetupDecision(saved: unknown | null): StandardSetupDecision {
  return saved === null || saved === undefined ? 'seed-standard' : 'keep-saved';
}

/* --------------------------------------------------- the parked reminder */

/**
 * The reminder that replaced the motion lock.
 *
 * The owner's decision is that a driver is an adult who may change their own
 * destination, and that an app which disables the controls instead ends up
 * being fought rather than obeyed — the old answer was a press-and-hold
 * dialog asking a parked driver to declare they were a passenger, which is a
 * question with no honest answer.
 *
 * So this is a SENTENCE. It never disables a control, never intercepts a tap,
 * never asks to be acknowledged and never starts a timer. The harness asserts
 * all four, because "informational" is exactly the property that erodes.
 */
export const PARKED_REMINDER = 'Only make changes when safely parked.';
