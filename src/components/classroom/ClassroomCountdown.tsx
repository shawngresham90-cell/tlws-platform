'use client';

import { useEffect, useState } from 'react';
import {
  CAMPAIGN_OPENS_AT_MS,
  CAMPAIGN_OPENS_LABEL,
  countdownParts,
  pad2,
  tickIntervalMs,
  type CountdownParts,
} from '@/lib/classroom/campaign';

/**
 * Countdown to the classroom opening.
 *
 * HYDRATION. A live clock cannot be rendered on the server: the HTML is
 * generated once (static/ISR) and would disagree with the browser the moment
 * it is served, which React reports as a hydration mismatch and — worse —
 * would show a visitor a stale number baked in at build time. So the server
 * and the FIRST client render deliberately produce the same thing: the
 * opening date, no digits. The clock appears only after mount, from the
 * visitor's own `Date.now()`.
 *
 * REDUCED MOTION. A number changing every second is motion. When the visitor
 * has asked for less of it the countdown keeps working but settles to a
 * once-a-minute update and drops the seconds column entirely, so nothing is
 * animating in their peripheral vision.
 *
 * TIMERS. One interval, cleared on unmount and re-created only when the tick
 * rate actually changes.
 */
export function ClassroomCountdown() {
  const [parts, setParts] = useState<CountdownParts | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Track the motion preference, including a mid-session change.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const update = () => setParts(countdownParts(Date.now(), CAMPAIGN_OPENS_AT_MS));
    update();
    const id = window.setInterval(update, tickIntervalMs(reducedMotion));
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  // Server render + first paint: the date, not a stale clock.
  if (parts === null) {
    return (
      <p className="font-display text-2xl uppercase tracking-wide text-ink sm:text-3xl">
        Doors open {CAMPAIGN_OPENS_LABEL}
      </p>
    );
  }

  if (parts.complete) {
    return (
      <p
        className="font-display text-2xl uppercase tracking-wide text-signal sm:text-3xl"
        role="status"
      >
        The doors are open. The room is built.
      </p>
    );
  }

  const segments: Array<{ label: string; value: string }> = [
    { label: parts.days === 1 ? 'Day' : 'Days', value: String(parts.days) },
    { label: 'Hours', value: pad2(parts.hours) },
    { label: 'Minutes', value: pad2(parts.minutes) },
  ];
  if (!reducedMotion) segments.push({ label: 'Seconds', value: pad2(parts.seconds) });

  const spoken =
    `${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes ` +
    `until the classroom opens on ${CAMPAIGN_OPENS_LABEL}.`;

  return (
    <div>
      {/* One calm sentence for screen readers instead of four ticking numbers. */}
      <p className="sr-only" role="status">
        {spoken}
      </p>
      <ul aria-hidden="true" className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {segments.map((segment) => (
          <li key={segment.label} className="min-w-[3.5rem]">
            <span className="block font-display text-4xl leading-none text-signal sm:text-5xl">
              {segment.value}
            </span>
            <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-muted">
              {segment.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
