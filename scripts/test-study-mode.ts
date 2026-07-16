/**
 * CDL Practice Tests — Milestone 2 (Study Mode) tests.
 *
 * Covers what Milestone 2 added on top of the M1 foundation:
 *   - Study session state: answer-once, navigation clamps, completion,
 *     serialize/deserialize + resume semantics (version/slug mismatch, junk,
 *     re-seeded banks dropping stale answers).
 *   - The attempt API schema: anonymous OK, email requires a Turnstile token,
 *     malformed payloads rejected.
 *   - The seed bank: 52 original questions, every one carrying choices in the
 *     canonical array shape, a correct key that exists, an explanation, a
 *     citation, a verified date, difficulty 1–3, and tags.
 *   - Route + component wiring: noindex study route, zero-question guard,
 *     44px touch targets, aria-live feedback, no service-role imports in
 *     client code.
 *
 * Run:
 *   npx esbuild scripts/test-study-mode.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-study-mode.cjs && node /tmp/test-study-mode.cjs
 */
import { readFileSync } from 'node:fs';
import {
  STUDY_STORAGE_VERSION,
  answerQuestion,
  answeredCount,
  clampIndex,
  deserializeSession,
  goToQuestion,
  isComplete,
  markLogged,
  newSession,
  serializeSession,
  studyStorageKey,
} from '@/lib/tests/study';
import { testAttemptSchema } from '@/lib/api/schemas';
import { gradeAttempt } from '@/lib/tests/scoring';

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

// ── 1. Session state ────────────────────────────────────────────────────────
const T0 = 1_700_000_000_000;
const ids = ['q1', 'q2', 'q3'];
let s = newSession('general-knowledge', T0);
check(
  'new session starts at question 0 with no answers',
  s.currentIndex === 0 && Object.keys(s.answers).length === 0,
);
check(
  'storage key is versioned + slug-scoped',
  studyStorageKey('general-knowledge') === `tlws:study:v${STUDY_STORAGE_VERSION}:general-knowledge`,
);

s = answerQuestion(s, 'q1', 'a', T0 + 1);
check('answer recorded', s.answers.q1 === 'a');
const sAgain = answerQuestion(s, 'q1', 'b', T0 + 2);
check('first answer wins (no un-missing after the reveal)', sAgain.answers.q1 === 'a');
check('re-answer returns the same object (no phantom update)', sAgain === s);

check('goTo clamps below 0', goToQuestion(s, -5, 3).currentIndex === 0);
check('goTo clamps above max', goToQuestion(s, 99, 3).currentIndex === 2);
check('goTo moves normally', goToQuestion(s, 1, 3).currentIndex === 1);
check(
  'clampIndex is the one shared clamp (nav + resume agree)',
  clampIndex(-1, 3) === 0 &&
    clampIndex(9, 3) === 2 &&
    clampIndex(1.9, 3) === 1 &&
    clampIndex(0, 0) === 0,
);

check('answeredCount counts only known ids', answeredCount(s, ids) === 1);
check('not complete with 1/3', isComplete(s, ids) === false);
s = answerQuestion(answerQuestion(s, 'q2', 'b', T0 + 3), 'q3', 'c', T0 + 4);
check('complete with 3/3', isComplete(s, ids) === true);
check('empty bank is never complete', isComplete(newSession('x', T0), []) === false);

// ── 2. Serialize / resume ───────────────────────────────────────────────────
const stored = serializeSession(s);
const restored = deserializeSession(stored, 'general-knowledge', ids);
check(
  'roundtrip restores answers',
  restored?.answers.q2 === 'b' && Object.keys(restored?.answers ?? {}).length === 3,
);
check('roundtrip keeps slug', restored?.slug === 'general-knowledge');

check(
  'slug mismatch → null (no cross-test bleed)',
  deserializeSession(stored, 'air-brakes', ids) === null,
);
check(
  'junk → null, never throws',
  deserializeSession('{not json', 'general-knowledge', ids) === null,
);
check('null input → null', deserializeSession(null, 'general-knowledge', ids) === null);
const wrongVersion = stored.replace(`"v":${STUDY_STORAGE_VERSION}`, '"v":999');
check(
  'version mismatch → null',
  deserializeSession(wrongVersion, 'general-knowledge', ids) === null,
);

// Bank re-seeded: stale answer ids dropped, index re-clamped.
const shrunk = deserializeSession(stored, 'general-knowledge', ['q2']);
check(
  'unknown answer ids dropped on resume',
  shrunk !== null && shrunk.answers.q1 === undefined && shrunk.answers.q2 === 'b',
);
check('resume index clamped to live bank', (shrunk?.currentIndex ?? 99) <= 0);

// Attempt-logged guard: set once, survives serialize/deserialize — this is
// what keeps one sitting from ever producing two attempt rows.
check('new session is not logged', s.loggedAt === undefined);
const logged = markLogged(s, T0 + 10);
check('markLogged stamps loggedAt', logged.loggedAt === T0 + 10);
check('markLogged is idempotent (first stamp wins)', markLogged(logged, T0 + 99) === logged);
const loggedRoundtrip = deserializeSession(serializeSession(logged), 'general-knowledge', ids);
check('loggedAt survives the storage roundtrip', loggedRoundtrip?.loggedAt === T0 + 10);

// ── 3. Attempt schema ───────────────────────────────────────────────────────
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const anon = testAttemptSchema.safeParse({
  test_slug: 'general-knowledge',
  answers: { [uuid(1)]: 'a', [uuid(2)]: 'b' },
});
check('anonymous attempt (no email, no token) is valid', anon.success);

check(
  'email WITHOUT token is rejected',
  !testAttemptSchema.safeParse({
    test_slug: 'general-knowledge',
    answers: { [uuid(1)]: 'a' },
    email: 'x@y.com',
  }).success,
);
check(
  'email WITH token is valid',
  testAttemptSchema.safeParse({
    test_slug: 'general-knowledge',
    answers: { [uuid(1)]: 'a' },
    email: 'x@y.com',
    turnstileToken: 'tok',
  }).success,
);
check(
  'empty answers (and no email) rejected',
  !testAttemptSchema.safeParse({ test_slug: 'general-knowledge', answers: {} }).success,
);
check(
  'neither answers nor email rejected',
  !testAttemptSchema.safeParse({ test_slug: 'general-knowledge' }).success,
);
// The email-only shape: saves the lead WITHOUT re-logging the attempt.
check(
  'email-only save (with token, no answers) is valid',
  testAttemptSchema.safeParse({
    test_slug: 'general-knowledge',
    email: 'x@y.com',
    turnstileToken: 'tok',
  }).success,
);
check(
  'email-only save without token is rejected',
  !testAttemptSchema.safeParse({ test_slug: 'general-knowledge', email: 'x@y.com' }).success,
);
check(
  'non-uuid question id rejected',
  !testAttemptSchema.safeParse({ test_slug: 'general-knowledge', answers: { 'not-a-uuid': 'a' } })
    .success,
);
check(
  'bad slug rejected',
  !testAttemptSchema.safeParse({ test_slug: 'NOT A SLUG!!', answers: { [uuid(1)]: 'a' } }).success,
);
check(
  'oversized choice key rejected',
  !testAttemptSchema.safeParse({
    test_slug: 'general-knowledge',
    answers: { [uuid(1)]: 'x'.repeat(9) },
  }).success,
);
const big: Record<string, string> = {};
for (let i = 0; i < 201; i++) big[uuid(i)] = 'a';
check(
  '>200 answers rejected',
  !testAttemptSchema.safeParse({ test_slug: 'general-knowledge', answers: big }).success,
);

// ── 4. Seed bank sanity (parse the SQL) ─────────────────────────────────────
const seed = read('supabase/migrations/032_seed_general_knowledge.sql');
check(
  'seed is idempotent (skips when bank non-empty)',
  /if exists \(select 1 from public\.questions where test_id = v_test\)/.test(seed),
);
check('seed upserts the test row by slug', /on conflict \(slug\)/.test(seed));
check('seed test slug matches the catalog join key', /'general-knowledge'/.test(seed));

const blocks = seed.split('(v_test,').slice(1);
check('seed contains at least 50 questions', blocks.length >= 50, blocks.length);
check('seed contains exactly 52 questions', blocks.length === 52, blocks.length);

const prompts = new Set<string>();
let allShapesValid = true;
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
        choices.length < 2 ||
        !choices.every((c) => typeof c.key === 'string' && typeof c.text === 'string')
      ) {
        allShapesValid = false;
      }
    } catch {
      allShapesValid = false;
    }
  }

  const keyMatch = block.match(/::jsonb,\s*'([a-d])'/);
  if (!keyMatch || !choices.some((c) => c.key === keyMatch[1])) allKeysValid = false;

  // explanation is the quoted string after the correct key
  const afterKey = block.split(/::jsonb,\s*'[a-d]',/)[1] ?? '';
  const explanationMatch = afterKey.match(/'((?:[^']|'')+)'/);
  if (!explanationMatch || explanationMatch[1].length < 40) allExplained = false;

  if (!/'(49 CFR [0-9.()a-z]+|CDL Manual §[0-9.]+)'/.test(block)) allCited = false;
  if (!/'2026-07-16'/.test(block)) allVerified = false;

  const diffMatch = block.match(/'2026-07-16',\s*([0-9]+),/);
  if (!diffMatch || Number(diffMatch[1]) < 1 || Number(diffMatch[1]) > 3) allDifficulty = false;

  const tagsMatch = block.match(/'\{([a-z0-9,-]+)\}'/);
  if (!tagsMatch || tagsMatch[1].length === 0) allTagged = false;

  const sortMatch = block.match(/,\s*([0-9]+)\)[,;]/);
  if (sortMatch) sortOrders.add(Number(sortMatch[1]));
}
check('every question uses the canonical array choices shape', allShapesValid);
check('every correct_key exists among its choices', allKeysValid);
check('every question has a real explanation (40+ chars)', allExplained);
check('every question cites 49 CFR or the CDL Manual', allCited);
check('every question is verified 2026-07-16', allVerified);
check('every difficulty is 1..3', allDifficulty);
check('every question has tags', allTagged);
check(
  'prompts are unique',
  prompts.size === blocks.length,
  `${prompts.size} unique of ${blocks.length}`,
);
check(
  'sort orders are unique and complete 1..52',
  sortOrders.size === 52 && Math.min(...sortOrders) === 1 && Math.max(...sortOrders) === 52,
);
check('seed keeps question_count in sync', /set question_count = \(select count\(\*\)/.test(seed));

// ── 5. Server-side grading sanity (mirrors the API path) ───────────────────
const qsFixture = [
  { id: uuid(1), correctKey: 'a' },
  { id: uuid(2), correctKey: 'b' },
];
const graded = gradeAttempt(qsFixture, { [uuid(1)]: 'a' }, 80);
check(
  'API grading counts unanswered against the score',
  graded.total === 2 && graded.correct === 1 && graded.passed === false,
);

// ── 6. API route wiring ─────────────────────────────────────────────────────
const route = read('src/app/api/tests/attempt/route.ts');
check('route uses the guard stack (guardedPost)', /guardedPost\(/.test(route));
check('route validates with testAttemptSchema', /testAttemptSchema/.test(route));
check('route writes via the service-role client only', /createAdminClient\(\)/.test(route));
check('route grades server-side', /gradeAttempt\(/.test(route));
check('route rejects unknown tests', /unknown_test/.test(route));
check('route guards the not-live case', /not_live/.test(route));
check('route drops answers for foreign question ids', /known\.has\(/.test(route));
check('route bumps miss_count via the 031 RPC', /tlws_increment_question_misses/.test(route));
check(
  'route only counts answered-wrong as missed',
  /selectedKey !== null && !a\.isCorrect/.test(route),
);
check(
  'route upserts leads only with a verified email path',
  /from\('leads'\)/.test(route) && /onConflict: 'email'/.test(route),
);
// Review fixes locked in:
check(
  'lead writes are insert-if-absent (never clobber recorded consent/source)',
  (route.match(/ignoreDuplicates: true/g) ?? []).length >= 2,
);
check('route enforces same-origin (sec-fetch-site)', /sec-fetch-site/.test(route));
check(
  'email-only saves never insert a second attempt row',
  /data\.email && \(!data\.answers/.test(route),
);
check(
  'RPC errors are observed, not swallowed (supabase-js never throws)',
  /test_attempt_miss_rpc_failed/.test(route) && /rpcError/.test(route),
);
check(
  'read failures return retryable 500, never fake not_live',
  /test_attempt_read_failed/.test(route),
);
check('test + answer key fetched in one round trip', /questions\(id, correct_key\)/.test(route));

// ── 7. Migration 031 (RPC) posture ──────────────────────────────────────────
const m031 = read('supabase/migrations/031_practice_tests_attempts.sql');
check('031 creates the miss-count RPC', /tlws_increment_question_misses/.test(m031));
check(
  '031 revokes execute from anon + authenticated',
  /revoke execute[\s\S]*anon, authenticated/.test(m031),
);
check('031 grants execute to service_role', /grant execute[\s\S]*to service_role/.test(m031));
check('031 pins search_path', /set search_path = ''/.test(m031));

// ── 8. Study route + runner wiring ──────────────────────────────────────────
const studyPage = read('src/app/(learn)/practice-tests/[slug]/study/page.tsx');
check('study route is noindex', /noindex: true/.test(studyPage));
check('study route 404s unknown tests', /notFound\(\)/.test(studyPage));
check('study route guards zero questions', /questions\.length === 0/.test(studyPage));
check(
  'study route passes the Turnstile site key',
  /NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(studyPage),
);

const runner = read('src/components/test/StudyRunner.tsx');
// The results experience (score, review, email save, CTAs) moved to the shared
// TestResults in Milestone 3 — same behavior, one home for both runners.
const resultsShared = read('src/components/test/TestResults.tsx');
const runnerAll = runner + resultsShared;
check('runner is a client island', /^'use client';/.test(runner));
check(
  'runner resumes from localStorage via the pure helpers',
  /deserializeSession\(/.test(runner) && /serializeSession\(/.test(runner),
);
check('runner announces feedback (aria-live)', /aria-live="polite"/.test(runner));
check('runner exposes progress semantics', /role="progressbar"/.test(runner));
check('runner touch targets are ≥44px', /min-h-\[44px\]/.test(runner));
check(
  'runner reveals explanation + citation on answer',
  /q\.explanation/.test(runner) && /q\.cfrCite/.test(runner),
);
check(
  'runner posts the attempt to the API (via shared TestResults)',
  /\/api\/tests\/attempt/.test(runnerAll),
);
check('runner has retake', /Retake the test/.test(runnerAll));
check(
  'runner links Academy + Pre-School CTAs',
  /academy\/apply/.test(runnerAll) && /PRESCHOOL_PATH/.test(runnerAll),
);
// Review fixes locked in:
check(
  'attempt is logged once per sitting (persisted loggedAt guard)',
  /markLogged/.test(runner) && /session\.loggedAt/.test(runner),
);
check(
  'answered choices stay focusable (aria-disabled, never disabled)',
  /aria-disabled=\{answered\}/.test(runner) && !/[^-]disabled=\{answered\}/.test(runner),
);
check(
  'per-choice correctness carries screen-reader text, not just color',
  /\(correct answer\)/.test(runner) && /your answer — incorrect/.test(runner),
);
check(
  'no diesel-as-text on dark (contrast): red state uses border/bg with ink text',
  !/text-diesel/.test(runner),
);
check('email capture is a real form (Enter submits)', /<form onSubmit=/.test(resultsShared));
check(
  'email form parses the ok-envelope and surfaces server errors',
  /body\?\.ok/.test(resultsShared),
);
check(
  'failed submits remount Turnstile for a fresh single-use token',
  /setWidgetKey/.test(resultsShared),
);
check('Turnstile loads lazily on email-field intent', /setEngaged\(true\)/.test(resultsShared));
check(
  'forward navigation survives completion (Next never replaced away)',
  /Next →/.test(runner) && /allAnswered && <Button onClick=\{onFinish\}/.test(runner),
);
check('nav/CTA buttons reuse the design-system Button (focus rings)', /<Button/.test(runner));
check(
  'shared TextField powers the email input (label + error wiring)',
  /TextField/.test(resultsShared),
);

// ── 9. Go-live wiring ───────────────────────────────────────────────────────
const landing = read('src/app/(learn)/practice-tests/[slug]/page.tsx');
check(
  'landing gates Start Study Mode on a live bank',
  /live \?/.test(landing) && /Start Study Mode/.test(landing),
);
check(
  'landing keeps the honest coming-soon fallback panel',
  /Question bank coming soon/.test(landing),
);
check(
  'landing never advertises Timed before it ships (tile gated on modes)',
  /modes\.includes\('timed'\)/.test(landing),
);
check('landing derives the runner link from the catalog (studyHref)', /studyHref\(/.test(landing));
const featured = read('src/components/sections/FeaturedTest.tsx');
check(
  'homepage CTA derives from the catalog (testHref), pointing at GK',
  /testHref\('general-knowledge'\)/.test(featured),
);
check('homepage CTA no longer promises an unbuilt count', !/50 questions/.test(featured));

// ── 10. No secrets in client code ───────────────────────────────────────────
for (const f of ['src/components/test/StudyRunner.tsx', 'src/components/test/TestCard.tsx']) {
  const src = read(f);
  check(`${f}: no service-role import`, !/supabase\/admin/.test(src));
  check(`${f}: no service-role key reference`, !/SERVICE_ROLE/.test(src));
}
check(
  'study lib is DOM-free (usable in tests + runner)',
  !/window\./.test(read('src/lib/tests/study.ts')) ||
    !/localStorage\.setItem/.test(read('src/lib/tests/study.ts')),
);

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nStudy Mode tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
