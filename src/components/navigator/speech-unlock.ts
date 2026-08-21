'use client';

import { createBrowserSpeechPort } from './speech-port';
import { VOICE_ENABLED_CONFIRMATION } from './VoiceControls';

/**
 * Unlocking the speech engine from the Start Driving tap (NAV-ENTRY-1).
 *
 * THE BROWSER RULE THIS EXISTS FOR. WebKit — and mobile Safari in
 * particular — refuses `speechSynthesis` that was not started by a real user
 * gesture. The first utterance of a session must happen INSIDE a click
 * handler, synchronously. Miss that window and the engine accepts every
 * later utterance and speaks none of them: a whole trip of silent guidance
 * with nothing on screen to explain it.
 *
 * Voice used to be unlocked by its own "Enable voice" button, which was also
 * the thing that turned voice on. Now that the preference defaults to ON, the
 * driver never taps that button — so the gesture had to move to the one tap
 * every driver makes anyway. START DRIVING is that tap.
 *
 * WHY THE FLAG IS A MODULE VARIABLE. The tap happens on the launcher; the
 * guidance engine is created later, on the driving screen. Those are two
 * components on two routes — but ONE document, because the launcher navigates
 * client-side. A module-level flag is exactly as long-lived as the unlock it
 * describes: it dies with the document, and so does the engine's unlocked
 * state. Persisting it would be a lie the first time a driver reloaded.
 *
 * WHAT THIS IS NOT. No microphone, no recognition, no recording, nothing sent
 * anywhere. This module can produce exactly one sound: the same confirmation
 * sentence the mute button has always spoken.
 */

export type PrimeOutcome = 'spoken' | 'unsupported';

let primed = false;
let lastOutcome: PrimeOutcome | null = null;

/**
 * Speak the confirmation from inside a user gesture, unlocking the engine.
 *
 * MUST be called synchronously from a click handler — an `await` before it
 * spends the gesture and the browser refuses. Safe to call more than once;
 * the confirmation is spoken each time it is genuinely invoked, exactly as
 * re-enabling voice from the mute button has always done.
 */
export function primeSpeech(): PrimeOutcome {
  const port = createBrowserSpeechPort();
  if (!port.supported) {
    lastOutcome = 'unsupported';
    return 'unsupported';
  }
  port.speak(VOICE_ENABLED_CONFIRMATION, () => {});
  primed = true;
  lastOutcome = 'spoken';
  return 'spoken';
}

/**
 * Did a gesture in THIS document already unlock the engine?
 *
 * The driving screen reads this to decide whether it may unmute silently. If
 * the launcher already spoke the confirmation, saying it a second time on
 * arrival would be the app talking about itself instead of about the road.
 */
export function speechWasPrimed(): boolean {
  return primed;
}

/** What the last prime attempt did, or null if none has been made. */
export function lastPrimeOutcome(): PrimeOutcome | null {
  return lastOutcome;
}

/** Test seam: forget the unlock. Never called from application code. */
export function resetSpeechPrimeForTests(): void {
  primed = false;
  lastOutcome = null;
}

/**
 * What the driver is told when voice was wanted and could not start.
 *
 * Honest and terminal: it names the one place that can change it and stops.
 * No retry loop, no second attempt on the next render, no modal — a browser
 * without speech is a fact about the device, and pestering a driver about it
 * at 70 mph would be worse than the silence it is complaining about.
 */
export const VOICE_UNAVAILABLE_TEXT = 'Voice could not start. Turn it on in Settings.';
