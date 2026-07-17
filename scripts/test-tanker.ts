/**
 * CDL Practice Tests — Tanker milestone tests.
 *
 * Covers what the Tanker milestone added:
 *   - The catalog entry: slug/category/endorsement/threshold/limit/modes/SEO
 *     configured right, published, and resolving through every catalog helper.
 *   - The seed bank (039): 32 original questions, canonical choices shape,
 *     valid correct keys, real explanations, CDL-manual/49-CFR citations,
 *     verified dates, difficulty, tags, unique prompts + sort orders,
 *     balanced answer keys, idempotent insert, question_count sync.
 *   - Topic coverage: every required tank-vehicles topic is represented.
 *   - Zero-new-UI proof: hub, landing, study, timed, saved pages, sitemap,
 *     AND the M7 admin Tests module all derive from the catalog.
 *
 * Run:
 *   npx esbuild scripts/test-tanker.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-tanker.cjs && node /tmp/test-tanker.cjs
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
const tk = getTest('tanker');
check('tanker exists in the catalog', tk !== undefined);
check('tanker is published', tk?.isPublished === true);
check('category is tanker (matches the DB check constraint)', tk?.category === 'tanker');
check('endorsement code is N', tk?.endorsementCode === 'N');
check('pass threshold is 80%', tk?.passThresholdPct === 80);
check('timed limit is 25 minutes', tk?.timeLimitSeconds === 25 * 60);
check(
  'both modes ship',
  tk?.modes.includes('study') === true && tk?.modes.includes('timed') === true,
);
check('timedAvailable gates true', tk !== undefined && timedAvailable(tk));
check(
  'questionCountTarget matches the seeded bank (full bank served per attempt)',
  tk?.questionCountTarget === 32,
);
check(
  'SEO title is unique across the catalog',
  tk !== undefined && publishedTests().filter((t) => t.seoTitle === tk.seoTitle).length === 1,
);
check(
  'SEO description is unique across the catalog',
  tk !== undefined &&
    publishedTests().filter((t) => t.seoDescription === tk.seoDescription).length === 1,
);
check('hero copy is endorsement-focused', /endorsement/i.test(tk?.heroIntro ?? ''));
check('getTestByCategory resolves tanker', getTestByCategory('tanker')?.slug === 'tanker');
check('hrefs derive from the slug', testHref('tanker') === '/practice-tests/tanker');
check('study href', studyHref('tanker') === '/practice-tests/tanker/study');
check('timed href', timedHref('tanker') === '/practice-tests/tanker/timed');
check(
  'tanker is published, listed after GK, Air Brakes, Combination, and Hazmat',
  publishedTests().findIndex((t) => t.slug === 'tanker') === 4,
);
check(
  'existing tests untouched and ordered (GK, Air Brakes, Combination, Hazmat)',
  publishedTests()[0]?.slug === 'general-knowledge' &&
    publishedTests()[1]?.slug === 'air-brakes' &&
    publishedTests()[2]?.slug === 'combination-vehicles' &&
    publishedTests()[3]?.slug === 'hazmat' &&
    getTest('general-knowledge')?.timeLimitSeconds === 50 * 60 &&
    getTest('air-brakes')?.timeLimitSeconds === 25 * 60 &&
    getTest('combination-vehicles')?.timeLimitSeconds === 30 * 60 &&
    getTest('hazmat')?.timeLimitSeconds === 25 * 60 &&
    getTest('hazmat')?.questionCountTarget === 35,
);
check('unknown slugs still resolve to undefined (404 path)', getTest('no-such-test') === undefined);

// ── 2. Seed bank sanity (parse the SQL — mirrors the 032/034/035/036 checks) ─
const seed = read('supabase/migrations/039_seed_tanker_practice_test.sql');
check(
  'seed is idempotent (skips when bank non-empty)',
  /if exists \(select 1 from public\.questions where test_id = v_test\)/.test(seed),
);
check('seed inserts the test row if absent', /on conflict \(slug\) do nothing/.test(seed));
check('seed test slug matches the catalog join key', /values \(\s*'tanker',/.test(seed));
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

  if (!/'(49 CFR 383\.[0-9]+|CDL Manual §8\.[0-9]+)'/.test(block)) allCited = false;
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
check(
  'every question cites the CDL Manual tank section (§8) or 49 CFR Part 383 (zero uncited)',
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
  'every answer position (a–d) is correct at least 6 times (balanced keys)',
  Object.values(keyCounts).every((n) => n >= 6),
  JSON.stringify(keyCounts),
);
check('seed keeps question_count in sync', /set question_count = \(select count\(\*\)/.test(seed));
check(
  'seed cites only Section 8 manual references and Part 383 CFR references',
  (seed.match(/'CDL Manual §([0-9.]+)'/g) ?? []).every((c) => c.includes('§8.')) &&
    (seed.match(/'49 CFR ([0-9]+)\./g) ?? []).every((c) => /'49 CFR 383\./.test(c)),
);

// ── 3. Topic coverage — every topic the milestone requires ──────────────────
const topics: [string, boolean][] = [
  [
    'high center of gravity / rollover risk',
    allTags.has('high-center-of-gravity') && allTags.has('rollover'),
  ],
  ['liquid surge', allTags.has('surge')],
  ['surge at stops (brake hold, intersection shove)', allTags.has('stopping')],
  [
    'following distance / space management',
    allTags.has('following-distance') && allTags.has('space-management'),
  ],
  ['baffled tanks', allTags.has('baffles')],
  ['smooth-bore tanks', allTags.has('smooth-bore')],
  ['food-grade sanitation rule', allTags.has('food-grade')],
  ['bulkheads and compartments', allTags.has('bulkheads')],
  ['weight distribution across axles', allTags.has('weight-distribution')],
  ['outage', allTags.has('outage')],
  ['dense-liquid weight limits (partial loads)', allTags.has('weight-limits')],
  ['tank inspection', allTags.has('inspection')],
  ['leaks (illegal to haul leaking)', allTags.has('leaks')],
  ['manhole covers', allTags.has('manholes')],
  ['special-purpose equipment', allTags.has('special-equipment')],
  ['smooth driving technique', allTags.has('smoothness')],
  ['curves and ramps', allTags.has('curves')],
  ['stopping distance (wet, empty)', allTags.has('stopping-distance') && allTags.has('empty')],
  ['emergency braking (controlled/stab)', allTags.has('emergency-braking')],
  ['skid causes and recovery', allTags.has('skids')],
  ['endorsement definition (383.5)', allTags.has('endorsement') && allTags.has('definitions')],
  ['temporarily attached tanks / IBC totes', allTags.has('ibc')],
  ['X (tanker + hazmat) combination', allTags.has('x-endorsement')],
];
for (const [topic, covered] of topics) check(`topic covered: ${topic}`, covered);
check(
  'the memorized specifics appear (119 gallons, 1,000 gallons, well-below curve speeds, wet doubling)',
  seed.includes('119 gallons') &&
    seed.includes('1,000 gallons') &&
    /well below/i.test(seed) &&
    /double/i.test(seed),
);

// ── 4. Zero new UI — every surface derives from the catalog ─────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check('hub renders from publishedTests()', hub.includes('publishedTests()'));
check(
  'hub has no hardcoded per-test assumptions',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat|tanker/.test(hub),
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
  'saved pages group ALL published banks (tanker joins free)',
  read('src/lib/tests/queries.ts').includes('publishedTests()') &&
    read('src/app/(learn)/practice-tests/bookmarks/page.tsx').includes('getPublishedBanks') &&
    read('src/app/(learn)/practice-tests/missed/page.tsx').includes('getPublishedBanks'),
);
check(
  'sitemap derives test URLs from publishedTests()',
  /for \(const test of publishedTests\(\)\)/.test(read('src/app/sitemap.ts')),
);
check(
  'endorsement badge renders from the catalog field (no tanker-specific UI)',
  read('src/components/test/TestCard.tsx').includes('endorsementCode') &&
    !read('src/components/test/TestCard.tsx').includes('tanker'),
);

// ── 5. Admin Tests module (M7) picks tanker up with zero code changes ───────
const adminLib = read('src/lib/admin/tests.ts');
check(
  'admin overview iterates TEST_CATALOG (tanker appears automatically)',
  adminLib.includes('TEST_CATALOG'),
);
check(
  'admin lib has no per-test hardcoding',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat|tanker/.test(adminLib),
);
const adminActions = read('src/app/admin/(dashboard)/tests/actions.ts');
check(
  'admin actions stay slug-generic (no per-test hardcoding)',
  !/general-knowledge|air-brakes|combination-vehicles|hazmat|tanker/.test(adminActions),
);

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nTanker tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
