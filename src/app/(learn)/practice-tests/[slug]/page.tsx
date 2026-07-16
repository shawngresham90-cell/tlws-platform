import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, Section, Eyebrow, Button } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { getTest, publishedTests, testHref, studyHref } from '@/lib/tests/catalog';
import { getSeededQuestionCount } from '@/lib/tests/queries';
import { testSchema } from '@/lib/tests/schema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Practice test landing page. One indexable page per test — the SEO surface for
 * "free CDL [test] practice test" queries. The start area is live-state aware:
 * a seeded bank gets the Start Study Mode CTA; an unseeded one keeps the honest
 * coming-soon panel. Stats only advertise modes a student can take TODAY
 * (catalog.modes) — Timed appears when its milestone ships.
 */
export const revalidate = 300;

export function generateStaticParams() {
  return publishedTests().map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const test = getTest(params.slug);
  if (!test || !test.isPublished) {
    return buildMetadata({
      title: 'Practice test not found',
      path: `/practice-tests/${params.slug}`,
      noindex: true,
    });
  }
  return buildMetadata({
    title: test.seoTitle,
    description: test.seoDescription,
    path: testHref(test.slug),
  });
}

function formatTimeLimit(seconds: number | null): string {
  if (!seconds) return 'Untimed';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min (Timed mode)`;
}

export default async function PracticeTestLandingPage({ params }: { params: { slug: string } }) {
  const test = getTest(params.slug);
  if (!test || !test.isPublished) notFound();

  const seededQuestionCount = await getSeededQuestionCount(test.slug);
  const live = seededQuestionCount > 0;

  const stats: { label: string; value: string }[] = [
    {
      label: 'Questions',
      value: live ? String(seededQuestionCount) : `${test.questionCountTarget} (coming soon)`,
    },
    { label: 'To pass', value: `${test.passThresholdPct}%` },
    {
      label: 'Modes',
      value: test.modes.map((m) => (m === 'study' ? 'Study' : 'Timed')).join(' · '),
    },
    // The time-limit tile only renders when Timed Mode actually exists —
    // never advertise a mode a student can't take.
    ...(test.modes.includes('timed')
      ? [{ label: 'Time limit', value: formatTimeLimit(test.timeLimitSeconds) }]
      : []),
  ];

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Practice Tests', path: '/practice-tests' },
            { name: test.title, path: testHref(test.slug) },
          ]),
          testSchema(test),
        ]}
      />

      <div className="border-b border-line bg-asphalt py-14 sm:py-16">
        <Container>
          <Breadcrumbs
            crumbs={[
              { name: 'Home', href: '/' },
              { name: 'Practice Tests', href: '/practice-tests' },
              { name: test.title },
            ]}
          />
          <Eyebrow>CDL Practice Test</Eyebrow>
          <h1 className="display-hero max-w-3xl text-4xl sm:text-5xl">{test.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{test.heroIntro}</p>

          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-card border border-line bg-asphalt-800 p-4">
                <dt className="text-xs uppercase tracking-wide text-muted">{s.label}</dt>
                <dd className="mt-1 font-display text-lg text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </div>

      <Section>
        {live ? (
          <div className="max-w-2xl rounded-card border border-signal/40 bg-asphalt-800 p-8">
            <h2 className="font-display text-2xl uppercase text-signal">Start studying — free</h2>
            <p className="mt-3 text-muted">
              One question at a time. Answer, and the correct choice, a plain-English explanation,
              and the exact 49 CFR / CDL-manual citation appear immediately. Your progress saves on
              this device, so you can stop and pick right back up.
            </p>
            <div className="mt-6">
              <Button href={studyHref(test.slug)}>Start Study Mode</Button>
            </div>
            <p className="mt-4 text-xs text-muted">
              Timed exam simulation is coming next. No account needed — just study.
            </p>
          </div>
        ) : (
          <div className="max-w-2xl rounded-card border border-line bg-asphalt-800 p-8">
            <h2 className="font-display text-2xl uppercase text-signal">
              Question bank coming soon
            </h2>
            <p className="mt-3 text-muted">
              The {test.title} test is built and its page is live. The question bank is being
              finalized — every question will show the correct answer, a plain-English explanation,
              and the 49 CFR citation the moment you answer in Study Mode.
            </p>
            <p className="mt-4 text-sm text-muted">
              Want a head start now?{' '}
              <Link href="/knowledge" className="font-semibold text-signal hover:underline">
                Read the Knowledge Center
              </Link>{' '}
              or{' '}
              <Link href="/academy/apply" className="font-semibold text-signal hover:underline">
                enroll at the Academy
              </Link>
              .
            </p>
          </div>
        )}
      </Section>
    </>
  );
}
