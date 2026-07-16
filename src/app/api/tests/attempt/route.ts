import { guardedPost } from '@/lib/api/handler';
import { testAttemptSchema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';
import { getTest } from '@/lib/tests/catalog';
import { gradeAttempt } from '@/lib/tests/scoring';

export const runtime = 'nodejs';

/**
 * Practice-test attempt log + optional email save (Milestone 2 — Study Mode).
 *
 * Two payload shapes (schema-enforced) so one study session never produces
 * two attempt rows:
 *   * answers (no email)  → grade SERVER-side, insert ONE test_attempts row,
 *     bump miss_count for answered-wrong questions.
 *   * email (no answers)  → Turnstile-verified lead save only — no second
 *     attempt row, no second miss_count pass.
 *   * both                → one attempt row carrying lead_email.
 *
 * Lead writes are INSERT-IF-ABSENT (ignoreDuplicates): an existing lead's
 * recorded sms_consent and source are never overwritten — consent records are
 * compliance artifacts, not fields to clobber.
 *
 * Abuse posture (mirrors /api/directory/view): same-origin check + IP rate
 * limit. Privacy: the anonymous path stores answers + score only.
 */
export const POST = guardedPost(
  testAttemptSchema,
  // Serves BOTH runners' completion logs plus email saves — sized so a study
  // and a timed completion with an email save in one window never collide.
  { routeKey: 'test-attempt', rateLimitMax: 15 },
  async ({ data, req }) => {
    // Same-origin only — this endpoint serves the site's own quiz runner.
    const secFetchSite = req.headers.get('sec-fetch-site');
    if (secFetchSite && secFetchSite !== 'same-origin') {
      return fail('Forbidden.', 403, 'cross_site');
    }

    const catalogTest = getTest(data.test_slug);
    if (!catalogTest || !catalogTest.isPublished) {
      return fail('Unknown test.', 404, 'unknown_test');
    }

    const supabase = createAdminClient();

    // Email-only save: attach the student to the funnel, never re-log the attempt.
    if (data.email && (!data.answers || Object.keys(data.answers).length === 0)) {
      const { error: leadError } = await supabase
        .from('leads')
        .upsert(
          { email: data.email, source: 'practice-test', sms_consent: false },
          { onConflict: 'email', ignoreDuplicates: true },
        );
      if (leadError) {
        log.error('test_attempt_lead_upsert_failed', { code: leadError.code });
        return fail('Could not save your email. Try again.', 500, 'db_error');
      }
      log.info('test_attempt_email_saved', { test: catalogTest.slug });
      return ok({ saved: true }, 201);
    }

    // One round trip: the published test row with its full answer key.
    const { data: testRow, error: readError } = await supabase
      .from('tests')
      .select('id, questions(id, correct_key)')
      .eq('slug', catalogTest.slug)
      .eq('is_published', true)
      .maybeSingle();
    // A read failure is retryable — never conflate it with "not seeded".
    if (readError) {
      log.error('test_attempt_read_failed', { code: readError.code });
      return fail('Could not load the test. Try again.', 500, 'db_error');
    }
    const questions = ((testRow?.questions as { id: string; correct_key: string }[]) ?? []).map(
      (q) => ({ id: q.id, correctKey: q.correct_key }),
    );
    if (!testRow || questions.length === 0) {
      return fail('This test is not open yet.', 409, 'not_live');
    }

    // Keep only answers to questions that actually belong to this test.
    const known = new Set(questions.map((q) => q.id));
    const answers: Record<string, string> = {};
    for (const [id, key] of Object.entries(data.answers ?? {})) {
      if (known.has(id)) answers[id] = key;
    }
    if (Object.keys(answers).length === 0) {
      return fail('No answers matched this test.', 422, 'no_valid_answers');
    }

    // Authoritative grading — unanswered questions count against the score,
    // exactly like the real exam.
    const result = gradeAttempt(questions, answers, catalogTest.passThresholdPct);

    // Analytics fields: clamp elapsed to the test's limit (timed) or a day
    // (study) so a tampered client clock can't poison duration analytics.
    const elapsedCap =
      data.mode === 'timed' && catalogTest.timeLimitSeconds ? catalogTest.timeLimitSeconds : 86_400;
    const elapsed =
      data.elapsed_seconds !== undefined ? Math.min(data.elapsed_seconds, elapsedCap) : null;

    const { error: insertError } = await supabase.from('test_attempts').insert({
      test_id: testRow.id,
      lead_email: data.email ?? null,
      score: result.correct,
      total: result.total,
      answers,
      mode: data.mode ?? null,
      elapsed_seconds: elapsed,
      completed_at: new Date().toISOString(),
    });
    if (insertError) {
      log.error('test_attempt_insert_failed', { code: insertError.code });
      return fail('Could not save the attempt. Try again.', 500, 'db_error');
    }

    // Miss analytics: only questions the student answered AND got wrong.
    // supabase-js resolves { error } (it never throws) — check it explicitly
    // so a missing RPC/migration is visible in logs instead of silent.
    const missedIds = result.answers
      .filter((a) => a.selectedKey !== null && !a.isCorrect)
      .map((a) => a.questionId);
    if (missedIds.length > 0) {
      const { error: rpcError } = await supabase.rpc('tlws_increment_question_misses', {
        p_question_ids: missedIds,
      });
      if (rpcError) {
        // Analytics only — never fail the attempt over it, but never hide it.
        log.warn('test_attempt_miss_rpc_failed', { code: rpcError.code });
      }
    }

    if (data.email) {
      const { error: leadError } = await supabase
        .from('leads')
        .upsert(
          { email: data.email, source: 'practice-test', sms_consent: false },
          { onConflict: 'email', ignoreDuplicates: true },
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
