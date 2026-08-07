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
export function VoiceControls({
  voice,
  compact = false,
}: {
  voice: VoiceGuidance;
  /**
   * Driving surface: the control shares one height-constrained row with
   * Overview and Stop, so the WORDS shorten — the target does not. Both
   * labels still start the accessible name (WCAG 2.5.3), and the state is
   * still carried in the words plus aria-pressed, never in color.
   */
  compact?: boolean;
}) {
  const [muted, setMuted] = useState(() => voice.snapshot().muted);

  if (!voice.snapshot().supported) {
    return compact ? (
      <p role="status" className="self-center px-2 text-base text-ink/70">
        No voice
      </p>
    ) : (
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
      aria-label={
        compact
          ? muted
            ? 'Voice on — enable voice guidance'
            : 'Mute voice guidance'
          : muted
            ? 'Enable voice guidance'
            : 'Mute voice guidance'
      }
    >
      {compact ? (muted ? 'Voice on' : 'Mute') : muted ? 'Enable voice' : 'Mute voice'}
    </button>
  );
}
