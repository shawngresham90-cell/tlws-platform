import { Section, Button, Eyebrow } from '@/components/ui';
import { PageHero, AcademyFaq, CtaBand, Placeholder } from '@/components/academy';
import { JsonLd, breadcrumbSchema, personSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'Instructors — Meet Founder Shawn Gresham | Trucking Life Academy',
  description:
    'Trucking Life Academy is led by Shawn Gresham — a 17-year CDL-A driver with zero violations and a CDL instructor and driver trainer. Learn from working drivers, not classroom theory.',
  path: '/academy/instructors',
});

const FAQS: KcFaq[] = [
  {
    q: 'Who teaches at Trucking Life Academy?',
    a: 'The school is founded and led by Shawn Gresham, a Class A driver with 17 years on the road, zero violations, and experience as a CDL instructor and driver trainer. Instruction comes from working drivers, not classroom-only trainers.',
  },
  {
    q: 'What makes the instruction different?',
    a: 'Everything is taught from the seat of real experience. The mission is drivers helping drivers — practical, road-tested guidance that prepares you for the job, not just the test.',
  },
  {
    q: 'Are there other instructors?',
    a: 'Additional instructor bios will be added here as the team grows. Every instructor is held to the same standard: real driving experience and a driver-first approach.',
  },
];

export default function InstructorsPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Academy', path: '/academy' },
            { name: 'Instructors', path: '/academy/instructors' },
          ]),
          personSchema(),
        ]}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'Instructors' },
        ]}
        eyebrow="Instructors"
        title="Taught by drivers who’ve"
        highlight="run the miles."
        intro="You can’t teach the road from a whiteboard. At Trucking Life Academy, you learn from people who’ve actually done the job — starting with the founder."
      />

      {/* Founder feature */}
      <Section className="border-b border-line">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div className="flex flex-col items-start">
            <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-card border border-dashed border-line bg-asphalt-800 text-center">
              <p className="text-muted">
                <span className="mb-2 block text-4xl" aria-hidden="true">
                  🧑‍✈️
                </span>
                <Placeholder>Photo of Shawn coming soon</Placeholder>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['17 years driving', 'Zero violations', 'CDL instructor', 'Driver trainer'].map(
                (b) => (
                  <span
                    key={b}
                    className="rounded-card border border-line bg-asphalt-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-signal"
                  >
                    {b}
                  </span>
                ),
              )}
            </div>
          </div>

          <div>
            <Eyebrow>Founder &amp; lead instructor</Eyebrow>
            <h2 className="display-section">{SITE.founder.name}</h2>
            <div className="mt-4 space-y-4 text-lg text-muted">
              <p>
                Shawn Gresham has spent 17 years behind the wheel of a Class A truck — with zero
                violations to show for it. That clean record isn’t luck; it’s the product of doing
                the job right, mile after mile, year after year.
              </p>
              <p>
                As a CDL instructor and driver trainer, Shawn founded Trucking Life Academy to pass
                that experience down the way it should be handed down — straight, practical, and on
                the driver’s side. The mission is simple:{' '}
                <strong className="text-ink">drivers helping drivers</strong>.
              </p>
              <p>
                Beyond the Academy, Shawn shares free trucking knowledge with drivers across the
                country through Trucking Life with Shawn — the same voice, the same honesty, whether
                you’re enrolled or just getting started.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="ghost" href="/knowledge">
                Read free CDL guides
              </Button>
              <Button variant="ghost" href="/academy/curriculum">
                See what he teaches
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Teaching philosophy */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="max-w-3xl">
          <Eyebrow>Teaching philosophy</Eyebrow>
          <h2 className="display-section">Real accountability, no shortcuts</h2>
          <p className="mt-4 text-lg text-muted">
            Corporate CDL mills are measured by how fast they can push students through. Trucking
            Life Academy is measured by whether you’re genuinely ready for the road. That means
            honest feedback, real seat time, and instructors who’ve carried the responsibility of an
            80,000-pound truck themselves — and who treat your success like it’s their own.
          </p>
        </div>
      </Section>

      {/* Growing team placeholder */}
      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>The team</Eyebrow>
          <h2 className="display-section">More instructors, same standard</h2>
          <p className="mt-4 text-muted">
            As the Academy grows, additional instructor bios will be added here — each one a real
            driver held to the same bar.{' '}
            <Placeholder>Additional instructor profiles coming soon</Placeholder>
          </p>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
      </Section>

      <CtaBand heading="Learn from a driver who’s been there" />
    </>
  );
}
