/**
 * CDL Practice Tests — Milestone 5 (Air Brakes) tests.
 *
 * Covers what Milestone 5 added:
 *   - The catalog entry: slug/category/threshold/limit/modes/SEO configured
 *     right, published, and resolving through every catalog helper.
 *   - The seed bank (034): 31 original questions, canonical choices shape,
 *     valid correct keys, real explanations, CDL-manual/49-CFR citations,
 *     verified dates, difficulty, tags, unique prompts + sort orders,
 *     idempotent insert, question_count sync.
 *   - Topic coverage: every core air-brakes topic from the milestone scope is
 *     represented in the bank's tags/prompts.
 *   - Zero-new-UI proof: hub, landing, study, timed, saved pages, and sitemap
 *     all derive from publishedTests()/the catalog — no hardcoded GK-only
 *     assumptions anywhere in the surfaces that must now show two tests.
 *
 * Run:
 *   npx esbuild scripts/test-air-brakes.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-air-brakes.cjs && node /tmp/test-air-brakes.cjs
 */
import { readFileSync } from 'node:fs';
import {
  TEST_CATALOG,
  getTest,
  getTestByCategory,
  publishedTests,
  studyHref,
  testHref,
  timedAvailable,
  timedHref,
} from '@/lib/tests/catalog';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};
const read = (p: string) => readFileSync(p, 'utf8');

// ── 1. Catalog entry ─────────────────────────────────────────────────────────
const ab = getTest('air-brakes');
check('air-brakes exists in the catalog', ab !== undefined);
check('air-brakes is published', ab?.isPublished === true);
check('category is air_brakes (matches the DB check constraint)', ab?.category === 'air_brakes');
check('pass threshold is 80%', ab?.passThresholdPct === 80);
check('timed limit is 25 minutes', ab?.timeLimitSeconds === 25 * 60);
check(
  'both modes ship',
  ab?.modes.includes('study') === true && ab?.modes.includes('timed') === true,
);
check('timedAvailable gates true for air-brakes', ab !== undefined && timedAvailable(ab));
check(
  'SEO title is unique vs General Knowledge',
  ab !== undefined &&
    ab.seoTitle.length > 0 &&
    ab.seoTitle !== getTest('general-knowledge')?.seoTitle,
);
check(
  'SEO description is unique vs General Knowledge',
  ab !== undefined &&
    ab.seoDescription.length > 0 &&
    ab.seoDescription !== getTest('general-knowledge')?.seoDescription,
);
check(
  'hero copy is CDL-focused (mentions the restriction)',
  /restriction/i.test(ab?.heroIntro ?? ''),
);
check(
  'getTestByCategory resolves air_brakes',
  getTestByCategory('air_brakes')?.slug === 'air-brakes',
);
check('hrefs derive from the slug', testHref('air-brakes') === '/practice-tests/air-brakes');
check('study href', studyHref('air-brakes') === '/practice-tests/air-brakes/study');
check('timed href', timedHref('air-brakes') === '/practice-tests/air-brakes/timed');
check('published tests now number 2 (GK + Air Brakes)', publishedTests().length === 2);
check(
  'General Knowledge entry untouched (still first, still 50-question target)',
  publishedTests()[0]?.slug === 'general-knowledge' &&
    getTest('general-knowledge')?.questionCountTarget === 50 &&
    getTest('general-knowledge')?.timeLimitSeconds === 50 * 60,
);
check('unknown slugs still resolve to undefined (404 path)', getTest('no-such-test') === undefined);
check(
  'questionCountTarget matches the seeded bank (full bank is served per attempt)',
  ab?.questionCountTarget === 31,
);

// ── 2. Seed bank sanity (parse the SQL — mirrors the 032 checks) ────────────
const seed = read('supabase/migrations/034_seed_air_brakes.sql');
check(
  'seed is idempotent (skips when bank non-empty)',
  /if exists \(select 1 from public\.questions where test_id = v_test\)/.test(seed),
);
check(
  'seed upserts the test row by slug (insert-if-absent)',
  /on conflict \(slug\) do nothing/.test(seed),
);
check('seed test slug matches the catalog join key', /'air-brakes'/.test(seed));
check(
  'seed contains no destructive statements (purely additive)',
  !/drop table|drop column|truncate|delete from public\./i.test(seed),
);

const blocks = seed.split('(v_test,').slice(1);
check('seed contains at least 25 questions', blocks.length >= 25, blocks.length);
check('seed contains exactly 31 questions', blocks.length === 31, blocks.length);

const prompts = new Set<string>();
const allTags = new Set<string>();
let allShapesValid = true;
let allFourChoices = true;
let allKeysValid = true;
let allExplained = true;
let allCited = true;
let allVerified = true;
let allDifficulty = true;
let allTagged = true;
const sortOrders = new Set<number>();
for (const block of blocks) {
  const promptMatch = block.match(/'((?:[^']|'')+)'/);
  if (promptMatch) prompts.add(promptMatch[1]);

  const choicesMatch = block.match(/'(\[\{(?:[^']|'')*\}\])'::jsonb/);
  let choices: { key: string; text: string }[] = [];
  if (!choicesMatch) allShapesValid = false;
  else {
    try {
      choices = JSON.parse(choicesMatch[1].replace(/''/g, "'"));
      if (
        !Array.isArray(choices) ||
        !choices.every((c) => typeof c.key === 'string' && typeof c.text === 'string')
      ) {
        allShapesValid = false;
      }
      if (choices.length !== 4) allFourChoices = false;
    } catch {
      allShapesValid = false;
    }
  }

  const keyMatch = block.match(/::jsonb,\s*'([a-d])'/);
  if (!keyMatch || !choices.some((c) => c.key === keyMatch[1])) allKeysValid = false;

  const afterKey = block.split(/::jsonb,\s*'[a-d]',/)[1] ?? '';
  const explanationMatch = afterKey.match(/'((?:[^']|'')+)'/);
  if (!explanationMatch || explanationMatch[1].length < 40) allExplained = false;

  if (!/'(49 CFR [0-9.()a-z]+|CDL Manual §[0-9.]+)'/.test(block)) allCited = false;
  if (!/'2026-07-16'/.test(block)) allVerified = false;

  const diffMatch = block.match(/'2026-07-16',\s*([0-9]+),/);
  if (!diffMatch || Number(diffMatch[1]) < 1 || Number(diffMatch[1]) > 3) allDifficulty = false;

  const tagsMatch = block.match(/'\{([a-z0-9,-]+)\}'/);
  if (!tagsMatch || tagsMatch[1].length === 0) allTagged = false;
  else for (const t of tagsMatch[1].split(',')) allTags.add(t);

  const sortMatch = block.match(/,\s*([0-9]+)\)[,;]/);
  if (sortMatch) sortOrders.add(Number(sortMatch[1]));
}
check('every question uses the canonical array choices shape', allShapesValid);
check('every question has exactly four choices', allFourChoices);
check('every correct_key exists among its choices (no orphans)', allKeysValid);
check('every question has a real explanation (40+ chars)', allExplained);
check('every question cites 49 CFR or the CDL Manual (zero uncited)', allCited);
check('every question is verified 2026-07-16', allVerified);
check('every difficulty is 1..3', allDifficulty);
check('every question has tags', allTagged);
check(
  'prompts are unique',
  prompts.size === blocks.length,
  `${prompts.size} unique of ${blocks.length}`,
);
check(
  'sort orders are unique and complete 1..31',
  sortOrders.size === 31 && Math.min(...sortOrders) === 1 && Math.max(...sortOrders) === 31,
);
check('seed keeps question_count in sync', /set question_count = \(select count\(\*\)/.test(seed));

// Answer-key distribution: a lopsided bank (e.g. d never correct) lets a
// test-wise student game the choices without knowledge.
{
  const keyCounts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (const block of blocks) {
    const k = block.match(/::jsonb,\s*'([a-d])'/)?.[1];
    if (k) keyCounts[k]++;
  }
  check(
    'every answer position (a–d) is correct at least 3 times',
    Object.values(keyCounts).every((n) => n >= 3),
    JSON.stringify(keyCounts),
  );
}

// ── 3. Topic coverage — every core air-brakes topic from the scope ──────────
const seedLower = seed.toLowerCase();
const topics: [string, boolean][] = [
  ['system components', allTags.has('components')],
  ['air compressor', allTags.has('compressor')],
  ['governor', allTags.has('governor')],
  ['air tanks and drains', allTags.has('tanks')],
  ['safety valve', allTags.has('safety-valve')],
  ['brake chambers', allTags.has('brake-chambers')],
  ['slack adjusters', allTags.has('slack-adjusters')],
  ['spring brakes', allTags.has('spring-brakes')],
  ['parking brakes', allTags.has('parking-brakes')],
  ['low-air warning', allTags.has('low-air-warning')],
  ['pressure buildup', allTags.has('pressure-buildup')],
  ['leakage tests', allTags.has('leakage-tests')],
  ['dual air systems', allTags.has('dual-systems')],
  ['ABS', allTags.has('abs')],
  ['stopping distance', allTags.has('stopping-distance')],
  ['brake fade', allTags.has('brake-fade')],
  ['mountain driving', allTags.has('mountain-driving')],
  ['emergency braking', allTags.has('emergency-braking')],
  ['pre-trip air-brake inspection', allTags.has('inspection')],
];
for (const [topic, covered] of topics) check(`topic covered: ${topic}`, covered);
check(
  'the memorized numbers appear (125/150/60/20-45 psi, 45s, 100 psi)',
  seedLower.includes('125 psi') &&
    seedLower.includes('150 psi') &&
    seedLower.includes('60 psi') &&
    seedLower.includes('45 psi') &&
    seedLower.includes('45 seconds') &&
    seedLower.includes('100 psi'),
);

// ── 4. Zero new UI — every surface derives from the catalog ─────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check(
  'hub renders from publishedTests() (auto-includes Air Brakes)',
  hub.includes('publishedTests()'),
);
check('hub has no hardcoded GK-only assumptions', !/general-knowledge/.test(hub));

const landing = read('src/app/(learn)/practice-tests/[slug]/page.tsx');
check('landing statics generate from publishedTests()', landing.includes('publishedTests()'));
check('landing 404s unknown slugs via getTest + notFound', landing.includes('notFound()'));

for (const [label, p] of [
  ['study', 'src/app/(learn)/practice-tests/[slug]/study/page.tsx'],
  ['timed', 'src/app/(learn)/practice-tests/[slug]/timed/page.tsx'],
] as const) {
  const src = read(p);
  check(`${label} route statics generate from publishedTests()`, src.includes('publishedTests()'));
  check(`${label} route 404s unknown slugs`, src.includes('notFound()'));
}

check(
  'saved pages group ALL published banks (bookmarks/misses get Air Brakes free)',
  read('src/lib/tests/queries.ts').includes('publishedTests()') &&
    read('src/app/(learn)/practice-tests/bookmarks/page.tsx').includes('getPublishedBanks') &&
    read('src/app/(learn)/practice-tests/missed/page.tsx').includes('getPublishedBanks'),
);
check(
  'sitemap derives test URLs from publishedTests() (Air Brakes lands automatically)',
  /for \(const test of publishedTests\(\)\)/.test(read('src/app/sitemap.ts')),
);

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nAir Brakes tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
