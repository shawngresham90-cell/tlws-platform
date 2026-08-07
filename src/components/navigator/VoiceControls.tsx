'use client';

import { useState } from 'react';
import type { VoiceGuidance } from '@/lib/navigator/voice-guidance';

/**
 * The one-touch mute control (milestone N7) — always available, moving or
 * stationary (doc 06 capability matrix: "Mute / unmute voice ✅ ✅"), one
 * of the ≤5 sanctioned interactive elements on the driving screen. State
 * is carried in the words and aria-pressed, never color alone.
 *
 * When speech is unsupported the control degrades to an honest sentence
 * instead of a dead button — silent degradation for the voice itself
 * (doc 06 §3), but never a silent lie in the UI.
 */
export function VoiceControls({ voice }: { voice: VoiceGuidance }) {
  const [muted, setMuted] = useState(() => voice.snapshot().muted);

  if (!voice.snapshot().supported) {
    return (
      <p className="text-xl text-ink/80">
        Voice guidance is unavailable on this device. All guidance stays on screen.
      </p>
    );
  }

  // Voice starts MUTED (no speech on page load — doc 06 keeps voice an
  // explicit driver choice); the same control is enable and mute.
  return (
    <button
      type="button"
      aria-pressed={muted}
      onClick={() => {
        if (muted) {
          voice.unmute();
          setMuted(false);
        } else {
          voice.mute();
          setMuted(true);
        }
      }}
      className="min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink"
      aria-label={muted ? 'Enable voice guidance' : 'Mute voice guidance'}
    >
      {muted ? 'Enable voice' : 'Mute voice'}
    </button>
  );
}
