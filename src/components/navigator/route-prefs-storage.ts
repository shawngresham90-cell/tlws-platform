'use client';

import {
  DEFAULT_ROUTE_PREFERENCES,
  type RoutePreferences,
} from '@/lib/navigator/route-preferences';
import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * The driver's saved route preferences, remembered on this device
 * (Fast Start milestone).
 *
 * ITS OWN KEY, ITS OWN PARSER, ITS OWN FAILURE. This is the fourth
 * independent record beside the truck, the clocks and the driver's name,
 * and the reason is the same one that separated those three: a record
 * damaged by a quota failure, a half-write or a hand edit must cost the
 * driver that record and nothing else. A corrupt preference must never
 * take a verified truck down with it, and a corrupt truck must never cost
 * a driver their toll setting.
 *
 * HOW IT DEGRADES, AND WHY THAT IS SAFE HERE. Unlike the clocks — where
 * the plausible-looking default is a false claim about legal standing —
 * the safe default for a preference is simply "avoid nothing", which is
 * the provider's own behaviour with no `avoid[features]` at all. So an
 * unreadable record returns `DEFAULT_ROUTE_PREFERENCES` rather than
 * refusing: the driver gets the ordinary route they would have got
 * before they ever set a preference, and the screen says plainly that
 * tolls are allowed.
 *
 * WHAT IT NEVER DOES is claim a preference it could not read. The record
 * is booleans only; anything that is not a boolean is not coerced into
 * one, because `Boolean("false")` is `true` and that is the direction
 * that quietly starts avoiding tolls nobody asked to avoid — or worse,
 * stops avoiding ones they did.
 */

export const ROUTE_PREFS_KEY = 'tlws-navigator-route-prefs-v1';
export const ROUTE_PREFS_VERSION = 1;

/**
 * Strict boolean read. A missing or non-boolean field falls back to the
 * default for that field rather than being coerced.
 */
function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function shapePrefs(payload: Record<string, unknown>): RoutePreferences | null {
  const prefs = payload.prefs;
  if (prefs === null || typeof prefs !== 'object') return null;
  const p = prefs as Record<string, unknown>;
  return {
    avoidTolls: boolOr(p.avoidTolls, DEFAULT_ROUTE_PREFERENCES.avoidTolls),
    avoidFerries: boolOr(p.avoidFerries, DEFAULT_ROUTE_PREFERENCES.avoidFerries),
  };
}

/**
 * The saved preferences, or the "avoid nothing" default.
 *
 * Returns a value in every case — there is no `null` for the caller to
 * mishandle, because "no preferences" and "unreadable preferences" mean
 * the same thing to a route request: send no avoidances.
 */
export function readRoutePrefs(): RoutePreferences {
  const read = readVersioned<RoutePreferences>(ROUTE_PREFS_KEY, ROUTE_PREFS_VERSION, shapePrefs);
  return read.ok ? read.value : DEFAULT_ROUTE_PREFERENCES;
}

export function writeRoutePrefs(prefs: RoutePreferences): void {
  writeVersioned(ROUTE_PREFS_KEY, ROUTE_PREFS_VERSION, { prefs });
}

/** Forget the preferences. Nothing else is touched. */
export function clearRoutePrefs(): void {
  clearVersioned(ROUTE_PREFS_KEY);
}
