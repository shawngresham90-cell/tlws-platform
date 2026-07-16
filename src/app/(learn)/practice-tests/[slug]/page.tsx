import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, Section, Eyebrow, Button } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import {
  getTest,
  publishedTests,
  testHref,
  studyHref,
  timedHref,
  timedAvailable,
} from '@/lib/tests/catalog';
import { getSeededQuestionCount } from '@/lib/tests/queries';
import { testSchema } from '@/lib/tests/schema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Practice test landing page. One indexable page per test — the SEO surface for
 * "free CDL [test] practice test" queries. The start area is live-state aware:
 * a seeded bank gets the Start Study Mode CTA; an unseeded one keeps the honest
 * coming-soon panel. Stats and the chooser gate on the same
 * timedAvailable() condition, so an advertised mode always has an entry point.
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
  const timedMinutes = Math.round((test.timeLimitSeconds ?? 0) / 60);

  const stats: { label: string; value: string }[] = [
    {
      label: 'Questions',
      value: live ? String(seededQuestionCount) : `${test.questionCountTarget} (coming soon)`,
    },
    { label: 'To pass', value: `${test.passThresholdPct}%` },
    {
      label: 'Modes',
      value: (timedAvailable(test) ? test.modes : test.modes.filter((m) => m !== 'timed'))
        .map((m) => (m === 'study' ? 'Study' : 'Timed'))
        .join(' · '),
    },
    // Tiles gate on the SAME condition as the chooser (timedAvailable) —
    // never advertise a mode without an entry point.
    ...(timedAvailable(test)
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
          <>
            {/* Mode chooser — pick how to take the test. Only shipped modes render. */}
            <div className="grid max-w-4xl gap-5 sm:grid-cols-2">
              <div className="rounded-card border border-signal/40 bg-asphalt-800 p-8">
                <h2 className="font-display text-2xl uppercase text-signal">Study Mode</h2>
                <p className="mt-3 text-muted">
                  Learn as you go — one question at a time. Answer, and the correct choice, a
                  plain-English explanation, and the exact 49 CFR / CDL-manual citation appear
                  immediately. Progress saves on this device.
                </p>
                <div className="mt-6">
                  <Button href={studyHref(test.slug)}>Start Study Mode</Button>
                </div>
                <p className="mt-4 text-xs text-muted">Untimed · instant feedback · free</p>
              </div>
              {timedAvailable(test) && (
                <div className="rounded-card border border-line bg-asphalt-800 p-8">
                  <h2 className="font-display text-2xl uppercase text-ink">Timed Test</h2>
                  <p className="mt-3 text-muted">
                    Exam conditions — {timedMinutes} minutes on the clock, no feedback until you
                    submit, answers changeable until the end. Explanations and citations are
                    revealed with your score.
                  </p>
                  <div className="mt-6">
                    <Button variant="secondary" href={timedHref(test.slug)}>
                      Start Timed Test
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted">
                    {timedMinutes} min · auto-submits at zero · {test.passThresholdPct}% to pass
                  </p>
                </div>
              )}
            </div>

            {/* Saved-work launch points (Milestone 4) — device-local drills. */}
            <p className="mt-6 max-w-4xl text-sm text-muted">
              Been here before? Drill{' '}
              <Link
                href="/practice-tests/bookmarks"
                className="font-semibold text-signal hover:underline"
              >
                your bookmarks
              </Link>{' '}
              or{' '}
              <Link
                href="/practice-tests/missed"
                className="font-semibold text-signal hover:underline"
              >
                your missed questions
              </Link>{' '}
              — saved on this device, no account needed.
            </p>
          </>
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
