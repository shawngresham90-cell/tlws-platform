'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { CLASSROOM_EVENTS } from '@/lib/classroom/analytics';
import { CAMPAIGN_OPENS_LABEL, CAMPAIGN_PATH } from '@/lib/classroom/campaign';
import {
  CLASSROOM_PHOTO_HEIGHT,
  CLASSROOM_PHOTO_SRC,
  CLASSROOM_PHOTO_WIDTH,
} from '@/lib/classroom/classroom-photo';

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
 *
 * LAYOUT. One grid, three children, placed explicitly so the reading order
 * differs from the visual order only where that helps:
 *
 *   mobile   copy -> photograph -> button   (single column, source order)
 *   desktop  [ copy      | photograph ]     (photo spans both left-hand rows
 *            [ button    |            ]      and centres against them)
 *
 * The photograph is the SECOND child rather than the last so that on a phone
 * it lands between the pitch and the button — the button stays the last thing
 * before the thumb, instead of stranding a large image below it.
 *
 * The right column is 40% of the card's inner width: enough for the room to
 * read at a glance, little enough that the headline still leads. Below lg the
 * column collapses and the photograph goes full width.
 */
export function SupplyClassroom() {
  return (
    <Section>
      <div className="rounded-card border-2 border-signal/40 bg-asphalt-700 p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40%)] lg:items-center lg:gap-10">
          <div className="lg:col-start-1 lg:row-start-1">
            <Eyebrow>Supply the Classroom</Eyebrow>
            <h2 className="display-section text-3xl sm:text-4xl">The room is empty</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted">
              Help equip Trucking Life Academy before doors open {CAMPAIGN_OPENS_LABEL}. Pick a real
              item off the supply list and it ships straight to the classroom.
            </p>
          </div>

          {/* The room itself — the same file the campaign page shows, at its
              own 4:3 ratio. No object-cover: cropping to a fixed box would
              cut the far wall and the doorways, which are the whole point. */}
          <figure className="overflow-hidden rounded-card border border-line lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center">
            <Image
              src={CLASSROOM_PHOTO_SRC}
              alt="Empty classroom being prepared for Trucking Life Academy"
              width={CLASSROOM_PHOTO_WIDTH}
              height={CLASSROOM_PHOTO_HEIGHT}
              // Measured, not guessed. The container is max-width capped, so
              // above 1280 the column is a fixed ~404px no matter how wide the
              // viewport gets — a vw figure there would under-declare and the
              // optimizer would upscale a 384px candidate into a 400px box.
              sizes="(min-width: 1280px) 404px, (min-width: 1024px) 36vw, 100vw"
              className="h-auto w-full"
            />
          </figure>

          <div className="lg:col-start-1 lg:row-start-2">
            <Link
              href={CAMPAIGN_PATH}
              onClick={() => trackEvent(CLASSROOM_EVENTS.homeCtaClick, { placement: 'home_band' })}
              className="inline-flex min-h-[48px] items-center justify-center rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.99]"
            >
              View the Amazon List
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
