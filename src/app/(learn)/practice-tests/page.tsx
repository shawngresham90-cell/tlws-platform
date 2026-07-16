import { Container, Section, Eyebrow, Button } from '@/components/ui';
import { TestCard } from '@/components/tests';
import { publishedTests } from '@/lib/tests/catalog';
import { getSeededQuestionCount } from '@/lib/tests/queries';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Practice Tests hub. Lists every published CDL practice test. Fixes the
 * homepage + footer "Practice Tests" CTA, which pointed here before the route
 * existed. Renders from the TS catalog, so it is live and crawlable even before
 * any question bank is seeded (each card shows "coming soon" until it is).
 */
export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Free CDL Practice Tests | Trucking Life with Shawn',
  description:
    'Free CDL practice tests written against the CDL manual and 49 CFR — every question carries its citation and a plain-English explanation. Built by a 17-year driver.',
  path: '/practice-tests',
});

export default async function PracticeTestsHubPage() {
  const tests = publishedTests();
  const counts = await Promise.all(tests.map((t) => getSeededQuestionCount(t.category)));

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Practice Tests', path: '/practice-tests' },
        ])}
      />

      <div className="border-b border-line bg-asphalt py-14 sm:py-16">
        <Container>
          <Eyebrow>Practice Tests</Eyebrow>
          <h1 className="display-hero max-w-3xl text-4xl sm:text-5xl">Free CDL practice tests</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Real permit-style questions written against the current CDL manual and 49 CFR. Every
            answer shows the citation and a plain-English explanation — so you learn the rule, not
            just the letter.
          </p>
        </Container>
      </div>

      <Section>
        {tests.length === 0 ? (
          <p className="text-muted">Practice tests are on the way — check back soon.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test, i) => (
              <TestCard key={test.slug} test={test} seededQuestionCount={counts[i]} />
            ))}
          </div>
        )}
      </Section>

      {/* How it works — trust band. Mirrors the platform's CFR-verified posture. */}
      <Section className="border-t border-line bg-asphalt-800">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="font-display text-section uppercase text-ink">Written to the regulation</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="font-display text-lg uppercase text-signal">Cited to 49 CFR</h3>
            <p className="mt-2 text-sm text-muted">
              Every question is checked against the CDL manual and the eCFR, with the citation
              attached before it publishes.
            </p>
          </div>
          <div>
            <h3 className="font-display text-lg uppercase text-signal">Learn from misses</h3>
            <p className="mt-2 text-sm text-muted">
              Miss one and you see exactly why — the correct answer and the reason behind it, in
              plain English.
            </p>
          </div>
          <div>
            <h3 className="font-display text-lg uppercase text-signal">Free to take</h3>
            <p className="mt-2 text-sm text-muted">
              No account, no paywall. Built by a driver to help drivers pass the first time.
            </p>
          </div>
        </div>
      </Section>

      {/* Academy CTA. */}
      <Section className="border-t border-line">
        <div className="rounded-card border border-line bg-asphalt-800 p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl uppercase text-ink">
                Ready for the real thing?
              </h2>
              <p className="mt-3 text-muted">
                Trucking Life Academy trains CDL-A drivers in Dalton, GA — off I-75. Drivers helping
                drivers, the way it should be.
              </p>
            </div>
            <Button href="/academy/apply">Enroll at the Academy</Button>
          </div>
        </div>
      </Section>
    </>
  );
}
