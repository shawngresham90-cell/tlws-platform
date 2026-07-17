import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminQuestion } from '@/lib/admin/tests';
import { hasCanonicalChoices } from '@/lib/admin/tests-shared';
import { getTest } from '@/lib/tests/catalog';
import { QuestionForm } from '@/components/admin/tests/QuestionForm';
import { saveQuestionAction } from '../../../actions';

/**
 * Edit one existing question (Milestone 7, edit-only). The UUID is bound
 * into the server action — the form can only update this row, never create
 * or delete, so attempt history and device-local student state survive.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Edit Question', robots: { index: false, follow: false } };

export default async function AdminEditQuestionPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  requireAdmin();

  const test = getTest(params.slug);
  if (!test) notFound();

  const { question, error } = await getAdminQuestion(params.slug, params.id);
  if (error) {
    return (
      <p className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
        Couldn&apos;t load the question: {error}
      </p>
    );
  }
  if (!question) notFound();

  const editAction = saveQuestionAction.bind(null, question.id, test.slug);

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        <Link href={`/admin/tests/${test.slug}`} className="hover:text-signal">
          ← {test.title} bank
        </Link>
      </p>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Edit question #{question.sort_order}</h1>
        <p className="text-sm text-muted">
          Missed {question.miss_count}× by students · UUID{' '}
          <span className="break-all font-mono text-xs">{question.id}</span>
        </p>
      </div>
      <div className="mt-6">
        {hasCanonicalChoices(question) ? (
          <QuestionForm action={editAction} question={question} />
        ) : (
          // The form can only round-trip the canonical a–d shape. Rendering
          // it for anything else would silently rewrite the row (and could
          // silently move the answer key) — refuse instead.
          <p className="max-w-2xl rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
            This question&apos;s choices are not in the canonical a–d shape, so the form can&apos;t
            edit it without rewriting the choices. Fix it with a targeted SQL UPDATE (keyed on this
            UUID) instead.
          </p>
        )}
      </div>
    </div>
  );
}
