/**
 * Diagnostic snapshot, post-trip feedback, and issue triage.
 *
 * The centre of gravity is PRIVACY BY CONSTRUCTION. The snapshot's claim
 * is not "sensitive values are redacted" but "there is nowhere to put
 * one" — every field is an enum, a bounded number, or a charset-restricted
 * id. So the tests below try to smuggle things in: a coordinate through a
 * maneuver id, a provider payload through a reroute reason, a newline
 * through an identifier. Each must come out null rather than sanitised,
 * because sanitising is what an allowlist is supposed to make unnecessary.
 *
 * The feedback tests are about a different kind of honesty: an unanswered
 * question must never score as a good outcome. A pilot-health signal that
 * counts silence as success reports a healthy pilot right up until
 * someone gets hurt.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot-diagnostics.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-navigator-pilot-diagnostics.cjs && node /tmp/test-navigator-pilot-diagnostics.cjs
 */
import { readFileSync } from 'node:fs';
import {
  buildDiagnosticSnapshot,
  snapshotJson,
  snapshotLines,
  type SnapshotInput,
} from '@/lib/navigator/diagnostic-snapshot';
import {
  FEEDBACK_NOTE_MAX,
  FEEDBACK_QUESTIONS,
  SEVERITY_MEANING,
  SKIPPED,
  buildFeedback,
  feedbackConcerns,
  feedbackLines,
  suggestSeverity,
  triageGaps,
  triageLines,
} from '@/lib/navigator/post-trip-feedback';

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

function input(over: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    build: 'pilot 2.0 · c83ba70 · production',
    atIso: '2026-08-09T14:30:59.123Z',
    tripStartedMs: T0,
    nowMs: T0 + 95 * 60_000,
    navigation: 'navigating',
    routeLoaded: true,
    routeMiles: 412.37,
    remainingMiles: 88.914,
    validation: 'accepted',
    reroute: 'applied',
    rerouteReason: 'off-route',
    rerouteAttempts: 2,
    gps: 'good',
    gpsAccuracyM: 7.53,
    speedMph: 61.4,
    maneuverId: 'mnv-0042',
    maneuverType: 'turn-right',
    voice: 'speaking',
    follow: 'following',
    provider: 'ok',
    hosWarning: true,
    network: 'online',
    truck: {
      heightFt: 13.5,
      widthFt: 8.5,
      lengthFt: 70,
      grossWeightLbs: 80000,
      axles: 5,
      hazmat: false,
    },
    ...over,
  };
}

/* ============================================================ snapshot */

{
  const s = buildDiagnosticSnapshot(input());
  check('snapshot: carries a schema version', s.v === 1);
  check('snapshot: carries the build label verbatim', s.build.includes('c83ba70'));
  check('snapshot: time is minute precision, never seconds', s.atIso === '2026-08-09T14:30Z');
  check('snapshot: trip elapsed is whole minutes', s.tripMinutes === 95);
  check('snapshot: route miles rounded to a tenth', s.routeMiles === 412.4);
  check('snapshot: remaining miles rounded too', s.remainingMiles === 88.9);
  check('snapshot: accuracy is whole metres', s.gpsAccuracyM === 8);
  check('snapshot: speed is whole mph', s.speedMph === 61);
  check(
    'snapshot: names the maneuver by id and type',
    s.maneuverId === 'mnv-0042' && s.maneuverType === 'turn-right',
  );
  check(
    'snapshot: carries every category the brief asked for',
    s.navigation === 'navigating' &&
      s.validation === 'accepted' &&
      s.reroute === 'applied' &&
      s.gps === 'good' &&
      s.voice === 'speaking' &&
      s.follow === 'following' &&
      s.provider === 'ok' &&
      s.network === 'online' &&
      s.hosWarning === true,
  );
  check('snapshot: truck summary is dimensions only', s.truck !== null && !('vin' in s.truck));
}

{
  // Defaults must be honest: unknown is a state, not an assumption.
  const s = buildDiagnosticSnapshot({
    build: 'b',
    atIso: '2026-08-09T14:30:00Z',
    tripStartedMs: null,
    nowMs: T0,
    navigation: 'idle',
    routeLoaded: false,
    gps: 'unavailable',
  });
  check('snapshot: no trip means no elapsed time, not zero', s.tripMinutes === null);
  check('snapshot: unset validation defaults to not-run', s.validation === 'not-run');
  check('snapshot: unset provider defaults to none', s.provider === 'none');
  check('snapshot: unset network defaults to unknown, not online', s.network === 'unknown');
  check('snapshot: unset follow defaults to unknown', s.follow === 'unknown');
  check('snapshot: unset HOS warning is false', s.hosWarning === false);
  check('snapshot: absent truck is null', s.truck === null);
}

/*
 * The allowlist, attacked. Each of these is something a caller might
 * plausibly pass, and each must come out null rather than sanitised.
 */
{
  const smuggled: readonly [string, string][] = [
    ['a coordinate pair', '35.123456,-84.987654'],
    ['a provider payload', '{"routes":[{"sections":[]}]}'],
    ['an api key', 'apiKey=AbC123SuperSecretValue'],
    ['a newline that would forge a report line', 'ok\n  build: fake'],
    ['a road name with spaces', 'Old Mill Road toward the gate'],
    ['an overlong id', 'x'.repeat(41)],
  ];
  for (const [what, value] of smuggled) {
    const s = buildDiagnosticSnapshot(input({ maneuverId: value, rerouteReason: value }));
    check(`snapshot: ${what} cannot ride in as a maneuver id`, s.maneuverId === null, s.maneuverId);
    check(`snapshot: ${what} cannot ride in as a reroute reason`, s.rerouteReason === null);
  }
}
{
  const s = buildDiagnosticSnapshot(
    input({ routeMiles: Infinity, speedMph: NaN, gpsAccuracyM: -Infinity }),
  );
  check('snapshot: a non-finite number becomes null, never Infinity', s.routeMiles === null);
  check('snapshot: NaN speed becomes null', s.speedMph === null);
  check('snapshot: non-finite accuracy becomes null', s.gpsAccuracyM === null);
}
{
  const s = buildDiagnosticSnapshot(input({ rerouteAttempts: -5 }));
  check('snapshot: attempts can never go negative', s.rerouteAttempts === 0);
}

{
  // The whole serialized snapshot, searched for the categories of thing
  // that must never appear.
  const json = snapshotJson(buildDiagnosticSnapshot(input()));
  check('privacy: no coordinate-precision number anywhere', !/-?\d{1,3}\.\d{4,}/.test(json));
  check(
    'privacy: no key, token, cookie or password field',
    !/apikey|api_key|token|cookie|password|secret|authorization/i.test(json),
  );
  check(
    'privacy: no latitude or longitude field',
    !/\blat\b|\blng\b|latitude|longitude/i.test(json),
  );
  check('privacy: it is valid JSON', typeof JSON.parse(json).v === 'number');
  const lines = snapshotLines(buildDiagnosticSnapshot(input()));
  check(
    'report: snapshot renders as lines for the text report',
    lines[0] === 'DIAGNOSTIC SNAPSHOT',
  );
  check(
    'report: every line is a single line',
    lines.every((l) => !l.includes('\n')),
  );
}

{
  // Structural: the module cannot even name the things it must not carry.
  const src = readFileSync('src/lib/navigator/diagnostic-snapshot.ts', 'utf8').replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    '',
  );
  for (const banned of ['apiKey', 'password', 'cookie', 'Authorization', 'geometry', 'payload']) {
    check(`privacy: the snapshot code never names ${banned}`, !new RegExp(banned, 'i').test(src));
  }
  check('purity: the snapshot reads no clock', !/Date\.now\(\)|new Date\(/.test(src));
  check('purity: the snapshot reads no environment', !src.includes('process.env'));
}

/* ============================================================ feedback */

check('feedback: nine tap questions', FEEDBACK_QUESTIONS.length === 9);
check('feedback: ids are unique', new Set(FEEDBACK_QUESTIONS.map((q) => q.id)).size === 9);
check(
  'feedback: every question offers at least two choices',
  FEEDBACK_QUESTIONS.every((q) => q.choices.length >= 2),
);
check(
  'feedback: every topic the brief named is covered',
  [
    'destination',
    'truck-legal',
    'instruction-timing',
    'voice-amount',
    'reroute-speed',
    'map',
    'gps',
    'stability',
    'would-use-again',
  ].every((id) => FEEDBACK_QUESTIONS.some((q) => q.id === id)),
);

{
  const r = buildFeedback({});
  check(
    'feedback: nothing answered means everything skipped',
    Object.values(r.answers).every((v) => v === SKIPPED),
  );
  check('feedback: and the answered count is zero', r.answeredCount === 0);
  /*
   * The assertion that matters most in this file. Silence must not read
   * as a good outcome anywhere — not in the answers, and not in the
   * concerns list, which must stay empty rather than inventing a verdict.
   */
  check(
    'feedback: an unanswered survey raises no false all-clear',
    feedbackConcerns(r).length === 0,
  );
  check('feedback: and no answer defaults to "yes"', !Object.values(r.answers).includes('yes'));
}
{
  const r = buildFeedback({ answers: { destination: 'yes', 'truck-legal': 'no', gps: 'bad' } });
  check('feedback: given answers are kept', r.answers.destination === 'yes');
  check('feedback: partial answers count correctly', r.answeredCount === 3);
  check('feedback: the rest stay skipped', r.answers.map === SKIPPED);
  const concerns = feedbackConcerns(r);
  check(
    'feedback: a not-truck-legal answer is a concern',
    concerns.some((c) => /truck-legal/.test(c)),
  );
  check(
    'feedback: bad GPS is a concern',
    concerns.some((c) => /GPS/.test(c)),
  );
}
{
  // A value we never offered is not data — it is noise or an attack.
  const r = buildFeedback({ answers: { destination: 'maybe', gps: '<script>alert(1)</script>' } });
  check(
    'feedback: an unoffered answer is discarded, not stored',
    r.answers.destination === SKIPPED,
  );
  check('feedback: injected markup never becomes an answer', r.answers.gps === SKIPPED);
  check('feedback: and it does not count as answered', r.answeredCount === 0);
}
{
  const r = buildFeedback({ note: `${'x'.repeat(500)}\nEVENT LOG` });
  check('feedback: the note is capped', r.note.length === FEEDBACK_NOTE_MAX);
  check('feedback: and carries no newline to forge a section', !r.note.includes('\n'));
  check('feedback: lines render for the report', feedbackLines(r)[0] === 'POST-TRIP FEEDBACK');
  check(
    'feedback: the lines say how much was actually answered',
    feedbackLines(r)[1].includes('0/9'),
  );
}

/* ============================================================== triage */

check('triage: four severities, each with a meaning', Object.keys(SEVERITY_MEANING).length === 4);
check('triage: P0 says to stop expansion', /stop pilot expansion/i.test(SEVERITY_MEANING.P0));
check(
  'triage: a truck-legality report is SUGGESTED P0',
  suggestSeverity('wrong-truck-route') === 'P0',
);
check('triage: a crash is suggested P1', suggestSeverity('freeze-crash') === 'P1');
check('triage: a slow reroute is suggested P2', suggestSeverity('reroute-too-slow') === 'P2');
check(
  'triage: an unknown category is suggested P3, not P0',
  suggestSeverity('something-new') === 'P3',
);
check('triage: "other" does not inflate to P0', suggestSeverity('other') === 'P3');

{
  /*
   * Nothing classifies itself. The function is named `suggestSeverity`
   * and the record carries a severity a human set — pinned structurally
   * so a future edit cannot quietly wire the suggestion into the record.
   */
  const src = readFileSync('src/lib/navigator/post-trip-feedback.ts', 'utf8');
  check(
    'triage: no function assigns a severity automatically',
    !/function\s+assignSeverity|autoSeverity/.test(src),
  );
  check(
    'triage: the suggestion is named as a suggestion',
    src.includes('export function suggestSeverity'),
  );
}
{
  const gaps = triageGaps({ severity: 'P1', build: 'b', category: 'gps' });
  check('triage: an incomplete record names its holes', gaps.length === 5, gaps);
  check('triage: reproduction is required', gaps.includes('reproduction'));
  check('triage: driver impact is required', gaps.includes('driverImpact'));
  check('triage: route state is required', gaps.includes('routeState'));
  check(
    'triage: whitespace does not count as filled in',
    triageGaps({ severity: 'P1', build: 'b', category: 'c', reproduction: '   ' }).includes(
      'reproduction',
    ),
  );
}
{
  const complete = {
    severity: 'P0' as const,
    build: 'pilot 2.0 · c83ba70',
    category: 'wrong-truck-route',
    reproduction: 'plan a route from the yard to the customer',
    expected: 'stays on the truck route',
    actual: 'routed under a 12 ft 6 in bridge',
    driverImpact: 'had to stop and reroute manually',
    evidence: 'diagnostic snapshot attached',
    routeState: 'navigating, 40 miles in',
    suggestedAction: 'check the height parameter on the wire',
  };
  check('triage: a complete record has no gaps', triageGaps(complete).length === 0);
  const lines = triageLines(complete);
  check('triage: the severity and category head the record', lines[0] === 'P0 — wrong-truck-route');
  check('triage: every required field is rendered', lines.length === 9);
}

console.log(`\nnavigator-pilot-diagnostics: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
