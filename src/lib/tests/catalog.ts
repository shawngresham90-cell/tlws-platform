import type { TestCategory, TestDefinition } from './types';

/**
 * The practice-test catalog — one source of truth for each test's public
 * identity and config (mirrors the store and directory category registries).
 * The DB holds the questions and attempt logs; this holds everything the hub
 * and landing pages render, so a test's page is live and crawlable before its
 * question bank is seeded.
 *
 * Milestone 1 shipped ONLY General Knowledge; Milestone 5 added Air Brakes;
 * Milestone 6 added Combination Vehicles; Milestone 8 added Hazmat; the
 * Tanker milestone adds Tanker (N). The remaining knowledge tests
 * (Doubles & Triples, Passenger, School Bus) are deliberately deferred —
 * each is a later milestone. Lighting one up is adding an entry here, then
 * seeding its bank.
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
    /** Timed Test length — the countdown anchor for the exam simulation. */
    timeLimitSeconds: 50 * 60,
    // Both modes are shipped: Study (instant feedback) and Timed (exam
    // simulation, Milestone 3). Only list a mode a student can take today.
    modes: ['study', 'timed'],
    relatedKcCategorySlug: null, // Knowledge Center integration is a later milestone
    seoTitle: 'Free CDL General Knowledge Practice Test (2026) | Trucking Life with Shawn',
    seoDescription:
      'Free CDL General Knowledge practice test. Real permit-style questions written against the CDL manual and 49 CFR — each with the citation and a plain-English explanation. Study at your own pace.',
    isPublished: true,
  },
  {
    slug: 'air-brakes',
    category: 'air_brakes',
    title: 'Air Brakes',
    shortDescription:
      'The knowledge test that keeps the air-brake restriction off your CDL — components, gauges, warning signals, and the braking techniques that matter on grade.',
    heroTitle: 'Pass the Air Brakes knowledge test and skip the L restriction',
    heroIntro:
      'Fail this test (or skip it) and your CDL carries a restriction barring air-braked vehicles — which is nearly every truck worth driving. Every question here is written against the CDL manual air-brakes section and 49 CFR, with the citation attached: compressor to spring brakes, pump-down checks to stab braking.',
    // Air brakes is a restriction-removal knowledge test, not an endorsement —
    // passing it removes the L/Z restriction rather than adding a code.
    endorsementCode: null,
    icon: '🛑',
    questionCountTarget: 31,
    passThresholdPct: PASS_THRESHOLD_DEFAULT,
    /** Timed Test length — the countdown anchor for the exam simulation. */
    timeLimitSeconds: 25 * 60,
    modes: ['study', 'timed'],
    relatedKcCategorySlug: null,
    seoTitle: 'Free CDL Air Brakes Practice Test (2026) | Trucking Life with Shawn',
    seoDescription:
      'Free CDL Air Brakes practice test. Permit-style questions on compressors, governors, spring brakes, leakage checks, and mountain braking — each with the CDL manual or 49 CFR citation and a plain-English explanation.',
    isPublished: true,
  },
  {
    slug: 'combination-vehicles',
    category: 'combination',
    title: 'Combination Vehicles',
    shortDescription:
      'Required for every Class A license — coupling and uncoupling, trailer air lines, the tractor protection system, and keeping a rig upright.',
    heroTitle: 'Pass the Combination Vehicles test and earn your Class A',
    heroIntro:
      'Every Class A applicant must pass this exam — no combination test, no tractor-trailer. These questions are written against the CDL manual combination-vehicles section and 49 CFR, with the citation attached: glad hands to fifth wheels, tractor protection valves to rollover prevention.',
    // A knowledge test required for the Class A license itself — like Air
    // Brakes, passing it adds no endorsement letter.
    endorsementCode: null,
    icon: '🚛',
    questionCountTarget: 30,
    passThresholdPct: PASS_THRESHOLD_DEFAULT,
    /** Timed Test length — the countdown anchor for the exam simulation. */
    timeLimitSeconds: 30 * 60,
    modes: ['study', 'timed'],
    relatedKcCategorySlug: null,
    seoTitle: 'Free CDL Combination Vehicles Practice Test (2026) | Trucking Life with Shawn',
    seoDescription:
      'Free CDL Combination Vehicles practice test for the Class A exam. Questions on coupling, air lines, glad hands, the tractor protection valve, and rollover prevention — each with the CDL manual or 49 CFR citation and a plain-English explanation.',
    isPublished: true,
  },
  {
    slug: 'hazmat',
    category: 'hazmat',
    title: 'Hazmat',
    shortDescription:
      'The H-endorsement knowledge test — hazard classes, placards, shipping papers, and the loading, parking, and emergency rules that keep dangerous cargo legal.',
    heroTitle: 'Pass the Hazmat knowledge test and earn your H endorsement',
    heroIntro:
      'Hazmat freight pays better for a reason: the endorsement takes a TSA background check plus this knowledge exam. Every question here is written against the CDL manual hazardous-materials section and 49 CFR Parts 171–180, with the citation attached — placard tables to shipping-paper format, attendance rules to the ERG.',
    endorsementCode: 'H',
    icon: '☣️',
    questionCountTarget: 35,
    passThresholdPct: PASS_THRESHOLD_DEFAULT,
    /** Timed Test length — the countdown anchor for the exam simulation. */
    timeLimitSeconds: 25 * 60,
    modes: ['study', 'timed'],
    relatedKcCategorySlug: null,
    seoTitle: 'Free CDL Hazmat Practice Test — H Endorsement (2026) | Trucking Life with Shawn',
    seoDescription:
      'Free CDL Hazmat practice test for the H endorsement. Permit-style questions on hazard classes, placards, shipping papers, loading rules, parking, and emergencies — each with the CDL manual or 49 CFR citation and a plain-English explanation.',
    isPublished: true,
  },
  {
    slug: 'tanker',
    category: 'tanker',
    title: 'Tanker',
    shortDescription:
      'The N-endorsement knowledge test — liquid surge, baffles and bulkheads, outage, tank inspection, and the driving that keeps a high-center-of-gravity load upright.',
    heroTitle: 'Pass the Tanker knowledge test and earn your N endorsement',
    heroIntro:
      'Bulk liquid is its own discipline: the weight rides high and the cargo moves on its own. Any rig hauling tanks over 119 gallons apiece that total 1,000 gallons or more needs the N endorsement — and this exam. Every question here is written against the CDL manual tank-vehicles section and 49 CFR Part 383, with the citation attached: surge and baffles to outage, tank inspection to skid recovery.',
    endorsementCode: 'N',
    icon: '🛢️',
    questionCountTarget: 32,
    passThresholdPct: PASS_THRESHOLD_DEFAULT,
    /** Timed Test length — the countdown anchor for the exam simulation. */
    timeLimitSeconds: 25 * 60,
    modes: ['study', 'timed'],
    relatedKcCategorySlug: null,
    seoTitle: 'Free CDL Tanker Practice Test — N Endorsement (2026) | Trucking Life with Shawn',
    seoDescription:
      'Free CDL Tanker practice test for the N endorsement. Permit-style questions on liquid surge, baffled and smooth-bore tanks, outage, tank inspection, and safe tanker driving — each with the CDL manual or 49 CFR citation and a plain-English explanation.',
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

/** Canonical path for a test's Study Mode runner. */
export function studyHref(slug: string): string {
  return `${testHref(slug)}/study`;
}

/** Canonical path for a test's Timed Test runner. */
export function timedHref(slug: string): string {
  return `${testHref(slug)}/timed`;
}

/**
 * A takeable Timed Test needs BOTH the mode flag and a time limit. This is
 * the one condition the landing chooser, the stats tiles, and the /timed
 * route all gate on — never re-derive it inline.
 */
export function timedAvailable(test: TestDefinition): boolean {
  return test.modes.includes('timed') && (test.timeLimitSeconds ?? 0) > 0;
}

// Build-time config guard: a test declaring the timed mode without a time
// limit is a misconfiguration that would otherwise fail silently (hidden
// chooser card, 404ing route). Fail the build loudly instead.
for (const t of TEST_CATALOG) {
  if (t.modes.includes('timed') && !((t.timeLimitSeconds ?? 0) > 0)) {
    throw new Error(
      `Test catalog misconfiguration: "${t.slug}" declares the 'timed' mode without a positive timeLimitSeconds.`,
    );
  }
}
