/**
 * CDL Practice Tests — Milestone 8 (Hazmat) tests.
 *
 * Covers what Milestone 8 added:
 *   - The catalog entry: slug/category/endorsement/threshold/limit/modes/SEO
 *     configured right, published, and resolving through every catalog helper.
 *   - The seed bank (036): 35 original questions, canonical choices shape,
 *     valid correct keys, real explanations, CDL-manual/49-CFR citations,
 *     verified dates, difficulty, tags, unique prompts + sort orders,
 *     balanced answer keys, idempotent insert, question_count sync.
 *   - Topic coverage: every required hazmat topic is represented.
 *   - Zero-new-UI proof: hub, landing, study, timed, saved pages, sitemap,
 *     AND the M7 admin Tests module all derive from the catalog.
 *
 * Run:
 *   npx esbuild scripts/test-hazmat.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-hazmat.cjs && node /tmp/test-hazmat.cjs
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
const hz = getTest('hazmat');
check('hazmat exists in the catalog', hz !== undefined);
check('hazmat is published', hz?.isPublished === true);
check('category is hazmat (matches the DB check constraint)', hz?.category === 'hazmat');
check('endorsement code is H (first endorsement in the catalog)', hz?.endorsementCode === 'H');
check('pass threshold is 80%', hz?.passThresholdPct === 80);
check('timed limit is 25 minutes', hz?.timeLimitSeconds === 25 * 60);
check(
  'both modes ship',
  hz?.modes.includes('study') === true && hz?.modes.includes('timed') === true,
);
check('timedAvailable gates true', hz !== undefined && timedAvailable(hz));
check(
  'questionCountTarget matches the seeded bank (full bank served per attempt)',
  hz?.questionCountTarget === 35,
);
check(
  'SEO title is unique across the catalog',
  hz !== undefined && publishedTests().filter((t) => t.seoTitle === hz.seoTitle).length === 1,
);
check(
  'SEO description is unique across the catalog',
  hz !== undefined &&
    publishedTests().filter((t) => t.seoDescription === hz.seoDescription).length === 1,
);
check('hero copy is endorsement-focused', /endorsement/i.test(hz?.heroIntro ?? ''));
check('getTestByCategory resolves hazmat', getTestByCategory('hazmat')?.slug === 'hazmat');
check('hrefs derive from the slug', testHref('hazmat') === '/practice-tests/hazmat');
check('study href', studyHref('hazmat') === '/practice-tests/hazmat/study');
check('timed href', timedHref('hazmat') === '/practice-tests/hazmat/timed');
check(
  'hazmat is published, listed after GK, Air Brakes, and Combination',
  publishedTests().findIndex((t) => t.slug === 'hazmat') === 3,
);
check(
  'existing tests untouched and ordered (GK, Air Brakes, Combination)',
  publishedTests()[0]?.slug === 'general-knowledge' &&
    publishedTests()[1]?.slug === 'air-brakes' &&
    publishedTests()[2]?.slug === 'combination-vehicles' &&
    getTest('general-knowledge')?.timeLimitSeconds === 50 * 60 &&
    getTest('air-brakes')?.timeLimitSeconds === 25 * 60 &&
    getTest('combination-vehicles')?.timeLimitSeconds === 30 * 60,
);
check('unknown slugs still resolve to undefined (404 path)', getTest('no-such-test') === undefined);

// ── 2. Seed bank sanity (parse the SQL — mirrors the 032/034/035 checks) ────
const seed = read('supabase/migrations/036_seed_hazmat.sql');
check(
  'seed is idempotent (skips when bank non-empty)',
  /if exists \(select 1 from public\.questions where test_id = v_test\)/.test(seed),
);
check('seed inserts the test row if absent', /on conflict \(slug\) do nothing/.test(seed));
check('seed test slug matches the catalog join key', /'hazmat'/.test(seed));
check(
  'seed contains no destructive statements (purely additive)',
  !/drop table|drop column|truncate|delete from public\./i.test(seed),
);

const blocks = seed.split('(v_test,').slice(1);
check('seed contains at least 30 questions', blocks.length >= 30, blocks.length);
check('seed contains exactly 35 questions', blocks.length === 35, blocks.length);

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
  'sort orders are unique and complete 1..35',
  sortOrders.size === 35 && Math.min(...sortOrders) === 1 && Math.max(...sortOrders) === 35,
);
check(
  'every answer position (a–d) is correct at least 6 times (balanced keys)',
  Object.values(keyCounts).every((n) => n >= 6),
  JSON.stringify(keyCounts),
);
check('seed keeps question_count in sync', /set question_count = \(select count\(\*\)/.test(seed));
check(
  'seed cites only Section 9 manual references and Parts 171–180/392/397 CFR references',
  (seed.match(/'CDL Manual §([0-9.]+)'/g) ?? []).every((c) => c.includes('§9.')) &&
    (seed.match(/'49 CFR ([0-9]+)\./g) ?? []).every((c) => {
      const part = Number(c.replace(/'49 CFR ([0-9]+)\./, '$1'));
      return (part >= 171 && part <= 180) || part === 392 || part === 397;
    }),
);

// ── 3. Topic coverage — every topic the milestone requires ──────────────────
const topics: [string, boolean][] = [
  ['hazard classes', allTags.has('hazard-classes')],
  ['identification numbers', allTags.has('id-numbers')],
  ['placards and labels', allTags.has('placards')],
  ['shipping papers', allTags.has('shipping-papers')],
  ['emergency response information', allTags.has('emergency-response')],
  ['ERG use', allTags.has('erg')],
  ['loading and unloading', allTags.has('loading')],
  ['segregation', allTags.has('segregation')],
  ['bulk packaging and cargo tanks', allTags.has('bulk-packaging')],
  ['attendance rules', allTags.has('attendance')],
  ['fueling', allTags.has('fueling')],
  ['smoking', allTags.has('smoking')],
  ['parking', allTags.has('parking')],
  ['routing', allTags.has('routing')],
  ['leaks and damaged packages', allTags.has('leaks')],
  ['incident reporting', allTags.has('incident-reporting')],
  ['security awareness', allTags.has('security')],
  ['radioactive materials', allTags.has('radioactive')],
  ['explosives', allTags.has('explosives')],
  ['poison and inhalation hazards', allTags.has('poison') && allTags.has('inhalation-hazard')],
  ['railroad crossings', allTags.has('railroad')],
];
for (const [topic, covered] of topics) check(`topic covered: ${topic}`, covered);
check(
  'the memorized specifics appear (1,001 lbs, 25 ft, 100 ft, 15-50 ft, 119 gal, TI 50)',
  seed.includes('1,001 pounds') &&
    seed.includes('25 feet') &&
    seed.includes('100 feet') &&
    seed.includes('15 to 50 feet') &&
    seed.includes('119 gallons') &&
    /transport.index/i.test(seed),
);

// ── 4. Zero new UI — every surface derives from the catalog ─────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check('hub renders from publishedTests()', hub.includes('publishedTests()'));
check(
  'hub has no hardcoded per-test assumptions',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat/.test(hub),
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
  'saved pages group ALL published banks (hazmat joins free)',
  read('src/lib/tests/queries.ts').includes('publishedTests()') &&
    read('src/app/(learn)/practice-tests/bookmarks/page.tsx').includes('getPublishedBanks') &&
    read('src/app/(learn)/practice-tests/missed/page.tsx').includes('getPublishedBanks'),
);
check(
  'sitemap derives test URLs from publishedTests()',
  /for \(const test of publishedTests\(\)\)/.test(read('src/app/sitemap.ts')),
);
check(
  'endorsement badge renders from the catalog field (no hazmat-specific UI)',
  read('src/components/test/TestCard.tsx').includes('endorsementCode') &&
    !read('src/components/test/TestCard.tsx').includes('hazmat'),
);

// ── 5. Admin Tests module (M7) picks hazmat up with zero code changes ───────
const adminLib = read('src/lib/admin/tests.ts');
check(
  'admin overview iterates TEST_CATALOG (hazmat appears automatically)',
  adminLib.includes('TEST_CATALOG'),
);
check(
  'admin lib has no per-test hardcoding',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat/.test(adminLib),
);
const adminActions = read('src/app/admin/(dashboard)/tests/actions.ts');
check(
  'admin actions stay slug-generic (no per-test hardcoding)',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat/.test(adminActions),
);

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nHazmat tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
