import type { AttemptResult, GradedAnswer, Question } from './types';

/**
 * Pure attempt grading — no UI, no DB, no side effects. Given the served
 * questions and the student's selected keys, returns the graded result. Shared
 * by Study mode (per-question feedback) and Timed mode (end-of-test scoring)
 * when those UIs land in Milestone 2. Kept pure so it is trivially unit-tested
 * in scripts/test-practice-tests.ts.
 */
export function gradeAttempt(
  questions: Pick<Question, 'id' | 'correctKey'>[],
  selections: Record<string, string | null>,
  passThresholdPct: number,
): AttemptResult {
  const answers: GradedAnswer[] = questions.map((q) => {
    const selectedKey = selections[q.id] ?? null;
    return {
      questionId: q.id,
      selectedKey,
      correctKey: q.correctKey,
      isCorrect: selectedKey !== null && selectedKey === q.correctKey,
    };
  });

  const total = questions.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const scorePct = total === 0 ? 0 : Math.round((correct / total) * 100);

  return {
    total,
    correct,
    scorePct,
    passed: total > 0 && scorePct >= passThresholdPct,
    answers,
  };
}
