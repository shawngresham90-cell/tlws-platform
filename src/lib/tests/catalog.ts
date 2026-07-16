import type { TestCategory, TestDefinition } from './types';

/**
 * The practice-test catalog — one source of truth for each test's public
 * identity and config (mirrors the store and directory category registries).
 * The DB holds the questions and attempt logs; this holds everything the hub
 * and landing pages render, so a test's page is live and crawlable before its
 * question bank is seeded.
 *
 * Milestone 1 ships ONLY General Knowledge. The other seven endorsements
 * (Air Brakes, Combination, Hazmat, Tanker, Doubles & Triples, Passenger,
 * School Bus) are deliberately deferred — each is a later milestone. Lighting
 * one up is adding an entry here, then seeding its bank.
 */

/** CDL passing standard, reused as the default threshold. */
export const PASS_THRESHOLD_DEFAULT = 80;

export const TEST_CATALOG: TestDefinition[] = [
  {
    slug: 'general-knowledge',
    category: 'general_knowledge',
    title: 'General Knowledge',
    shortDescription:
      'The core CDL permit test every driver takes first — vehicle control, safe operating, and the rules of the road.',
    heroTitle: 'Pass the General Knowledge permit test the first time',
    heroIntro:
      'The base CDL knowledge exam every applicant must pass before any endorsement. Every question is written against the current CDL manual and 49 CFR, with the citation attached — miss one, see exactly why.',
    endorsementCode: null,
    icon: '📖',
    questionCountTarget: 50,
    passThresholdPct: PASS_THRESHOLD_DEFAULT,
    timeLimitSeconds: 50 * 60, // 50 minutes in Timed mode
    modes: ['study', 'timed'],
    relatedKcCategorySlug: null, // Knowledge Center integration is a later milestone
    seoTitle: 'Free CDL General Knowledge Practice Test (2026) | Trucking Life with Shawn',
    seoDescription:
      'Free CDL General Knowledge practice test. Real permit-style questions written against the CDL manual and 49 CFR — each with the citation and a plain-English explanation. Study at your own pace.',
    isPublished: true,
  },
];

const BY_SLUG = new Map(TEST_CATALOG.map((t) => [t.slug, t]));
const BY_CATEGORY = new Map(TEST_CATALOG.map((t) => [t.category, t]));

/** Published tests only, in display order (registry order). */
export function publishedTests(): TestDefinition[] {
  return TEST_CATALOG.filter((t) => t.isPublished);
}

export function getTest(slug: string): TestDefinition | undefined {
  return BY_SLUG.get(slug);
}

export function getTestByCategory(category: string): TestDefinition | undefined {
  return BY_CATEGORY.get(category as TestCategory);
}

/** Canonical path for a test landing page. */
export function testHref(slug: string): string {
  return `/practice-tests/${slug}`;
}
