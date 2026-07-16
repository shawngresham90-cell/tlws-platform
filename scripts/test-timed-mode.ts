/**
 * CDL Practice Tests — Milestone 3 (Timed Test) tests.
 *
 * Covers what Milestone 3 added:
 *   - Timed session state: the countdown anchors on the PERSISTED startedAt
 *     (refresh can never reset or extend the clock), answers changeable until
 *     the one-way submission latch, expiry math, storage roundtrips.
 *   - The runner: explicit start gate (clock starts on click, not load),
 *     visible role="timer", threshold-only screen-reader announcements,
 *     ZERO feedback/explanations/answer-keys in the exam view, auto-submit
 *     exactly once on expiry, duplicate-submission protection.
 *   - Wiring: catalog offers both modes, landing mode chooser, noindex timed
 *     route with unknown-test + mode + zero-question guards, shared
 *     TestResults (explanations revealed only at results), no client secrets.
 *
 * Run:
 *   npx esbuild scripts/test-timed-mode.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-timed-mode.cjs && node /tmp/test-timed-mode.cjs
 */
import { readFileSync } from 'node:fs';
import {
  TIMED_STORAGE_VERSION,
  answerTimedQuestion,
  deserializeTimedSession,
  formatRemaining,
  goToTimedQuestion,
  isExpired,
  markTimedLogged,
  newTimedSession,
  remainingMs,
  serializeTimedSession,
  submitTimedSession,
  timedStorageKey,
} from '@/lib/tests/timed';
import { TEST_CATALOG, getTest, studyHref, timedHref } from '@/lib/tests/catalog';

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

// ── 1. Clock math — the refresh-proof anchor ────────────────────────────────
const T0 = 1_700_000_000_000;
const LIMIT = 50 * 60; // seconds
const ids = ['q1', 'q2', 'q3'];
let s = newTimedSession('general-knowledge', T0);

check('new session anchors startedAt', s.startedAt === T0);
check('full time at start', remainingMs(s, LIMIT, T0) === LIMIT * 1000);
check('clock counts down', remainingMs(s, LIMIT, T0 + 10 * 60_000) === 40 * 60 * 1000);
check('clock never goes negative', remainingMs(s, LIMIT, T0 + 99 * 60_000) === 0);
check('not expired mid-test', isExpired(s, LIMIT, T0 + 49 * 60_000) === false);
check('expired exactly at the limit', isExpired(s, LIMIT, T0 + 50 * 60_000) === true);

// THE core Milestone-3 guarantee: a refresh restores the ORIGINAL clock.
const stored = serializeTimedSession(s);
const restored = deserializeTimedSession(stored, 'general-knowledge', ids);
check('refresh keeps the original startedAt (timer cannot reset)', restored?.startedAt === T0);
check(
  'remaining time after refresh reflects the ORIGINAL anchor',
  restored !== null && remainingMs(restored, LIMIT, T0 + 20 * 60_000) === 30 * 60 * 1000,
);
check(
  'corrupt startedAt → session discarded (never defaults to now)',
  deserializeTimedSession(
    stored.replace(`"startedAt":${T0}`, '"startedAt":"soon"'),
    'general-knowledge',
    ids,
  ) === null,
);

check('formatRemaining 50:00', formatRemaining(50 * 60 * 1000) === '50:00');
check('formatRemaining 0:59', formatRemaining(59 * 1000) === '0:59');
check('formatRemaining rounds up partial seconds', formatRemaining(500) === '0:01');
check('formatRemaining 0:00', formatRemaining(0) === '0:00');

// ── 2. Exam answer semantics — changeable until the latch ──────────────────
s = answerTimedQuestion(s, 'q1', 'a');
check('answer recorded', s.answers.q1 === 'a');
s = answerTimedQuestion(s, 'q1', 'c');
check('answers are CHANGEABLE before submit (exam strategy)', s.answers.q1 === 'c');
check('same-answer re-click is a no-op object', answerTimedQuestion(s, 'q1', 'c') === s);

check('goTo clamps below 0', goToTimedQuestion(s, -3, 3).currentIndex === 0);
check('goTo clamps above max', goToTimedQuestion(s, 42, 3).currentIndex === 2);

// ── 3. Submission — a one-way latch, exactly once ───────────────────────────
const submitted = submitTimedSession(s, T0 + 1000);
check('submit stamps submittedAt', submitted.submittedAt === T0 + 1000);
check(
  'second submit is a no-op (duplicate protection)',
  submitTimedSession(submitted, T0 + 9999) === submitted,
);
check('answers are frozen after submit', answerTimedQuestion(submitted, 'q2', 'b') === submitted);
const loggedOnce = markTimedLogged(submitted, T0 + 2000);
check(
  'attempt-log latch stamps once',
  loggedOnce.loggedAt === T0 + 2000 && markTimedLogged(loggedOnce, T0 + 5000) === loggedOnce,
);

// Latch + log survive the storage roundtrip — refresh after expiry can't resubmit.
const roundtrip = deserializeTimedSession(
  serializeTimedSession(loggedOnce),
  'general-knowledge',
  ids,
);
check(
  'submittedAt survives refresh (no resubmission window)',
  roundtrip?.submittedAt === T0 + 1000,
);
check('loggedAt survives refresh (no duplicate attempt rows)', roundtrip?.loggedAt === T0 + 2000);

// ── 4. Storage hygiene (mirrors the Study rules) ────────────────────────────
check(
  'storage key is versioned + slug-scoped + distinct from study',
  timedStorageKey('general-knowledge') === `tlws:timed:v${TIMED_STORAGE_VERSION}:general-knowledge`,
);
check('slug mismatch → null', deserializeTimedSession(stored, 'air-brakes', ids) === null);
check(
  'junk → null, never throws',
  deserializeTimedSession('{nope', 'general-knowledge', ids) === null,
);
check(
  'version mismatch → null',
  deserializeTimedSession(
    stored.replace(`"v":${TIMED_STORAGE_VERSION}`, '"v":99'),
    'general-knowledge',
    ids,
  ) === null,
);
const shrunk = deserializeTimedSession(serializeTimedSession(s), 'general-knowledge', ['q1']);
check('unknown answer ids dropped', shrunk !== null && Object.keys(shrunk.answers).length === 1);

// ── 5. Catalog — both modes shipped, hrefs derived ──────────────────────────
const gk = getTest('general-knowledge');
check(
  'GK offers Study AND Timed',
  gk?.modes.includes('study') === true && gk?.modes.includes('timed') === true,
);
check('GK timed limit is the reserved 50 minutes', gk?.timeLimitSeconds === 50 * 60);
check(
  'every timed test has a time limit',
  TEST_CATALOG.every((t) => !t.modes.includes('timed') || (t.timeLimitSeconds ?? 0) > 0),
);
check(
  'timedHref shape',
  timedHref('general-knowledge') === '/practice-tests/general-knowledge/timed',
);
check(
  'study + timed routes are distinct',
  studyHref('general-knowledge') !== timedHref('general-knowledge'),
);

// ── 6. Timed route guards ───────────────────────────────────────────────────
const timedPage = read('src/app/(learn)/practice-tests/[slug]/timed/page.tsx');
check('timed route is noindex', /noindex: true/.test(timedPage));
check('timed route 404s unknown tests', /notFound\(\)/.test(timedPage));
check(
  'timed route 404s tests without the timed mode',
  /modes\.includes\('timed'\)/.test(timedPage),
);
check('timed route guards zero questions', /questions\.length === 0/.test(timedPage));
check(
  'timed route only prerenders timed-capable tests',
  /filter\(\(t\) => t\.modes\.includes\('timed'\)\)/.test(timedPage),
);
check(
  'timed route passes the Turnstile site key',
  /NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(timedPage),
);

// ── 7. The runner — exam rules enforced in code ─────────────────────────────
const runner = read('src/components/test/TimedRunner.tsx');
check('runner is a client island', /^'use client';/.test(runner));
check(
  'clock starts on the Begin click, never on page load',
  /onBegin=\{\(\) => setSession\(newTimedSession\(test\.slug, Date\.now\(\)\)\)\}/.test(runner),
);
check('start gate names the exam conditions', /Exam conditions/.test(runner));
check('visible countdown is role="timer"', /role="timer"/.test(runner));
check(
  'screen-reader announcements at thresholds only',
  /ANNOUNCE_AT_MS/.test(runner) && /aria-live="polite"/.test(runner),
);
check(
  'NO explanations render during the exam',
  !/q\.explanation/.test(runner) && !/q\.cfrCite/.test(runner),
);
check('NO answer key is even referenced in the exam view', !/correctKey/.test(runner));
check(
  'expiry auto-submits via the one-way latch',
  /remaining === 0/.test(runner) && /submitTimedSession/.test(runner),
);
check(
  'results render only after the submittedAt latch',
  /session\.submittedAt !== undefined/.test(runner),
);
check('expiry shows the auto-submit notice', /submitted automatically/.test(runner));
check(
  'unanswered-submit needs an explicit confirm',
  /Keep working/.test(runner) && /unanswered/.test(runner),
);
check(
  'resume + persistence via the pure timed helpers',
  /deserializeTimedSession\(/.test(runner) && /serializeTimedSession\(/.test(runner),
);
check('touch targets ≥44px', /min-h-\[44px\]/.test(runner));
check('refresh warning shown to the student', /refreshing never resets it/i.test(runner));
check(
  'exam choices expose selection state (aria-pressed)',
  /aria-pressed=\{isSelected\}/.test(runner),
);

// ── 8. Shared results — explanations revealed only at results ───────────────
const results = read('src/components/test/TestResults.tsx');
check(
  'TestResults reveals explanations + citations',
  /q\.explanation/.test(results) && /q\.cfrCite/.test(results),
);
check('TestResults grades with the shared gradeAttempt', /gradeAttempt\(/.test(results));
check('TestResults logs the attempt once (persisted guard)', /alreadyLogged/.test(results));
check(
  'TimedRunner renders results via the shared TestResults',
  /<TestResults/.test(runner) && /modeLabel="Timed Test"/.test(runner),
);
const studyRunner = read('src/components/test/StudyRunner.tsx');
check(
  'StudyRunner renders results via the SAME shared TestResults',
  /<TestResults/.test(studyRunner) && /modeLabel="Study Mode"/.test(studyRunner),
);
check(
  'Study Mode immediate-feedback behavior unchanged',
  /aria-disabled=\{answered\}/.test(studyRunner) && /Not quite — the answer is/.test(studyRunner),
);

// ── 9. Landing mode chooser ──────────────────────────────────────────────────
const landing = read('src/app/(learn)/practice-tests/[slug]/page.tsx');
check('landing offers Start Study Mode', /Start Study Mode/.test(landing));
check(
  'landing offers Start Timed Test (gated on modes)',
  /Start Timed Test/.test(landing) && /modes\.includes\('timed'\)/.test(landing),
);
check('landing derives the timed link from the catalog', /timedHref\(/.test(landing));
check('landing states exam conditions honestly', /no feedback until you submit/i.test(landing));

// ── 10. No secrets in the new client code ────────────────────────────────────
for (const f of ['src/components/test/TimedRunner.tsx', 'src/components/test/TestResults.tsx']) {
  const src = read(f);
  check(`${f}: no service-role import`, !/supabase\/admin/.test(src));
  check(`${f}: no service-role key reference`, !/SERVICE_ROLE/.test(src));
}
check('timed lib is DOM-free', !/window\./.test(read('src/lib/tests/timed.ts')));

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nTimed Mode tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
