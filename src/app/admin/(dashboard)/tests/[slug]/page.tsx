import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminQuestions } from '@/lib/admin/tests';
import { testHref } from '@/lib/tests/catalog';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { setTestPublishedAction } from '../actions';

/**
 * Admin question-bank review (Milestone 7). The whole bank in one table —
 * prompt, keyed answer, citation, verified date, difficulty, tags, and the
 * live miss counter — with per-question edit links and the publish switch.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Test Bank', robots: { index: false, follow: false } };

const OK_MESSAGES: Record<string, string> = {
  saved: 'Question saved. Public pages revalidate within a few minutes.',
  published: 'Test published — the bank is live for students again.',
  unpublished:
    'Test unpublished — anon reads are blocked by RLS, so the public pages now show their "coming soon" state.',
};

export default async function AdminTestBankPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();

  const { test, questions, error } = await getAdminQuestions(params.slug);
  if (!test && !error) notFound();

  const okMessage = searchParams.ok ? OK_MESSAGES[searchParams.ok] : null;
  const errMessage =
    searchParams.error === 'publish' ? 'Could not change the publish state — try again.' : null;

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        <Link href="/admin/tests" className="hover:text-signal">
          ← Tests
        </Link>
      </p>

      {error && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          Couldn&apos;t load the bank: {error}
        </p>
      )}

      {test && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="display-section">{test.def.title}</h1>
            {test.dbId && (
              <form
                action={setTestPublishedAction.bind(
                  null,
                  test.dbId,
                  test.def.slug,
                  !(test.dbPublished ?? false),
                )}
              >
                <ConfirmSubmit
                  message={
                    test.dbPublished
                      ? `Unpublish "${test.def.title}"?\n\nRLS blocks anonymous reads of unpublished tests, so students immediately lose access: the landing page falls back to "question bank coming soon" and Study/Timed show their not-open panels. Saved bookmarks/miss history on devices is kept but can't drill until republish.`
                      : `Publish "${test.def.title}"?\n\nThe bank becomes readable to anonymous students immediately, and the public pages go live on their next revalidation.`
                  }
                  className="rounded-card border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
                >
                  {test.dbPublished ? 'Unpublish' : 'Publish'}
                </ConfirmSubmit>
              </form>
            )}
          </div>

          <p className="mb-4 text-sm text-muted">
            <span className="font-mono text-xs">{test.def.slug}</span> ·{' '}
            {test.dbPublished ? (
              <span className="font-semibold text-signal">Published</span>
            ) : (
              <span>Unpublished — hidden from students</span>
            )}{' '}
            · {test.seededCount} questions · {test.def.passThresholdPct}% to pass ·{' '}
            {test.def.timeLimitSeconds
              ? `${Math.round(test.def.timeLimitSeconds / 60)} min timed`
              : 'untimed'}{' '}
            ·{' '}
            <a
              href={testHref(test.def.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-signal underline-offset-4 hover:underline"
            >
              View public page ↗
            </a>
          </p>

          {(okMessage || errMessage) && (
            <p
              className={`mb-4 rounded-card border px-4 py-3 text-sm font-medium ${
                errMessage
                  ? 'border-diesel bg-diesel/10 text-diesel'
                  : 'border-signal/50 bg-signal/10 text-signal'
              }`}
            >
              {errMessage ?? okMessage}
            </p>
          )}

          {questions.length === 0 ? (
            <p className="rounded-card border border-line bg-asphalt-800 p-6 text-muted">
              No questions seeded for this test yet — banks are seeded by migration.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Prompt</th>
                    <th className="px-3 py-3">Answer</th>
                    <th className="px-3 py-3">Citation</th>
                    <th className="px-3 py-3">Verified</th>
                    <th className="px-3 py-3">Diff</th>
                    <th className="px-3 py-3">Tags</th>
                    <th className="px-3 py-3">Misses</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const answerText = q.choices.find((c) => c.key === q.correct_key)?.text ?? '';
                    return (
                      <tr key={q.id} className="border-t border-line align-top">
                        <td className="px-3 py-3 text-muted">{q.sort_order}</td>
                        <td className="max-w-md px-3 py-3 text-ink">{q.prompt}</td>
                        <td className="max-w-xs px-3 py-3 text-ink">
                          <span className="font-display uppercase text-signal">
                            {q.correct_key}.
                          </span>{' '}
                          {answerText}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted">{q.cfr_cite}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted">
                          {q.verified_date}
                        </td>
                        <td className="px-3 py-3 text-muted">{q.difficulty}</td>
                        <td className="max-w-[10rem] px-3 py-3 text-xs text-muted">
                          {q.tags.join(', ')}
                        </td>
                        <td className="px-3 py-3 text-ink">{q.miss_count}</td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/tests/${test.def.slug}/questions/${q.id}`}
                            className="font-semibold text-signal underline-offset-4 hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
