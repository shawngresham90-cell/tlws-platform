/**
 * The pilot event schema, its privacy gate, and the Navigator crash
 * boundary.
 *
 * The schema's whole claim is that it CANNOT emit a coordinate, a road
 * name, a secret or a driver's name — not that it is careful to avoid
 * them. So the tests are mostly hostile: the factory is fed addresses,
 * latitudes, API keys, URLs and provider payloads in every field that
 * accepts a string, and the assertion is that none of them survive into
 * the event. A schema that only works when it is called politely is not
 * a schema, it is a convention.
 *
 * The crash boundary is checked for what it must NOT do, which is the
 * part that matters. The site-wide boundary it replaces for Navigator
 * routes fires an analytics event and offers a driver whose navigation
 * just died a link to the practice tests. Those two behaviours are
 * asserted absent here, along with the raw error message, and the "your
 * route is gone" copy is asserted present — because a boundary that
 * offers "try again" while implying the trip resumed would be the most
 * dangerous screen in the app.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot-events.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-pilot-events.cjs && node /tmp/test-navigator-pilot-events.cjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  EVENT_REASONS,
  MAX_COUNT,
  PILOT_EVENT_NAMES,
  checkEventPrivacy,
  createMemoryEventSink,
  eventSummaryLines,
  pilotEvent,
  summarizeEvents,
  type PilotEvent,
} from '@/lib/navigator/pilot-events';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

const EVENTS_SRC = readFileSync('src/lib/navigator/pilot-events.ts', 'utf8');
const BOUNDARY = readFileSync('src/app/(navigator)/error.tsx', 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const BOUNDARY_CODE = strip(BOUNDARY);
/** Prettier decides where the copy wraps; prose assertions must not. */
const BOUNDARY_FLAT = BOUNDARY.replace(/\s+/g, ' ');

const BASE = { name: 'route-ready', tSec: 10, build: 'b6a1260' } as const;

/* ------------------------------------------------------------ 1. schema */
{
  check('schema: 26 events', PILOT_EVENT_NAMES.length === 26, PILOT_EVENT_NAMES.length);
  check('schema: names are unique', new Set(PILOT_EVENT_NAMES).size === PILOT_EVENT_NAMES.length);
  for (const n of PILOT_EVENT_NAMES) {
    check(`schema: "${n}" is a stable kebab-case name`, /^[a-z][a-z0-9-]*[a-z0-9]$/.test(n), n);
    const e = pilotEvent({ ...BASE, name: n });
    check(`schema: "${n}" builds`, e !== null);
    check(`schema: "${n}" is frozen`, e !== null && Object.isFrozen(e));
    check(`schema: "${n}" carries version 1`, e?.v === 1);
  }

  check(
    'schema: an unknown name is refused, not coerced',
    pilotEvent({ ...BASE, name: 'made-up' }) === null,
  );
  check(
    'schema: a non-string name is refused',
    pilotEvent({ ...BASE, name: 42 as unknown as string }) === null,
  );
  check(
    'schema: the event has exactly the nine allowlisted keys',
    Object.keys(pilotEvent(BASE) as PilotEvent)
      .sort()
      .join(',') ===
      'build,count,gps,lifecycle,name,network,reason,tSec,v'.split(',').sort().join(','),
    Object.keys(pilotEvent(BASE) as PilotEvent).join(','),
  );

  // No field could ever hold a position. This is the structural claim.
  for (const forbidden of [
    'lat',
    'lng',
    'latitude',
    'longitude',
    'position',
    'coords',
    'road',
    'street',
    'address',
    'destination',
    'firstName',
    'query',
  ]) {
    check(
      `schema: the event type has no "${forbidden}" field`,
      !Object.prototype.hasOwnProperty.call(pilotEvent(BASE) as PilotEvent, forbidden),
      forbidden,
    );
  }
}

/* ------------------------------------------------------- 2. coercions */
{
  check('time: negative seconds floor to 0', pilotEvent({ ...BASE, tSec: -50 })?.tSec === 0);
  check('time: NaN floors to 0', pilotEvent({ ...BASE, tSec: Number.NaN })?.tSec === 0);
  check('time: Infinity floors to 0', pilotEvent({ ...BASE, tSec: Infinity })?.tSec === 0);
  check('time: fractions truncate', pilotEvent({ ...BASE, tSec: 12.9 })?.tSec === 12);

  check(
    'build: a full sha shortens',
    pilotEvent({ ...BASE, build: 'b6a1260a17e9f01c007782791c0a28f8bf08b55c' })?.build === 'b6a1260',
  );
  check(
    'build: a non-sha becomes unknown',
    pilotEvent({ ...BASE, build: 'not a sha' })?.build === 'unknown',
  );
  check('build: null becomes unknown', pilotEvent({ ...BASE, build: null })?.build === 'unknown');
  check(
    'build: a secret mis-set into the build variable does NOT pass through',
    pilotEvent({ ...BASE, build: 'sk-live-abcdef0123456789abcdef0123456789' })?.build === 'unknown',
  );

  check(
    'count: bounded at the ceiling',
    pilotEvent({ ...BASE, count: 10_000 })?.count === MAX_COUNT,
  );
  check('count: negative clamps to 0', pilotEvent({ ...BASE, count: -3 })?.count === 0);
  check('count: NaN becomes null', pilotEvent({ ...BASE, count: Number.NaN })?.count === null);
  check('count: absent is null', pilotEvent(BASE)?.count === null);

  check(
    'category: an unknown gps value falls back',
    pilotEvent({ ...BASE, gps: 'excellent' })?.gps === 'unavailable',
  );
  check(
    'category: a known gps value survives',
    pilotEvent({ ...BASE, gps: 'degraded' })?.gps === 'degraded',
  );
  check(
    'category: an unknown lifecycle falls back',
    pilotEvent({ ...BASE, lifecycle: 'cruising' })?.lifecycle === 'unknown',
  );
  check(
    'category: an unknown network falls back',
    pilotEvent({ ...BASE, network: 'wifi' })?.network === 'unknown',
  );
}

/* -------------------------------------------------------- 3. reasons */
{
  for (const [name, vocabulary] of EVENT_REASONS) {
    for (const r of vocabulary) {
      check(
        `reason: "${name}" accepts "${r}"`,
        pilotEvent({ ...BASE, name, reason: r })?.reason === r,
      );
    }
    check(
      `reason: "${name}" turns an unrecognised reason into "other"`,
      pilotEvent({ ...BASE, name, reason: 'something nobody designed' })?.reason === 'other',
    );
    check(
      `reason: "${name}" allows an absent reason`,
      pilotEvent({ ...BASE, name })?.reason === null,
    );
  }

  // The strict half: an event with no vocabulary carries no reason AT ALL,
  // not 'other'. Supplying one is a caller error and is dropped.
  const withoutVocabulary = PILOT_EVENT_NAMES.filter((n) => !EVENT_REASONS.has(n));
  check(
    'reason: most events have no vocabulary',
    withoutVocabulary.length >= 15,
    withoutVocabulary.length,
  );
  for (const n of withoutVocabulary) {
    check(
      `reason: "${n}" has no reason field even when one is supplied`,
      pilotEvent({ ...BASE, name: n, reason: 'I-75 at exit 333' })?.reason === null,
      n,
    );
  }
}

/* --------------------------------------------------------- 4. privacy */

/** Everything an unwary caller might try to put in an event. */
const HOSTILE: readonly string[] = Object.freeze([
  '33.748995,-84.387982',
  '33.7489950',
  'I-75 North at Charles Hardy Pkwy',
  '1600 Pennsylvania Ave NW, Washington DC',
  'apiKey=aBcDeF0123456789aBcDeF0123456789',
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'https://router.hereapi.com/v8/routes?apiKey=secret',
  'driver@example.com',
  'password: hunter2',
  'tlws_navigator_pilot=v1.123.abc',
  'Shawn',
  '{"routes":[{"polyline":"BG0zsflD"}]}',
]);

{
  for (const nasty of HOSTILE) {
    // Every string-accepting field, on an event that has a vocabulary and
    // one that does not.
    for (const name of ['reroute-rejected', 'route-ready'] as const) {
      const e = pilotEvent({
        name,
        tSec: 5,
        build: nasty,
        lifecycle: nasty,
        gps: nasty,
        network: nasty,
        reason: nasty,
      });
      check(`privacy: "${nasty.slice(0, 28)}…" produces an event at all`, e !== null);
      if (e === null) continue;
      const verdict = checkEventPrivacy(e);
      check(
        `privacy: nothing from "${nasty.slice(0, 28)}…" survives into ${name}`,
        verdict.safe,
        verdict.problems.join('; '),
      );
      check(
        `privacy: the hostile string is not anywhere in ${name}`,
        !JSON.stringify(e).includes(nasty),
        JSON.stringify(e),
      );
    }
  }

  // The gate itself must actually detect things, or its passes mean
  // nothing. Force each shape into an event and confirm it is caught.
  for (const [what, value] of [
    ['a coordinate', '33.74899'],
    ['a secret-shaped run', 'aBcDeF0123456789aBcDeF0123456789xy'],
    ['a credential keyword', 'password'],
    ['a url', 'https://example.com'],
    ['an email', 'a@b.co'],
  ] as const) {
    const forced = { ...(pilotEvent(BASE) as PilotEvent), reason: value } as PilotEvent;
    const verdict = checkEventPrivacy(forced);
    check(
      `privacy gate: detects ${what}`,
      !verdict.safe,
      `${value} → ${verdict.problems.join(';')}`,
    );
  }
  check(
    'privacy gate: a clean event passes',
    checkEventPrivacy(pilotEvent(BASE) as PilotEvent).safe,
  );
}

/* ------------------------------------------------------------ 5. sink */
{
  const sink = createMemoryEventSink(4);
  for (let i = 0; i < 6; i += 1) {
    sink.record(pilotEvent({ ...BASE, name: 'route-request', tSec: i }) as PilotEvent);
  }
  check('sink: bounded to its maximum', sink.entries().length === 4, sink.entries().length);
  check(
    'sink: keeps the newest',
    sink.entries()[3].tSec === 5,
    sink.entries().map((e) => e.tSec),
  );
  check('sink: counts what it discarded', sink.dropped() === 2, sink.dropped());
  check('sink: entries() returns a copy', sink.entries() !== sink.entries());

  const guard = createMemoryEventSink();
  guard.record({ ...(pilotEvent(BASE) as PilotEvent), reason: '33.74899' } as PilotEvent);
  check('sink: refuses an event that fails the privacy gate', guard.entries().length === 0);
  check('sink: and counts the refusal rather than hiding it', guard.dropped() === 1);

  guard.record({ name: 'not-an-event' } as unknown as PilotEvent);
  check('sink: refuses a malformed event', guard.entries().length === 0 && guard.dropped() === 2);

  // A sink must never throw — an observability failure must not become a
  // navigation failure.
  let threw = false;
  try {
    guard.record(null as unknown as PilotEvent);
    guard.record(undefined as unknown as PilotEvent);
  } catch {
    threw = true;
  }
  check('sink: never throws, whatever it is handed', !threw);

  check(
    'sink: an invalid maximum falls back rather than breaking',
    createMemoryEventSink(-1).entries().length === 0,
  );
}

/* --------------------------------------------------------- 6. summary */
{
  const sink = createMemoryEventSink();
  const script: [string, number, string | null][] = [
    ['navigator-session-start', 0, null],
    ['route-request', 12, null],
    ['route-ready', 15, null],
    ['navigation-start', 20, null],
    ['off-route-confirmed', 300, null],
    ['reroute-request', 301, null],
    ['reroute-rejected', 303, 'unsafe-reversal'],
    ['reroute-request', 340, null],
    ['reroute-rejected', 342, 'unsafe-reversal'],
    ['reroute-ready', 380, null],
    ['arrival', 900, null],
  ];
  for (const [name, tSec, reason] of script) {
    sink.record(pilotEvent({ name, tSec, build: 'b6a1260', reason }) as PilotEvent);
  }
  const s = summarizeEvents(sink);
  check('summary: totals', s.total === script.length, s.total);
  check('summary: counts repeated events', s.counts['reroute-request'] === 2, s.counts);
  check('summary: spans first to last', s.spanSec === 900, s.spanSec);
  check(
    'summary: dedupes reasons rather than repeating them',
    JSON.stringify(s.reasons['reroute-rejected']) === JSON.stringify(['unsafe-reversal']),
    s.reasons,
  );

  const lines = eventSummaryLines(s);
  check('summary lines: headed like the report', lines[0] === 'SESSION EVENTS');
  check(
    'summary lines: name the diagnosis a triager needs',
    lines.some((l) => l.includes('reroute-rejected: 2 (unsafe-reversal)')),
    lines.join('\n'),
  );
  check(
    'summary lines: follow the schema order, not insertion order',
    lines.findIndex((l) => l.startsWith('  route-request')) <
      lines.findIndex((l) => l.startsWith('  off-route-confirmed')),
    lines.join('\n'),
  );
  const empty = summarizeEvents(createMemoryEventSink());
  check(
    'summary: an empty session does not divide by anything',
    empty.total === 0 && empty.spanSec === 0,
  );
}

/* ---------------------------------------------------------- 7. purity */
{
  const CODE = EVENTS_SRC.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const [what, re] of [
    ['a clock', /\bDate\b|\bnow\(\)/],
    ['the network', /\bfetch\(|XMLHttpRequest|WebSocket/],
    ['browser globals', /\bwindow\.|\bdocument\.|localStorage|sessionStorage|indexedDB/],
    ['timers', /setTimeout|setInterval/],
    ['persistence', /supabase|writeFile|readFile/i],
    ['logging', /console\./],
    ['configuration', /process\.env|NEXT_PUBLIC/],
  ] as const) {
    check(`events module: does not reach ${what}`, !re.test(CODE), what);
  }
  check(
    'events module: exports exactly one sink implementation',
    (EVENTS_SRC.match(/export function create\w*Sink/g) ?? []).length === 1,
    EVENTS_SRC.match(/export function create\w*Sink/g),
  );
  check(
    'events module: the sink is a port, so a destination stays a decision',
    /export type PilotEventSink = \{/.test(EVENTS_SRC),
  );
}

/* -------------------------- 8. Navigator emits nothing to a third party */
{
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) {
        const src = strip(readFileSync(p, 'utf8'));
        if (/\btrackEvent\s*\(/.test(src) || /\bconsole\.\w+\s*\(/.test(src)) offenders.push(p);
      }
    }
  };
  for (const dir of ['src/components/navigator', 'src/lib/navigator', 'src/app/(navigator)'])
    walk(dir);
  check(
    'privacy: no Navigator surface fires analytics or writes a log',
    offenders.length === 0,
    offenders,
  );
}

/* ------------------------------------------------- 9. the crash boundary */
{
  check('boundary: is a client component', /^'use client';/.test(BOUNDARY));
  check(
    'boundary: is the default export for the route group',
    /export default function NavigatorError/.test(BOUNDARY),
  );

  // What it must NOT do.
  check(
    'boundary: fires no analytics — unlike the site-wide one it replaces',
    !/trackEvent|analytics/i.test(BOUNDARY_CODE),
  );
  check('boundary: never renders the raw error message', !/error\.message/.test(BOUNDARY_CODE));
  check('boundary: renders the digest instead', /error\.digest/.test(BOUNDARY_CODE));
  for (const marketing of ['/knowledge', '/practice-tests', '/directory', '/store']) {
    check(
      `boundary: does not send a stranded driver to ${marketing}`,
      !BOUNDARY_CODE.includes(marketing),
      marketing,
    );
  }
  check(
    'boundary: claims no surviving route',
    !/route is still|still navigating|resume your route|continue on/i.test(BOUNDARY_CODE),
  );
  check(
    'boundary: fabricates no guidance',
    !/maneuver|turn (?:left|right)|exit in|continue for/i.test(BOUNDARY_CODE),
  );

  // What it must do.
  check('boundary: says navigation has stopped', /Navigation has stopped/.test(BOUNDARY_FLAT));
  check(
    'boundary: says the driver is not being guided',
    /You are not being guided/.test(BOUNDARY_FLAT),
  );
  check('boundary: says the route is gone', /Your route is gone/.test(BOUNDARY_FLAT));
  check(
    'boundary: tells the driver to use another source',
    /own knowledge or another device/.test(BOUNDARY_FLAT),
  );
  check('boundary: offers a reset', /onClick=\{\(\) => reset\(\)\}/.test(BOUNDARY_CODE));
  check('boundary: offers a way back to the driving screen', /href="\/drive"/.test(BOUNDARY_CODE));
  check(
    'boundary: shows the build id from the same three variables as the pilot strip',
    /NEXT_PUBLIC_BUILD_COMMIT/.test(BOUNDARY_CODE) &&
      /NEXT_PUBLIC_BUILD_CONTEXT/.test(BOUNDARY_CODE) &&
      /NEXT_PUBLIC_BUILD_TIME/.test(BOUNDARY_CODE),
  );
  check(
    'boundary: derives it through the same whitelist, not by hand',
    /resolveBuildId\(/.test(BOUNDARY_CODE) && /buildId\.label/.test(BOUNDARY_CODE),
  );
  check('boundary: targets are at least 64px', /minHeight: '64px'/.test(BOUNDARY_CODE));
  check(
    'boundary: styles inline so it renders even when the stylesheet did not',
    !/className=/.test(BOUNDARY_CODE),
  );
  check(
    'boundary: states that nothing was sent anywhere',
    /nothing about the trip was sent anywhere/.test(BOUNDARY_FLAT),
  );
}

console.log(`navigator-pilot-events: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
