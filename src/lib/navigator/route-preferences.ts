import { HERE_AVOID_FEATURES } from '@/lib/trip-planner/here-truck-params';

/**
 * The driver's saved route preferences — separate from the truck.
 *
 * Pure. No storage, no clock, no I/O.
 *
 * WHY THEY LEFT THE TRUCK PROFILE. `avoid` was a field on
 * `EditableProfile`, which made "avoid tolls" a TRUCK EDIT: toggling it
 * changed the routing fingerprint, invalidated the truck confirmation,
 * and sent the driver back through "this is my truck" to say something
 * about tolls. The pilot asked for saved settings *such as* avoiding
 * tolls and got a truck re-confirmation instead.
 *
 * A preference and a dimension are different kinds of fact. A trailer
 * height is a property of the vehicle that a bridge does not negotiate.
 * A toll is a choice the same truck can make differently on Tuesday. So
 * they are stored apart, edited apart, and only meet on the wire.
 *
 * WHAT MAY BE OFFERED. Only avoidances the provider genuinely supports,
 * verified against `HERE_AVOID_FEATURES` — the same whitelist the route
 * request sanitizes against, and documented as IMPL with `[REPO]`
 * evidence in docs/navigator/11-truck-legal-routing.md. A preference the
 * provider does not implement must never appear as a toggle, because a
 * switch that does nothing is worse than an absent one: it is a promise.
 */

/** One preference the driver may set, keyed by its provider feature id. */
export type RoutePreferenceId = 'tollRoad' | 'ferry';

export type RoutePreferences = {
  /** Avoid toll roads — HERE v8 `avoid[features]=tollRoad`. */
  avoidTolls: boolean;
  /** Avoid ferries — HERE v8 `avoid[features]=ferry`. */
  avoidFerries: boolean;
};

/** Nothing avoided. What a driver who has never chosen gets. */
export const DEFAULT_ROUTE_PREFERENCES: RoutePreferences = Object.freeze({
  avoidTolls: false,
  avoidFerries: false,
});

/**
 * The preferences this build may offer, with the exact wire value each
 * one becomes and the words shown for both of its states.
 *
 * `feature` is asserted against the provider whitelist below, so a typo
 * here becomes a failing test rather than a toggle that silently does
 * nothing.
 */
export const ROUTE_PREFERENCE_SPECS: readonly {
  key: keyof RoutePreferences;
  feature: RoutePreferenceId;
  /** What the screen says when the preference is ON. */
  onLabel: string;
  /** What the screen says when it is OFF — never blank, never implied. */
  offLabel: string;
}[] = Object.freeze([
  {
    key: 'avoidTolls',
    feature: 'tollRoad',
    onLabel: 'Avoid tolls',
    offLabel: 'Tolls allowed',
  },
  {
    key: 'avoidFerries',
    feature: 'ferry',
    onLabel: 'Avoid ferries',
    offLabel: 'Ferries allowed',
  },
] as const);

/**
 * Every offered preference maps to a feature the provider implements.
 *
 * Exported so a test can assert it rather than trusting the table above:
 * the whole safety argument for showing a toggle is that flipping it
 * changes the request.
 */
export function unsupportedPreferenceFeatures(): string[] {
  return ROUTE_PREFERENCE_SPECS.filter((s) => !HERE_AVOID_FEATURES.has(s.feature)).map(
    (s) => s.feature,
  );
}

/**
 * The `avoid` list these preferences produce, for the route request.
 *
 * Sorted so two equal preference sets produce the same array — the route
 * cache keys on it, and an unstable order would split the cache.
 */
export function preferencesToAvoid(prefs: RoutePreferences): string[] {
  return ROUTE_PREFERENCE_SPECS.filter((s) => prefs[s.key])
    .map((s) => s.feature)
    .sort();
}

/**
 * What the compact summary says, in the driver's words.
 *
 * Both states are named. "Avoid tolls" alone would leave a driver
 * guessing whether an absent line means tolls are allowed or that the
 * app forgot to ask — and the difference is money.
 */
export function summarizePreferences(prefs: RoutePreferences): string {
  return ROUTE_PREFERENCE_SPECS.map((s) => (prefs[s.key] ? s.onLabel : s.offLabel)).join(' · ');
}

/**
 * Does a route built with `before` still stand under `after`?
 *
 * A preference change is a ROUTE change: the provider computed the old
 * line around a different set of restrictions. Returning false here is
 * what forces exactly one fresh request before navigation.
 */
export function preferencesChanged(before: RoutePreferences, after: RoutePreferences): boolean {
  return preferencesToAvoid(before).join(',') !== preferencesToAvoid(after).join(',');
}

/**
 * A claim is only allowed when the request carried it.
 *
 * The screen must never say "avoiding tolls" over a route whose request
 * did not contain `tollRoad`. This compares the two directly so the UI
 * cannot drift from the wire — the request's own avoid list is the
 * authority, not the checkbox that was on screen when it was sent.
 */
export function claimsMatchRequest(
  prefs: RoutePreferences,
  requestAvoid: readonly string[],
): boolean {
  const want = preferencesToAvoid(prefs);
  const sent = [...new Set(requestAvoid)].sort();
  return want.every((f) => sent.includes(f));
}
