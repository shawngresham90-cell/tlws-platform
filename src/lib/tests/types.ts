/**
 * Practice Tests — shared types.
 *
 * The DB (public.tests / public.questions, migrations 007 + 029–031) holds the
 * question banks and attempt logs. The TS catalog (catalog.ts) holds each
 * test's public identity + config. These types are the contract between them.
 */

/**
 * Test categories — mirrors the check constraint on public.tests.category
 * (migration 007). Kept in sync by scripts/test-practice-tests.ts, which reads
 * the migration and asserts this list matches it exactly.
 */
export const TEST_CATEGORIES = [
  'general_knowledge',
  'air_brakes',
  'combination',
  'hazmat',
  'tanker',
  'doubles_triples',
  'passenger',
  'school_bus',
  'pre_trip',
] as const;

export type TestCategory = (typeof TEST_CATEGORIES)[number];

/** The two ways a driver can take a test. Study reveals answers inline; Timed defers them. */
export type TestMode = 'study' | 'timed';

/**
 * Registry entry — the TS source of truth for a test's public identity and
 * config. Everything the hub and landing pages render comes from here, so a
 * test's page is live and crawlable before its question bank is seeded (the
 * same pattern the store and directory use).
 */
export type TestDefinition = {
  /** URL slug, kebab-case (e.g. "general-knowledge"). */
  slug: string;
  /** DB category enum value (e.g. "general_knowledge"). */
  category: TestCategory;
  title: string;
  /** Hub card copy. */
  shortDescription: string;
  heroTitle: string;
  heroIntro: string;
  /** CDL endorsement letter (H, N, T, P, S) or null for the base permit. */
  endorsementCode: string | null;
  icon: string;
  /**
   * The bank size shown on a coming-soon landing before the bank is seeded.
   * Every attempt serves the FULL seeded bank (there is no per-attempt
   * sampling), so keep this equal to the seed's question count.
   */
  questionCountTarget: number;
  /** Passing score percent (CDL standard is 80). */
  passThresholdPct: number;
  /** Timed-mode limit in seconds; null = untimed. */
  timeLimitSeconds: number | null;
  modes: TestMode[];
  /** Knowledge Center category to cross-link (integration is a later milestone). */
  relatedKcCategorySlug: string | null;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

/**
 * One answer option. The DB `choices` jsonb is stored as an ARRAY of these
 * objects — order-explicit, because jsonb objects do not preserve key order.
 */
export type QuestionChoice = { key: string; text: string };

/** A question as read from public.questions and normalized for the client. */
export type Question = {
  id: string;
  prompt: string;
  choices: QuestionChoice[];
  correctKey: string;
  explanation: string | null;
  cfrCite: string | null;
  verifiedDate: string | null;
  imageUrl: string | null;
  difficulty: number;
  tags: string[];
  sortOrder: number;
};

/** One graded answer within an attempt. */
export type GradedAnswer = {
  questionId: string;
  selectedKey: string | null;
  correctKey: string;
  isCorrect: boolean;
};

/** The result of grading a full attempt (pure — no UI, no DB). */
export type AttemptResult = {
  total: number;
  correct: number;
  scorePct: number;
  passed: boolean;
  answers: GradedAnswer[];
};
