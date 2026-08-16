'use client';

import { useEffect, useState } from 'react';
import { readOnboardingSeen, writeOnboardingSeen } from './onboarding-storage';
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
export function PilotOnboarding({
  /*
   * Told, not discovered. The briefing is the fourth synced domain — a driver
   * who has read it on one device should not be shown it again on the next —
   * and the driving screen owns the sync schedule, so it hands down the one
   * callback rather than this component acquiring a second one.
   *
   * Optional and defaulted to a no-op, so every existing caller and every
   * existing test renders this component unchanged.
   */
  onSeenSaved,
}: { onSeenSaved?: () => void } = {}) {
  /*
   * REMEMBERED ACROSS VISITS (Fast Start milestone).
   *
   * This opened expanded on every load, so a returning driver scrolled
   * the whole first-trip briefing every time — a large share of the
   * 8,826 px the audit measured. It is now shown expanded once and
   * collapsed thereafter, with "View instructions" always available.
   *
   * Starts CLOSED and opens after the read, rather than the reverse: on
   * the server and on the first client paint there is no storage to
   * consult, and a briefing that flashes open and snaps shut is worse
   * than one the driver opens deliberately. First-time drivers get it
   * expanded the moment the effect runs.
   */
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const alreadySeen = readOnboardingSeen();
    setSeen(alreadySeen);
    setOpen(!alreadySeen);
  }, []);

  const dismiss = () => {
    setOpen(false);
    if (!seen) {
      // Local first, then the nudge — and only when something was actually
      // written. A driver tapping "Got it" a second time must not queue a
      // second identical cloud write.
      writeOnboardingSeen();
      setSeen(true);
      onSeenSaved?.();
    }
  };

  if (!open) {
    return (
      <details className="rounded-card border border-line p-4" data-onboarding="collapsed">
        <summary className="min-h-16 cursor-pointer text-lg font-semibold text-ink">
          View instructions
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
        onClick={dismiss}
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
