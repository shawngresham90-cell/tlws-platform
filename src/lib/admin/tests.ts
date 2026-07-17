import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { TEST_CATALOG, getTest } from '@/lib/tests/catalog';
import type { TestDefinition } from '@/lib/tests/types';

/**
 * Admin Tests module data layer (Milestone 7 — edit-only first version).
 *
 * Division of truth, unchanged from the student side:
 *   - The TS catalog owns each test's public identity and config (title,
 *     threshold, timed limit, SEO). The admin module READS it, never edits it.
 *   - The DB owns the question content and the live `is_published` switch
 *     that RLS gates anon reads on. The admin module edits question rows
 *     by UUID (update-only — creation stays in migrations, deletion doesn't
 *     exist) and flips `is_published`.
 *
 * Every read here uses the service-role client so admins can inspect
 * unpublished banks; every write goes through the actions file, which gates
 * on requireAdmin() first. Anon permissions are untouched.
 */

export type AdminTestRow = {
  def: TestDefinition;
  dbId: string | null;
  dbPublished: boolean | null;
  seededCount: number;
};

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

/** Every catalog test joined with its live DB row (id, published, count). */
export async function getAdminTests(): Promise<{ rows: AdminTestRow[]; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('tests').select('id, slug, is_published');
    if (error) return { rows: [], error: error.message };
    const bySlug = new Map(
      ((data ?? []) as { id: string; slug: string; is_published: boolean }[]).map((r) => [
        r.slug,
        r,
      ]),
    );

    const rows: AdminTestRow[] = [];
    for (const def of TEST_CATALOG) {
      const db = bySlug.get(def.slug);
      let seededCount = 0;
      if (db) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('test_id', db.id);
        seededCount = count ?? 0;
      }
      rows.push({
        def,
        dbId: db?.id ?? null,
        dbPublished: db?.is_published ?? null,
        seededCount,
      });
    }
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

/** The full bank for one test, most-missed first within sort order intact. */
export async function getAdminQuestions(
  slug: string,
): Promise<{ test: AdminTestRow | null; questions: AdminQuestionRow[]; error: string | null }> {
  const def = getTest(slug);
  if (!def) return { test: null, questions: [], error: null };
  try {
    const supabase = createAdminClient();
    const { data: testRow, error: testError } = await supabase
      .from('tests')
      .select('id, is_published')
      .eq('slug', slug)
      .maybeSingle();
    if (testError) return { test: null, questions: [], error: testError.message };
    if (!testRow) {
      return {
        test: { def, dbId: null, dbPublished: null, seededCount: 0 },
        questions: [],
        error: null,
      };
    }
    const { data, error } = await supabase
      .from('questions')
      .select(
        'id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order, miss_count',
      )
      .eq('test_id', (testRow as { id: string }).id)
      .order('sort_order', { ascending: true });
    if (error) return { test: null, questions: [], error: error.message };
    const questions = ((data ?? []) as AdminQuestionRow[]).map((q) => ({
      ...q,
      tags: q.tags ?? [],
      miss_count: q.miss_count ?? 0,
    }));
    return {
      test: {
        def,
        dbId: (testRow as { id: string }).id,
        dbPublished: (testRow as { is_published: boolean }).is_published,
        seededCount: questions.length,
      },
      questions,
      error: null,
    };
  } catch (e) {
    return { test: null, questions: [], error: (e as Error).message };
  }
}

/** One question by UUID (with its test slug verified against the catalog). */
export async function getAdminQuestion(
  slug: string,
  questionId: string,
): Promise<{ question: AdminQuestionRow | null; error: string | null }> {
  const def = getTest(slug);
  if (!def) return { question: null, error: null };
  try {
    const supabase = createAdminClient();
    const { data: testRow } = await supabase
      .from('tests')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!testRow) return { question: null, error: null };
    const { data, error } = await supabase
      .from('questions')
      .select(
        'id, prompt, choices, correct_key, explanation, cfr_cite, verified_date, difficulty, tags, sort_order, miss_count',
      )
      .eq('id', questionId)
      .eq('test_id', (testRow as { id: string }).id)
      .maybeSingle();
    if (error) return { question: null, error: error.message };
    if (!data) return { question: null, error: null };
    const q = data as AdminQuestionRow;
    return { question: { ...q, tags: q.tags ?? [], miss_count: q.miss_count ?? 0 }, error: null };
  } catch (e) {
    return { question: null, error: (e as Error).message };
  }
}

/* ── Edit validation — the blueprint's hard content rules, enforced ───────── */

export const CHOICE_KEYS = ['a', 'b', 'c', 'd'] as const;

/** Citation must be a real source reference: 49 CFR or the CDL manual. */
const CITE_PATTERN = /^(49 CFR \S.*|CDL Manual §\S.*)$/;

const questionEditSchema = z
  .object({
    prompt: z.string().trim().min(10, 'Prompt must be at least 10 characters'),
    choice_a: z.string().trim().min(1, 'Choice A cannot be empty'),
    choice_b: z.string().trim().min(1, 'Choice B cannot be empty'),
    choice_c: z.string().trim().min(1, 'Choice C cannot be empty'),
    choice_d: z.string().trim().min(1, 'Choice D cannot be empty'),
    correct_key: z.enum(CHOICE_KEYS, {
      errorMap: () => ({ message: 'Correct key must be a, b, c, or d' }),
    }),
    explanation: z.string().trim().min(20, 'Explanation must be at least 20 characters'),
    cfr_cite: z
      .string()
      .trim()
      .min(1, 'Citation is required')
      .regex(CITE_PATTERN, 'Citation must start with "49 CFR" or "CDL Manual §"'),
    verified_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Verified date must be YYYY-MM-DD')
      .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), 'Invalid date'),
    difficulty: z.coerce.number().int().min(1, 'Difficulty is 1–3').max(3, 'Difficulty is 1–3'),
    tags: z
      .string()
      .trim()
      .min(1, 'At least one tag is required')
      .refine(
        (raw) => raw.split(',').every((t) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.trim())),
        'Tags must be comma-separated kebab-case words',
      ),
  })
  .strict();

export type QuestionEdit = {
  prompt: string;
  choices: { key: string; text: string }[];
  correct_key: string;
  explanation: string;
  cfr_cite: string;
  verified_date: string;
  difficulty: number;
  tags: string[];
};

/**
 * Parse + validate the edit form. Blocks every invalid-edit class the
 * milestone names: missing citation, missing/garbled verified date, malformed
 * or empty choices, a correct key outside the choices, empty explanation.
 */
export function parseQuestionForm(
  formData: FormData,
): { data: QuestionEdit; error?: undefined } | { data?: undefined; error: string } {
  const raw = {
    prompt: String(formData.get('prompt') ?? ''),
    choice_a: String(formData.get('choice_a') ?? ''),
    choice_b: String(formData.get('choice_b') ?? ''),
    choice_c: String(formData.get('choice_c') ?? ''),
    choice_d: String(formData.get('choice_d') ?? ''),
    correct_key: String(formData.get('correct_key') ?? ''),
    explanation: String(formData.get('explanation') ?? ''),
    cfr_cite: String(formData.get('cfr_cite') ?? ''),
    verified_date: String(formData.get('verified_date') ?? ''),
    difficulty: String(formData.get('difficulty') ?? ''),
    tags: String(formData.get('tags') ?? ''),
  };
  const parsed = questionEditSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first.path.join('.') || 'form';
    return { error: `${field}: ${first.message}` };
  }
  const d = parsed.data;
  return {
    data: {
      prompt: d.prompt,
      // Canonical ordered array shape (029) — keys are FIXED a–d, so the
      // correct_key enum check above guarantees no orphan keys.
      choices: [
        { key: 'a', text: d.choice_a },
        { key: 'b', text: d.choice_b },
        { key: 'c', text: d.choice_c },
        { key: 'd', text: d.choice_d },
      ],
      correct_key: d.correct_key,
      explanation: d.explanation,
      cfr_cite: d.cfr_cite,
      verified_date: d.verified_date,
      difficulty: d.difficulty,
      tags: d.tags.split(',').map((t) => t.trim()),
    },
  };
}
