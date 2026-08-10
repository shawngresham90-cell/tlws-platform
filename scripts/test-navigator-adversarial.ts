/**
 * Adversarial pass over the pilot's inputs — the password form, the
 * driver's name, the problem report, the truck profile, the search query,
 * the build metadata and the redirect parameter.
 *
 * The existing access harness already proves the GATE holds: passwords,
 * cookies, tokens, expiry, forgery, protected paths. This one starts
 * where that leaves off and asks the two questions it does not:
 *
 *   1. HOW FAST CAN THE GATE BE GUESSED AT? Every other Navigator
 *      surface is rate limited — six route requests an hour, thirty
 *      searches a minute. The password form, which is the whole of the
 *      access control, had no limit at all. A constant-time comparison
 *      defends against a subtle attack while leaving the obvious one
 *      open: a shared static secret with unlimited attempts is guessable
 *      at line rate and nothing would have noticed. That is fixed, and
 *      the fix is pinned here.
 *
 *   2. WHAT HAPPENS WHEN THE INPUTS ARE HOSTILE? Not malformed —
 *      hostile. Newlines that would forge a section header in a pasted
 *      report. Right-to-left overrides. Zero-width joiners. A name
 *      100,000 characters long. A truck that is 400 feet tall. A build
 *      variable mis-set to an API key.
 *
 * The rule throughout: a hostile input must produce a REFUSAL or a
 * SANITISED value, never a crash and never a pass-through. Where an
 * input is rejected, the rejection must not describe the expected value.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-adversarial.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-adversarial.cjs && node /tmp/test-navigator-adversarial.cjs
 */
import { readFileSync } from 'node:fs';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import {
  UNLOCK_BURST,
  UNLOCK_REFILL_SECONDS,
  UNLOCK_THROTTLED,
  allowUnlockAttempt,
  unlockClientKey,
} from '@/lib/navigator-api/pilot-unlock-throttle';
import { sanitizeNextPath } from '@/lib/navigator-api/pilot-access';
import {
  MAX_FIRST_NAME_CHARS,
  normalizeFirstName,
  greetingText,
  routeStartText,
} from '@/lib/navigator/driver-greeting';
import { MAX_NOTE_CHARS, buildProblemReport, normalizeNote } from '@/lib/navigator/problem-report';
import { validateNavigatorTruckProfile } from '@/lib/navigator/truck-validation';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import { resolveBuildId, shortCommit, buildTime } from '@/lib/navigator/build-id';
import { redactCoordinates } from '@/lib/navigator/pilot-mode';
import { scrub } from '@/lib/navigator/road-test-report';
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH } from '@/lib/navigator-api/destination-search';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

const ACTION = readFileSync('src/app/(navigator)/navigator/access/actions.ts', 'utf8');
const ACCESS_PAGE = readFileSync('src/app/(navigator)/navigator/access/page.tsx', 'utf8');
const THROTTLE = readFileSync('src/lib/navigator-api/pilot-unlock-throttle.ts', 'utf8');

/** Every unpleasant string one place, so each surface faces the same set. */
const HOSTILE: readonly [string, string][] = Object.freeze([
  ['newline', 'Shawn\nREPORTED PROBLEM'],
  ['carriage return', 'Shawn\r\nX-Injected: 1'],
  ['tab', 'Sh\tawn'],
  ['null-ish control', 'Shawn\u0000'],
  ['bell', 'Shawn\u0007'],
  ['RTL override', 'Sha‮wn'],
  ['zero-width joiner', 'Sha‍wn'],
  ['zero-width space', 'Sha​wn'],
  ['BOM', '﻿Shawn'],
  ['script tag', '<script>alert(1)</script>'],
  ['sql-ish', "Robert'); DROP TABLE drivers;--"],
  ['path traversal', '../../etc/passwd'],
  ['template injection', '${process.env.HERE_API_KEY}'],
  ['url', 'https://evil.example/?k=abc'],
  ['coordinates', '33.748995,-84.387982'],
  ['api key shaped', 'aBcDeF0123456789aBcDeF0123456789'],
  ['emoji', '🚛🚛🚛'],
  ['very long', 'a'.repeat(100_000)],
  ['only spaces', '        '],
  ['empty', ''],
]);

/* ------------------------------------------- 1. password brute force */
{
  // The policy numbers, proven with an injected clock rather than by
  // waiting. This tests the CONSTANTS the module publishes, so a change
  // to them is a visible change here.
  let clock = 0;
  const bucket = new RateLimiter({
    capacity: UNLOCK_BURST,
    refillPerSecond: 1 / UNLOCK_REFILL_SECONDS,
    nowMs: () => clock,
  });
  let allowed = 0;
  for (let i = 0; i < UNLOCK_BURST + 20; i += 1) if (bucket.allow('ip')) allowed += 1;
  check(`throttle: exactly ${UNLOCK_BURST} attempts in a burst`, allowed === UNLOCK_BURST, allowed);
  check('throttle: the next one is refused', !bucket.allow('ip'));

  clock += (UNLOCK_REFILL_SECONDS - 1) * 1000;
  check('throttle: still refused a second before the refill', !bucket.allow('ip'));
  clock += 2000;
  check('throttle: one attempt is earned back after the refill window', bucket.allow('ip'));
  check('throttle: and only one', !bucket.allow('ip'));

  clock += UNLOCK_REFILL_SECONDS * 1000 * 1000;
  let afterLongWait = 0;
  for (let i = 0; i < UNLOCK_BURST + 5; i += 1) if (bucket.allow('ip')) afterLongWait += 1;
  check(
    'throttle: the burst refills to its ceiling and no further',
    afterLongWait === UNLOCK_BURST,
    afterLongWait,
  );

  check(
    'throttle: an hour of sustained guessing from one address is bounded',
    Math.floor(3600 / UNLOCK_REFILL_SECONDS) + UNLOCK_BURST <= 60,
    Math.floor(3600 / UNLOCK_REFILL_SECONDS) + UNLOCK_BURST,
  );

  // The real module: separate addresses must not share a bucket, or one
  // attacker locks out every driver.
  const keyA = `adversarial-a-${UNLOCK_BURST}`;
  const keyB = `adversarial-b-${UNLOCK_BURST}`;
  let a = 0;
  for (let i = 0; i < UNLOCK_BURST + 3; i += 1) if (allowUnlockAttempt(keyA)) a += 1;
  check('throttle: the live limiter enforces the same burst', a === UNLOCK_BURST, a);
  check('throttle: a different address is unaffected', allowUnlockAttempt(keyB));
}

/* --------------------------------------- 2. the throttle's bucket key */
{
  const h = (map: Record<string, string>) => ({ get: (n: string) => map[n] ?? null });

  check(
    'key: prefers the platform client-ip header',
    unlockClientKey(h({ 'x-nf-client-connection-ip': '5.5.5.5', 'x-forwarded-for': '1.1.1.1' })) ===
      '5.5.5.5',
  );
  check(
    'key: falls back to the LAST forwarded hop, not the first',
    unlockClientKey(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 9.9.9.9' })) === '9.9.9.9',
  );
  // The whole point of taking the last hop: earlier entries are
  // client-supplied, so keying on them would let an attacker mint a fresh
  // bucket per attempt just by changing a header.
  const spoofed = ['a', 'b', 'c'].map((s) =>
    unlockClientKey(h({ 'x-forwarded-for': `${s}, 9.9.9.9` })),
  );
  check(
    'key: a spoofed forwarded chain cannot mint a new bucket',
    new Set(spoofed).size === 1 && spoofed[0] === '9.9.9.9',
    spoofed,
  );
  check('key: no headers at all still produces a key', unlockClientKey(h({})) === 'unknown');
  check(
    'key: an empty header is not a key',
    unlockClientKey(h({ 'x-forwarded-for': '' })) === 'unknown',
  );
  check(
    'key: whitespace is trimmed rather than creating a twin bucket',
    unlockClientKey(h({ 'x-nf-client-connection-ip': '  5.5.5.5  ' })) === '5.5.5.5',
  );
}

/* ------------------------------------ 3. the throttle is wired first */
{
  const code = ACTION.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const throttleAt = code.indexOf('allowUnlockAttempt');
  const verifyAt = code.indexOf('verifyPilotPassword(password)');
  const configuredAt = code.indexOf('pilotConfigured()');
  check('wiring: the action throttles', throttleAt >= 0);
  check('wiring: it verifies', verifyAt >= 0);
  check(
    'wiring: the token is spent BEFORE the password is compared — no oracle',
    throttleAt >= 0 && verifyAt >= 0 && throttleAt < verifyAt,
    `${throttleAt} vs ${verifyAt}`,
  );
  check(
    'wiring: and before the configuration check, so an unconfigured deploy is not a free oracle either',
    throttleAt >= 0 && configuredAt >= 0 && throttleAt < configuredAt,
  );
  check(
    'wiring: the key comes from request headers, not the form',
    /unlockClientKey\(headers\(\)\)/.test(code),
  );
  check(
    'wiring: a throttled attempt redirects rather than falling through',
    new RegExp(`redirect\\(\`\\$\\{back\\}&error=\\$\\{UNLOCK_THROTTLED\\}\`\\)`).test(code),
    code.slice(throttleAt, throttleAt + 160),
  );

  check('page: renders a distinct throttled message', ACCESS_PAGE.includes('UNLOCK_THROTTLED'));
  check(
    'page: the message says how to recover',
    /Wait a couple of minutes and try again/.test(ACCESS_PAGE),
  );
  check(
    'page: and does NOT count down remaining attempts',
    !/attempts? (?:left|remaining)|\d+ of \d+/i.test(ACCESS_PAGE),
  );
  check(
    'page: the incorrect-password message still describes nothing about the password',
    /'Incorrect password\.'/.test(ACCESS_PAGE) &&
      !/too short|too long|must contain|characters/i.test(ACCESS_PAGE),
  );

  // Comment prose, with the leading asterisks stripped so the assertion
  // is about what the module SAYS, not about where the lines wrap.
  const throttleProse = THROTTLE.replace(/^\s*\*+/gm, ' ').replace(/\s+/g, ' ');
  check(
    'throttle module: documents the per-instance limitation rather than implying a global cap',
    /per warm instance, not global/.test(throttleProse),
    throttleProse.slice(
      throttleProse.indexOf('KNOWN LIMITATION'),
      throttleProse.indexOf('KNOWN LIMITATION') + 200,
    ),
  );
  check(
    'throttle module: explains why there is no global cap',
    /denial of service/i.test(THROTTLE),
  );
  check(
    'throttle module: never sees the password',
    !/password/i.test(THROTTLE.replace(/\/\*[\s\S]*?\*\//g, '')),
  );
  check(`throttle: the code is "${UNLOCK_THROTTLED}"`, UNLOCK_THROTTLED === 'throttled');
}

/* ------------------------------------------- 4. the driver's name */
{
  for (const [what, value] of HOSTILE) {
    let result: ReturnType<typeof normalizeFirstName> | 'threw';
    try {
      result = normalizeFirstName(value);
    } catch {
      result = 'threw';
    }
    check(`name: "${what}" does not crash the validator`, result !== 'threw');
    if (result === 'threw') continue;
    if (result.ok) {
      check(
        `name: "${what}" was accepted — so it must be clean`,
        /^[\p{L}][\p{L}’'-]*$/u.test(result.firstName),
        result.firstName,
      );
      check(
        `name: "${what}" cannot exceed the cap`,
        result.firstName.length <= MAX_FIRST_NAME_CHARS,
      );
    } else {
      check(
        `name: "${what}" is refused without describing the expected value`,
        !/password|secret|regex|pattern/i.test(result.reason),
        result.reason,
      );
    }
  }

  // The specific injections that would matter downstream.
  check(
    'name: a newline never survives into an accepted name',
    normalizeFirstName('Shawn\nAdmin').ok === false,
  );
  check(
    'name: 100k characters is refused, not truncated silently',
    normalizeFirstName('a'.repeat(100_000)).ok === false,
  );
  check(
    `name: exactly ${MAX_FIRST_NAME_CHARS} characters is allowed`,
    normalizeFirstName('a'.repeat(MAX_FIRST_NAME_CHARS)).ok === true,
  );
  check(
    `name: one over the cap is refused`,
    normalizeFirstName('a'.repeat(MAX_FIRST_NAME_CHARS + 1)).ok === false,
  );
  check('name: an ordinary name still works', normalizeFirstName('  Shawn ').ok === true);
  check('name: an apostrophe name still works', normalizeFirstName("O'Brien").ok === true);
  check('name: a hyphenated name still works', normalizeFirstName('Mary-Jane').ok === true);
  check('name: a non-Latin name still works', normalizeFirstName('José').ok === true);

  // And what the name is used FOR cannot be turned into something else.
  const accepted = normalizeFirstName('Shawn');
  if (accepted.ok) {
    for (const text of [
      greetingText('morning', accepted.firstName),
      routeStartText(accepted.firstName),
    ]) {
      check(`phrase: "${text.slice(0, 30)}…" is a single line`, !/[\r\n]/.test(text));
      check(`phrase: contains no markup`, !/[<>]/.test(text));
    }
  }
}

/* ------------------------------------------- 5. the problem report */
{
  for (const [what, value] of HOSTILE) {
    let note: string | 'threw';
    try {
      note = normalizeNote(value);
    } catch {
      note = 'threw';
    }
    check(`note: "${what}" does not crash`, note !== 'threw');
    if (note === 'threw') continue;
    check(`note: "${what}" is capped`, note.length <= MAX_NOTE_CHARS, note.length);
    // A newline in a note would forge a section header in the plain-text
    // report it gets pasted into. This is the whole reason the cap exists
    // alongside the collapse.
    check(
      `note: "${what}" carries no line break`,
      !/[\r\n]/.test(note),
      JSON.stringify(note.slice(0, 40)),
    );
  }
  check(
    'report: a forged section header collapses to one line',
    !normalizeNote('fine\n\nREPORTED PROBLEM\n  category: nothing').includes('\n'),
  );
  check(
    'report: an unknown category is refused',
    buildProblemReport({ categoryId: 'made-up' }).ok === false,
  );
  check(
    'report: a null category is refused',
    buildProblemReport({ categoryId: null }).ok === false,
  );
  check(
    'report: a valid category with a hostile note still builds, sanitised',
    buildProblemReport({ categoryId: 'gps', note: 'a\nb' }).ok === true,
  );

  // The scrubber the report applies on the way out.
  check('scrub: removes a coordinate', scrub('at 33.748995,-84.387982').includes('[coord]'));
  check(
    'scrub: removes an api key',
    scrub('apiKey=aBcDeF0123456789aBcDeF0123456789').includes('[redacted]'),
  );
  check(
    'scrub: removes a bearer token',
    scrub('authorization: Bearer abc123').includes('[redacted]'),
  );
  check(
    'scrub: leaves ordinary text alone',
    scrub('rerouted twice on I-75') === 'rerouted twice on I-75',
  );
  check('redact: a bare latitude is caught', redactCoordinates('33.748995').includes('[coord]'));
  check(
    'redact: a route mile is NOT mistaken for a coordinate',
    redactCoordinates('12.4 mi') === '12.4 mi',
  );
}

/* --------------------------------------------- 6. the truck profile */
{
  const bad = [
    ['400 ft tall', { heightFt: 400 }],
    ['negative height', { heightFt: -5 }],
    ['zero width', { widthFt: 0 }],
    ['NaN length', { lengthFt: Number.NaN }],
    ['Infinity weight', { grossWeightLbs: Infinity }],
    ['fractional axles', { axles: 2.5 }],
    ['no axles', { axles: 0 }],
    ['a million pounds', { grossWeightLbs: 1_000_000 }],
    ['70ft on 2 axles', { lengthFt: 70, axles: 2 }],
    ['hazmat class 12', { hazmatClass: '12' }],
    ['hazmat injection', { hazmatClass: '3; DROP TABLE' }],
    ['hazmat empty string', { hazmatClass: '' }],
  ] as const;
  for (const [what, patch] of bad) {
    let issues: ReturnType<typeof validateNavigatorTruckProfile> | 'threw';
    try {
      issues = validateNavigatorTruckProfile({ ...DEFAULT_TRUCK_PROFILE, ...patch });
    } catch {
      issues = 'threw';
    }
    check(`truck: "${what}" does not crash the validator`, issues !== 'threw');
    if (issues === 'threw') continue;
    check(`truck: "${what}" is rejected`, issues.length > 0, JSON.stringify(patch));
    for (const issue of issues) {
      check(
        `truck: the "${what}" message exposes no internals`,
        !/https?:|apiKey|process\.env/i.test(issue.message),
        issue.message,
      );
    }
  }
  check(
    'truck: a legal default profile still validates clean',
    validateNavigatorTruckProfile(DEFAULT_TRUCK_PROFILE).length === 0,
    validateNavigatorTruckProfile(DEFAULT_TRUCK_PROFILE),
  );
}

/* --------------------------------------------- 7. build metadata */
{
  for (const [what, value] of HOSTILE) {
    const id = resolveBuildId({ commitRef: value, context: value, builtAtIso: value });
    check(
      `build: "${what}" cannot become a sha`,
      /^([0-9a-f]{7}|unknown)$/.test(id.shortSha),
      id.shortSha,
    );
    check(
      `build: "${what}" cannot become a channel`,
      ['production', 'preview', 'branch', 'local', 'unknown'].includes(id.channel),
      id.channel,
    );
    check(
      `build: "${what}" cannot become a timestamp`,
      id.builtAt === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(id.builtAt),
      id.builtAt,
    );
    check(
      `build: "${what}" never appears verbatim in the label`,
      value.length < 3 || !id.label.includes(value),
      id.label,
    );
    check(
      `build: the "${what}" label stays one short line`,
      id.label.length < 120 && !/[\r\n]/.test(id.label),
      id.label.length,
    );
  }
  check(
    'build: a mis-set secret does not become the build id',
    shortCommit('sk-live-abcdef0123456789') === 'unknown',
  );
  check(
    'build: a non-UTC timestamp is refused rather than shifted',
    buildTime('2026-08-09T14:30-04:00') === null,
  );
  check(
    'build: a UTC timestamp is kept to the minute',
    buildTime('2026-08-09T14:30:59.123Z') === '2026-08-09T14:30Z',
  );
}

/* ------------------------------------------- 8. the redirect target */
{
  const open = [
    'https://evil.example',
    'http://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/admin',
    '/api/navigator/route',
    '/api/navigator/destination-search?q=x',
    '/navigator/access',
    '',
    '   ',
    '/drive/../admin',
    '/drive\n/admin',
  ];
  for (const candidate of open) {
    const out = sanitizeNextPath(candidate);
    check(
      `redirect: "${candidate.slice(0, 30)}" cannot leave the Navigator surface`,
      out === '/drive' || /^\/(?:drive|navigator)(?:[/?#]|$)/.test(out),
      out,
    );
    check(
      `redirect: "${candidate.slice(0, 30)}" never returns an absolute url`,
      !/^[a-z]+:/i.test(out),
      out,
    );
    check(
      `redirect: "${candidate.slice(0, 30)}" never returns a protocol-relative url`,
      !out.startsWith('//'),
      out,
    );
  }
  check('redirect: a legitimate Navigator path survives', sanitizeNextPath('/drive') === '/drive');
  check('redirect: with a query too', sanitizeNextPath('/navigator?x=1') === '/navigator?x=1');
}

/* ------------------------------- 9. search bounds, stated by the code */
{
  check('search: a minimum exists', MIN_SEARCH_LENGTH >= 2, MIN_SEARCH_LENGTH);
  check(
    'search: a maximum exists and is not generous',
    MAX_SEARCH_LENGTH <= 200,
    MAX_SEARCH_LENGTH,
  );
  const SEARCH_API = readFileSync('src/app/api/navigator/destination-search/route.ts', 'utf8');
  const ROUTE_API = readFileSync('src/app/api/navigator/route/route.ts', 'utf8');
  for (const [name, src] of [
    ['search', SEARCH_API],
    ['route', ROUTE_API],
  ] as const) {
    // Comments and imports name all three long before the handler runs
    // them, so the ordering has to be read off the EXPRESSIONS rather
    // than off the first mention of an identifier.
    // ...and only inside the HANDLER. The route file also binds the key
    // into its adapter at module scope, which happens once at cold start
    // and is not part of any request's ordering.
    const whole = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const handlerAt = whole.search(/export async function (?:GET|POST)\(/);
    check(`${name} API: has a handler to inspect`, handlerAt >= 0);
    const code = whole.slice(handlerAt < 0 ? 0 : handlerAt);
    const flagAt = code.indexOf("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true'");
    const authAt = code.indexOf('await requestHasPilotAccess(req)');
    const keyAt = code.indexOf('process.env.HERE_API_KEY');
    // The two endpoints reach the limiter differently — one calls it
    // directly, the other through the shared guarded-parse helper. Both
    // spend a token, which is what the ordering claim is about.
    const limiterAt = Math.max(
      code.indexOf('imiter.allow('),
      code.indexOf('guardedParseWithLimiter('),
    );
    check(
      `${name} API: the flag is checked first`,
      flagAt >= 0 && flagAt < authAt,
      `${flagAt}/${authAt}`,
    );
    check(
      `${name} API: authorization is checked before the provider key is even read`,
      authAt >= 0 && keyAt >= 0 && authAt < keyAt,
      `${authAt}/${keyAt}`,
    );
    check(
      `${name} API: an unauthorized caller cannot even spend a limiter token`,
      authAt >= 0 && limiterAt > authAt,
      `${authAt}/${limiterAt}`,
    );
    check(`${name} API: no error path returns a URL`, !/message:.*https?:\/\//.test(src));
    check(`${name} API: the key is never echoed`, !/apiKey.*(?:message|json\()/i.test(src));
  }
}

console.log(`navigator-adversarial: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
