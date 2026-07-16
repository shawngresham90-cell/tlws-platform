import { createStaticClient } from '@/lib/supabase/static';
import type { Question, QuestionChoice } from './types';

/**
 * Practice Tests data layer — reads published tests and their questions from
 * the DB via the cookieless anon client. RLS (migration 010) is the boundary:
 * anon sees only published tests and their questions. Everything fails SOFT —
 * an unseeded or unreachable DB yields null / empty and the pages render their
 * honest "question bank coming soon" state, never a 500.
 *
 * Join key is the SLUG: tests.slug is unique (migration 007) and the TS
 * catalog owns it, so a lookup can never hit the multiple-rows trap that a
 * category filter would once state variants share a category. Seeded DB rows
 * MUST use the catalog's slug verbatim — that is the contract between the
 * catalog and the bank.
 *
 * Answer keys (correct_key + explanation) are intentionally exposed to the
 * client. This is a free study tool; usability beats bank protection. No RPC,
 * no hidden keys — decided and finalized in the Practice Tests blueprint.
 */

type TestMetaRow = { id: string };

type QuestionRow = {
  id: string;
  prompt: string;
  choices: unknown;
  correct_key: string;
  explanation: string | null;
  cfr_cite: string | null;
  verified_date: string | null;
  image_url: string | null;
  difficulty: number | null;
  tags: string[] | null;
  sort_order: number | null;
};

/** Published test row id for a catalog slug, or null. */
export async function getPublishedTestMeta(slug: string): Promise<TestMetaRow | null> {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('tests')
      .select('id')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    return (data as TestMetaRow) ?? null;
  } catch {
    return null;
  }
}

/**
 * How many questions are actually seeded for a test. 0 when unseeded. Counts
 * the real questions rows (head-only count) rather than trusting the manually
 * maintained tests.question_count, so the "live" signal and the rendered count
 * can never disagree with the bank itself.
 */
export async function getSeededQuestionCount(slug: string): Promise<number> {
  try {
    const meta = await getPublishedTestMeta(slug);
    if (!meta) return 0;
    const supabase = createStaticClient();
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', meta.id);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Normalize the DB `choices` jsonb into an ordered [{key,text}] list.
 * Canonical stored shape is an ARRAY of {key, text} objects — order-explicit
 * (jsonb objects don't preserve key order). Elements missing string key/text
 * are dropped rather than surfacing "undefined" choices.
 */
export function normalizeChoices(raw: unknown): QuestionChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { key: string; text: string } =>
        Boolean(c) &&
        typeof c === 'object' &&
        !Array.isArray(c) &&
        typeof (c as { key?: unknown }).key === 'string' &&
        typeof (c as { text?: unknown }).text === 'string',
    )
    .map((c) => ({ key: c.key, text: c.text }));
}

/**
 * All questions for a published test, ordered. Fails soft to []. The quiz
 * runner (Milestone 2) consumes this; Milestone 1 only needs it to exist and
 * to prove the read path is correct.
 */
export async function getQuestionsForTest(slug: string): Promise<Question[]> {
  try {
    const meta = await getPublishedTestMeta(slug);
    if (!meta) return [];
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('questions')
      .select(
        'id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, image_url, difficulty, tags, sort_order',
      )
      .eq('test_id', meta.id)
      .order('sort_order', { ascending: true });
    return ((data as QuestionRow[]) ?? []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: normalizeChoices(q.choices),
      correctKey: q.correct_key,
      explanation: q.explanation,
      cfrCite: q.cfr_cite,
      verifiedDate: q.verified_date,
      imageUrl: q.image_url,
      difficulty: q.difficulty ?? 1,
      tags: q.tags ?? [],
      sortOrder: q.sort_order ?? 0,
    }));
  } catch {
    return [];
  }
}
