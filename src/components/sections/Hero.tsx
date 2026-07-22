import { Button, Container, Eyebrow } from '@/components/ui';
import { HeroShirtPromo } from './HeroShirtPromo';

/**
 * Hero — THE CALL (cinematic flow beat 1). Leads with the one thing that
 * can't be faked — a driver's clean record — and routes to the school.
 * CTA hierarchy: ONE amber action (the school application), one outlined
 * learn-more. Every other path lives one scroll down in the Four Doors.
 *
 * Type-led by design until real founder photography exists (see
 * docs/design/owner-assets-needed.md) — no stock people, no AI people.
 * Atmosphere comes from a restrained sodium light wash, film grain, and a
 * verified proof-label row: documentary confidence, not decoration.
 *
 * No opening date is displayed until the owner confirms one — honest copy
 * over hype, per the design blueprint's own rule.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-line bg-asphalt py-20 sm:py-28"
    >
      {/* Sodium light wash — ambient, top-right, like a yard lamp off-frame.
          Decorative layers sit above the section background and below the
          relatively-positioned content (negative z-index would paint them
          behind the section's own background and hide them entirely). */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 90% at 82% -10%, rgba(245,166,35,0.09) 0%, rgba(245,166,35,0) 55%), linear-gradient(180deg, #1A1A1C 0%, #141414 72%)',
        }}
      />
      <div aria-hidden="true" className="film-grain absolute inset-0" />

      {/* The one hero-level motion moment; killed under reduced motion.
          Grid (xl+) keeps the hero copy in column one and lifts the
          temporary shirt placard into the upper-right column — no overlap,
          no layout push. Below xl the placard stacks under the hero content
          so it never crowds the primary CDL School CTA. */}
      <Container className="relative motion-safe:animate-fade-up">
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-10">
          <div>
            <Eyebrow>Trucking Life · Dalton, GA · off I-75</Eyebrow>
            <h1 id="hero-heading" className="display-hero max-w-4xl">
              17 years. Zero violations.{' '}
              <span className="text-signal">Now I&apos;m training the next generation.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted">
              A CDL school in Dalton, GA — built by a driver, funded by drivers, no games.
              ELDT-compliant CDL-A training on real trucks and real road, plus free tools for every
              driver already out there running.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button href="/academy/apply">Apply to the Academy</Button>
              <Button variant="secondary" href="/knowledge">
                Explore Free Training
              </Button>
            </div>

            {/* Documentary byline — the one verified credential the hero doesn't
                already state (the headline owns 17 years / zero violations, the
                eyebrow owns Dalton). Repetition is trailer filler, not proof. */}
            <p className="doc-caption mt-12 max-w-3xl border-t border-line pt-5">
              CDL instructor &amp; driver trainer
            </p>
          </div>

          {/* TEMPORARY launch merchandising — remove when the shirt sells out */}
          <HeroShirtPromo className="mt-10 xl:mt-0 xl:justify-self-end" />
        </div>
      </Container>
    </section>
  );
}
