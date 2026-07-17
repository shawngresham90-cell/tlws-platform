/**
 * CDL Practice Tests — Milestone 1 foundation tests.
 *
 * Milestone 1 ships the data architecture, routes, SEO, and General Knowledge
 * foundation — NOT the interactive runner, results, admin, or extra
 * endorsements. These tests guard the foundation:
 *
 *   - The TS catalog is well-formed and General Knowledge is configured right.
 *   - The category union stays in lock-step with the DB check constraint,
 *     scanning ALL migrations so a future constraint change can't slip by.
 *   - The migrations are additive and safe (no drops, IF NOT EXISTS).
 *   - Pure scoring grades correctly — including the rounding boundary where
 *     the display percent rounds up to the threshold but the true score fails.
 *   - Choice normalization accepts only the canonical array shape and drops
 *     malformed elements instead of surfacing "undefined" choices.
 *   - The Quiz JSON-LD emits only schema.org-recognized properties.
 *   - Routes, SEO wiring, shared components, and the homepage/footer CTA are
 *     all in place, in the README-documented locations.
 *
 * Run:
 *   npx esbuild scripts/test-practice-tests.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-practice-tests.cjs && node /tmp/test-practice-tests.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  TEST_CATALOG,
  PASS_THRESHOLD_DEFAULT,
  publishedTests,
  getTest,
  getTestByCategory,
  testHref,
} from '@/lib/tests/catalog';
import { gradeAttempt } from '@/lib/tests/scoring';
import { normalizeChoices } from '@/lib/tests/queries';
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

// ── 2. Published scope: GK (M1) + Air Brakes (M5), General Knowledge first ──
// Every published test must be a DELIBERATE milestone addition — this count
// is bumped once per shipped test so an accidental isPublished flip fails.
check(
  'published tests match the shipped milestones (GK + Air Brakes)',
  publishedTests().length === 2,
  publishedTests().length,
);
check(
  'General Knowledge stays first in display order',
  publishedTests()[0]?.slug === 'general-knowledge',
);
const gk = getTest('general-knowledge');
check('General Knowledge exists', Boolean(gk));
check('GK category is general_knowledge', gk?.category === 'general_knowledge');
check('GK is published', gk?.isPublished === true);
check('GK target is 50 questions', gk?.questionCountTarget === 50, gk?.questionCountTarget);
check('GK pass threshold is 80 (CDL standard)', gk?.passThresholdPct === 80, gk?.passThresholdPct);
check('GK default matches PASS_THRESHOLD_DEFAULT', PASS_THRESHOLD_DEFAULT === 80);
// Both modes shipped: Study (M2) + Timed (M3). Only list a takeable mode.
check(
  'GK offers Study AND Timed (both shipped)',
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
check('testHref shape', testHref('general-knowledge') === '/practice-tests/general-knowledge');

// ── 4. Category union mirrors the LAST tests.category constraint in ANY
//      migration — anchored to the effective schema, not just 007 ────────────
const migrationDir = 'supabase/migrations';
const migrationFiles = readdirSync(migrationDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
let lastConstraint: string | null = null;
for (const f of migrationFiles) {
  const sql = read(`${migrationDir}/${f}`);
  // Matches the category check constraint wherever it is (re)defined.
  const matches = sql.match(/check\s*\(category in \(([^)]+)\)\)/gi);
  if (matches) lastConstraint = matches[matches.length - 1];
}
check('a tests.category constraint exists in migrations', Boolean(lastConstraint));
if (lastConstraint) {
  const inner = lastConstraint.match(/in \(([^)]+)\)/i)?.[1] ?? '';
  const dbCats = inner
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  check(
    'TEST_CATEGORIES matches the effective DB enum exactly',
    JSON.stringify([...TEST_CATEGORIES]) === JSON.stringify(dbCats),
    `${JSON.stringify([...TEST_CATEGORIES])} vs ${JSON.stringify(dbCats)}`,
  );
}

// ── 5. Migrations are additive & safe ───────────────────────────────────────
const migs = {
  '029': read('supabase/migrations/029_practice_tests_questions.sql'),
  '030': read('supabase/migrations/030_practice_tests_jurisdiction.sql'),
};
for (const [id, sql] of Object.entries(migs)) {
  check(`migration ${id}: uses ADD COLUMN IF NOT EXISTS`, /add column if not exists/i.test(sql));
  check(`migration ${id}: no destructive DROP TABLE`, !/drop table/i.test(sql));
  check(
    `migration ${id}: no DROP COLUMN outside rollback comment`,
    !/^\s*alter table[^;]*drop column/im.test(sql),
  );
}
check('029 adds image_url', /image_url/i.test(migs['029']));
check('029 adds difficulty check 1..3', /difficulty[\s\S]*between 1 and 3/i.test(migs['029']));
check(
  '029 adds tags array + gin index',
  /tags text\[\]/i.test(migs['029']) && /using gin \(tags\)/i.test(migs['029']),
);
check('029 documents the canonical array choices shape', /ARRAY of \{"key"/.test(migs['029']));
check('029 documents the slug join contract', /tests\.slug/i.test(migs['029']));
check(
  '030 adds jurisdiction default federal',
  /jurisdiction[\s\S]*default 'federal'/i.test(migs['030']),
);
check('030 adds states array', /states text\[\]/i.test(migs['030']));
check('030 has no dead index on a two-value column', !/create index/i.test(migs['030']));
// The dual-source-of-truth migration was removed in review: test config and SEO
// live ONLY in the TS catalog. No migration may re-add unread duplicates.
check(
  'no migration adds pass_threshold_pct/meta_title to tests (TS catalog owns config)',
  migrationFiles.every(
    (f) =>
      !/pass_threshold_pct|add column if not exists meta_title/i.test(read(`${migrationDir}/${f}`)),
  ),
);

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

// Rounding boundary: 43/54 = 79.63% displays as 80 but MUST fail an 80% bar.
const rounding = gradeAttempt(
  Array.from({ length: 54 }, (_, i) => ({ id: `q${i}`, correctKey: 'a' })),
  Object.fromEntries(Array.from({ length: 54 }, (_, i) => [`q${i}`, i < 43 ? 'a' : 'x'])),
  80,
);
check('43/54 displays as 80%', rounding.scorePct === 80, rounding.scorePct);
check('43/54 (79.63%) FAILS the 80% bar despite rounding', rounding.passed === false);

const empty = gradeAttempt([], {}, 80);
check(
  'empty attempt → 0% and not passed (no divide-by-zero)',
  empty.scorePct === 0 && empty.passed === false && empty.total === 0,
);

// ── 7. Choice normalization: canonical array shape only, validated ──────────
const good = normalizeChoices([
  { key: 'a', text: 'Air brakes' },
  { key: 'b', text: 'Hydraulic brakes' },
]);
check(
  'valid array normalizes in order',
  good.length === 2 && good[0].key === 'a' && good[1].text === 'Hydraulic brakes',
);
check(
  'record shape is rejected (order not preserved by jsonb)',
  normalizeChoices({ a: 'x', b: 'y' }).length === 0,
);
check(
  'array-of-pairs elements are dropped',
  normalizeChoices([
    ['a', 'x'],
    ['b', 'y'],
  ]).length === 0,
);
check(
  'mis-keyed objects are dropped, valid ones kept',
  normalizeChoices([
    { label: 'a', value: 'x' },
    { key: 'b', text: 'y' },
  ]).length === 1,
);
check(
  'null/junk input fails soft to []',
  normalizeChoices(null).length === 0 && normalizeChoices('x').length === 0,
);

// ── 8. Quiz JSON-LD emits only schema.org-recognized properties ─────────────
const schemaOut = testSchema(gk as TestDefinition) as Record<string, unknown>;
check('schema @type is Quiz', schemaOut['@type'] === 'Quiz');
check('schema is free', schemaOut.isAccessibleForFree === true);
check(
  'schema never emits numberOfQuestions (not in the schema.org vocabulary)',
  !('numberOfQuestions' in schemaOut),
);
check(
  'schema url is absolute + correct path',
  String(schemaOut.url).endsWith('/practice-tests/general-knowledge'),
);
const KNOWN_QUIZ_PROPS = new Set([
  '@context',
  '@type',
  'name',
  'description',
  'url',
  'educationalUse',
  'educationalLevel',
  'about',
  'provider',
  'isAccessibleForFree',
]);
check(
  'schema emits no unrecognized keys',
  Object.keys(schemaOut).every((k) => KNOWN_QUIZ_PROPS.has(k)),
  Object.keys(schemaOut).filter((k) => !KNOWN_QUIZ_PROPS.has(k)),
);

// ── 9. Routes exist, in the documented locations ────────────────────────────
check(
  'hub route exists',
  /export default async function/.test(read('src/app/(learn)/practice-tests/page.tsx')),
);
const landing = read('src/app/(learn)/practice-tests/[slug]/page.tsx');
check('landing route segment is [slug] (it holds the slug, not the enum)', true);
check('landing route exists', /export default async function/.test(landing));
check('landing has generateStaticParams', /export function generateStaticParams/.test(landing));
check('landing has generateMetadata', /export function generateMetadata/.test(landing));
check('landing calls notFound on unknown test', /notFound\(\)/.test(landing));
check(
  'components live in README-documented src/components/test/',
  /export function TestCard/.test(read('src/components/test/TestCard.tsx')),
);

// ── 10. Shared components reused (no hand-rolled drift) ─────────────────────
const hub = read('src/app/(learn)/practice-tests/page.tsx');
check(
  'landing uses the shared Breadcrumbs component',
  /@\/components\/kc\/Breadcrumbs/.test(landing),
);
check('landing does not hand-roll a breadcrumb nav', !/aria-label="Breadcrumb"/.test(landing));
check('hub uses the shared CtaBand', /@\/components\/academy\/CtaBand/.test(hub));
check('hub imports TestCard from components/test', /@\/components\/test'/.test(hub));

// ── 11. SEO wiring ──────────────────────────────────────────────────────────
check('hub uses buildMetadata', /buildMetadata\(/.test(hub));
check('hub emits breadcrumb JSON-LD', /breadcrumbSchema/.test(hub));
check('landing uses buildMetadata', /buildMetadata\(/.test(landing));
check('landing emits testSchema JSON-LD', /testSchema\(/.test(landing));
check('landing emits breadcrumb JSON-LD', /breadcrumbSchema/.test(landing));
const sitemap = read('src/app/sitemap.ts');
check('sitemap imports publishedTests', /publishedTests/.test(sitemap));
check('sitemap includes /practice-tests', /\/practice-tests/.test(sitemap));

// ── 12. Homepage + footer CTA resolve to live practice-test pages ───────────
check(
  'homepage FeaturedTest CTA derives from the catalog (testHref) — no hardcoded slug path',
  /testHref\('general-knowledge'\)/.test(read('src/components/sections/FeaturedTest.tsx')),
);
check(
  'footer links to /practice-tests',
  /href:\s*'\/practice-tests'/.test(read('src/components/layout/Footer.tsx')),
);

// ── 13. Data layer: slug-keyed, real counts, fails soft ─────────────────────
const queries = read('src/lib/tests/queries.ts');
check('queries wrap reads in try/catch', (queries.match(/catch/g) ?? []).length >= 3);
check('queries use the cookieless static client', /createStaticClient/.test(queries));
check('test lookup joins on the unique slug, not category', /\.eq\('slug', slug\)/.test(queries));
check('no category-filtered maybeSingle (multi-row trap)', !/\.eq\('category'/.test(queries));
check(
  'seeded count counts real questions rows (head-only), not tests.question_count',
  /count: 'exact', head: true/.test(queries) && !/select\('[^']*question_count/.test(queries),
);
check('answer-key exposure is documented as intentional', /usability/i.test(queries));

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nPractice Tests tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
