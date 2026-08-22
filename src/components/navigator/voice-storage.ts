'use client';

import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * Whether the driver wants voice guidance, remembered on this device
 * (NAV-ENTRY-1).
 *
 * THE DEFAULT IS ON, and that is the owner's decision. It reverses the
 * previous one — voice started muted and every driver had to find the button
 * — because a driver looking at the road is exactly the person who needs to
 * be told about a turn out loud, and "off unless you went looking" meant most
 * of them drove in silence without ever deciding to.
 *
 * WHAT DID NOT CHANGE, and must not: browsers refuse speech that no user
 * gesture started. "Default on" therefore means the PREFERENCE is on, not
 * that anything speaks on page load. The utterance is still unlocked by a
 * real tap — now the Start Driving tap, which is the first thing a driver
 * does and a far better gesture than a mute button they had to hunt for.
 *
 * AN EXPLICIT OFF IS FOREVER. `null` (never chosen) and `false` (chosen off)
 * are different facts, and collapsing them is how an app ends up re-enabling
 * something a driver deliberately silenced. The record stores a real boolean,
 * so a driver who turned voice off stays off across visits; only the ABSENCE
 * of a record takes the default.
 */

export const VOICE_PREFERENCE_KEY = 'tlws-navigator-voice-v1';
export const VOICE_VERSION = 1;

/** Owner decision: a driver who has never chosen gets voice ON. */
export const VOICE_DEFAULT_ENABLED = true;

function shape(payload: Record<string, unknown>): { enabled: boolean } | null {
  // Strict boolean. A truthy string ("false" is truthy!) must never become a
  // preference — that is the classic way a stored "off" turns itself on.
  if (typeof payload.enabled !== 'boolean') return null;
  return { enabled: payload.enabled };
}

/**
 * The driver's choice, or null if they have never made one.
 *
 * Callers that just want "should voice be on" should use
 * `voiceEnabledByDefault`; this raw form exists for the settings screen,
 * which legitimately needs to know whether a default is being shown.
 */
export function readVoiceChoice(): boolean | null {
  const stored = readVersioned<{ enabled: boolean }>(VOICE_PREFERENCE_KEY, VOICE_VERSION, shape);
  return stored.ok ? stored.value.enabled : null;
}

/** Should voice be on right now? Never chosen → the documented default. */
export function voiceEnabledByDefault(): boolean {
  return readVoiceChoice() ?? VOICE_DEFAULT_ENABLED;
}

export function writeVoiceChoice(enabled: boolean): void {
  writeVersioned(VOICE_PREFERENCE_KEY, VOICE_VERSION, { enabled });
}

/** Forget the choice, returning the driver to the default. */
export function clearVoiceChoice(): void {
  clearVersioned(VOICE_PREFERENCE_KEY);
}
