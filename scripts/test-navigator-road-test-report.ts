/**
 * Road-test report (Block 2, priorities N and O). The report is the ONE
 * artifact designed to leave the device, so most of this harness is
 * adversarial: it feeds coordinates, keys, tokens and passwords in
 * through every input the report accepts — including the driver's own
 * free-text note — and asserts none of them survive to the output.
 *
 * The rest checks the report is actually useful: that it states what it
 * dropped, that it never invents a number it was not given, and that the
 * affordance is wired where a moving driver cannot reach it.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-road-test-report.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-road-report.cjs && node /tmp/test-road-report.cjs
 */
import { readFileSync } from 'node:fs';
import { buildRoadTestReport, scrub, type RoadTestInput } from '@/lib/navigator/road-test-report';
import type { PilotLogEntry } from '@/lib/navigator/pilot-mode';
import { resolveBuildId } from '@/lib/navigator/build-id';

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

function entry(over: Partial<PilotLogEntry> & { tMs: number }): PilotLogEntry {
  return Object.freeze({ event: 'tick', detail: null, ...over });
}

function input(over: Partial<RoadTestInput> = {}): RoadTestInput {
  return {
    generatedMs: T0,
    build: resolveBuildId({
      commitRef: 'abc1234def5678',
      context: 'deploy-preview',
      builtAtIso: '2026-08-09T12:00:00.000Z',
    }),
    pilot: Object.freeze({ active: true, debugLogging: true, reason: 'pilot' as const }),
    lifecycleState: 'navigating',
    trip: null,
    log: [],
    logDropped: 0,
    gps: { health: 'good', accuracyM: 8.2, speedMph: 61.4 },
    voice: { supported: true, muted: false, speakingId: null, queuedIds: [], announcedCount: 12 },
    wake: { supported: true, held: true, requests: 2, refusals: 0, lastRefusal: null },
    device: {
      userAgent: 'Mozilla/5.0 (iPhone)',
      viewport: { width: 390, height: 844 },
      online: true,
    },
    ...over,
  };
}

// ============================== privacy: coordinates =====================
{
  const report = buildRoadTestReport(
    input({
      note: 'stalled near 35.041827, -85.309442 and it never recovered',
      log: [
        entry({ tMs: T0, event: 'fix', detail: 'lat=35.0418271 lng=-85.3094428 acc=6' }),
        entry({ tMs: T0 + 4000, event: 'reroute', detail: 'origin 35.123456,-85.654321' }),
      ],
    }),
  );
  check('privacy: no coordinate survives from the log', !/35\.04182/.test(report));
  check("privacy: no coordinate survives from the DRIVER'S note", !/85\.309442/.test(report));
  check(
    'privacy: nothing that looks like a lat/lng pair remains anywhere',
    !/-?\d{1,3}\.\d{4,}/.test(report),
    report.match(/-?\d{1,3}\.\d{4,}/g),
  );
  check('privacy: the redaction is visible, not a silent deletion', report.includes('[coord]'));
  // Everything else in the line must survive: a report that redacts the
  // whole entry tells the owner nothing.
  check('privacy: the surrounding event text is kept', report.includes('reroute'));
}

// ============================== privacy: secrets =========================
{
  const report = buildRoadTestReport(
    input({
      note: 'tried again with apikey=AbC123SuperSecretValue and it worked',
      log: [
        entry({ tMs: T0, event: 'plan', detail: 'GET /api/navigator/route?apiKey=zzzz' }),
        entry({ tMs: T0 + 1, event: 'auth', detail: 'password: hunter2' }),
        entry({
          tMs: T0 + 2,
          event: 'token',
          detail: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijklmnop',
        }),
      ],
    }),
  );
  check('privacy: an api key in a log line is redacted', !/zzzz/.test(report));
  check('privacy: an api key in the note is redacted', !/SuperSecretValue/.test(report));
  check('privacy: a password is redacted', !/hunter2/.test(report));
  check('privacy: a long opaque token is redacted', !/eyJhbGciOiJIUzI1NiI/.test(report));
  check('privacy: the redaction is visible', report.includes('[redacted]'));

  // The scrubber is exported and applies to the WHOLE report, so a field
  // added later cannot quietly skip it.
  check('privacy: scrub is the single choke point', scrub('token: abc123') === '[redacted]');

  const source = readFileSync('src/lib/navigator/road-test-report.ts', 'utf8');
  check(
    'privacy: the report is scrubbed on the way out, in one place',
    /return scrub\(out\.join\('\\n'\)\)/.test(source),
  );
  // Not "the word never appears" — `password` appears in the scrubber's
  // own pattern list, and should. What matters is that the module has no
  // ROUTE to geometry, provider payloads, or credentials: it reads no
  // environment, and imports only the four state shapes it prints.
  const imports = source.match(/^import .*$/gm) ?? [];
  check('privacy: the module reads no environment', !/process\.env|NEXT_PUBLIC_/.test(source));
  check(
    'privacy: it imports nothing from the provider or routing layer',
    imports.length > 0 && !imports.some((i) => /trip-planner|navigator-api|here-/.test(i)),
    imports,
  );
  check(
    'privacy: its input carries no geometry and no positions',
    !/geometry|LatLng|positions/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')),
  );
}

// ============================== times are offsets ========================
{
  const report = buildRoadTestReport(
    input({
      log: [entry({ tMs: T0, event: 'start' }), entry({ tMs: T0 + 62_400, event: 'off-route' })],
    }),
  );
  // A report that travels should not also carry the driver's schedule.
  check('time: entries are offsets from the first entry', report.includes('+01:02.4'));
  check(
    'time: no wall-clock time-of-day appears in the log',
    !/\d{2}:\d{2}:\d{2}/.test(report.slice(report.indexOf('EVENT LOG'))),
  );
  check(
    'time: the header states when the report was made, to the minute',
    report.includes(new Date(T0).toISOString().slice(0, 16)),
  );
}

// ============================== honesty ==================================
{
  const dropped = buildRoadTestReport(input({ log: [entry({ tMs: T0 })], logDropped: 47 }));
  check('honest: dropped log entries are stated, never silently omitted', /47 older/.test(dropped));

  const bare = buildRoadTestReport(
    input({
      gps: { health: 'lost', accuracyM: null, speedMph: null },
      voice: null,
      wake: null,
      device: { userAgent: null, viewport: null, online: null },
      trip: null,
    }),
  );
  check('honest: missing numbers read "unknown", never 0', /accuracy \(m\): unknown/.test(bare));
  check('honest: an uninitialised subsystem says so', /not initialised/.test(bare));
  check('honest: no completed trip says exactly that', /no completed trip/.test(bare));
  check('honest: an empty log says empty', /EVENT LOG \(0 entries\)/.test(bare));
  check('honest: nothing is invented for a missing device', /user agent: unknown/.test(bare));

  const offline = buildRoadTestReport(input({ device: { ...input().device, online: false } }));
  check('honest: being offline is called OFFLINE, in capitals', /network: OFFLINE/.test(offline));

  const trip = buildRoadTestReport(
    input({
      trip: Object.freeze({
        routeId: 'r1',
        endReason: 'destination-unverified' as const,
        entranceKind: 'unverified-entrance' as const,
        plannedMiles: 142.7,
        finalRouteMile: 142.5,
        startedMs: T0,
        endedMs: T0 + 3_600_000,
        observations: 3421,
      }),
    }),
  );
  check(
    'honest: the trip section reports the END REASON as it happened',
    /ended: destination-unverified/.test(trip) && /entrance: unverified-entrance/.test(trip),
  );
  check('honest: duration is derived, not guessed', /duration \(min\): 60\.0/.test(trip));
}

// ============================== the affordance ===========================
{
  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');

  // The report lives inside PilotTripControls, which the driving screen
  // renders inside the stationary-only 'edit-destination' gate. Writing a
  // note at speed is exactly what doc 06 locks — and this inherits that
  // rail rather than inventing a second one.
  check(
    'affordance: it renders inside the stationary-only pilot slot',
    /<LockGate[^>]*action="edit-destination"/.test(screen) && screen.includes('destinationSlot={'),
  );
  check(
    'affordance: no new permission was invented for it',
    !/road-test-report|copy-report/.test(readFileSync('src/lib/navigator/actions.ts', 'utf8')),
  );
  check('affordance: the report text is SHOWN, not only copied', controls.includes('readOnly'));
  check(
    'affordance: a clipboard that is missing or refuses says so',
    /Clipboard unavailable/.test(controls) && /Copy refused/.test(controls),
  );
  check(
    'affordance: the driver can add their own account of what happened',
    controls.includes('road-test-note') && controls.includes('Anything to add?'),
  );
  // The note became optional when the category picker landed: a triager
  // reads the category first, and a driver at the end of a shift will tap
  // a list long after they have stopped being willing to type. The note
  // survives — this pins that it stayed OPTIONAL rather than becoming the
  // only way to say anything.
  check(
    'affordance: the note is explicitly optional',
    /Anything to add\?.*optional/s.test(controls),
  );
  check(
    'affordance: and it is length-capped in the markup, not just in the model',
    controls.includes('maxLength={MAX_NOTE_CHARS}'),
  );
  check(
    'wiring: the screen assembles the report from live session state',
    screen.includes('buildRoadTestReport({') &&
      screen.includes('trip: lifecycle.summary()') &&
      screen.includes('wake: wakeRef.current?.snapshot()'),
  );
}

console.log(`navigator-road-test-report: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
