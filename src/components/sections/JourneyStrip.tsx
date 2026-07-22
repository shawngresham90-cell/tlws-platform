import { Section, Eyebrow } from '@/components/ui';

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
const BEATS: Array<{ index: string; beat: string; detail: string }> = [
  { index: '01', beat: 'Drove it', detail: '17 years on the road, zero violations' },
  { index: '02', beat: 'Taught it', detail: 'CDL instructor & driver trainer' },
  { index: '03', beat: 'Building it', detail: 'Trucking Life Academy — Dalton, GA' },
];

export function JourneyStrip() {
  return (
    <Section id="journey" className="border-b border-line">
      {/* One h2 per section like every other beat; the visible eyebrow stays
          a label and the beats sit at h3 so the outline isn't three top-level
          entries. Numerals are muted — amber stays money/action only. */}
      <h2 className="sr-only">The journey</h2>
      <Eyebrow>The journey</Eyebrow>
      <div className="grid gap-8 lg:grid-cols-3">
        {BEATS.map((b) => (
          <div key={b.beat} className="border-t border-line pt-5">
            <p className="num-data font-display text-sm uppercase text-muted">{b.index}</p>
            <h3 className="mt-2 font-display text-3xl uppercase text-ink">{b.beat}</h3>
            <p className="mt-2 text-sm text-muted">{b.detail}</p>
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
