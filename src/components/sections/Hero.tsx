import { Button, Container, Eyebrow } from '@/components/ui';

/**
 * Hero — the thesis (blueprint §4 S1). Leads with the one thing that can't be
 * faked — a driver's clean record — and routes to the school. CTA hierarchy:
 * ONE amber action (the school application), one outlined learn-more. Every
 * other path lives one scroll down in the Four Doors.
 *
 * No opening date is displayed until the owner confirms one — honest copy
 * over hype, per the design blueprint's own rule.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="border-b border-line bg-asphalt py-20 sm:py-28"
    >
      <Container>
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
      </Container>
    </section>
  );
}
