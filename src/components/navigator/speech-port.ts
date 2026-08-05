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
export function createBrowserSpeechPort(): SpeechPort {
  const synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

  if (synth === null) {
    return { supported: false, speak: () => {}, cancel: () => {} };
  }

  return {
    supported: true,
    speak(text: string, onDone: () => void): void {
      const utterance = new SpeechSynthesisUtterance(text);
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
