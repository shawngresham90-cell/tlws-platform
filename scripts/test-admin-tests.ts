/**
 * CDL Practice Tests — Milestone 7 (Admin Tests module, edit-only) tests.
 *
 * Covers what Milestone 7 added:
 *   - parseQuestionForm: every invalid-edit class the milestone names is
 *     BLOCKED (missing citation, missing/garbled verified date, malformed or
 *     empty choices, invalid correct key, empty explanation, bad difficulty,
 *     bad tags), and a valid edit round-trips into the canonical shapes.
 *   - The admin gate: every new page and action runs behind requireAdmin().
 *   - Update-only doctrine: the module can never insert or delete questions —
 *     UUIDs survive every edit.
 *   - Feedback + confirmation: publish toggles confirm first; saves and
 *     failures surface clear messages; public pages revalidate after writes.
 *   - Hygiene: admin routes noindex, no new migrations (anon permissions
 *     untouched), no admin imports leaking into student-facing code.
 *
 * Run:
 *   npx esbuild scripts/test-admin-tests.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-admin-tests.cjs && node /tmp/test-admin-tests.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { parseQuestionForm } from '@/lib/admin/tests';

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

/* ── 1. Edit validation — valid form round-trips ────────────────────────── */
const validFields: Record<string, string> = {
  prompt: 'At about what pressure does a typical governor cut out?',
  choice_a: '60 psi',
  choice_b: '100 psi',
  choice_c: '125 psi',
  choice_d: '150 psi',
  correct_key: 'c',
  explanation: 'Cut-out is around 125 psi; cut-in is around 100 psi — memorize both numbers.',
  cfr_cite: 'CDL Manual §5.1.2',
  verified_date: '2026-07-17',
  difficulty: '2',
  tags: 'air-brakes, governor',
};
const form = (overrides: Record<string, string | null> = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...validFields, ...overrides })) {
    if (v !== null) fd.set(k, v);
  }
  return fd;
};

const valid = parseQuestionForm(form());
check('valid edit parses', valid.data !== undefined, valid.error);
check(
  'choices land in the canonical ordered a–d array',
  valid.data !== undefined &&
    valid.data.choices.length === 4 &&
    valid.data.choices.map((c) => c.key).join('') === 'abcd' &&
    valid.data.choices[2].text === '125 psi',
);
check('correct key preserved', valid.data?.correct_key === 'c');
check('tags split and trimmed', JSON.stringify(valid.data?.tags) === '["air-brakes","governor"]');
check('difficulty coerced to a number', valid.data?.difficulty === 2);
check(
  '49 CFR citations also accepted',
  parseQuestionForm(form({ cfr_cite: '49 CFR 392.7' })).data !== undefined,
);

/* ── 2. Every invalid-edit class is BLOCKED ─────────────────────────────── */
const blocked = (name: string, overrides: Record<string, string | null>, needle?: string) => {
  const r = parseQuestionForm(form(overrides));
  check(`blocked: ${name}`, r.error !== undefined, JSON.stringify(r.data ?? null));
  if (needle && r.error) {
    check(`blocked: ${name} — message names the field`, r.error.includes(needle), r.error);
  }
};
blocked('missing citation', { cfr_cite: '' }, 'cfr_cite');
blocked('citation without a real source prefix', { cfr_cite: 'trust me' }, 'cfr_cite');
blocked('missing verified date', { verified_date: '' }, 'verified_date');
blocked('garbled verified date', { verified_date: 'July 17' }, 'verified_date');
blocked('impossible verified date', { verified_date: '2026-13-45' });
blocked('empty choice (malformed choices)', { choice_b: '  ' }, 'choice_b');
blocked('missing choice field entirely', { choice_d: null });
blocked('invalid correct key (orphan)', { correct_key: 'e' }, 'correct_key');
blocked('empty correct key', { correct_key: '' });
blocked('empty explanation', { explanation: '' }, 'explanation');
blocked('explanation too short to teach anything', { explanation: 'yes.' });
blocked('prompt too short', { prompt: 'psi?' }, 'prompt');
blocked('difficulty out of range', { difficulty: '5' }, 'difficulty');
blocked('difficulty non-numeric', { difficulty: 'hard' });
blocked('empty tags', { tags: '' }, 'tags');
blocked('non-kebab tags', { tags: 'Air Brakes!!' });

/* ── 3. Admin gate + noindex on every new surface ───────────────────────── */
const pages: [string, string][] = [
  ['tests index', 'src/app/admin/(dashboard)/tests/page.tsx'],
  ['bank review', 'src/app/admin/(dashboard)/tests/[slug]/page.tsx'],
  ['question edit', 'src/app/admin/(dashboard)/tests/[slug]/questions/[id]/page.tsx'],
];
for (const [label, p] of pages) {
  const src = read(p);
  check(`${label} page calls requireAdmin()`, src.includes('requireAdmin()'));
  check(`${label} page is noindex`, src.includes('robots: { index: false, follow: false }'));
  check(
    `${label} page is force-dynamic (no cached admin data)`,
    src.includes("dynamic = 'force-dynamic'"),
  );
}
check(
  'the dashboard layout gates the whole group (defense in depth)',
  read('src/app/admin/(dashboard)/layout.tsx').includes('requireAdmin()'),
);

const actions = read('src/app/admin/(dashboard)/tests/actions.ts');
check('actions file is server-only', actions.startsWith("'use server'"));
check(
  'every action gates on requireAdmin()',
  (actions.match(/requireAdmin\(\);/g) ?? []).length >= 2,
);
check('writes use the service-role client', actions.includes('createAdminClient()'));

/* ── 4. Update-only doctrine — UUIDs survive every edit ─────────────────── */
const adminLib = read('src/lib/admin/tests.ts');
check('actions never INSERT questions', !actions.includes('.insert('));
check('actions never DELETE questions', !actions.includes('.delete('));
check(
  'lib never writes at all',
  !adminLib.includes('.insert(') &&
    !adminLib.includes('.update(') &&
    !adminLib.includes('.delete('),
);
check('question update is keyed by UUID', actions.includes(".eq('id', questionId)"));
check(
  'a missed UUID surfaces an error instead of silently no-opping',
  actions.includes('Question not found'),
);
check(
  'publish toggle updates ONLY is_published, keyed by id',
  /update\(\{ is_published: publish \}\)\s*\.eq\('id', testId\)/.test(actions),
);

/* ── 5. Feedback, confirmation, revalidation ────────────────────────────── */
check('saves redirect with success feedback', actions.includes('?ok=saved'));
check(
  'publish/unpublish redirect with success feedback',
  actions.includes("?ok=${publish ? 'published' : 'unpublished'}"),
);
check('failures return an error message state', actions.includes('Could not save the question'));
check(
  'public test pages revalidate after a write',
  actions.includes('revalidatePath(testHref(slug))') &&
    actions.includes('revalidatePath(studyHref(slug))') &&
    actions.includes('revalidatePath(timedHref(slug))'),
);
const bankPage = read('src/app/admin/(dashboard)/tests/[slug]/page.tsx');
check('publish toggle requires confirmation', bankPage.includes('<ConfirmSubmit'));
check(
  'unpublish confirmation explains the RLS visibility consequence',
  bankPage.includes('RLS blocks anonymous reads'),
);
check('bank table surfaces miss counts', bankPage.includes('miss_count'));
check(
  'bank table shows citation + verified date + difficulty + tags',
  bankPage.includes('cfr_cite') &&
    bankPage.includes('verified_date') &&
    bankPage.includes('difficulty') &&
    bankPage.includes('tags'),
);

const formSrc = read('src/components/admin/tests/QuestionForm.tsx');
check('edit form surfaces validation errors (role=alert)', formSrc.includes('role="alert"'));
check('edit form has a pending state', formSrc.includes('useFormStatus'));
check(
  'the UUID is bound into the action, never an editable field',
  !formSrc.includes('name="id"') &&
    read('src/app/admin/(dashboard)/tests/[slug]/questions/[id]/page.tsx').includes(
      'saveQuestionAction.bind(null, question.id',
    ),
);

/* ── 6. Hygiene — anon untouched, no student-facing leakage ─────────────── */
const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
check(
  'no new migration in this milestone (anon permissions unchanged)',
  migrations.sort().at(-1) === '035_seed_combination_vehicles.sql',
  migrations.at(-1),
);
check(
  'admin nav links the Tests section',
  read('src/components/admin/AdminNav.tsx').includes("{ href: '/admin/tests', label: 'Tests' }"),
);
// Student-facing code must never import the admin layer.
const studentFiles = [
  'src/components/test/StudyRunner.tsx',
  'src/components/test/TimedRunner.tsx',
  'src/components/test/TestResults.tsx',
  'src/components/test/SavedBrowser.tsx',
  'src/lib/tests/queries.ts',
  'src/app/(learn)/practice-tests/page.tsx',
];
for (const p of studentFiles) {
  check(`${p} does not import the admin layer`, !read(p).includes('@/lib/admin'));
}
check(
  'the admin data lib is server-only in spirit (uses the service client, no use client)',
  adminLib.includes('createAdminClient') && !adminLib.includes("'use client'"),
);

/* ── Done ───────────────────────────────────────────────────────────────── */
console.log(`\nAdmin Tests tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
