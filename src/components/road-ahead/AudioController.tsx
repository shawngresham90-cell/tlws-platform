'use client';

import { useEffect, useState } from 'react';
import { useMounted } from '@/lib/road-ahead/hooks';
import { soundOn, subscribeSound, toggleSound } from './audio';

/**
 * Ambient-soundtrack toggle, powered by the synthesized audio engine (audio.ts)
 * — no asset files, so the soundtrack works the moment the visitor asks for it.
 * Audio is OFF by default and the AudioContext is not even constructed until
 * this explicit tap (no autoplay-with-sound, a hard browser + accessibility
 * rule). The soundtrack is pure atmosphere; a visitor who never enables it
 * misses nothing. Renders only after mount so the server HTML has no control to
 * hydrate-mismatch.
 */
export function AudioController() {
  const mounted = useMounted();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(soundOn());
    return subscribeSound(setOn);
  }, []);

  if (!mounted) return null;

  const label = on ? 'Turn off soundtrack' : 'Turn on soundtrack';
  return (
    <button
      type="button"
      onClick={() => void toggleSound()}
      aria-pressed={on}
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
        {on ? (
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
  );
}
