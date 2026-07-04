import { Button, Container, Section, Eyebrow } from '@/components/ui';

/**
 * Placeholder homepage — scaffold only.
 * The real hero, funnel, and CTAs land in the Homepage milestone.
 * Structure here proves the design system and layout shell work end to end.
 */
export default function HomePage() {
  return (
    <>
      {/* Hero — thesis first: the driver's authority and the school's mission */}
      <div className="border-b border-line bg-asphalt py-24 sm:py-32">
        <Container>
          <Eyebrow>17 Years · Zero Violations · Dalton, GA</Eyebrow>
          <h1 className="display-hero max-w-4xl">
            The CDL school built by a driver, <span className="text-signal">for drivers.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Corporate schools can&apos;t reach the drivers who need it most. This one does.
            ELDT-compliant training off I-75 — real trucks, real road, real accountability.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Button href="/academy">Enroll now</Button>
            <Button variant="ghost" href="/founders">
              Back the build
            </Button>
          </div>
        </Container>
      </div>

      {/* Placeholder pillars — proves Section + grid rhythm */}
      <Section>
        <Eyebrow>What&apos;s coming</Eyebrow>
        <h2 className="display-section mb-10 max-w-2xl">Milestone-built. Shipping in order.</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { t: 'The Academy', d: 'Enrollment, curriculum, application funnel.' },
            { t: 'Founders Wall', d: 'Back the school. Live thermometer, tiers, sponsors.' },
            { t: 'Practice Tests', d: 'CFR-verified CDL prep. Free tier, done-for-you upsell.' },
          ].map((c) => (
            <div key={c.t} className="rounded-card border border-line bg-asphalt-800 p-6">
              <h3 className="font-display text-xl uppercase text-signal">{c.t}</h3>
              <p className="mt-2 text-sm text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
