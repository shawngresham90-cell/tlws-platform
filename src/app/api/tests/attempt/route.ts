import { guardedPost } from '@/lib/api/handler';
import { testAttemptSchema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';
import { getTest } from '@/lib/tests/catalog';
import { gradeAttempt } from '@/lib/tests/scoring';

export const runtime = 'nodejs';

/**
 * Practice-test attempt log (Milestone 2 — Study Mode).
 *
 * Grades SERVER-SIDE against the real question bank (the client's local
 * grading is display-only), then:
 *   1. inserts a test_attempts row (service role — the table has zero anon
 *      policies, so this route is the only write path),
 *   2. bumps miss_count for answered-wrong questions via the 031 RPC
 *      (fail-soft if the migration isn't applied yet),
 *   3. optionally upserts a lead when a Turnstile-verified email came along
 *      (schema enforces email ⇒ token; the guard stack verifies the token).
 *
 * Privacy: the anonymous path stores answers + score only — no IP, no UA, no
 * email. Rate limiting uses the transient request IP and persists nothing.
 */
export const POST = guardedPost(
  testAttemptSchema,
  { routeKey: 'test-attempt', rateLimitMax: 10 },
  async ({ data }) => {
    const catalogTest = getTest(data.test_slug);
    if (!catalogTest || !catalogTest.isPublished) {
      return fail('Unknown test.', 404, 'unknown_test');
    }

    const supabase = createAdminClient();

    const { data: testRow } = await supabase
      .from('tests')
      .select('id')
      .eq('slug', catalogTest.slug)
      .eq('is_published', true)
      .maybeSingle();
    if (!testRow) return fail('This test is not open yet.', 409, 'not_live');

    const { data: questionRows } = await supabase
      .from('questions')
      .select('id, correct_key')
      .eq('test_id', testRow.id);
    const questions = (questionRows ?? []).map((q) => ({
      id: q.id as string,
      correctKey: q.correct_key as string,
    }));
    if (questions.length === 0) return fail('This test is not open yet.', 409, 'not_live');

    // Keep only answers to questions that actually belong to this test.
    const known = new Set(questions.map((q) => q.id));
    const answers: Record<string, string> = {};
    for (const [id, key] of Object.entries(data.answers)) {
      if (known.has(id)) answers[id] = key;
    }
    if (Object.keys(answers).length === 0) {
      return fail('No answers matched this test.', 422, 'no_valid_answers');
    }

    // Authoritative grading — unanswered questions count against the score,
    // exactly like the real exam.
    const result = gradeAttempt(questions, answers, catalogTest.passThresholdPct);

    const { error: insertError } = await supabase.from('test_attempts').insert({
      test_id: testRow.id,
      lead_email: data.email ?? null,
      score: result.correct,
      total: result.total,
      answers,
      completed_at: new Date().toISOString(),
    });
    if (insertError) {
      log.error('test_attempt_insert_failed', { code: insertError.code });
      return fail('Could not save the attempt. Try again.', 500, 'db_error');
    }

    // Miss analytics: only questions the student answered AND got wrong.
    const missedIds = result.answers
      .filter((a) => a.selectedKey !== null && !a.isCorrect)
      .map((a) => a.questionId);
    if (missedIds.length > 0) {
      try {
        await supabase.rpc('tlws_increment_question_misses', { p_question_ids: missedIds });
      } catch {
        // Migration 031 unapplied or DB hiccup — analytics only, never fail the attempt.
      }
    }

    if (data.email) {
      const { error: leadError } = await supabase
        .from('leads')
        .upsert(
          { email: data.email, source: 'practice-test', sms_consent: false },
          { onConflict: 'email' },
        );
      if (leadError) log.warn('test_attempt_lead_upsert_failed', { code: leadError.code });
    }

    log.info('test_attempt_recorded', {
      test: catalogTest.slug,
      score: result.correct,
      total: result.total,
      passed: result.passed,
      withEmail: Boolean(data.email),
    });
    return ok(
      {
        correct: result.correct,
        total: result.total,
        scorePct: result.scorePct,
        passed: result.passed,
      },
      201,
    );
  },
);
