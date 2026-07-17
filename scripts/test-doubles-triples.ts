/**
 * CDL Practice Tests — Doubles & Triples milestone tests.
 *
 * Covers what the Doubles & Triples milestone added:
 *   - The catalog entry: slug/category/endorsement/threshold/limit/modes/SEO
 *     configured right, published, and resolving through every catalog helper.
 *   - The seed bank (041): 32 original questions, canonical choices shape,
 *     valid correct keys, real explanations, CDL-manual/49-CFR citations,
 *     verified dates, difficulty, tags, unique prompts + sort orders,
 *     balanced answer keys, no systematic longest-answer bias, idempotent
 *     insert, question_count sync.
 *   - Topic coverage: every required doubles/triples topic is represented.
 *   - Zero-new-UI proof: hub, landing, study, timed, saved pages, sitemap,
 *     AND the M7 admin Tests module all derive from the catalog.
 *
 * Run:
 *   npx esbuild scripts/test-doubles-triples.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-doubles-triples.cjs && node /tmp/test-doubles-triples.cjs
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
const dt = getTest('doubles-triples');
check('doubles-triples exists in the catalog', dt !== undefined);
check('doubles-triples is published', dt?.isPublished === true);
check(
  'category is doubles_triples (matches the DB check constraint)',
  dt?.category === 'doubles_triples',
);
check('endorsement code is T', dt?.endorsementCode === 'T');
check('pass threshold is 80%', dt?.passThresholdPct === 80);
check('timed limit is 25 minutes', dt?.timeLimitSeconds === 25 * 60);
check(
  'both modes ship',
  dt?.modes.includes('study') === true && dt?.modes.includes('timed') === true,
);
check('timedAvailable gates true', dt !== undefined && timedAvailable(dt));
check(
  'questionCountTarget matches the seeded bank (full bank served per attempt)',
  dt?.questionCountTarget === 32,
);
check(
  'SEO title is unique across the catalog',
  dt !== undefined && publishedTests().filter((t) => t.seoTitle === dt.seoTitle).length === 1,
);
check(
  'SEO description is unique across the catalog',
  dt !== undefined &&
    publishedTests().filter((t) => t.seoDescription === dt.seoDescription).length === 1,
);
check('hero copy is endorsement-focused', /endorsement/i.test(dt?.heroIntro ?? ''));
check(
  'getTestByCategory resolves doubles-triples',
  getTestByCategory('doubles_triples')?.slug === 'doubles-triples',
);
check(
  'hrefs derive from the slug',
  testHref('doubles-triples') === '/practice-tests/doubles-triples',
);
check('study href', studyHref('doubles-triples') === '/practice-tests/doubles-triples/study');
check('timed href', timedHref('doubles-triples') === '/practice-tests/doubles-triples/timed');
check(
  'doubles-triples is published, listed after GK, Air Brakes, Combination, Hazmat, Tanker',
  publishedTests().findIndex((t) => t.slug === 'doubles-triples') === 5,
);
check(
  'existing tests untouched and ordered (GK, Air Brakes, Combination, Hazmat, Tanker)',
  publishedTests()[0]?.slug === 'general-knowledge' &&
    publishedTests()[1]?.slug === 'air-brakes' &&
    publishedTests()[2]?.slug === 'combination-vehicles' &&
    publishedTests()[3]?.slug === 'hazmat' &&
    publishedTests()[4]?.slug === 'tanker' &&
    getTest('general-knowledge')?.timeLimitSeconds === 50 * 60 &&
    getTest('air-brakes')?.timeLimitSeconds === 25 * 60 &&
    getTest('combination-vehicles')?.timeLimitSeconds === 30 * 60 &&
    getTest('hazmat')?.questionCountTarget === 35 &&
    getTest('tanker')?.questionCountTarget === 32,
);
check('unknown slugs still resolve to undefined (404 path)', getTest('no-such-test') === undefined);

// ── 2. Seed bank sanity (parse the SQL — mirrors the 036/039 checks) ────────
const seed = read('supabase/migrations/041_seed_doubles_triples_practice_test.sql');
check(
  'seed is idempotent (skips when bank non-empty)',
  /if exists \(select 1 from public\.questions where test_id = v_test\)/.test(seed),
);
check('seed inserts the test row if absent', /on conflict \(slug\) do nothing/.test(seed));
check('seed test slug matches the catalog join key', /values \(\s*'doubles-triples',/.test(seed));
check(
  'seed row uses the doubles_triples DB category (matches the catalog + constraint)',
  /values \(\s*'doubles-triples',[\s\S]*?'doubles_triples',\s*\n?\s*true,/.test(seed),
);
check(
  'seed contains no destructive statements (purely additive)',
  !/drop table|drop column|truncate|delete from public\./i.test(seed),
);

const blocks = seed.split('(v_test,').slice(1);
check('seed contains at least 30 questions', blocks.length >= 30, blocks.length);
check('seed contains exactly 32 questions', blocks.length === 32, blocks.length);

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
let correctIsLongest = 0;
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
  if (keyMatch && choices.length === 4) {
    const keyLen = choices.find((c) => c.key === keyMatch[1])!.text.length;
    const maxOther = Math.max(
      ...choices.filter((c) => c.key !== keyMatch[1]).map((c) => c.text.length),
    );
    if (keyLen > maxOther) correctIsLongest++;
  }

  const afterKey = block.split(/::jsonb,\s*'[a-d]',/)[1] ?? '';
  const explanationMatch = afterKey.match(/'((?:[^']|'')+)'/);
  if (!explanationMatch || explanationMatch[1].length < 40) allExplained = false;

  if (!/'(49 CFR 3(83|93)\.[0-9]+|CDL Manual §[67]\.[0-9]+)'/.test(block)) allCited = false;
  if (!/'2026-07-17'/.test(block)) allVerified = false;

  const diffMatch = block.match(/'2026-07-17',\s*([0-9]+),/);
  if (!diffMatch || Number(diffMatch[1]) < 1 || Number(diffMatch[1]) > 3) allDifficulty = false;

  const tagsMatch = block.match(/'\{([a-z0-9,-]+)\}'/);
  if (!tagsMatch || tagsMatch[1].length === 0) allTagged = false;
  else for (const t of tagsMatch[1].split(',')) allTags.add(t);

  const sortMatch = block.match(/'\{[a-z0-9,-]+\}',\s*([0-9]+)\)/);
  if (sortMatch) sortOrders.add(Number(sortMatch[1]));
}
check('every question uses the canonical array choices shape', allShapesValid);
check('every question has exactly four choices', allFourChoices);
check('every correct_key exists among its choices (no orphans)', allKeysValid);
check('every question has a real explanation (40+ chars)', allExplained);
check(
  'every question cites the CDL Manual doubles section (§7), the combination §6, or 49 CFR Part 383/393 (zero uncited)',
  allCited,
);
check('every question is verified 2026-07-17', allVerified);
check('every difficulty is 1..3', allDifficulty);
check('every question has tags', allTagged);
check(
  'prompts are unique',
  prompts.size === blocks.length,
  `${prompts.size} unique of ${blocks.length}`,
);
check(
  'sort orders are unique and complete 1..32',
  sortOrders.size === 32 && Math.min(...sortOrders) === 1 && Math.max(...sortOrders) === 32,
);
check(
  'answer keys are perfectly balanced (8 each a–d)',
  Object.values(keyCounts).every((n) => n === 8),
  JSON.stringify(keyCounts),
);
check(
  'no systematic longest-answer bias (correct is longest at most 12 of 32)',
  correctIsLongest <= 12,
  `${correctIsLongest}/32`,
);
check('seed keeps question_count in sync', /set question_count = \(select count\(\*\)/.test(seed));
check(
  'seed cites only real Section 7 (7.1–7.4) or the combination §6.2 manual references, and Part 383/393 CFR',
  (seed.match(/'CDL Manual §([0-9.]+)'/g) ?? []).every(
    (c) => /§7\.[1-4]/.test(c) || c.includes('§6.2'),
  ) && (seed.match(/'49 CFR ([0-9]+)\./g) ?? []).every((c) => /'49 CFR 3(83|93)\./.test(c)),
);

// ── 3. Topic coverage — every topic the milestone requires ──────────────────
const topics: [string, boolean][] = [
  ['safe operation of doubles and triples', allTags.has('fundamentals') || allTags.has('driving')],
  ['rearward amplification / crack-the-whip', allTags.has('rearward-amplification')],
  ['rollover risk', allTags.has('rollover')],
  ['steering and lane positioning', allTags.has('steering') || allTags.has('lane-position')],
  ['following distance and stopping', allTags.has('following-distance') && allTags.has('stopping')],
  ['converter dollies', allTags.has('converter-dolly')],
  ['pintle hooks', allTags.has('pintle-hook')],
  ['coupling and uncoupling', allTags.has('coupling')],
  ['trailer air lines / electrical', allTags.has('air-lines')],
  ['shutoff valves', allTags.has('shutoff-valves')],
  ['trailer hand valve', allTags.has('hand-valve')],
  ['tractor protection valve', allTags.has('tractor-protection-valve')],
  ['spring and emergency brakes', allTags.has('spring-brakes') || allTags.has('emergency-brakes')],
  ['inspection of coupling devices', allTags.has('inspection')],
  ['trailer height and alignment', allTags.has('trailer-alignment')],
  ['managing turns and off-tracking', allTags.has('off-tracking') && allTags.has('turns')],
  ['emergency handling', allTags.has('emergency-handling')],
  ['ABS and trailer braking', allTags.has('abs') && allTags.has('brakes')],
  ['endorsement requirements / rules', allTags.has('endorsement') && allTags.has('rules')],
  ['space management', allTags.has('space-management')],
  ['glad hands', allTags.has('glad-hands')],
];
for (const [topic, covered] of topics) check(`topic covered: ${topic}`, covered);
check(
  'the memorized specifics appear (heavier trailer first, rear trailer rolls, empty tank purged n/a)',
  /heavier trailer first|Heavier trailer in front/i.test(seed) &&
    /rear trailer of the set/i.test(seed) &&
    /pintle hook/i.test(seed) &&
    /converter doll/i.test(seed),
);

// ── 4. Zero new UI — every surface derives from the catalog ─────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check('hub renders from publishedTests()', hub.includes('publishedTests()'));
check(
  'hub has no hardcoded per-test assumptions',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat|tanker|doubles-triples/.test(hub),
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
  'saved pages group ALL published banks (doubles-triples joins free)',
  read('src/lib/tests/queries.ts').includes('publishedTests()') &&
    read('src/app/(learn)/practice-tests/bookmarks/page.tsx').includes('getPublishedBanks') &&
    read('src/app/(learn)/practice-tests/missed/page.tsx').includes('getPublishedBanks'),
);
check(
  'sitemap derives test URLs from publishedTests()',
  /for \(const test of publishedTests\(\)\)/.test(read('src/app/sitemap.ts')),
);
check(
  'endorsement badge renders from the catalog field (no doubles-triples-specific UI)',
  read('src/components/test/TestCard.tsx').includes('endorsementCode') &&
    !read('src/components/test/TestCard.tsx').includes('doubles-triples'),
);

// ── 5. Admin Tests module (M7) picks doubles-triples up with zero code changes
const adminLib = read('src/lib/admin/tests.ts');
check(
  'admin overview iterates TEST_CATALOG (doubles-triples appears automatically)',
  adminLib.includes('TEST_CATALOG'),
);
check(
  'admin lib has no per-test hardcoding',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat|tanker|doubles-triples/.test(adminLib),
);
const adminActions = read('src/app/admin/(dashboard)/tests/actions.ts');
check(
  'admin actions stay slug-generic (no per-test hardcoding)',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat|tanker|doubles-triples/.test(
    adminActions,
  ),
);

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nDoubles & Triples tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
