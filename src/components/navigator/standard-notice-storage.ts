'use client';

import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * Has this device already been shown the standard-setup notice?
 * (NAV-ENTRY-1.)
 *
 * The notice tells a first-time driver that the app loaded the standard
 * 13 ft 6 in / 80,000 lb truck for them and asks them to check it. It has to
 * appear ONCE — a message that returns every visit is one a driver learns to
 * dismiss without reading, which is the opposite of what a "check this matches
 * your truck" line is for.
 *
 * ITS OWN KEY, and deliberately not a field on the truck record. Whether a
 * message was read is not part of the truck, and folding it in would mean the
 * truck record changes shape (and version, and every parser) the next time a
 * message needs remembering.
 */

export const STANDARD_NOTICE_KEY = 'tlws-navigator-standard-notice-v1';
export const STANDARD_NOTICE_VERSION = 1;

function shape(payload: Record<string, unknown>): { seen: boolean } | null {
  if (typeof payload.seen !== 'boolean') return null;
  return { seen: payload.seen };
}

/**
 * True only for a device that has definitely seen it.
 *
 * Every failure mode — no storage, damaged record, wrong version — reads as
 * "not seen". Showing a helpful sentence one extra time is a much cheaper
 * mistake than never showing it to a driver whose storage hiccupped.
 */
export function readStandardNoticeSeen(): boolean {
  const stored = readVersioned<{ seen: boolean }>(
    STANDARD_NOTICE_KEY,
    STANDARD_NOTICE_VERSION,
    shape,
  );
  return stored.ok ? stored.value.seen : false;
}

export function writeStandardNoticeSeen(): void {
  writeVersioned(STANDARD_NOTICE_KEY, STANDARD_NOTICE_VERSION, { seen: true });
}

/** Forget it, so the notice would show again. Used by tests and resets. */
export function clearStandardNoticeSeen(): void {
  clearVersioned(STANDARD_NOTICE_KEY);
}
