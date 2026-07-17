/**
 * Client-safe constants and types for the Admin Tests module. This module
 * exists so the 'use client' QuestionForm never value-imports the server
 * data layer (src/lib/admin/tests.ts is `server-only`: it reaches the
 * service-role client, and only tree-shaking kept it out of the browser
 * bundle before this split — M7 security review).
 */

export const CHOICE_KEYS = ['a', 'b', 'c', 'd'] as const;

export type AdminQuestionRow = {
  id: string;
  prompt: string;
  choices: { key: string; text: string }[];
  correct_key: string;
  explanation: string | null;
  cfr_cite: string | null;
  verified_date: string | null;
  difficulty: number;
  tags: string[];
  sort_order: number;
  miss_count: number;
};

/**
 * True when a question row uses the canonical choices shape the edit form
 * can faithfully round-trip: exactly four choices keyed a–d in order, and a
 * correct key that exists among them. Anything else must NOT be edited via
 * the form — it would silently rewrite the row into a–d shape (and could
 * silently move the answer key).
 */
export function hasCanonicalChoices(q: Pick<AdminQuestionRow, 'choices' | 'correct_key'>): boolean {
  return (
    Array.isArray(q.choices) &&
    q.choices.length === CHOICE_KEYS.length &&
    q.choices.every((c, i) => c?.key === CHOICE_KEYS[i] && typeof c.text === 'string') &&
    (CHOICE_KEYS as readonly string[]).includes(q.correct_key)
  );
}
