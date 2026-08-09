'use client';

import { useState } from 'react';
import { PILOT_ONBOARDING } from '@/lib/navigator/pilot-onboarding';

/**
 * The pilot briefing (pilot-ops priority 1).
 *
 * Rendered inside the stationary-only slot on the driving screen, so it
 * inherits the existing motion gate instead of inventing a second one —
 * the same reasoning as the road-test report.
 *
 * NOTHING IS PERSISTED, and that is a rail rather than an omission. The
 * first draft of this component remembered the dismissal in
 * `localStorage` and was caught by two standing gates: no file under
 * `src/components/navigator/` may touch storage, because a safety-lock
 * passenger override must never survive a reload. A briefing exception
 * would have put the first storage call into that directory and left the
 * next one to argue about, so the feature gave way to the invariant.
 *
 * What that costs is small and what it buys is honest: the briefing opens
 * once per app load and collapses on a tap. A driver who reopens the app
 * mid-shift sees eight short cards again — and "follow the sign" is worth
 * re-reading anyway. It never disappears entirely: collapsed, it stays
 * available as a toggle, which is how a driver looks it up later.
 */
export function PilotOnboarding() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <details className="rounded-card border border-line p-4">
        <summary className="min-h-16 cursor-pointer text-lg font-semibold text-ink">
          Pilot briefing
        </summary>
        <BriefingCards />
      </details>
    );
  }

  return (
    <section
      aria-labelledby="pilot-briefing-heading"
      className="rounded-card border border-line p-4"
    >
      <h2 id="pilot-briefing-heading" className="text-xl font-semibold text-ink">
        Before your first trip
      </h2>
      <BriefingCards />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-4 min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink"
      >
        Got it
      </button>
    </section>
  );
}

function BriefingCards() {
  return (
    <ul className="mt-3 space-y-3">
      {PILOT_ONBOARDING.map((card) => (
        <li key={card.id}>
          <p className="text-lg font-semibold text-ink">{card.title}</p>
          <p className="text-lg text-ink/80">{card.body}</p>
        </li>
      ))}
    </ul>
  );
}
