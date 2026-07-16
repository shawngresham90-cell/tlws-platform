import { createStaticClient } from '@/lib/supabase/static';
import type { Question, QuestionChoice, TestCategory } from './types';

/**
 * Practice Tests data layer — reads published tests and their questions from
 * the DB via the cookieless anon client. RLS (migration 010) is the boundary:
 * anon sees only published tests and their questions. Everything fails SOFT —
 * an unseeded or unreachable DB yields null / empty and the pages render their
 * honest "question bank coming soon" state, never a 500.
 *
 * Answer keys (correct_key + explanation) are intentionally exposed to the
 * client. This is a free study tool; usability beats bank protection. No RPC,
 * no hidden keys — decided and finalized in the Practice Tests blueprint.
 */

type TestMetaRow = { id: string; question_count: number };

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

/** Published test row (id + seeded count) for a category, or null. */
export async function getPublishedTestMeta(category: TestCategory): Promise<TestMetaRow | null> {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('tests')
      .select('id, question_count')
      .eq('category', category)
      .eq('is_published', true)
      .maybeSingle();
    return (data as TestMetaRow) ?? null;
  } catch {
    return null;
  }
}

/** How many questions are actually seeded for a category. 0 when unseeded. */
export async function getSeededQuestionCount(category: TestCategory): Promise<number> {
  const meta = await getPublishedTestMeta(category);
  return meta?.question_count ?? 0;
}

/** Normalize the DB `choices` jsonb into an ordered [{key,text}] list. */
function normalizeChoices(raw: unknown): QuestionChoice[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((c): c is { key: string; text: string } => Boolean(c) && typeof c === 'object')
      .map((c) => ({ key: String(c.key), text: String(c.text) }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([key, text]) => ({
      key,
      text: String(text),
    }));
  }
  return [];
}

/**
 * All questions for a published test, ordered. Fails soft to []. The quiz
 * runner (Milestone 2) consumes this; Milestone 1 only needs it to exist and
 * to prove the read path is correct.
 */
export async function getQuestionsForCategory(category: TestCategory): Promise<Question[]> {
  try {
    const meta = await getPublishedTestMeta(category);
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
