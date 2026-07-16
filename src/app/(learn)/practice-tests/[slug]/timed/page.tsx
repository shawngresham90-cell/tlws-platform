import { notFound } from 'next/navigation';
import { Container, Eyebrow } from '@/components/ui';
import { TimedRunner } from '@/components/test';
import { TestNotOpenPanel } from '@/components/test/shared';
import { getTest, publishedTests, timedAvailable } from '@/lib/tests/catalog';
import { getQuestionsForTest } from '@/lib/tests/queries';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Timed Test — the exam-simulation surface (Milestone 3). Deliberately
 * NOINDEX like the Study route: the SEO page is the test landing; this is an
 * app screen. Questions are fetched server-side (RLS: published tests only)
 * and handed to the client island.
 *
 * Guards: unknown slugs 404; tests without 'timed' in their catalog modes
 * 404 (the mode simply doesn't exist for them yet); an unseeded bank renders
 * the honest "not open yet" panel instead of an empty exam.
 */
export const revalidate = 300;

export function generateStaticParams() {
  return publishedTests()
    .filter((t) => timedAvailable(t))
    .map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const test = getTest(params.slug);
  return buildMetadata({
    title: test ? `${test.title} — Timed Test | Practice Tests` : 'Practice test not found',
    path: `/practice-tests/${params.slug}/timed`,
    noindex: true,
  });
}

export default async function TimedTestPage({ params }: { params: { slug: string } }) {
  const test = getTest(params.slug);
  if (!test || !test.isPublished || !timedAvailable(test) || !test.timeLimitSeconds) {
    notFound();
  }

  const questions = await getQuestionsForTest(test.slug);

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <Eyebrow>Timed Test</Eyebrow>
        <h1 className="font-display text-3xl uppercase text-ink sm:text-4xl">{test.title}</h1>

        {questions.length === 0 ? (
          <TestNotOpenPanel slug={test.slug} title={test.title} />
        ) : (
          <div className="mt-8">
            <TimedRunner
              test={{
                slug: test.slug,
                title: test.title,
                passThresholdPct: test.passThresholdPct,
                timeLimitSeconds: test.timeLimitSeconds,
              }}
              questions={questions}
              turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
            />
          </div>
        )}
      </Container>
    </div>
  );
}
