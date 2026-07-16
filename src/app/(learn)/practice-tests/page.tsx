import Link from 'next/link';
import { Container, Section, Eyebrow } from '@/components/ui';
import { TestCard } from '@/components/test';
import { CtaBand } from '@/components/academy/CtaBand';
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
  const counts = await Promise.all(tests.map((t) => getSeededQuestionCount(t.slug)));

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
        {/* Saved-work launch points (Milestone 4) — device-local, so always shown. */}
        <div className="mt-8 grid max-w-4xl gap-5 sm:grid-cols-2">
          {/* h3 + hover treatment match the sibling TestCards — these are
              peer cards in the same grid family, not section headings. */}
          <Link
            href="/practice-tests/bookmarks"
            className="group rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            <h3 className="font-display text-xl uppercase text-ink transition-colors group-hover:text-signal">
              Your bookmarks →
            </h3>
            <p className="mt-2 text-sm text-muted">
              Questions you saved while studying, ready to drill anytime. Stored on this device — no
              account needed.
            </p>
          </Link>
          <Link
            href="/practice-tests/missed"
            className="group rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            <h3 className="font-display text-xl uppercase text-ink transition-colors group-hover:text-signal">
              Your missed questions →
            </h3>
            <p className="mt-2 text-sm text-muted">
              Every question you have gotten wrong, tracked automatically. Practice your misses
              until they stick.
            </p>
          </Link>
        </div>
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

      {/* Academy conversion band — the shared component, so the CTA never drifts. */}
      <CtaBand
        heading="Ready for the real thing?"
        intro="Trucking Life Academy trains CDL-A drivers in Dalton, GA — off I-75. Drivers helping drivers, the way it should be."
      />
    </>
  );
}
