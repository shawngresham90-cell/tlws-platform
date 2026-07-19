'use client';

import { useEffect, useReducer, useRef } from 'react';
import { ROAD_AHEAD_AUDIO, hasSoundtrack } from '@/lib/road-ahead/assets';
import {
  audioControlLabel,
  audioReducer,
  INITIAL_AUDIO_STATE,
  isAudioControlVisible,
  isAudioPlaying,
} from '@/lib/road-ahead/audio-state';

/**
 * Optional ambient-soundtrack toggle. Renders nothing until a licensed track is
 * supplied in the asset manifest (hasSoundtrack === false → control hidden), so
 * it never shows a dead button. Audio is off by default and only ever starts
 * from this explicit tap; a rejected play() lands in a labelled retry state
 * rather than silently failing. All the transition rules live in the pure
 * reducer (audio-state.ts).
 */
export function AudioController() {
  const [state, dispatch] = useReducer(audioReducer, INITIAL_AUDIO_STATE);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    dispatch({ type: 'INIT', hasTrack: hasSoundtrack() });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isAudioPlaying(state)) {
      const played = el.play();
      if (played && typeof played.then === 'function') {
        played.catch(() => dispatch({ type: 'BLOCKED' }));
      }
    } else {
      el.pause();
    }
  }, [state]);

  if (!isAudioControlVisible(state)) return null;

  const playing = isAudioPlaying(state);
  const label = audioControlLabel(state);

  return (
    <>
      <audio
        ref={ref}
        src={ROAD_AHEAD_AUDIO.src ?? undefined}
        loop={ROAD_AHEAD_AUDIO.loop}
        preload="none"
        onEnded={() => dispatch({ type: 'ENDED' })}
      />
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE' })}
        aria-pressed={playing}
        aria-label={label}
        title={label}
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-asphalt/80 text-ink backdrop-blur transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
          {playing ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          ) : (
            <>
              <line x1="17" y1="9" x2="22" y2="15" />
              <line x1="22" y1="9" x2="17" y2="15" />
            </>
          )}
        </svg>
      </button>
    </>
  );
}
