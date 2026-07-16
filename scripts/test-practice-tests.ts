/**
 * CDL Practice Tests — Milestone 1 foundation tests.
 *
 * Milestone 1 ships the data architecture, routes, SEO, and General Knowledge
 * foundation — NOT the interactive runner, results, admin, or extra
 * endorsements. These tests guard the foundation:
 *
 *   - The TS catalog is well-formed and General Knowledge is configured right.
 *   - The category union stays in lock-step with the DB check constraint (007).
 *   - The migrations are additive and safe (no drops, IF NOT EXISTS).
 *   - Pure scoring logic grades correctly (pass/fail/empty/unanswered).
 *   - The Quiz JSON-LD never fabricates a question count.
 *   - Routes, SEO wiring, and the homepage/footer CTA are all in place.
 *
 * Run:
 *   npx esbuild scripts/test-practice-tests.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-practice-tests.cjs && node /tmp/test-practice-tests.cjs
 */
import { readFileSync } from 'node:fs';
import {
  TEST_CATALOG,
  PASS_THRESHOLD_DEFAULT,
  allTests,
  publishedTests,
  getTest,
  getTestByCategory,
  testHref,
} from '@/lib/tests/catalog';
import { gradeAttempt } from '@/lib/tests/scoring';
import { testSchema } from '@/lib/tests/schema';
import { TEST_CATEGORIES } from '@/lib/tests/types';
import type { TestDefinition } from '@/lib/tests/types';

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

// ── 1. Catalog shape ────────────────────────────────────────────────────────
check('catalog is non-empty', TEST_CATALOG.length >= 1, TEST_CATALOG.length);
check('slugs are unique', new Set(TEST_CATALOG.map((t) => t.slug)).size === TEST_CATALOG.length);
check(
  'categories are unique',
  new Set(TEST_CATALOG.map((t) => t.category)).size === TEST_CATALOG.length,
);
check(
  'slugs are kebab-case',
  TEST_CATALOG.every((t) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)),
);
check(
  'every category is a valid DB enum value',
  TEST_CATALOG.every((t) => (TEST_CATEGORIES as readonly string[]).includes(t.category)),
);
check(
  'every test has SEO title + description',
  TEST_CATALOG.every((t) => t.seoTitle.length > 0 && t.seoDescription.length > 0),
);
check(
  'every test has at least one mode',
  TEST_CATALOG.every((t) => t.modes.length > 0),
);
check(
  'pass thresholds are 1..100',
  TEST_CATALOG.every((t) => t.passThresholdPct >= 1 && t.passThresholdPct <= 100),
);

// ── 2. Milestone-1 scope: ONLY General Knowledge is published ───────────────
check(
  'exactly one published test (General Knowledge only this milestone)',
  publishedTests().length === 1,
  publishedTests().length,
);
const gk = getTest('general-knowledge');
check('General Knowledge exists', Boolean(gk));
check('GK category is general_knowledge', gk?.category === 'general_knowledge');
check('GK is published', gk?.isPublished === true);
check('GK target is 50 questions', gk?.questionCountTarget === 50, gk?.questionCountTarget);
check('GK pass threshold is 80 (CDL standard)', gk?.passThresholdPct === 80, gk?.passThresholdPct);
check('GK default matches PASS_THRESHOLD_DEFAULT', PASS_THRESHOLD_DEFAULT === 80);
check(
  'GK offers both modes',
  gk?.modes.includes('study') === true && gk?.modes.includes('timed') === true,
);
check('GK timed limit is 50 min', gk?.timeLimitSeconds === 50 * 60, gk?.timeLimitSeconds);
check('GK is the base permit (no endorsement code)', gk?.endorsementCode === null);
check('KC integration deferred (no related category yet)', gk?.relatedKcCategorySlug === null);

// ── 3. Catalog helpers ──────────────────────────────────────────────────────
check('getTest resolves by slug', getTest('general-knowledge')?.slug === 'general-knowledge');
check('getTest returns undefined for unknown', getTest('nope') === undefined);
check(
  'getTestByCategory resolves',
  getTestByCategory('general_knowledge')?.slug === 'general-knowledge',
);
check('allTests returns the full catalog', allTests().length === TEST_CATALOG.length);
check('testHref shape', testHref('general-knowledge') === '/practice-tests/general-knowledge');

// ── 4. Category union mirrors the DB check constraint (migration 007) ───────
const m007 = read('supabase/migrations/007_tests.sql');
const enumMatch = m007.match(/category\s+text\s+not null\s+check\s*\(category in \(([^)]+)\)\)/i);
check('007 category constraint found', Boolean(enumMatch));
if (enumMatch) {
  const dbCats = enumMatch[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  check(
    'TEST_CATEGORIES matches DB enum exactly',
    JSON.stringify([...TEST_CATEGORIES]) === JSON.stringify(dbCats),
    `${JSON.stringify([...TEST_CATEGORIES])} vs ${JSON.stringify(dbCats)}`,
  );
}

// ── 5. Migrations are additive & safe ───────────────────────────────────────
const migs = {
  '029': read('supabase/migrations/029_practice_tests_modes.sql'),
  '030': read('supabase/migrations/030_practice_tests_questions.sql'),
  '031': read('supabase/migrations/031_practice_tests_jurisdiction.sql'),
};
for (const [id, sql] of Object.entries(migs)) {
  check(`migration ${id}: uses ADD COLUMN IF NOT EXISTS`, /add column if not exists/i.test(sql));
  check(`migration ${id}: no destructive DROP TABLE`, !/drop table/i.test(sql));
  check(
    `migration ${id}: no DROP COLUMN outside rollback comment`,
    !/^\s*alter table[^;]*drop column/im.test(sql),
  );
}
check(
  '029 adds pass_threshold_pct default 80',
  /pass_threshold_pct[\s\S]*default 80/i.test(migs['029']),
);
check('029 adds time_limit_seconds', /time_limit_seconds/i.test(migs['029']));
check('029 adds endorsement_code', /endorsement_code/i.test(migs['029']));
check('029 adds related_kc_category_slug', /related_kc_category_slug/i.test(migs['029']));
check('030 adds image_url', /image_url/i.test(migs['030']));
check('030 adds difficulty check 1..3', /difficulty[\s\S]*between 1 and 3/i.test(migs['030']));
check(
  '030 adds tags array + gin index',
  /tags text\[\]/i.test(migs['030']) && /using gin \(tags\)/i.test(migs['030']),
);
check(
  '031 adds jurisdiction default federal',
  /jurisdiction[\s\S]*default 'federal'/i.test(migs['031']),
);
check('031 adds states array', /states text\[\]/i.test(migs['031']));

// ── 6. Pure scoring logic ───────────────────────────────────────────────────
const qs = [
  { id: 'q1', correctKey: 'a' },
  { id: 'q2', correctKey: 'b' },
  { id: 'q3', correctKey: 'c' },
  { id: 'q4', correctKey: 'd' },
];
const allRight = gradeAttempt(qs, { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, 80);
check('all correct → 100%', allRight.scorePct === 100 && allRight.correct === 4);
check('all correct → passed', allRight.passed === true);

const half = gradeAttempt(qs, { q1: 'a', q2: 'b', q3: 'x', q4: null }, 80);
check('2/4 → 50%', half.scorePct === 50 && half.correct === 2);
check('50% < 80% → failed', half.passed === false);
check(
  'wrong answer marked incorrect',
  half.answers.find((a) => a.questionId === 'q3')?.isCorrect === false,
);
check(
  'unanswered (null) marked incorrect',
  half.answers.find((a) => a.questionId === 'q4')?.isCorrect === false,
);

const exactly80 = gradeAttempt(
  Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, correctKey: 'a' })),
  { q0: 'a', q1: 'a', q2: 'a', q3: 'a', q4: 'x' },
  80,
);
check(
  'exactly 80% → passed (>= threshold)',
  exactly80.scorePct === 80 && exactly80.passed === true,
);

const empty = gradeAttempt([], {}, 80);
check(
  'empty attempt → 0% and not passed (no divide-by-zero)',
  empty.scorePct === 0 && empty.passed === false && empty.total === 0,
);

// ── 7. Quiz JSON-LD never fabricates a count ────────────────────────────────
const schemaUnseeded = testSchema(gk as TestDefinition, 0) as Record<string, unknown>;
check('schema @type is Quiz', schemaUnseeded['@type'] === 'Quiz');
check('schema is free', schemaUnseeded.isAccessibleForFree === true);
check('schema omits numberOfQuestions when unseeded', !('numberOfQuestions' in schemaUnseeded));
check(
  'schema url is absolute + correct path',
  String(schemaUnseeded.url).endsWith('/practice-tests/general-knowledge'),
);
const schemaSeeded = testSchema(gk as TestDefinition, 50) as Record<string, unknown>;
check('schema emits numberOfQuestions once seeded', schemaSeeded.numberOfQuestions === 50);

// ── 8. Routes exist ─────────────────────────────────────────────────────────
check(
  'hub route exists',
  /export default async function/.test(read('src/app/(learn)/practice-tests/page.tsx')),
);
const landing = read('src/app/(learn)/practice-tests/[category]/page.tsx');
check('landing route exists', /export default async function/.test(landing));
check('landing has generateStaticParams', /export function generateStaticParams/.test(landing));
check('landing has generateMetadata', /export function generateMetadata/.test(landing));
check('landing calls notFound on unknown test', /notFound\(\)/.test(landing));

// ── 9. SEO wiring ───────────────────────────────────────────────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check('hub uses buildMetadata', /buildMetadata\(/.test(hub));
check('hub emits breadcrumb JSON-LD', /breadcrumbSchema/.test(hub));
check('landing uses buildMetadata', /buildMetadata\(/.test(landing));
check('landing emits testSchema JSON-LD', /testSchema\(/.test(landing));
check('landing emits breadcrumb JSON-LD', /breadcrumbSchema/.test(landing));
const sitemap = read('src/app/sitemap.ts');
check('sitemap imports publishedTests', /publishedTests/.test(sitemap));
check('sitemap includes /practice-tests', /\/practice-tests/.test(sitemap));

// ── 10. Homepage + footer CTA resolve to the hub ────────────────────────────
check(
  'homepage FeaturedTest CTA points to /practice-tests',
  /href="\/practice-tests"/.test(read('src/components/sections/FeaturedTest.tsx')),
);
check(
  'footer links to /practice-tests',
  /href:\s*'\/practice-tests'/.test(read('src/components/layout/Footer.tsx')),
);

// ── 11. Data-layer fails soft (no throw path leaks) ─────────────────────────
const queries = read('src/lib/tests/queries.ts');
check('queries wrap reads in try/catch', (queries.match(/catch/g) ?? []).length >= 2);
check('queries use the cookieless static client', /createStaticClient/.test(queries));
check('answer-key exposure is documented as intentional', /usability/i.test(queries));

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nPractice Tests tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
