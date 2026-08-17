/**
 * Knowledge Center conversion map. Pure data: which platform destinations a
 * reader in each category is most likely to want next. Rendered by
 * KcNextSteps below the article body — additive; no article content changes.
 * Every href must be a live route (covered by the internal link crawl); only
 * confirmed-live static routes are used here.
 */
export type KcConversion = {
  title: string;
  blurb: string;
  href: string;
  cta: string;
};

const PRACTICE_TESTS: KcConversion = {
  title: 'Practice Tests',
  blurb: 'Drill the CDL general knowledge, air brakes, and endorsement tests free.',
  href: '/practice-tests',
  cta: 'Start a practice test',
};

const PRESCHOOL: KcConversion = {
  title: 'CDL Pre-School',
  blurb: 'Prepare before CDL school — modules built the driver way.',
  href: '/cdl-pre-school',
  cta: 'See the Pre-School',
};

const TRIP_PLANNER: KcConversion = {
  title: 'Trip Planner',
  blurb: 'Truck-legal routing with hours-of-service awareness, free.',
  href: '/trip-planner',
  cta: 'Plan a trip',
};

const DIRECTORY: KcConversion = {
  title: 'Driver Directory',
  blurb: 'Parking, truck stops, scales, and repair — mapped for big rigs.',
  href: '/directory',
  cta: 'Open the directory',
};

const BOOKS: KcConversion = {
  title: 'Driver-Built Books',
  blurb: 'Shawn’s books: DOT survival, discipline, and eating right in the cab.',
  href: '/books',
  cta: 'Browse the books',
};

// Direct academy sub-page destinations (SEO blueprint PR-C): readers of
// CDL-training and career content get the specific page that answers their
// question, not just the hub. Copy states what the pages cover — no dates,
// prices, approvals, or enrollment claims beyond what those pages say.
const ACADEMY_CURRICULUM: KcConversion = {
  title: 'Academy Curriculum',
  blurb: 'The ELDT-built CDL-A curriculum — theory, range, and road time, laid out plainly.',
  href: '/academy/curriculum',
  cta: 'See the curriculum',
};

const ACADEMY_FINANCING: KcConversion = {
  title: 'Academy Financing',
  blurb: 'What CDL training costs and the ways students plan to pay for it.',
  href: '/academy/financing',
  cta: 'See financing options',
};

const DOT_TOOLS: KcConversion = {
  title: 'DOT Tools',
  // Honest framing — the tools are still in verification; the link goes only
  // to the informational landing page.
  blurb: 'Free DOT reference tools — being verified against official sources before release.',
  href: '/dot-tools',
  cta: 'See what’s coming',
};

/**
 * Category slug → the two most relevant next steps, in order.
 *
 * Academy links appear ONLY in the CDL-training/career categories
 * (cdl-training, getting-your-cdl, trucking-careers) where the reader's
 * subject genuinely supports them — compliance, hours-of-service, and
 * health content stays free of school promotion (PR-C rule).
 */
const BY_CATEGORY: Record<string, KcConversion[]> = {
  'dot-compliance': [PRACTICE_TESTS, DOT_TOOLS],
  'hours-of-service': [TRIP_PLANNER, PRACTICE_TESTS],
  'getting-your-cdl': [PRESCHOOL, ACADEMY_FINANCING],
  'cdl-training': [ACADEMY_CURRICULUM, ACADEMY_FINANCING],
  'trucking-careers': [ACADEMY_CURRICULUM, BOOKS],
  'health-on-the-road': [BOOKS, DIRECTORY],
};

const DEFAULT_CONVERSIONS: KcConversion[] = [PRACTICE_TESTS, DIRECTORY];

/** Next steps for a category; unknown categories get safe defaults. */
export function conversionsFor(categorySlug: string): KcConversion[] {
  return Object.hasOwn(BY_CATEGORY, categorySlug) ? BY_CATEGORY[categorySlug] : DEFAULT_CONVERSIONS;
}
