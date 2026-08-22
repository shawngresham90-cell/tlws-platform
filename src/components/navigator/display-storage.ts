'use client';

import {
  DEFAULT_DISPLAY_MODE,
  parseDisplayMode,
  type DisplayMode,
} from '@/lib/navigator/display-mode';
import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * The driver's display choice, remembered on this device (NAV-ENTRY-1).
 *
 * Its own key behind its own parser, like every other Navigator record — a
 * damaged display preference costs the display preference and nothing else.
 *
 * DEVICE-LOCAL, AND ONLY DEVICE-LOCAL. It is not synced to an account, not
 * sent to a provider, and not included in any diagnostic payload. There is
 * nothing about a person in "this driver likes a dark screen", but there is
 * also no reason for it to leave the phone, and the cheapest way to keep a
 * value private is to give it nowhere to go.
 */

export const DISPLAY_MODE_KEY = 'tlws-navigator-display-v1';
export const DISPLAY_VERSION = 1;

function shape(payload: Record<string, unknown>): { mode: DisplayMode } | null {
  // An unknown string is not an error — `parseDisplayMode` maps it to the
  // documented default. What IS refused is a non-string, because that means
  // the record is a different shape than this build writes.
  if (typeof payload.mode !== 'string') return null;
  return { mode: parseDisplayMode(payload.mode) };
}

/** The saved mode, or the documented default for a driver who has none. */
export function readDisplayMode(): DisplayMode {
  const stored = readVersioned<{ mode: DisplayMode }>(DISPLAY_MODE_KEY, DISPLAY_VERSION, shape);
  return stored.ok ? stored.value.mode : DEFAULT_DISPLAY_MODE;
}

export function writeDisplayMode(mode: DisplayMode): void {
  writeVersioned(DISPLAY_MODE_KEY, DISPLAY_VERSION, { mode });
}

/** Forget the display choice. Nothing else is touched. */
export function clearDisplayMode(): void {
  clearVersioned(DISPLAY_MODE_KEY);
}
