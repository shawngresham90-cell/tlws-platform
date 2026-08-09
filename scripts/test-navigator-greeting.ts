/**
 * Driver greeting + initial route-start phrase.
 *
 * Four things are pinned here, in this order:
 *
 *   1. FIRST NAME validation — the allow-list, against the injection and
 *      junk a free-text field attracts.
 *   2. TIME BUCKETS — the four boundary minutes, exactly as specified,
 *      plus the property that makes them testable at all: the hour is an
 *      argument, never a clock read.
 *   3. VOICE ARBITRATION — both new phrases lose to maneuver, HOS and
 *      status speech, are DROPPED rather than queued when the speaker is
 *      busy, and can never be said twice.
 *   4. THE INITIAL-ROUTE TRIGGER — driven through the REAL lifecycle with
 *      scripted ports, so "a reroute cannot fire it" is a fact about the
 *      state machine rather than a claim about a mock. The transition
 *      table itself is asserted, so the proof fails loudly if a future
 *      edit ever adds a second way into `route-ready`.
 *
 * The lifecycle fixtures (line geometry, vertical replacement, drive
 * helper) are the ones test-navigator-pilot.ts already proved drive a real
 * off-route → rerouting → replaced sequence. They are reproduced rather
 * than shared because these harnesses are standalone bundles.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-greeting.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-greeting.cjs && node /tmp/test-navigator-greeting.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  createDriverPhraseAnnouncer,
  getGreetingPeriod,
  greetingText,
  greetingVoiceRequest,
  normalizeFirstName,
  routeStartText,
  routeStartVoiceRequest,
  GREETING_VOICE_ID,
  ROUTE_START_VOICE_ID,
  MAX_FIRST_NAME_CHARS,
} from '@/lib/navigator/driver-greeting';
import {
  createVoiceGuidance,
  createHosAnnouncer,
  MANEUVER_GROUP,
  type SpeechPort,
  type VoiceRequest,
} from '@/lib/navigator/voice-guidance';
import {
  createNavigationLifecycle,
  LIFECYCLE_TRANSITIONS,
  type LifecycleState,
  type NavigationLifecycle,
  type PlanFetchResult,
  type PlanRequest,
} from '@/lib/navigator/navigation-lifecycle';
import type {
  ReplacementFetchResult,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { PositionState } from '@/lib/navigator/types';
import type { LatLng } from '@/lib/map/bounds';
import type { RemainingClocks, TruckProfile } from '@/lib/trip-planner/types';
import { DriverNameEntry } from '@/components/navigator/DriverNameEntry';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The ARGUMENTS of `fn(...)`, by balanced parentheses. A regex cannot do
 * this: `fn\([\s\S]*?firstName` happily matches a `firstName` hundreds of
 * lines below the call it was meant to inspect, which is how the first
 * version of the privacy checks below reported a leak that did not exist.
 * Returns '' when the call is absent, so "the name is not in it" can never
 * pass by the call having been renamed away — the caller asserts presence.
 */
function callArgs(src: string, fn: string): string {
  const start = src.indexOf(`${fn}(`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start + fn.length; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(start + fn.length + 1, i);
    }
  }
  return '';
}

/** Scripted speech port: an utterance ends only when the test says so. */
function fakePort() {
  const spoken: string[] = [];
  let pendingDone: (() => void) | null = null;
  const port: SpeechPort = {
    supported: true,
    speak(text, onDone) {
      spoken.push(text);
      pendingDone = onDone;
    },
    cancel() {
      pendingDone = null;
    },
  };
  return {
    port,
    spoken,
    /** End the current utterance, if any, so the queue drains. */
    finish() {
      const d = pendingDone;
      pendingDone = null;
      d?.();
    },
  };
}

const NAME = 'Shawn';
const HOUR = 9;
const GREETING_SAID = 'Good morning, Shawn.';
const ROUTE_SAID = "Here's your route, Shawn. Now let's get it!";

// =====================================================================
// 1. FIRST NAME — the allow-list
// =====================================================================
{
  const ok = (raw: string, expect: string, label: string) => {
    const r = normalizeFirstName(raw);
    check(`name: ${label}`, r.ok && r.firstName === expect, r);
  };
  // Requirements 5-8.
  ok('Shawn', 'Shawn', 'a normal first name is accepted unchanged');
  ok("O'Brien", "O'Brien", 'a straight apostrophe is supported');
  ok('O’Brien', 'O’Brien', 'a curly apostrophe is supported');
  ok('Anne-Marie', 'Anne-Marie', 'a hyphenated name is supported');
  ok('   Shawn   ', 'Shawn', 'surrounding whitespace is trimmed');
  ok('José', 'José', 'a non-ASCII letter is still a letter');
  ok('Ng', 'Ng', 'a two-letter name is fine');
  ok('A', 'A', 'a single letter is fine');
  ok('A'.repeat(MAX_FIRST_NAME_CHARS), 'A'.repeat(MAX_FIRST_NAME_CHARS), 'the cap itself is legal');

  const bad = (raw: unknown, label: string) => {
    const r = normalizeFirstName(raw as string);
    check(
      `name: rejects ${label}`,
      !r.ok && typeof (r as { reason?: unknown }).reason === 'string',
      r,
    );
  };
  // Requirement 9 — newline and control characters.
  bad('Shawn\n', 'a trailing newline');
  bad('Shawn\nGresham', 'an embedded newline');
  bad('Shawn\r\nX', 'a CRLF');
  bad('Shawn\tG', 'a tab');
  bad('Shawn\u0000', 'a NUL byte');
  bad('Shawn\u0085', 'a C1 control character');
  bad('\u001B[31mShawn', 'an ANSI escape sequence');
  // Requirement 10 — HTML / script injection.
  bad('<script>alert(1)</script>', 'a script tag');
  bad('<b>Shawn</b>', 'HTML markup');
  bad('Shawn<', 'a bare angle bracket');
  bad('javascript:alert(1)', 'a javascript: URL');
  bad('&amp;', 'an HTML entity');
  bad('"Shawn"', 'quotes');
  bad('Shawn`', 'a backtick');
  bad('{{name}}', 'a template expression');
  // Requirement 11 — length.
  bad('A'.repeat(MAX_FIRST_NAME_CHARS + 1), 'one character over the cap');
  bad('A'.repeat(5000), 'an absurdly long paste');
  // Obviously-invalid input generally.
  bad('', 'an empty string');
  bad('    ', 'whitespace only');
  bad('shawn@example.com', 'an email address');
  bad('555-123-4567', 'a phone number');
  bad('Shawn Gresham', 'a full name with a space (first name only)');
  bad('-Shawn', 'a leading hyphen');
  bad('Shawn-', 'a trailing hyphen');
  bad("'", 'a lone apostrophe');
  bad('-', 'a lone hyphen');
  bad('7', 'a digit');
  bad('Shawn2', 'a trailing digit');
  bad('🙂', 'an emoji');
  bad(null, 'null');
  bad(undefined, 'undefined');
  bad(42, 'a number');
  bad({ toString: () => 'Shawn' }, 'an object that stringifies');

  const r = normalizeFirstName('<script>');
  check(
    'name: the rejection reason is a short plain sentence',
    !r.ok && r.reason.length < 80 && !/[<>{}\\]/.test(r.reason),
    r,
  );
}

// =====================================================================
// 2. TIME BUCKETS — the four specified boundaries
// =====================================================================
{
  // Requirements 1-4, named for the clock times they came from.
  check('time: 11:59 AM -> Good morning', getGreetingPeriod(11) === 'morning');
  check('time: 12:00 PM -> Good afternoon', getGreetingPeriod(12) === 'afternoon');
  check('time: 4:59 PM -> Good afternoon', getGreetingPeriod(16) === 'afternoon');
  check('time: 5:00 PM -> Good evening', getGreetingPeriod(17) === 'evening');

  // The whole dial, so a future edit cannot fix one boundary by breaking
  // another.
  const expected = new Map<number, string>();
  for (let h = 0; h <= 11; h++) expected.set(h, 'morning');
  for (let h = 12; h <= 16; h++) expected.set(h, 'afternoon');
  for (let h = 17; h <= 23; h++) expected.set(h, 'evening');
  const wrong = [...expected.keys()].filter((h) => getGreetingPeriod(h) !== expected.get(h));
  check('time: every hour 0-23 lands in the specified bucket', wrong.length === 0, wrong);
  check('time: midnight is morning', getGreetingPeriod(0) === 'morning');
  check('time: 23:00 is evening', getGreetingPeriod(23) === 'evening');

  // Sentence shape, with the sanitized name.
  check('greeting text: morning', greetingText('morning', NAME) === GREETING_SAID);
  check('greeting text: afternoon', greetingText('afternoon', NAME) === 'Good afternoon, Shawn.');
  check('greeting text: evening', greetingText('evening', NAME) === 'Good evening, Shawn.');
  check(
    'greeting text: uses the sanitized name verbatim',
    greetingText('morning', "O'Brien") === "Good morning, O'Brien.",
  );
  check('route-start text is the exact owner phrasing', routeStartText(NAME) === ROUTE_SAID);
  check(
    'greeting: the spoken line ends up matching end to end',
    greetingVoiceRequest(HOUR, NAME)?.text === GREETING_SAID,
  );

  // Nothing honest to say -> say nothing.
  check('greeting: no request without a name', greetingVoiceRequest(9, null) === null);
  check('greeting: no request without an hour', greetingVoiceRequest(null, NAME) === null);
  check('greeting: no request on a NaN hour', greetingVoiceRequest(Number.NaN, NAME) === null);
  check('greeting: no request on an out-of-range hour', greetingVoiceRequest(24, NAME) === null);
  check('greeting: no request on a negative hour', greetingVoiceRequest(-1, NAME) === null);
  check('route-start: no request without a name', routeStartVoiceRequest(null) === null);
}

// =====================================================================
// 2b. NO SECOND VOICE SYSTEM, NO CLOCK IN THE CORE
// =====================================================================
{
  const lib = strip(readFileSync('src/lib/navigator/driver-greeting.ts', 'utf8'));
  check('purity: the greeting core never touches Date', !/\bnew\s+Date\b|\bDate\s*[.(]/.test(lib));
  check(
    'purity: the greeting core never touches storage',
    !/localStorage|sessionStorage|indexedDB/i.test(lib),
  );
  check(
    'architecture: the greeting core builds no speech engine of its own',
    !/speechSynthesis|SpeechSynthesisUtterance|createVoiceGuidance/i.test(lib),
  );

  const screen = strip(readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8'));
  check(
    'architecture: the phrases ride the ONE existing voice instance',
    (screen.match(/createVoiceGuidance\(/g) ?? []).length === 1,
  );
  check(
    'architecture: the local browser hour is obtained at the component edge',
    /localHour:\s*new Date\(Date\.now\(\)\)\.getHours\(\)/.test(screen),
    'DrivingScreen no longer supplies the device local hour',
  );
  check(
    'architecture: the personal phrases are requested AFTER the maneuver announcer',
    screen.indexOf('maneuverAnnouncerRef.current.collect') > 0 &&
      screen.indexOf('maneuverAnnouncerRef.current.collect') <
        screen.indexOf('driverPhraseAnnouncerRef.current.collect'),
  );
}

// =====================================================================
// 3. VOICE ARBITRATION — priority, drop-not-queue, announce-once
// =====================================================================
const greeting = (): VoiceRequest => greetingVoiceRequest(HOUR, NAME)!;
const routeStart = (): VoiceRequest => routeStartVoiceRequest(NAME)!;

{
  check(
    'priority: the greeting is the lowest priority there is',
    greeting().priority === 'passive',
  );
  check('priority: so is the route-start phrase', routeStart().priority === 'passive');
  check(
    'priority: neither phrase joins the maneuver supersession group',
    greeting().group === undefined && routeStart().group === undefined,
  );
  check(
    'keys: the two announce-once ids are stable and distinct',
    greeting().id === GREETING_VOICE_ID &&
      routeStart().id === ROUTE_START_VOICE_ID &&
      // Widened deliberately: as literal types TS can prove these differ,
      // and rejects the comparison. The point of the check is that a
      // future edit cannot collapse them into one key, which is a runtime
      // property of the two constants, not of their declared types.
      (GREETING_VOICE_ID as string) !== (ROUTE_START_VOICE_ID as string),
  );
  check(
    'keys: the id carries no route id, so the next trip cannot replay it',
    !/route:|:r\d/.test(ROUTE_START_VOICE_ID),
    ROUTE_START_VOICE_ID,
  );
  check(
    'keys: the id carries no name, so a correction cannot re-greet',
    greetingVoiceRequest(HOUR, 'Shawn')!.id === greetingVoiceRequest(HOUR, 'Dale')!.id,
  );
  check(
    'keys: the id carries no hour, so a clock tick cannot re-greet',
    greetingVoiceRequest(9, NAME)!.id === greetingVoiceRequest(20, NAME)!.id,
  );
}

// Requirement 12: the greeting speaks exactly once.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  check('voice: an idle speaker says the greeting', v.request(greeting()) === 'spoken');
  check('voice: and it is the right sentence', f.spoken[0] === GREETING_SAID, f.spoken);
  f.finish();
  check(
    'voice: a second identical request is a repeat drop',
    v.request(greeting()) === 'dropped-repeat',
  );
  check('voice: nothing was said twice', f.spoken.length === 1, f.spoken);
}

// Requirements 15 + 17: a maneuver beats the greeting, which is DROPPED.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request({
    id: 'maneuver:1:execute',
    priority: 'normal',
    group: MANEUVER_GROUP,
    text: 'Turn right onto Old Mill Road.',
  });
  check(
    'arbitration: maneuver speech beats the greeting — it is dropped',
    v.request(greeting()) === 'dropped-passive-busy',
  );
  check(
    'arbitration: and the greeting is NOT sitting in the queue',
    !v.snapshot().queuedIds.includes(GREETING_VOICE_ID),
    v.snapshot(),
  );
  f.finish();
  check(
    'arbitration: when the maneuver ends, no stale greeting follows it',
    f.spoken.length === 1 && f.spoken[0].startsWith('Turn right'),
    f.spoken,
  );
}

// Requirement 24: the same, for the route-start phrase.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request({ id: 'm', priority: 'normal', group: MANEUVER_GROUP, text: 'Turn right.' });
  check(
    'arbitration: maneuver speech beats the route-start phrase',
    v.request(routeStart()) === 'dropped-passive-busy',
  );
  check(
    'arbitration: and it is dropped, not queued',
    !v.snapshot().queuedIds.includes(ROUTE_START_VOICE_ID),
    v.snapshot(),
  );
}

// A merely QUEUED maneuver is enough to drop a passive phrase.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request({ id: 'status:1', priority: 'normal', text: 'Position approximate.' });
  v.request({
    id: 'maneuver:2:approach',
    priority: 'normal',
    group: MANEUVER_GROUP,
    text: 'Turn left.',
  });
  check(
    'arbitration: a QUEUED maneuver also drops the route-start phrase',
    v.request(routeStart()) === 'dropped-passive-busy',
  );
  check(
    'arbitration: the queue still holds only the maneuver',
    v.snapshot().queuedIds.length === 1 && v.snapshot().queuedIds[0] === 'maneuver:2:approach',
    v.snapshot().queuedIds,
  );
}

// Requirements 16 + 25: HOS speech beats both phrases, in both directions.
{
  const remaining: RemainingClocks = {
    drivingMin: 20,
    windowMin: 300,
    cycleMin: 900,
    untilBreakMin: 20,
    limitedBy: '11-hour',
    legalDrivingMin: 20,
  };
  const hos = createHosAnnouncer().collect(
    { severity: 'critical', text: 'Driving limit in 0:20', clock: 'driving' },
    remaining,
  )[0];
  check('arbitration: the HOS line under test really is critical', hos.priority === 'critical');

  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request(hos);
  check(
    'arbitration: HOS speech beats the greeting',
    v.request(greeting()) === 'dropped-passive-busy',
  );
  check(
    'arbitration: HOS speech beats the route-start phrase',
    v.request(routeStart()) === 'dropped-passive-busy',
  );

  // And the other direction: a critical HOS line preempts a greeting that
  // already has the speaker, so a safety warning is never made to wait.
  const g = fakePort();
  const vv = createVoiceGuidance(g.port);
  vv.request(greeting());
  check(
    'arbitration: the greeting had the speaker',
    vv.snapshot().speakingId === GREETING_VOICE_ID,
  );
  check('arbitration: a critical HOS line preempts the greeting', vv.request(hos) === 'spoken');
  check(
    'arbitration: the HOS warning is what the driver actually hears',
    vv.snapshot().speakingId === hos.id && g.spoken.at(-1) === hos.text,
    g.spoken,
  );
}

// Voice starts muted by design: a muted greeting is silent and is not
// burned, exactly like every other announcement made while voice is off.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port, { startMuted: true });
  check('voice: muted drops the greeting', v.request(greeting()) === 'dropped-muted');
  check('voice: and says nothing at all', f.spoken.length === 0, f.spoken);
  v.unmute();
  check(
    'voice: once the driver enables voice, the greeting can still speak',
    v.request(greeting()) === 'spoken',
  );
}

// =====================================================================
// 4. THE ANNOUNCER WINDOW — renders, remounts, duplicate notifications
// =====================================================================
const at = (lifecycleState: LifecycleState) => ({
  firstName: NAME,
  localHour: HOUR,
  lifecycleState,
});

// Requirements 13 + 14.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const a = createDriverPhraseAnnouncer();
  for (let i = 0; i < 50; i++) {
    for (const r of a.collect(at('idle'))) v.request(r);
    f.finish();
  }
  for (let i = 0; i < 50; i++) {
    for (const r of a.collect(at('route-ready'))) v.request(r);
    f.finish();
  }
  check(
    'announcer: 100 repeated renders produce each phrase exactly once',
    f.spoken.length === 2 && f.spoken[0] === GREETING_SAID && f.spoken[1] === ROUTE_SAID,
    f.spoken,
  );
}
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const a = createDriverPhraseAnnouncer();
  for (const s of ['idle', 'planning', 'route-ready', 'route-ready', 'route-ready'] as const) {
    for (const r of a.collect(at(s))) v.request(r);
    f.finish();
  }
  check(
    'announcer: a duplicate route-ready notification does not replay',
    f.spoken.filter((t) => t === ROUTE_SAID).length === 1,
    f.spoken,
  );
}
{
  // A REMOUNT is a fresh announcer against the SAME voice instance — the
  // ledger, not the announcer, is what carries announce-once across it.
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  for (let mount = 0; mount < 3; mount++) {
    const a = createDriverPhraseAnnouncer();
    for (const r of a.collect(at('idle'))) v.request(r);
    f.finish();
    for (const r of a.collect(at('route-ready'))) v.request(r);
    f.finish();
  }
  check('announcer: three remounts still say each phrase once', f.spoken.length === 2, f.spoken);
}
{
  const a = createDriverPhraseAnnouncer();
  const any = (['idle', 'planning', 'route-ready'] as const).flatMap((s) =>
    a.collect({ firstName: null, localHour: HOUR, lifecycleState: s }),
  );
  check('announcer: no name means no phrases at all', any.length === 0, any);
}
{
  // The greeting window closes the moment guidance is live, and never
  // reopens — a greeting mid-trip is the stale line this must not produce.
  const a = createDriverPhraseAnnouncer();
  check('announcer: idle offers the greeting', a.collect(at('idle')).length === 1);
  check('announcer: navigating closes the window', a.collect(at('navigating')).length === 0);
  check(
    'announcer: and it stays closed even back at idle',
    a.collect(at('idle')).length === 0,
    'the greeting window reopened',
  );

  for (const s of ['navigating', 'off-route', 'rerouting', 'final-approach', 'arrived'] as const) {
    const fresh = createDriverPhraseAnnouncer();
    check(
      `announcer: a session first seen in '${s}' never greets`,
      fresh.collect(at(s)).every((r) => r.id !== GREETING_VOICE_ID),
    );
  }
}
{
  // Requirements 19-22, at the announcer: no state but route-ready offers
  // the route-start phrase.
  const states: LifecycleState[] = [
    'idle',
    'planning',
    'navigating',
    'off-route',
    'rerouting',
    'final-approach',
    'arrived',
    'completed',
  ];
  const leaked = states.filter((s) =>
    createDriverPhraseAnnouncer()
      .collect(at(s))
      .some((r) => r.id === ROUTE_START_VOICE_ID),
  );
  check(
    'announcer: no state but route-ready offers the route-start phrase',
    leaked.length === 0,
    leaked,
  );
}
{
  // "Once per live session" survives a whole second trip.
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const a = createDriverPhraseAnnouncer();
  for (const s of [
    'idle',
    'planning',
    'route-ready',
    'navigating',
    'arrived',
    'completed',
    'idle',
    'planning',
    'route-ready',
  ] as const) {
    for (const r of a.collect(at(s))) v.request(r);
    f.finish();
  }
  check(
    'session: a second trip in the same session repeats neither phrase',
    f.spoken.length === 2 && f.spoken[0] === GREETING_SAID && f.spoken[1] === ROUTE_SAID,
    f.spoken,
  );
}

// =====================================================================
// 5. THE LIFECYCLE PROOF — reroutes structurally cannot fire it
// =====================================================================
{
  // The structural half. This is what makes "route-ready == the initial,
  // validated route" a fact rather than a convention, and it is why no
  // route id is consulted anywhere in this feature.
  const intoRouteReady = Object.entries(LIFECYCLE_TRANSITIONS)
    .filter(([, tos]) => (tos as readonly string[]).includes('route-ready'))
    .map(([from]) => from);
  check(
    'lifecycle: the ONLY way into route-ready is from planning',
    intoRouteReady.length === 1 && intoRouteReady[0] === 'planning',
    intoRouteReady,
  );
  check(
    'lifecycle: rerouting can never land in route-ready',
    !LIFECYCLE_TRANSITIONS.rerouting.includes('route-ready'),
    LIFECYCLE_TRANSITIONS.rerouting,
  );
}

/* -------------------------------------------------- lifecycle fixtures */

const T0 = 1_754_000_000_000;
const LAT0 = 35;
const LNG0 = -85;
const MI_PER_STEP = 0.0690937; // 0.001° latitude
const N_POINTS = 1000;
const TOTAL_MI = Number(((N_POINTS - 1) * MI_PER_STEP).toFixed(1));

const TRUCK: TruckProfile = {
  lengthFt: 70,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80_000,
  axles: 5,
  hazmatClass: null,
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.75,
};

const LINE: LatLng[] = Array.from({ length: N_POINTS }, (_, i) => ({
  lat: LAT0 + i * 0.001,
  lng: LNG0,
}));
const DEST = LINE[N_POINTS - 1];

const VERIFIED_DEST: DestinationInfo = {
  position: DEST,
  facility: 'warehouse',
  positionSource: 'geocode',
  entrances: [{ position: DEST, kind: 'verified', label: 'Gate 1' }],
};

const PLAN_REQ: PlanRequest = {
  origin: LINE[0],
  destination: DEST,
  truck: TRUCK,
  departAtMs: T0,
};

function goodPlan(): PlanFetchResult {
  return {
    kind: 'route',
    routeId: 'nav-greeting-1',
    positions: LINE,
    distanceMiles: TOTAL_MI,
    durationSeconds: 4200,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'turn', instruction: 'Keep straight.', direction: 'left', offset: 500 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: N_POINTS - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

/** The remaining line from the truck's latitude to the destination. */
function verticalReplacement(req: ReplacementRequest): ReplacementFetchResult {
  const startIdx = Math.max(0, Math.min(N_POINTS - 2, Math.round((req.origin.lat - LAT0) / 0.001)));
  const positions = LINE.slice(startIdx);
  return {
    kind: 'route',
    positions,
    distanceMiles: Number(((positions.length - 1) * MI_PER_STEP).toFixed(1)),
    durationSeconds: Math.max(60, Math.round(positions.length * 4)),
    maneuvers: [
      { action: 'depart', instruction: 'Rejoin the route.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

function pos(lat: number, lng: number, tMs: number, speedMph: number | null): PositionState {
  return {
    fix: { lat, lng, accuracyM: 8, tMs, speedMph, headingDeg: 0 },
    health: 'good',
    lastFixMs: tMs,
    accuracyM: 8,
    speedMph,
    headingDeg: 0,
    deadReckoning: false,
  };
}

function makeLifecycle(plan: () => PlanFetchResult): NavigationLifecycle {
  return createNavigationLifecycle({
    planPort: async () => plan(),
    replacementPort: async (req) => verticalReplacement(req),
  });
}

function drive(
  lc: NavigationLifecycle,
  fromIdx: number,
  toIdx: number,
  t0: number,
  lngOff = 0,
): number {
  let t = t0;
  for (let i = fromIdx; i <= toIdx; i += 2) {
    lc.tick(pos(LAT0 + i * 0.001, LNG0 + lngOff, t, 62), t);
    t += 8000;
  }
  return t;
}

/** One live session: the announcer, the real voice module, one speech port. */
function session() {
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const a = createDriverPhraseAnnouncer();
  return {
    spoken: f.spoken,
    /** One React tick: offer what is eligible, then let speech finish. */
    say(lifecycleState: LifecycleState) {
      for (const r of a.collect({ firstName: NAME, localHour: HOUR, lifecycleState })) {
        v.request(r);
      }
      f.finish();
    },
  };
}

async function main() {
  // Requirement 18: the initial valid route fires it, once.
  {
    const lc = makeLifecycle(goodPlan);
    const s = session();
    s.say(lc.state()); // idle — the driver has just opened Navigator
    const outcome = await lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
    check('lifecycle: the scripted plan was accepted', outcome.ok, outcome);
    check('lifecycle: and the machine is at route-ready', lc.state() === 'route-ready', lc.state());
    for (let i = 0; i < 5; i++) s.say(lc.state()); // React renders repeatedly
    check(
      'route-start: an initial validated route says the phrase exactly once',
      s.spoken.filter((t) => t === ROUTE_SAID).length === 1,
      s.spoken,
    );
    check('route-start: the greeting came first', s.spoken[0] === GREETING_SAID, s.spoken);
    check('route-start: and nothing else was said', s.spoken.length === 2, s.spoken);
  }

  // Requirement 19: a FAILED route says nothing.
  {
    const lc = makeLifecycle(() => ({ kind: 'failure', reason: 'provider-500' }));
    const s = session();
    const outcome = await lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
    check('lifecycle: the failed plan was refused', !outcome.ok, outcome);
    check('lifecycle: and it fell back to idle', lc.state() === 'idle', lc.state());
    for (let i = 0; i < 5; i++) s.say(lc.state());
    check(
      'route-start: a failed route never says the phrase',
      !s.spoken.includes(ROUTE_SAID),
      s.spoken,
    );
  }

  // Requirement 20: a route the VALIDATOR rejects says nothing. Two
  // identical points is not a route, so route-session validation refuses
  // it and the machine goes planning -> idle without touching route-ready.
  {
    const lc = makeLifecycle(() => ({
      ...goodPlan(),
      positions: [LINE[0], LINE[0]],
      distanceMiles: 0,
      durationSeconds: 0,
    }));
    const s = session();
    const outcome = await lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
    check('lifecycle: the invalid route was rejected by validation', !outcome.ok, outcome);
    check('lifecycle: and it never reached route-ready', lc.state() === 'idle', lc.state());
    check(
      'lifecycle: no route-ready transition was ever recorded',
      lc.transitions().every((t) => t.to !== 'route-ready'),
      lc.transitions().map((t) => `${t.from}>${t.to}`),
    );
    for (let i = 0; i < 5; i++) s.say(lc.state());
    check(
      'route-start: a rejected route never says the phrase',
      !s.spoken.includes(ROUTE_SAID),
      s.spoken,
    );
  }

  // Requirements 21 + 22: a reroute and its replacement route say nothing —
  // driven through the real machine, not asserted about a mock.
  {
    const lc = makeLifecycle(goodPlan);
    await lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
    lc.startNavigation(T0);

    // A session that starts AFTER guidance is live: the greeting window is
    // already shut, which is the mid-trip case that must stay silent.
    const s = session();
    s.say(lc.state());

    let t = drive(lc, 0, 400, T0 + 1000);
    s.say(lc.state());
    check('lifecycle: on-route before the veer', lc.state() === 'navigating', lc.state());
    const routeIdBefore = lc.snapshot().routeId;

    // Veer ~109 m east of the corridor and keep driving north.
    t = drive(lc, 402, 412, t, 0.0012);
    s.say(lc.state());
    check(
      'lifecycle: sustained lateral departure confirms off-route',
      lc.state() === 'off-route',
      lc.state(),
    );

    const rrOut = await lc.requestReroute(t, 8);
    s.say(lc.state());
    check(
      'lifecycle: the confirmed off-route reroute was REPLACED',
      rrOut.outcome === 'replaced',
      rrOut,
    );
    check(
      'lifecycle: back to navigating on the new route',
      lc.state() === 'navigating',
      lc.state(),
    );
    check(
      'lifecycle: the route id really did change with the replacement',
      lc.snapshot().routeId !== routeIdBefore,
      { before: routeIdBefore, after: lc.snapshot().routeId },
    );

    // Keep driving the replacement, rendering all the way.
    t = drive(lc, 414, 460, t);
    for (let i = 0; i < 10; i++) s.say(lc.state());

    check(
      'lifecycle: the machine never re-entered route-ready after the reroute',
      lc
        .transitions()
        .filter((x) => x.to === 'route-ready')
        .every((x) => x.from === 'planning'),
      lc.transitions().filter((x) => x.to === 'route-ready'),
    );
    check(
      'route-start: a reroute never says the route-start phrase',
      !s.spoken.includes(ROUTE_SAID),
      s.spoken,
    );
    check(
      'route-start: neither does the replacement route it produced',
      !s.spoken.some((x) => x.startsWith("Here's your route")),
      s.spoken,
    );
    check(
      'greeting: nobody was greeted mid-trip',
      !s.spoken.some((x) => x.startsWith('Good ')),
      s.spoken,
    );
    check('lifecycle: nothing was spoken at all on this drive', s.spoken.length === 0, s.spoken);
    check(
      'lifecycle: no illegal transitions were attempted',
      lc.violations().length === 0,
      lc.violations(),
    );
  }

  // A route REFRESH — planning a second trip after completing the first —
  // is still not an initial route as far as the driver's ear is concerned.
  {
    const lc = makeLifecycle(goodPlan);
    const s = session();
    await lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
    s.say(lc.state()); // greeting
    s.say(lc.state()); // route-start
    lc.startNavigation(T0);
    s.say(lc.state());
    lc.cancel(T0 + 1000);
    s.say(lc.state());
    check('lifecycle: the first trip is completed', lc.state() === 'completed', lc.state());
    lc.reset(T0 + 2000);
    await lc.plan(PLAN_REQ, VERIFIED_DEST, T0 + 3000);
    check('lifecycle: a second route really is ready', lc.state() === 'route-ready');
    for (let i = 0; i < 5; i++) s.say(lc.state());
    check(
      'route-start: a second planned route in the same session stays silent',
      s.spoken.filter((x) => x === ROUTE_SAID).length === 1,
      s.spoken,
    );
  }

  // ===================================================================
  // 6. UI — the field itself, and the rails around it
  // ===================================================================
  {
    const html = renderToStaticMarkup(
      createElement(DriverNameEntry, { firstName: null, onAccept: () => {} }),
    );
    check('ui: the field has a real <label for>', /<label[^>]*for="[^"]+"/.test(html), html);
    const forId = html.match(/<label[^>]*for="([^"]+)"/)?.[1] ?? null;
    check(
      'ui: and the label points at the input',
      forId !== null && new RegExp(`id="${forId}"`).test(html),
      html,
    );
    check(
      'ui: the input is a plain text field, not a search, email or tel box',
      !/type="(email|tel|search|number)"/.test(html),
      html,
    );
    check('ui: it carries a length cap for the phone keyboard', /maxlength="24"/i.test(html), html);
    check('ui: the touch target meets the 64 px floor', /min-h-16/.test(html), html);
    check('ui: there is a submit control, so Enter works', /type="submit"/.test(html), html);
    check(
      'ui: no aria-live region competes with navigation voice',
      !/aria-live/.test(html) && !/role="status"/.test(html) && !/role="alert"/.test(html),
      html,
    );
    check(
      'ui: the driver is told the name is not saved',
      /Not saved/i.test(html) && /reload/i.test(html),
      html,
    );

    const settled = renderToStaticMarkup(
      createElement(DriverNameEntry, { firstName: NAME, onAccept: () => {} }),
    );
    check('ui: an accepted name is shown back to the driver', settled.includes(NAME), settled);
    check('ui: with one way to change it', /Change name/.test(settled), settled);
    check('ui: and no second input left to tab through', !/<input/.test(settled), settled);
  }

  // Requirement 26 + 27: no persistence, no leakage. Source rails, because
  // a render cannot prove the absence of a code path.
  {
    const files: Record<string, string> = {
      lib: 'src/lib/navigator/driver-greeting.ts',
      entry: 'src/components/navigator/DriverNameEntry.tsx',
      controls: 'src/components/navigator/PilotTripControls.tsx',
      screen: 'src/components/navigator/DrivingScreen.tsx',
    };
    for (const [label, path] of Object.entries(files)) {
      const src = strip(readFileSync(path, 'utf8'));
      check(
        `persistence: ${label} introduces no storage, cookie or URL state`,
        !/localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|URLSearchParams/i.test(
          src,
        ),
        path,
      );
      check(`persistence: ${label} writes the name to no database`, !/supabase/i.test(src), path);
    }

    const screen = strip(readFileSync(files.screen, 'utf8'));

    // The road-test report is the one thing on this screen that is built
    // to LEAVE the device — the driver copies it and sends it. Its
    // argument list is therefore the exact place the name must not be.
    const reportArgs = callArgs(screen, 'buildRoadTestReport');
    check('privacy: the report builder call was actually found', reportArgs.length > 100);
    check(
      'privacy: the name never reaches the road-test report builder',
      !reportArgs.includes('firstName'),
      'firstName reached buildRoadTestReport',
    );
    check(
      'privacy: the name is never recorded in the pilot log',
      !/\.record\([^)]*firstName/.test(screen),
      'firstName reached the pilot log',
    );
    check(
      'privacy: the name is never handed to a provider port',
      !/createNavigatorPlanPort\([^)]*firstName|createNavigatorReplacementPort\([^)]*firstName/.test(
        screen,
      ),
    );
    // The plan request is what becomes a provider HTTP call and a routing
    // URL. Same reasoning, same method.
    const planArgs = callArgs(strip(readFileSync(files.controls, 'utf8')), 'lifecycle.plan');
    check('privacy: the plan call was actually found', planArgs.length > 100);
    check(
      'privacy: the name is not put in the plan request',
      !planArgs.includes('firstName'),
      'firstName reached lifecycle.plan',
    );

    for (const path of Object.values(files)) {
      const src = readFileSync(path, 'utf8');
      check(
        `security: ${path.split('/').pop()} references no secret or token`,
        !/NAVIGATOR_PREVIEW_PASSWORD|HERE_API_KEY|apiKey|pilotToken|document\.cookie/i.test(src),
        path,
      );
    }
  }

  console.log(`navigator-greeting: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
