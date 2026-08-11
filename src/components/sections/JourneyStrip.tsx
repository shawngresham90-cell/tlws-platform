import { Section, Eyebrow } from '@/components/ui';
import { CinematicStill } from '@/components/media/CinematicStill';

/**
 * THE JOURNEY (cinematic flow beat 4) — the brand spine as its own
 * documentary beat: drove it, taught it, building it. Promoted out of the
 * ROAD AHEAD teaser so the story reads before the tools and the school.
 *
 * Every line is a verified brand fact; the pull-quote is the site's own
 * thesis line (rendered in the hero since Steel & Sodium shipped), not an
 * invented quotation. No CTA here on purpose — this beat earns trust; the
 * asks live in the doors above and the academy bridge below.
 */
/**
 * PHOTO SEAMS (Night Haul master blueprint, Part 2.3 "The journey" strip).
 * Each beat carries an optional `photo` slot that renders through
 * CinematicStill the day the REAL frame exists — until then the beat renders
 * exactly as today: complete, type-led, no placeholder, no stock, no
 * AI-generated stand-in.
 *   01 Drove it    → LANDED 2026-08-11: the owner's archival driving-days
 *      photograph — Shawn in the foreground, tractor-trailers and a snowy
 *      mountain behind. Full frame at its own 3:4 aspect: cropping tighter
 *      would lose the trucks that make "Drove it" legible at a glance.
 *      See docs/design/owner-assets-needed.md §1d.
 *   02 Taught it   → LANDED 2026-08-11: the owner's approved instructor
 *      portrait (blueprint shot #10's homepage role) — white Academy shirt,
 *      chest logo, dark studio ground. Rendered at its own 4:5 aspect: a
 *      landscape crop cannot hold both the face and the Academy chest logo.
 *      See docs/design/owner-assets-needed.md §1c.
 *   03 Building it → LANDED 2026-08-11: the owner's approved Academy yard
 *      wide (blueprint shot #6's homepage role) — branded 53' trailer, both
 *      tractors, low sun. See docs/design/owner-assets-needed.md §1b.
 * All three beats now carry their real frame; the seam mechanism stays for
 * any future re-shoot: drop the file under public/images/journey/, then set
 * `photo: { src, alt, width, height }` on the beat — nothing else changes.
 */
type BeatPhoto = { src: string; alt: string; width: number; height: number };

const BEATS: Array<{ index: string; beat: string; detail: string; photo?: BeatPhoto }> = [
  {
    index: '01',
    beat: 'Drove it',
    detail: '17 years on the road, zero violations',
    photo: {
      src: '/images/journey/shawn-drove-it.webp',
      alt: 'Shawn during his trucking years with tractor-trailers parked behind him in a snowy mountain setting.',
      width: 1080,
      height: 1440,
    },
  },
  {
    index: '02',
    beat: 'Taught it',
    detail: 'CDL instructor & driver trainer',
    photo: {
      src: '/images/journey/academy-instructor-portrait.webp',
      alt: 'Trucking Life Academy instructor wearing an Academy shirt.',
      width: 1080,
      height: 1350,
    },
  },
  {
    index: '03',
    beat: 'Building it',
    detail: 'Trucking Life Academy — Dalton, GA',
    photo: {
      src: '/images/journey/trucking-life-academy-yard.webp',
      alt: 'Trucking Life Academy tractor-trailer and training trucks in the yard at sunset.',
      width: 1080,
      height: 810,
    },
  },
];

export function JourneyStrip() {
  return (
    <Section id="journey" className="border-b border-line">
      {/* One h2 per section like every other beat; the visible eyebrow stays
          a label and the beats sit at h3 so the outline isn't three top-level
          entries. Numerals ride guide-green — mile-post wayfinding, never
          amber (amber stays money/action only). */}
      <h2 className="sr-only">The journey</h2>
      <Eyebrow>The journey</Eyebrow>
      <div className="grid gap-8 lg:grid-cols-3">
        {BEATS.map((b) => (
          <div key={b.beat} className="border-t border-line pt-5">
            {b.photo && (
              <CinematicStill
                src={b.photo.src}
                alt={b.photo.alt}
                width={b.photo.width}
                height={b.photo.height}
                sizes="(min-width: 1024px) 30vw, 100vw"
                className="mb-4"
              />
            )}
            <p className="num-data font-display text-base uppercase text-guide-300">{b.index}</p>
            <h3 className="mt-2 font-display text-3xl uppercase text-ink">{b.beat}</h3>
            <p className="mt-2 text-base text-muted">{b.detail}</p>
          </div>
        ))}
      </div>
      {/* Pull-quote — the site thesis, verified copy, not an invented quote.
          Ink rule, not amber: the 2px amber edge stays reserved for money. */}
      <blockquote className="mt-12 max-w-3xl border-l-2 border-ink/40 pl-6">
        <p className="font-display text-2xl uppercase leading-snug text-ink sm:text-3xl">
          Built by a driver, funded by drivers, no games.
        </p>
      </blockquote>
    </Section>
  );
}
