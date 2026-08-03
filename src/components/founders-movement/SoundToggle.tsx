'use client';

import { useEffect, useState } from 'react';
import { disableSound, enableSound, soundOn, subscribeSound } from './audio';

/**
 * Persistent sound control for the Founders Movement experience. Always
 * visible, keyboard-operable, off by default. Rendering is client-only but the
 * page's information never depends on audio — this is pure atmosphere.
 */
export function SoundToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(soundOn());
    return subscribeSound(setOn);
  }, []);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (on ? disableSound() : void enableSound())}
      className="fixed bottom-4 right-4 z-40 rounded-full border border-line bg-asphalt/85 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
    >
      {on ? 'Sound on' : 'Sound off'}
      <span className="sr-only"> — toggles ambient engine sound; off by default</span>
    </button>
  );
}
