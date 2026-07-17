/**
 * CDL Practice Tests — Milestone 6 (Combination Vehicles) tests.
 *
 * Covers what Milestone 6 added:
 *   - The catalog entry: slug/category/threshold/limit/modes/SEO configured
 *     right, published, and resolving through every catalog helper.
 *   - The seed bank (035): 30 original questions, canonical choices shape,
 *     valid correct keys, real explanations, CDL-manual/49-CFR citations,
 *     verified dates, difficulty, tags, unique prompts + sort orders,
 *     balanced answer keys, idempotent insert, question_count sync.
 *   - Topic coverage: every core combination-vehicles topic is represented.
 *   - Zero-new-UI proof: hub, landing, study, timed, saved pages, and sitemap
 *     all derive from publishedTests()/the catalog.
 *
 * Run:
 *   npx esbuild scripts/test-combination-vehicles.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-combination-vehicles.cjs && node /tmp/test-combination-vehicles.cjs
 */
import { readFileSync } from 'node:fs';
import {
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
const cv = getTest('combination-vehicles');
check('combination-vehicles exists in the catalog', cv !== undefined);
check('combination-vehicles is published', cv?.isPublished === true);
check('category is combination (matches the DB check constraint)', cv?.category === 'combination');
check('pass threshold is 80%', cv?.passThresholdPct === 80);
check('timed limit is 30 minutes', cv?.timeLimitSeconds === 30 * 60);
check(
  'both modes ship',
  cv?.modes.includes('study') === true && cv?.modes.includes('timed') === true,
);
check('timedAvailable gates true', cv !== undefined && timedAvailable(cv));
check(
  'questionCountTarget matches the seeded bank (full bank served per attempt)',
  cv?.questionCountTarget === 30,
);
check(
  'SEO title is unique across the catalog',
  cv !== undefined && publishedTests().filter((t) => t.seoTitle === cv.seoTitle).length === 1,
);
check(
  'SEO description is unique across the catalog',
  cv !== undefined &&
    publishedTests().filter((t) => t.seoDescription === cv.seoDescription).length === 1,
);
check('hero copy is Class-A focused', /class a/i.test(cv?.heroIntro ?? ''));
check(
  'getTestByCategory resolves combination',
  getTestByCategory('combination')?.slug === 'combination-vehicles',
);
check(
  'hrefs derive from the slug',
  testHref('combination-vehicles') === '/practice-tests/combination-vehicles',
);
check(
  'study href',
  studyHref('combination-vehicles') === '/practice-tests/combination-vehicles/study',
);
check(
  'timed href',
  timedHref('combination-vehicles') === '/practice-tests/combination-vehicles/timed',
);
check(
  'combination-vehicles is published, listed after GK and Air Brakes',
  publishedTests().findIndex((t) => t.slug === 'combination-vehicles') === 2,
);
check(
  'existing tests untouched and ordered (GK first, then Air Brakes)',
  publishedTests()[0]?.slug === 'general-knowledge' &&
    publishedTests()[1]?.slug === 'air-brakes' &&
    getTest('air-brakes')?.timeLimitSeconds === 25 * 60 &&
    getTest('general-knowledge')?.timeLimitSeconds === 50 * 60,
);
check('unknown slugs still resolve to undefined (404 path)', getTest('no-such-test') === undefined);

// ── 2. Seed bank sanity (parse the SQL — mirrors the 032/034 checks) ────────
const seed = read('supabase/migrations/035_seed_combination_vehicles.sql');
check(
  'seed is idempotent (skips when bank non-empty)',
  /if exists \(select 1 from public\.questions where test_id = v_test\)/.test(seed),
);
check('seed inserts the test row if absent', /on conflict \(slug\) do nothing/.test(seed));
check('seed test slug matches the catalog join key', /'combination-vehicles'/.test(seed));
check(
  'seed contains no destructive statements (purely additive)',
  !/drop table|drop column|truncate|delete from public\./i.test(seed),
);

const blocks = seed.split('(v_test,').slice(1);
check('seed contains at least 25 questions', blocks.length >= 25, blocks.length);
check('seed contains exactly 30 questions', blocks.length === 30, blocks.length);

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
const keyCounts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
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
  if (keyMatch) keyCounts[keyMatch[1]]++;

  const afterKey = block.split(/::jsonb,\s*'[a-d]',/)[1] ?? '';
  const explanationMatch = afterKey.match(/'((?:[^']|'')+)'/);
  if (!explanationMatch || explanationMatch[1].length < 40) allExplained = false;

  if (!/'(49 CFR [0-9.()a-z]+|CDL Manual §[0-9.]+)'/.test(block)) allCited = false;
  if (!/'2026-07-17'/.test(block)) allVerified = false;

  const diffMatch = block.match(/'2026-07-17',\s*([0-9]+),/);
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
check('every question is verified 2026-07-17', allVerified);
check('every difficulty is 1..3', allDifficulty);
check('every question has tags', allTagged);
check(
  'prompts are unique',
  prompts.size === blocks.length,
  `${prompts.size} unique of ${blocks.length}`,
);
check(
  'sort orders are unique and complete 1..30',
  sortOrders.size === 30 && Math.min(...sortOrders) === 1 && Math.max(...sortOrders) === 30,
);
check(
  'every answer position (a–d) is correct at least 3 times',
  Object.values(keyCounts).every((n) => n >= 3),
  JSON.stringify(keyCounts),
);
check('seed keeps question_count in sync', /set question_count = \(select count\(\*\)/.test(seed));

// ── 3. Topic coverage — the core combination-vehicles topics ────────────────
const topics: [string, boolean][] = [
  ['rollover prevention', allTags.has('rollover')],
  ['gentle steering / rearward amplification', allTags.has('steering')],
  ['off-tracking + turning', allTags.has('off-tracking') && allTags.has('turning')],
  ['braking / stopping distance (bobtail)', allTags.has('stopping-distance')],
  ['trailer skids / jackknife', allTags.has('jackknife')],
  ['railroad crossings', allTags.has('railroad')],
  ['backing with a trailer', allTags.has('backing')],
  ['service + emergency air lines', allTags.has('air-lines')],
  ['tractor protection valve', allTags.has('tractor-protection')],
  ['trailer hand valve', allTags.has('hand-valve')],
  ['trailer emergency brakes', allTags.has('emergency-brakes')],
  ['trailer ABS', allTags.has('abs')],
  ['coupling', allTags.has('coupling')],
  ['uncoupling', allTags.has('uncoupling')],
  ['landing gear', allTags.has('landing-gear')],
  ['fifth wheel', allTags.has('fifth-wheel')],
  ['pre-trip inspection checks', allTags.has('inspection')],
];
for (const [topic, covered] of topics) check(`topic covered: ${topic}`, covered);
check(
  'the memorized specifics appear (red/blue lines, 20-45 psi, tug test, glad hands)',
  /red/i.test(seed) &&
    /blue/i.test(seed) &&
    seed.includes('20 to 45 psi') &&
    /tug test/i.test(seed) &&
    /glad hands/i.test(seed),
);

// ── 4. Zero new UI — every surface derives from the catalog ─────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check('hub renders from publishedTests()', hub.includes('publishedTests()'));
check(
  'hub has no hardcoded per-test assumptions',
  !/general-knowledge|air-brakes|combination-vehicles/.test(hub),
);

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
  'saved pages group ALL published banks (combination joins free)',
  read('src/lib/tests/queries.ts').includes('publishedTests()') &&
    read('src/app/(learn)/practice-tests/bookmarks/page.tsx').includes('getPublishedBanks') &&
    read('src/app/(learn)/practice-tests/missed/page.tsx').includes('getPublishedBanks'),
);
check(
  'sitemap derives test URLs from publishedTests()',
  /for \(const test of publishedTests\(\)\)/.test(read('src/app/sitemap.ts')),
);

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nCombination Vehicles tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
