import { Button, Container, Eyebrow } from '@/components/ui';

/** Verified proof labels only — each one is repo-verified brand fact. */
const PROOF_LABELS = [
  '17 years on the road',
  'Zero violations',
  'CDL instructor & driver trainer',
  'Dalton, Georgia · off I-75',
];

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

      {/* The one hero-level motion moment; killed under reduced motion */}
      <Container className="relative motion-safe:animate-fade-up">
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

        {/* Documentary proof row — verified facts, framed by a hairline rule */}
        <ul className="mt-12 flex max-w-3xl flex-wrap gap-x-8 gap-y-2 border-t border-line pt-5">
          {PROOF_LABELS.map((label) => (
            <li key={label} className="doc-caption">
              {label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
