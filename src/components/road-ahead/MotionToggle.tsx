'use client';

/**
 * Pause/play the cinematic motion (looping backdrops, parallax, light sweeps).
 * This is the WCAG 2.2.2 control: even a visitor who hasn't set
 * `prefers-reduced-motion` can stop everything that moves. The experience hides
 * this entirely when the OS already requests reduced motion — there's nothing
 * to toggle, motion is off by their system choice.
 */
export function MotionToggle({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  const label = paused ? 'Play cinematic motion' : 'Pause cinematic motion';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
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
        {paused ? (
          <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
        ) : (
          <>
            <rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none" />
            <rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </button>
  );
}
