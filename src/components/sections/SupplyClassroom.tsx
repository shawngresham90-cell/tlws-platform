'use client';

import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { CLASSROOM_EVENTS } from '@/lib/classroom/analytics';
import { CAMPAIGN_OPENS_LABEL, CAMPAIGN_PATH } from '@/lib/classroom/campaign';

/**
 * Homepage campaign band for Supply the Classroom.
 *
 * Additive: it sits between the proof bar and the four core paths, so it is
 * high on the page without displacing, reordering or weakening any existing
 * homepage action.
 *
 * The button goes to the INTERNAL campaign page, never straight to Amazon —
 * a visitor should understand what they are buying into before they land in
 * a shopping cart.
 */
export function SupplyClassroom() {
  return (
    <Section>
      <div className="rounded-card border-2 border-signal/40 bg-asphalt-700 p-8 sm:p-10">
        <Eyebrow>Supply the Classroom</Eyebrow>
        <h2 className="display-section text-3xl sm:text-4xl">The room is empty</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Help equip Trucking Life Academy before doors open {CAMPAIGN_OPENS_LABEL}. Pick a real
          item off the supply list and it ships straight to the classroom.
        </p>
        <Link
          href={CAMPAIGN_PATH}
          onClick={() => trackEvent(CLASSROOM_EVENTS.homeCtaClick, { placement: 'home_band' })}
          className="mt-7 inline-flex min-h-[48px] items-center justify-center rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.99]"
        >
          View the Amazon List
        </Link>
      </div>
    </Section>
  );
}
