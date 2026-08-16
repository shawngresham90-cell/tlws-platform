'use client';

import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * Whether the driver has already read the pilot briefing.
 *
 * WHAT THIS FIXES. `PilotOnboarding` opened expanded on every visit —
 * `useState(true)`, never persisted — so a returning driver scrolled past
 * the entire first-trip briefing every single time. It is a large share
 * of the 8,826 px the audit measured on the parked screen, and it is
 * text the driver has already read.
 *
 * ITS OWN KEY, like every other remembered thing here. A damaged record
 * costs a driver one expanded briefing and nothing else — not the truck,
 * not the clocks, not the route preferences.
 *
 * IT DEGRADES TOWARD SHOWING, NOT HIDING. An unreadable record reads as
 * "not seen yet", so the failure mode is a briefing a driver has already
 * read rather than one they never saw. That is the right direction for
 * safety copy: the cost of the wrong answer is a scroll, and the cost of
 * the other wrong answer is a driver who never met the instructions.
 */

export const ONBOARDING_KEY = 'tlws-navigator-onboarding-v1';
export const ONBOARDING_VERSION = 1;

function shapeSeen(payload: Record<string, unknown>): { seen: true } | null {
  // Strictly `true`. Anything else — a string, a 1, a missing field — is
  // not evidence the briefing was read, and is not coerced into some.
  return payload.seen === true ? { seen: true } : null;
}

/** True only when a well-formed record says the briefing has been read. */
export function readOnboardingSeen(): boolean {
  const read = readVersioned<{ seen: true }>(ONBOARDING_KEY, ONBOARDING_VERSION, shapeSeen);
  return read.ok;
}

export function writeOnboardingSeen(): void {
  writeVersioned(ONBOARDING_KEY, ONBOARDING_VERSION, { seen: true });
}

/** Forget it — the next visit shows the briefing again. Nothing else changes. */
export function clearOnboardingSeen(): void {
  clearVersioned(ONBOARDING_KEY);
}
