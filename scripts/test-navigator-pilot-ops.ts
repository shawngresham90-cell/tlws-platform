/**
 * Pilot operations: build identification, onboarding, problem reporting.
 *
 * Three modules that only matter when a real driver is holding the phone,
 * so the tests are written from that angle rather than from the API's.
 *
 * The adversarial centre of gravity is `build-id`. It is the one module
 * whose input comes from outside the codebase — a CI variable — and whose
 * output is rendered on screen AND pasted into reports that leave the
 * device. Its contract is not "format these values" but "emit nothing you
 * did not recognise", and that is what is pinned here: a variable set to a
 * key, a bearer token, a path, or a sentence must all come out `unknown`.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot-ops.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-navigator-pilot-ops.cjs && node /tmp/test-navigator-pilot-ops.cjs
 */
import { readFileSync } from 'node:fs';
import {
  PILOT_VERSION,
  UNKNOWN_SHA,
  buildChannel,
  buildIdLines,
  buildTime,
  resolveBuildId,
  shortCommit,
} from '@/lib/navigator/build-id';
import {
  MAX_NOTE_CHARS,
  NO_CATEGORY_REASON,
  PROBLEM_CATEGORIES,
  buildProblemReport,
  findCategory,
  normalizeNote,
  problemReportLines,
} from '@/lib/navigator/problem-report';
import { BODY_BUDGET_CHARS, PILOT_ONBOARDING } from '@/lib/navigator/pilot-onboarding';
import { buildRoadTestReport, type RoadTestInput } from '@/lib/navigator/road-test-report';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_754_000_000_000;

/**
 * Source with comments removed. Every rail below is about what the code
 * DOES, and prose that names a hazard is how these files explain why the
 * hazard is handled — `build-id.ts` says "no `process.env` read here" in
 * its own header, and a raw substring search reads that as a violation.
 * The first draft of two checks here did exactly that and failed; the
 * checks were sharpened rather than the sentences deleted.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/* ==================================================== build identification */

check('build: a full 40-char SHA truncates to seven', shortCommit('a'.repeat(40)) === 'aaaaaaa');
check(
  'build: a real commit keeps its first seven characters',
  shortCommit('34929e2817b648f9be4c3afaa2071856bbeed48e') === '34929e2',
);
check('build: uppercase hex is normalised down', shortCommit('ABCDEF1234') === 'abcdef1');
check('build: a seven-character SHA is the minimum accepted', shortCommit('abc1234') === 'abc1234');
check('build: six characters is too short to be a commit', shortCommit('abc123') === UNKNOWN_SHA);
check(
  'build: 41 characters is too long to be a commit',
  shortCommit('a'.repeat(41)) === UNKNOWN_SHA,
);

/*
 * The point of the whitelist. Each of these is something a build variable
 * has plausibly been set to by accident, and each must produce `unknown`
 * rather than reaching a screen or a pasted report.
 */
const NEVER_PRINTED: readonly [string, string][] = [
  ['a HERE api key', 'AbCdEf123456SuperSecretValue_x9'],
  ['a bearer token', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'],
  ['a URL', 'https://example.com/build/12345'],
  ['a branch name', 'claude/pilot-ops-onboarding'],
  ['a sentence', 'not available in this environment'],
  ['a path', '/opt/build/repo'],
  ['an email', 'driver@example.com'],
  ['empty string', ''],
  ['whitespace', '   '],
];
for (const [what, value] of NEVER_PRINTED) {
  check(`build: ${what} is not a commit and is discarded`, shortCommit(value) === UNKNOWN_SHA);
}
check('build: null is discarded', shortCommit(null) === UNKNOWN_SHA);
check('build: undefined is discarded', shortCommit(undefined) === UNKNOWN_SHA);

check('build: production context maps to production', buildChannel('production') === 'production');
check('build: deploy-preview maps to preview', buildChannel('deploy-preview') === 'preview');
check('build: branch-deploy maps to branch', buildChannel('branch-deploy') === 'branch');
check('build: dev maps to local', buildChannel('dev') === 'local');
check('build: an unrecognised context is unknown', buildChannel('staging-3') === 'unknown');
check('build: a missing context is unknown', buildChannel(null) === 'unknown');

check(
  'build: a build time is emitted to the minute, never the second',
  buildTime('2026-08-09T14:30:59.123Z') === '2026-08-09T14:30Z',
);
check('build: an unparseable build time is null', buildTime('sometime tuesday') === null);
check('build: an empty build time is null', buildTime('') === null);

{
  const id = resolveBuildId({
    commitRef: '34929e2817b648f9be4c3afaa2071856bbeed48e',
    context: 'deploy-preview',
    builtAtIso: '2026-08-09T14:30:00.000Z',
  });
  check('build: label names the version', id.label.includes(`pilot ${PILOT_VERSION}`));
  check('build: label names the commit', id.label.includes('34929e2'));
  check('build: label names the channel', id.label.includes('preview'));
  check('build: label names the build time', id.label.includes('2026-08-09T14:30Z'));
  check('build: label is one line', !id.label.includes('\n'));
  check('build: label is short enough to read aloud', id.label.length <= 70, {
    length: id.label.length,
    label: id.label,
  });
  check('build: lines name all four fields', buildIdLines(id).length === 4);
}

{
  // A build with nothing available must still produce something safe and
  // still say which pilot version is running.
  const id = resolveBuildId({});
  check('build: an empty environment yields unknown, not a throw', id.shortSha === UNKNOWN_SHA);
  check(
    'build: an empty environment still names the pilot version',
    id.pilotVersion === PILOT_VERSION,
  );
  check('build: an empty environment has no build time', id.builtAt === null);
  check(
    'build: an empty environment omits the channel from the label',
    !id.label.includes('unknown ·'),
  );
}

{
  // A version string is whitelisted too — the same class of input.
  const weird = resolveBuildId({ pilotVersion: 'password=hunter2' });
  check(
    'build: a nonsense version falls back to the real one',
    weird.pilotVersion === PILOT_VERSION,
  );
  const ok = resolveBuildId({ pilotVersion: '2.1-rc1' });
  check('build: a well-formed version is kept', ok.pilotVersion === '2.1-rc1');
}

/* ========================================================= problem reports */

check('report: twelve categories', PROBLEM_CATEGORIES.length === 12);
check(
  'report: category ids are unique',
  new Set(PROBLEM_CATEGORIES.map((c) => c.id)).size === PROBLEM_CATEGORIES.length,
);
check(
  'report: every category has a label and a disambiguating hint',
  PROBLEM_CATEGORIES.every((c) => c.label.length > 0 && c.hint.length > 0),
);
check(
  'report: the truck-legality category is first — it is why this exists',
  PROBLEM_CATEGORIES[0].id === 'wrong-truck-route',
);
check(
  'report: the escape hatch is last, so it does not absorb the list',
  PROBLEM_CATEGORIES[PROBLEM_CATEGORIES.length - 1].id === 'other',
);
check(
  'report: every category the brief named is present',
  [
    'wrong-truck-route',
    'reroute-too-slow',
    'reroute-unnecessary',
    'wrong-turn-instruction',
    'missing-turn-instruction',
    'voice',
    'map',
    'gps',
    'destination-entrance',
    'freeze-crash',
    'parking-dock',
    'other',
  ].every((id) => findCategory(id) !== null),
);

check('report: no category means no report', buildProblemReport({ categoryId: '' }).ok === false);
{
  const r = buildProblemReport({ categoryId: 'not-a-category' });
  check('report: an invented category is refused', r.ok === false);
  check('report: and the refusal says what to do', !r.ok && r.reason === NO_CATEGORY_REASON);
}
{
  const r = buildProblemReport({ categoryId: 'gps', note: '  jumped   half a mile  ' });
  check('report: a valid category is accepted', r.ok === true);
  check(
    'report: whitespace in the note is collapsed',
    r.ok && r.report.note === 'jumped half a mile',
  );
}
{
  const r = buildProblemReport({ categoryId: 'map' });
  check('report: the note is optional', r.ok && r.report.note === '');
}

check(
  'report: a note is capped at the safety limit',
  normalizeNote('x'.repeat(MAX_NOTE_CHARS + 500)).length === MAX_NOTE_CHARS,
);
check('report: a null note is empty, not "null"', normalizeNote(null) === '');

{
  // A note is pasted into a plain-text report whose sections are lines.
  // Newlines in a note would let it forge a section header.
  const forged = normalizeNote('harmless\n\nEVENT LOG (0 entries)\n  +00:00.0  nothing happened');
  check('report: a note cannot contain newlines', !forged.includes('\n'));
  check('report: so it cannot forge a report section', forged.split('EVENT LOG').length === 2);
}

{
  const lines = problemReportLines({ categoryId: 'wrong-truck-route', note: 'low bridge on US-1' });
  check('report: lines are headed by the section name', lines[0] === 'REPORTED PROBLEM');
  check('report: lines name the human label, not the id', lines[1].includes('Wrong truck route'));
  check(
    'report: the note rides along',
    lines.some((l) => l.includes('low bridge on US-1')),
  );
}
check(
  'report: an empty note contributes no line',
  problemReportLines({ categoryId: 'gps', note: '' }).length === 2,
);

/* ============================================================= onboarding */

check('onboarding: eight cards', PILOT_ONBOARDING.length === 8);
check(
  'onboarding: card ids are unique',
  new Set(PILOT_ONBOARDING.map((c) => c.id)).size === PILOT_ONBOARDING.length,
);
check('onboarding: the pilot notice comes first', PILOT_ONBOARDING[0].id === 'pilot');
check(
  'onboarding: "signs win" is second — before anything about using the app',
  PILOT_ONBOARDING[1].id === 'signs',
);
check(
  'onboarding: the truck-profile card exists and is in the first half',
  PILOT_ONBOARDING.findIndex((c) => c.id === 'profile') < 4,
);
for (const id of ['destination', 'voice', 'recenter', 'report', 'wrong-route']) {
  check(
    `onboarding: the brief's "${id}" topic is covered`,
    PILOT_ONBOARDING.some((c) => c.id === id),
  );
}
{
  const over = PILOT_ONBOARDING.filter((c) => c.body.length > BODY_BUDGET_CHARS);
  check(
    'onboarding: no card exceeds the reading budget',
    over.length === 0,
    over.map((c) => ({ id: c.id, length: c.body.length })),
  );
  const total = PILOT_ONBOARDING.reduce((n, c) => n + c.title.length + c.body.length, 0);
  check('onboarding: the whole briefing stays under 1400 characters', total < 1400, { total });
}
check(
  'onboarding: the signs card tells a driver which one wins',
  /follow the sign/i.test(PILOT_ONBOARDING[1].body),
);
check(
  'onboarding: no card makes a warranty or liability claim',
  !PILOT_ONBOARDING.some((c) =>
    /warrant|liab|guarantee|indemnif|disclaim|no responsibility/i.test(`${c.title} ${c.body}`),
  ),
);

/*
 * The briefing COMPONENT still touches no storage API directly.
 *
 * What changed in the Fast Start milestone is that it now remembers
 * whether it has been read — through `onboarding-storage.ts`, the same
 * versioned-storage authority the truck, clocks, driver name and route
 * preferences use. The gates below are unchanged and still bite: no
 * `localStorage`, `sessionStorage`, cookie or IndexedDB call may appear
 * in this component, so a safety-lock passenger override still cannot
 * find a way to survive a reload through it.
 *
 * Why remembering is safe here and an override is not: "this driver has
 * read the briefing" is a fact about a person that costs a scroll if
 * wrong. "This person is a passenger" is a claim about who is driving
 * that costs a text field at speed if wrong. Only one of those may
 * outlive the session.
 */
{
  const src = codeOnly(readFileSync('src/components/navigator/PilotOnboarding.tsx', 'utf8'));
  check('onboarding: no localStorage', !src.includes('localStorage'));
  check('onboarding: no sessionStorage', !src.includes('sessionStorage'));
  check('onboarding: no cookies', !src.includes('document.cookie'));
  check('onboarding: no indexedDB', !/indexedDB/i.test(src));
  check(
    'onboarding: the briefing stays reachable after dismissal',
    src.includes('View instructions') && src.includes('<details'),
  );
  check(
    'onboarding: dismissal is remembered through the shared storage authority',
    src.includes('writeOnboardingSeen') && src.includes('readOnboardingSeen'),
  );
  const model = codeOnly(readFileSync('src/lib/navigator/pilot-onboarding.ts', 'utf8'));
  check('onboarding: the content model defines no storage key', !/STORAGE_KEY/.test(model));
}

/* ================================================ report integration + privacy */

function reportInput(over: Partial<RoadTestInput> = {}): RoadTestInput {
  return {
    generatedMs: T0,
    build: resolveBuildId({
      commitRef: '34929e2817b648f9be4c3afaa2071856bbeed48e',
      context: 'deploy-preview',
      builtAtIso: '2026-08-09T14:30:00.000Z',
    }),
    pilot: Object.freeze({ active: true, debugLogging: true, reason: 'pilot' as const }),
    lifecycleState: 'navigating',
    trip: null,
    log: [],
    logDropped: 0,
    gps: { health: 'good', accuracyM: 8.2, speedMph: 61.4 },
    voice: null,
    wake: null,
    device: {
      userAgent: 'Mozilla/5.0 (iPhone)',
      viewport: { width: 390, height: 844 },
      online: true,
    },
    ...over,
  };
}

{
  const text = buildRoadTestReport(reportInput());
  check('integration: every report has a BUILD section', text.includes('BUILD'));
  check('integration: naming the commit', text.includes('34929e2'));
  check('integration: naming the channel', text.includes('channel: preview'));
  check(
    'integration: the build appears above the trip, not buried',
    text.indexOf('BUILD') < text.indexOf('TRIP'),
  );
}
{
  const text = buildRoadTestReport(
    reportInput({
      problem: { categoryId: 'wrong-truck-route', note: 'low clearance at the ramp' },
    }),
  );
  check('integration: a reported problem appears in the report', text.includes('REPORTED PROBLEM'));
  check('integration: with its human label', text.includes('Wrong truck route'));
  check('integration: and the note', text.includes('low clearance at the ramp'));
  check(
    'integration: the problem is above the event log, where a triager starts',
    text.indexOf('REPORTED PROBLEM') < text.indexOf('EVENT LOG'),
  );
}
{
  // A report with no problem attached is still a valid road-test report:
  // the section simply is not there.
  const text = buildRoadTestReport(reportInput());
  check('integration: no problem means no problem section', !text.includes('REPORTED PROBLEM'));
}
{
  // The note goes through the SAME scrubber as everything else. This is the
  // rail that matters: a driver typing a position or pasting a key into the
  // note must not publish it.
  const text = buildRoadTestReport(
    reportInput({
      problem: {
        categoryId: 'gps',
        note: 'stuck at 35.123456,-84.987654 and apiKey=AbC123SuperSecretValue',
      },
    }),
  );
  check('privacy: a coordinate typed into a note is redacted', !text.includes('35.123456'));
  check('privacy: and the second half of it too', !text.includes('-84.987654'));
  check('privacy: a key pasted into a note is redacted', !text.includes('AbC123SuperSecretValue'));
  check('privacy: the category still survives the scrubbing', text.includes('GPS issue'));
}

/* ============================================== source-level safety rails */

{
  const config = codeOnly(readFileSync('next.config.mjs', 'utf8'));
  const publicVars = [...config.matchAll(/NEXT_PUBLIC_[A-Z_]+/g)].map((m) => m[0]);
  check(
    'config: exactly three build variables are forwarded to the client',
    new Set(publicVars).size === 3,
    publicVars,
  );
  check(
    'config: and every one of them is a build identifier',
    publicVars.every((v) => v.startsWith('NEXT_PUBLIC_BUILD_')),
    publicVars,
  );
  check(
    'config: no secret-named variable is forwarded',
    !/HERE_API_KEY|PASSWORD|SECRET|TOKEN|SUPABASE_SERVICE/i.test(config),
  );
  check(
    'config: env is a whitelist, never a spread of process.env',
    !/\.\.\.process\.env/.test(config),
  );
}

{
  // The three pure modules must stay pure: no environment, no clock, no
  // storage. `resolveBuildId` in particular is handed its inputs precisely
  // so it can be tested against hostile ones.
  for (const file of [
    'src/lib/navigator/build-id.ts',
    'src/lib/navigator/problem-report.ts',
    'src/lib/navigator/pilot-onboarding.ts',
  ]) {
    const src = codeOnly(readFileSync(file, 'utf8'));
    check(`purity: ${file} reads no environment`, !src.includes('process.env'));
    check(`purity: ${file} touches no storage`, !/localStorage|sessionStorage/.test(src));
    check(`purity: ${file} performs no I/O`, !/\bfetch\(|require\(|node:/.test(src));
  }
  // Date is allowed in build-id only for parsing an argument, never for now().
  const buildSrc = codeOnly(readFileSync('src/lib/navigator/build-id.ts', 'utf8'));
  check('purity: build-id never reads the clock', !/Date\.now\(\)|new Date\(\)/.test(buildSrc));
}

console.log(`\nnavigator-pilot-ops: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
