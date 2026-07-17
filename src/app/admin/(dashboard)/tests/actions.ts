'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseQuestionForm, uuidSchema } from '@/lib/admin/tests';
import { getTest, testHref, studyHref, timedHref } from '@/lib/tests/catalog';

/**
 * Admin Tests writes (Milestone 7 — edit-only). Every action: admin gate →
 * validation → service-role UPDATE → revalidate the affected public pages →
 * redirect with feedback. Three hard rules:
 *
 *   - UPDATE-only, keyed by UUID. No inserts, no deletes — question ids must
 *     survive every edit so attempt history, miss counts, and students'
 *     device-local bookmarks/misses stay intact. Creation stays in migrations.
 *   - Bound args are UNTRUSTED. Next 14 ships .bind() args to the client in
 *     plaintext and rebinds whatever comes back, so every id is validated and
 *     every write is re-scoped server-side from the catalog slug (M7 security
 *     review) — a tampered pair can never edit one test while revalidating
 *     another.
 *   - Anon permissions untouched: these run server-side with the service
 *     role behind requireAdmin(); RLS keeps its published-only anon reads.
 */

export type QuestionFormState = { error: string | null };

function revalidateTestPages(slug: string) {
  revalidatePath('/practice-tests');
  revalidatePath(testHref(slug));
  revalidatePath(studyHref(slug));
  revalidatePath(timedHref(slug));
  // The saved pages ship every published bank in their payload.
  revalidatePath('/practice-tests/bookmarks');
  revalidatePath('/practice-tests/missed');
  revalidatePath(`/admin/tests/${slug}`);
}

/** Save an edit to an EXISTING question (update by UUID — never insert). */
export async function saveQuestionAction(
  questionId: string,
  slug: string,
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  requireAdmin();

  if (!getTest(slug)) return { error: 'Unknown test' };
  if (!uuidSchema.safeParse(questionId).success) return { error: 'Invalid question id' };
  const parsed = parseQuestionForm(formData);
  if (!parsed.data) return { error: parsed.error ?? 'Invalid form input' };

  const supabase = createAdminClient();
  // Re-derive the owning test server-side: the update is scoped to BOTH the
  // question UUID and the slug's test row, so a tampered (id, slug) pair
  // can't edit a question in one test while revalidating another.
  const { data: testRow, error: testError } = await supabase
    .from('tests')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (testError) {
    console.error('saveQuestionAction: tests lookup failed:', testError.message);
    return { error: 'Could not save the question — the test row could not be loaded.' };
  }
  if (!testRow) return { error: 'Test row not found in the database.' };

  const { data, error } = await supabase
    .from('questions')
    .update({
      prompt: parsed.data.prompt,
      choices: parsed.data.choices,
      correct_key: parsed.data.correct_key,
      explanation: parsed.data.explanation,
      cfr_cite: parsed.data.cfr_cite,
      verified_date: parsed.data.verified_date,
      difficulty: parsed.data.difficulty,
      tags: parsed.data.tags,
    })
    .eq('id', questionId)
    .eq('test_id', (testRow as { id: string }).id)
    .select('id');
  if (error) {
    console.error('saveQuestionAction: update failed:', error.message);
    return { error: 'Could not save the question — the database rejected the update.' };
  }
  if (!data || data.length === 0) {
    return { error: 'Question not found in this test — nothing was changed.' };
  }

  revalidateTestPages(slug);
  redirect(`/admin/tests/${slug}?ok=saved`);
}

/**
 * Publish / unpublish a test's DB row. This is the RLS visibility switch:
 * unpublished tests and their questions vanish from anon reads, so the
 * public landing/study/timed pages fall back to their honest
 * "question bank coming soon" states. (The catalog keeps the pages
 * themselves live — removing a test entirely is a catalog change.)
 *
 * Keyed by SLUG alone (catalog-validated) — no separately-bound row id that
 * a tampered form could point at a different test.
 */
export async function setTestPublishedAction(slug: string, publish: boolean): Promise<void> {
  requireAdmin();

  if (!getTest(slug)) redirect('/admin/tests?error=unknown');
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tests')
    .update({ is_published: publish === true })
    .eq('slug', slug)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error('setTestPublishedAction: update failed:', error.message);
    redirect(`/admin/tests/${slug}?error=publish`);
  }

  revalidateTestPages(slug);
  redirect(`/admin/tests/${slug}?ok=${publish === true ? 'published' : 'unpublished'}`);
}
