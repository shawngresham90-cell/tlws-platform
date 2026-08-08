'use client';

import type { SpeechPort } from '@/lib/navigator/voice-guidance';

/**
 * Browser SpeechPort (milestone N7): the one place Navigator touches
 * `speechSynthesis`. OUTPUT ONLY — no microphone, no recognition, no
 * recording API appears anywhere in this milestone; speech input is N15
 * and requires a Permissions-Policy change this code must not make.
 *
 * Degrades silently (doc 06 §3): when the API is missing the port
 * reports unsupported and every call is a no-op — never a throw.
 */

/**
 * The slice of `SpeechSynthesisUtterance` this adapter sets or reads.
 * Narrow on purpose: it is also the shape a test supplies, so the
 * adapter's real behaviour can be exercised without a browser.
 */
export type UtteranceLike = {
  text: string;
  lang: string;
  // Written, never read, and deliberately loose in their arguments so the
  // real `SpeechSynthesisUtterance` — whose handlers take an event — is a
  // structural match without a cast at the browser binding.
  onend: ((...args: never[]) => void) | null;
  onerror: ((...args: never[]) => void) | null;
};

/** The slice of `speechSynthesis` this adapter uses. */
export type SynthLike = {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  resume(): void;
  readonly paused: boolean;
};

/**
 * Language tag for every utterance.
 *
 * Left unset, the engine picks its default voice — the SYSTEM language,
 * not the page's. A phone set to Spanish reads "Turn right onto Battlefield
 * Pkwy" with Spanish phonetics, and US route numbers ("I-75 N") come out
 * as something the driver has to decode rather than hear. The guidance
 * text this app produces is US English, so it is labelled US English.
 */
export const SPEECH_LANG = 'en-US';

/**
 * The adapter proper, with both browser globals injected. `createBrowserSpeechPort`
 * binds the real ones; tests bind fakes.
 */
export function createSpeechPort(
  synth: SynthLike | null,
  makeUtterance: (text: string) => UtteranceLike,
): SpeechPort {
  if (synth === null) {
    return { supported: false, speak: () => {}, cancel: () => {} };
  }

  return {
    supported: true,
    speak(text: string, onDone: () => void): void {
      // A backgrounded tab can leave the queue PAUSED, and a paused queue
      // accepts utterances forever without ever speaking one — the driver
      // gets silence for the rest of the trip with no error to show. The
      // call is a no-op when the queue is already running.
      if (synth.paused) synth.resume();
      const utterance = makeUtterance(text);
      utterance.lang = SPEECH_LANG;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        onDone();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      synth.speak(utterance);
    },
    cancel(): void {
      synth.cancel();
    },
  };
}

export function createBrowserSpeechPort(): SpeechPort {
  const synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  return createSpeechPort(synth, (text) => new SpeechSynthesisUtterance(text));
}
