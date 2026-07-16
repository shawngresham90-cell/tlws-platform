import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, Eyebrow } from '@/components/ui';
import { StudyRunner } from '@/components/test';
import { getTest, publishedTests, testHref } from '@/lib/tests/catalog';
import { getQuestionsForTest } from '@/lib/tests/queries';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Study Mode — the interactive quiz surface. Deliberately NOINDEX: the SEO
 * page is the test landing; this page is an app screen. Questions are fetched
 * server-side (RLS: published tests only) and handed to the client island, so
 * the runner starts instantly with no loading spinner.
 *
 * Zero-question guard: if the bank isn't seeded yet the page renders an honest
 * "not open yet" panel instead of an empty quiz — the landing page won't link
 * here until the bank is live, but the URL must stay safe to hit directly.
 */
export const revalidate = 300;

export function generateStaticParams() {
  return publishedTests().map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const test = getTest(params.slug);
  return buildMetadata({
    title: test ? `${test.title} — Study Mode | Practice Tests` : 'Practice test not found',
    path: `/practice-tests/${params.slug}/study`,
    noindex: true,
  });
}

export default async function StudyModePage({ params }: { params: { slug: string } }) {
  const test = getTest(params.slug);
  if (!test || !test.isPublished) notFound();

  const questions = await getQuestionsForTest(test.slug);

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <Eyebrow>Study Mode</Eyebrow>
        <h1 className="font-display text-3xl uppercase text-ink sm:text-4xl">{test.title}</h1>

        {questions.length === 0 ? (
          <div className="mt-8 rounded-card border border-line bg-asphalt-800 p-8">
            <h2 className="font-display text-xl uppercase text-signal">
              This test isn&apos;t open yet
            </h2>
            <p className="mt-3 text-muted">
              The {test.title} question bank is being finalized. Check the test page for the latest
              — it goes live the moment the bank does.
            </p>
            <p className="mt-4">
              <Link
                href={testHref(test.slug)}
                className="font-semibold text-signal hover:underline"
              >
                ← Back to {test.title}
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <StudyRunner
              test={{
                slug: test.slug,
                title: test.title,
                passThresholdPct: test.passThresholdPct,
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
