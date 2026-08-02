/**
 * Practice-test → Academy conversion tracking (Revenue Conversion Sprint P1).
 *
 * The Academy and CDL Pre-School cards already existed on the results screen,
 * with pass/fail headline variants. What did not exist was any way to tell
 * whether a student clicked them — so the single most valuable moment in the
 * funnel was the one moment nobody could measure. This asserts the events are
 * wired, and, just as importantly, that wiring them changed no copy.
 *
 * It also guards the `Button` change that made the wiring possible. `onClick`
 * used to be swept into `...rest`, which only reached the <button> branch, so
 * passing it with `href` silently did nothing. Pulling it out to forward it to
 * the link branches would have dropped it from the <button> branch — which is
 * what the Retake control uses. Both directions are asserted here because
 * breaking Retake is a far worse outcome than missing an analytics event.
 *
 *   npx esbuild scripts/test-practice-test-cta.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { readFileSync } from 'node:fs';
import { TEST_EVENTS, resultsVariant } from '@/lib/tests/analytics';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const RESULTS = readFileSync('src/components/test/TestResults.tsx', 'utf8');
const BUTTON = readFileSync('src/components/ui/Button.tsx', 'utf8');

/* ------------------------------------------------------- event registry */

check('completion event name is unchanged', TEST_EVENTS.completed === 'practice_test_completed');
check(
  'academy CTA event name is stable',
  TEST_EVENTS.academyCtaClick === 'practice_test_academy_cta_click',
);
check(
  'preschool CTA event name is stable',
  TEST_EVENTS.preschoolCtaClick === 'practice_test_preschool_cta_click',
);
check(
  'event names are unique',
  new Set(Object.values(TEST_EVENTS)).size === Object.values(TEST_EVENTS).length,
);
check(
  'every event name is snake_case and prefixed',
  Object.values(TEST_EVENTS).every(
    (n) => /^practice_test_[a-z_]+$/.test(n) || n === 'practice_test_completed',
  ),
);

/* ------------------------------------------------------ variant mapping */

check('a passed sitting reports pass', resultsVariant(false, true) === 'pass');
check('a failed sitting reports fail', resultsVariant(false, false) === 'fail');
check(
  'a drill reports drill even when the subset was all correct',
  resultsVariant(true, true) === 'drill',
);
check('a drill reports drill when the subset was missed', resultsVariant(true, false) === 'drill');

/* ------------------------------------------------------- wiring present */

check('TestResults imports the event registry', /from '@\/lib\/tests\/analytics'/.test(RESULTS));
check(
  'the completion event fires through the registry, not a literal',
  RESULTS.includes('trackEvent(TEST_EVENTS.completed'),
);
check(
  'the Academy CTA fires its click event',
  RESULTS.includes('trackEvent(TEST_EVENTS.academyCtaClick'),
);
check(
  'the Pre-School CTA fires its click event',
  RESULTS.includes('trackEvent(TEST_EVENTS.preschoolCtaClick'),
);
check(
  'both CTA events carry the results variant',
  (RESULTS.match(/variant: resultsVariant\(drill, result\.passed\)/g) ?? []).length === 2,
);
check(
  'both CTA events are tagged with their placement',
  (RESULTS.match(/placement: 'results'/g) ?? []).length === 2,
);

/* ------------------------------------------- no personal data in payloads */

// The CTA payload object literals only — not the whole file, which legitimately
// handles an email in the separate opt-in form below the CTAs.
for (const m of RESULTS.matchAll(/trackEvent\(TEST_EVENTS\.\w+CtaClick,\s*\{([^}]*)\}/g)) {
  const payload = m[1];
  check('CTA payload carries no email', !/email/i.test(payload), payload);
  check('CTA payload carries no score', !/score/i.test(payload), payload);
}

/* ---------------------------------------------------- copy is unchanged */

// The exact strings that were on the page before this change. Wiring analytics
// must not have edited a single word — new marketing copy needs owner approval.
const UNCHANGED_COPY = [
  'Ready for the real thing?',
  'Want hands-on help?',
  'Apply to the Academy',
  'Still before the permit?',
  'See CDL Pre-School',
  'Trucking Life Academy trains CDL-A drivers in Dalton, GA',
];
for (const phrase of UNCHANGED_COPY) {
  check(`results copy still reads "${phrase}"`, RESULTS.includes(phrase));
}

check('the Academy CTA still points at the application', RESULTS.includes('href="/academy/apply"'));
check(
  'the Pre-School CTA still uses the shared path constant',
  RESULTS.includes('href={PRESCHOOL_PATH}'),
);

/* --------------------------------------------- Button forwards onClick */

check(
  'Button destructures onClick so it can be forwarded deliberately',
  /\bonClick,\s*\n\s*\.\.\.rest/.test(BUTTON),
);
check(
  'the internal-link branch forwards onClick',
  /<Link href=\{href\} className=\{classes\} onClick=\{onClick\}/.test(BUTTON),
);
check(
  'the external-link branch forwards onClick',
  /className=\{classes\}\s*\n\s*onClick=\{onClick\}/.test(BUTTON),
);
// The regression that matters most: Retake is a plain <button onClick>.
check(
  'the button branch still receives onClick after destructuring',
  /<button className=\{classes\} onClick=\{onClick\} \{\.\.\.rest\}>/.test(BUTTON),
);
check('the Retake control still passes onClick', RESULTS.includes('<Button onClick={onRetake}>'));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
