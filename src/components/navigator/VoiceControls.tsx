'use client';

import { useRef, useState } from 'react';
import type { VoiceGuidance } from '@/lib/navigator/voice-guidance';

/**
 * Spoken the instant voice is enabled, from inside the click handler.
 *
 * Two jobs, one line. It tells the driver the speaker actually works —
 * otherwise "enabled" is a claim about a button, and the first evidence
 * either way is a turn they may miss. And it is the FIRST `speak()` call
 * of the session, made during a real user gesture: WebKit refuses
 * speechSynthesis that was never started by one, so a Navigator that
 * waits for the first maneuver to speak would stay silent for the whole
 * trip on an iPhone, with nothing on screen to say so.
 */
export const VOICE_ENABLED_CONFIRMATION = 'Voice guidance on.';

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
  // Announce-once means the confirmation needs a fresh id every time, so
  // enabling voice a second time confirms a second time.
  const enableSeq = useRef(0);

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
          enableSeq.current += 1;
          voice.request({
            id: `voice-enabled:${enableSeq.current}`,
            priority: 'normal',
            text: VOICE_ENABLED_CONFIRMATION,
          });
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
