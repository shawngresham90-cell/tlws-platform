import { Button, Container, Eyebrow } from '@/components/ui';

/**
 * Hero — the thesis. Leads with the one thing that can't be faked: a driver's
 * clean record and the mission. Four CTAs in priority order: Apply, Pre-School, Fund, Free.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="border-b border-line bg-asphalt py-20 sm:py-28"
    >
      <Container>
        <Eyebrow>17 Years · Zero Violations · {`Dalton, GA · off I-75`}</Eyebrow>
        <h1 id="hero-heading" className="display-hero max-w-4xl">
          The CDL school built by a driver, <span className="text-signal">for drivers.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Corporate schools can&apos;t reach the drivers who need it most. Trucking Life Academy
          does — ELDT-compliant CDL-A training on real trucks, real road, real accountability, from
          a man who&apos;s run 17 years with a clean record.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button href="/academy">Apply to the Academy</Button>
          <Button variant="secondary" href="/cdl-pre-school">
            CDL Pre-School
          </Button>
          <Button variant="ghost" href="/founders">
            Fund the School
          </Button>
          <Button variant="ghost" href="/knowledge">
            Free CDL Resources
          </Button>
        </div>
      </Container>
    </section>
  );
}
