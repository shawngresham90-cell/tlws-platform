/**
 * The pilot's owner-facing and driver-facing documents, checked against
 * the code they describe.
 *
 * A limitations document is the one artifact whose value is entirely in
 * being CURRENT. It is written once, read by the person deciding whether
 * to hand a driver a password, and then the code moves underneath it for
 * six weeks. The failure mode is not a typo — it is a sentence that was
 * true in August and is quietly a lie in October, telling an owner that a
 * restriction is enforced when the request stopped carrying it.
 *
 * So every mechanical claim in `navigator-known-limitations.md` is
 * re-derived here from the thing it describes: the profile-coverage
 * catalogue, the real provider URL builder, the map styles, the rate
 * limiters, the reroute budget, the session lifetime. If the code
 * changes and the document does not, this fails.
 *
 * Two claims are checked in the NEGATIVE, which is the harder and more
 * important direction:
 *
 *   - the document may not describe a field as sent when the builder does
 *     not send it. An over-claim is the dangerous kind of stale.
 *   - the driver guide may not name a report destination, because the
 *     repository does not define one. An invented address would route
 *     truck-route defect reports to nobody.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot-docs.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-pilot-docs.cjs && node /tmp/test-navigator-pilot-docs.cjs
 */
import { readFileSync } from 'node:fs';
import {
  TRUCK_PROFILE_COVERAGE,
  sentFields,
  gapFields,
} from '@/lib/navigator/truck-profile-coverage';
import { buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import { MAP_STYLES } from '@/lib/navigator/map-style';
import { REROUTE_DEFAULTS } from '@/lib/navigator/reroute-controller';
import { PILOT_MAX_AGE_SECONDS } from '@/lib/navigator-api/pilot-access';
import { MAX_SEARCH_LENGTH } from '@/lib/navigator-api/destination-search';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

const LIMITS = readFileSync('docs/operations/navigator-known-limitations.md', 'utf8');
const PLAYBOOK = readFileSync('docs/operations/navigator-incident-playbook.md', 'utf8');
const GUIDE = readFileSync('docs/operations/navigator-driver-guide.md', 'utf8');

/** Markdown wraps; prose assertions run against a flattened copy. */
const flat = (s: string) => s.replace(/\s+/g, ' ');
const LIMITS_FLAT = flat(LIMITS);
const PLAYBOOK_FLAT = flat(PLAYBOOK);
const GUIDE_FLAT = flat(GUIDE);

function section(doc: string, start: string, end: string): string {
  const a = doc.indexOf(start);
  if (a < 0) return '';
  const b = end === '' ? doc.length : doc.indexOf(end, a + start.length);
  return doc.slice(a, b < 0 ? doc.length : b);
}

/* ------------------------------------------- 1. what the request sends */

// The real URL, from the real builder, with the real default profile.
const URL_PARAMS = (() => {
  const url = buildHereRouteUrl(
    {
      origin: { lat: 33.7, lng: -84.4 },
      destination: { lat: 34.0, lng: -85.0 },
      waypoints: [],
      truck: { ...DEFAULT_TRUCK_PROFILE, hazmatClass: '3' },
      departAtMs: 1_770_000_000_000,
      avoid: ['tollRoad'],
    },
    'test-key-not-a-real-one',
  );
  return new Set([...new URL(url).searchParams.keys()]);
})();

{
  const sent = sentFields();
  const gaps = gapFields();
  check(
    'coverage: 8 fields reach the wire',
    sent.length === 8,
    sent.map((f) => f.id),
  );
  check(
    'coverage: 4 fields do not',
    gaps.length === 4,
    gaps.map((f) => f.id),
  );

  // The catalogue must agree with the actual URL. This is what stops the
  // limitations doc inheriting a stale catalogue.
  for (const f of sent) {
    check(
      `wire: the builder really sets ${f.wireParam} (claimed for "${f.label}")`,
      f.wireParam !== null && URL_PARAMS.has(f.wireParam),
      [...URL_PARAMS].join(','),
    );
  }
  for (const f of gaps) {
    check(`wire: "${f.label}" has no provider parameter in the catalogue`, f.wireParam === null);
  }

  // The exact parameter set. A new one appearing is a routing change and
  // must not slip in behind a documentation PR.
  const EXPECTED = [
    'transportMode',
    'origin',
    'destination',
    'return',
    'units',
    'departureTime',
    'truck[height]',
    'truck[width]',
    'truck[length]',
    'truck[grossWeight]',
    'truck[axleCount]',
    'truck[shippedHazardousGoods]',
    'avoid[features]',
    'apiKey',
  ];
  check(
    'wire: the request carries exactly the documented parameter set',
    [...URL_PARAMS].sort().join(',') === [...EXPECTED].sort().join(','),
    [...URL_PARAMS].sort().join(','),
  );
  for (const absent of [
    'alternatives',
    'truck[type]',
    'vehicle[type]',
    'truck[weightPerAxle]',
    'truck[trailerCount]',
    'truck[tunnelCategory]',
  ]) {
    check(`wire: "${absent}" is NOT sent — nothing was guessed`, !URL_PARAMS.has(absent), absent);
  }
}

/* ------------------------------ 2. the document says what the code does */
{
  const sentTable = section(LIMITS, '### Sent to the provider', '### **Not** sent');
  const gapTable = section(LIMITS, '### **Not** sent', '## 3. Route guidance');
  check('limits: the sent table exists', sentTable.length > 200);
  check('limits: the not-sent table exists', gapTable.length > 200);

  for (const f of sentFields()) {
    check(
      `limits: sent table lists "${f.label}"`,
      sentTable.includes(f.label) && f.wireParam !== null && sentTable.includes(f.wireParam),
      f.label,
    );
    check(
      `limits: "${f.label}" is not ALSO in the not-sent table`,
      !gapTable.includes(`**${f.label}**`),
      f.label,
    );
  }
  for (const f of gapFields()) {
    check(`limits: not-sent table lists "${f.label}"`, gapTable.includes(f.label), f.label);
    check(
      `limits: "${f.label}" is not claimed as sent`,
      !sentTable.includes(`| ${f.label} |`),
      f.label,
    );
    check(
      `limits: explains why "${f.label}" matters`,
      gapTable.includes(f.why.slice(0, 25)),
      f.why,
    );

    // The STATUS WORD, not just the row. "Not modelled" and "provider
    // decides for itself" are different failures with different fixes,
    // and a row that says the wrong one sends the owner after the wrong
    // work. Read the row's own status cell rather than the table.
    const row = gapTable.split('\n').find((l) => l.includes(`**${f.label}**`)) ?? '';
    const statusCell = row.split('|')[2] ?? '';
    const expected = f.status === 'provider-default' ? /Provider default/i : /Not modelled/i;
    check(
      `limits: "${f.label}" is described as ${f.status}`,
      expected.test(statusCell),
      `${f.status} vs "${statusCell.trim()}"`,
    );
  }

  // The catalogue is the single source; the doc may not invent a field.
  const labels = new Set(TRUCK_PROFILE_COVERAGE.map((f) => f.label));
  for (const line of `${sentTable}\n${gapTable}`.split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('| What') || /^\|\s*-+/.test(line)) continue;
    const label = (line.split('|')[1] ?? '').replace(/\*\*/g, '').trim();
    if (label === '') continue;
    check(`limits: "${label}" is a real catalogue field`, labels.has(label), label);
  }
}

/* ------------------------------------- 3. every other mechanical claim */
{
  const satellite = MAP_STYLES.find((s) => s.id === 'satellite');
  check('map: the satellite style really has no tile url', satellite?.tileUrl === null);
  check(
    'limits: and the document says so rather than promising imagery',
    /no tile URL/i.test(LIMITS_FLAT) && /OpenStreetMap street tiles/i.test(LIMITS_FLAT),
  );

  check(
    'limits: quotes the real reroute budget',
    LIMITS.includes(
      `**${REROUTE_DEFAULTS.maxPerHour} per hour, ${REROUTE_DEFAULTS.maxPerSession} per session**`,
    ),
    `${REROUTE_DEFAULTS.maxPerHour}/${REROUTE_DEFAULTS.maxPerSession}`,
  );
  check(
    'limits: quotes the real backoff ladder',
    LIMITS.includes(REROUTE_DEFAULTS.failureBackoffMs.map((ms) => `${ms / 1000} s`).join(' → ')),
    REROUTE_DEFAULTS.failureBackoffMs.join(','),
  );
  check(
    'limits: quotes the real session lifetime',
    LIMITS.includes(`${PILOT_MAX_AGE_SECONDS / 3600} hours`),
    PILOT_MAX_AGE_SECONDS,
  );

  // Endpoint limiters, read out of the route files themselves.
  const ROUTE_API = readFileSync('src/app/api/navigator/route/route.ts', 'utf8');
  const SEARCH_API = readFileSync('src/app/api/navigator/destination-search/route.ts', 'utf8');
  check(
    'route API: still 6/hour/IP',
    /capacity:\s*6,\s*\n\s*refillPerSecond:\s*6\s*\/\s*3600/.test(ROUTE_API),
  );
  check(
    'search API: still 30/min/IP',
    /capacity:\s*30,\s*\n\s*refillPerSecond:\s*30\s*\/\s*60/.test(SEARCH_API),
  );
  check('limits: quotes 6 per hour per IP for routes', /\*\*6 per hour per IP\*\*/.test(LIMITS));
  check(
    'limits: quotes 30 per minute per IP for search',
    /\*\*30 per minute per IP\*\*/.test(LIMITS),
  );
  check('search: the query cap is still bounded', MAX_SEARCH_LENGTH === 120);

  // Persistence claims. The strongest form: no navigator surface reaches a
  // store at all, which is what makes the document's claim safe to print.
  for (const f of [
    'src/components/navigator/DrivingScreen.tsx',
    'src/components/navigator/DriverNameEntry.tsx',
    'src/lib/navigator/road-test-report.ts',
    'src/lib/navigator/diagnostic-snapshot.ts',
  ]) {
    const src = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    check(
      `persistence: ${f} reaches no store`,
      !/localStorage|sessionStorage|indexedDB|supabase/i.test(src),
      f,
    );
  }
  check(
    'limits: says the first name is session-only and lost on reload',
    /session-only/i.test(LIMITS_FLAT) && /reload loses it/i.test(LIMITS_FLAT),
  );
  check('limits: says position is never stored', /Position is never stored/i.test(LIMITS_FLAT));

  check(
    'limits: records the vehicle-type gap as unresolved rather than fixed',
    /Nothing was guessed/i.test(LIMITS_FLAT),
  );
  check('limits: is honest that #272 is unmerged', /PR #272, which is unmerged/i.test(LIMITS_FLAT));
  check(
    'limits: does not promise legal routing',
    /No route is guaranteed legal/i.test(LIMITS_FLAT) &&
      !/guarantees? (?:a )?legal/i.test(LIMITS_FLAT.replace(/No route is guaranteed legal/gi, '')),
  );
}

/* ------------------------------------------------- 4. incident playbook */
{
  const numbered = [...PLAYBOOK.matchAll(/^## (\d+) · /gm)].map((m) => Number(m[1]));
  check('playbook: 14 incidents', numbered.length === 14, numbered);
  check(
    'playbook: numbered 1..14 in order',
    numbered.every((n, i) => n === i + 1),
    numbered,
  );

  for (const required of [
    'Unsafe route',
    'Implicit or unverified turnaround',
    'Truck restriction concern',
    'Wrong-way guidance',
    'Bad rerouting',
    'GPS or map-position failure',
    'Voice failure',
    'HOS failure',
    'Crash or freeze',
    'Routing provider outage',
    'Network outage',
    'Password or authentication failure',
    'Session expiry',
    'Privacy or security concern',
  ]) {
    check(`playbook: covers "${required}"`, PLAYBOOK.includes(required), required);
  }

  // Every incident answers the same six questions, so nothing is half-written.
  const blocks = PLAYBOOK.split(/^## \d+ · /m).slice(1);
  check('playbook: 14 blocks to inspect', blocks.length === 14, blocks.length);
  for (const [i, block] of blocks.entries()) {
    for (const field of [
      '**Severity**',
      '**Tell the driver**',
      '**Pilot posture**',
      '**Collect**',
    ]) {
      check(`playbook: incident ${i + 1} answers ${field}`, block.includes(field), field);
    }
    check(
      `playbook: incident ${i + 1} says whether to keep using Navigator`,
      /\*\*Keep using Navigator\?\*\*/.test(block),
    );
    check(`playbook: incident ${i + 1} has a resume line`, /\*\*Resume/.test(block));
  }

  check(
    'playbook: rotates the secret BEFORE fixing the code',
    /Rotate the exposed value first/i.test(PLAYBOOK_FLAT),
  );
  check(
    'playbook: separates "not spoken" from "not heard"',
    /was the phone capable of speaking/i.test(PLAYBOOK_FLAT),
  );
  check('playbook: tells the driver not to turn around', /Do not turn around/i.test(PLAYBOOK_FLAT));
  check(
    'playbook: requires a regression fixture after every P0',
    /has not been fixed; it has been guessed at/i.test(PLAYBOOK_FLAT),
  );
}

/* ---------------------------------------------------- 5. driver guide */
{
  check(
    'guide: marks the report destination as an owner decision',
    /OWNER DECISION REQUIRED — REPORT DESTINATION/.test(GUIDE_FLAT),
  );
  // The negative that matters: no address may be invented here.
  const addresses = [...GUIDE.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]);
  check('guide: invents no email address to send reports to', addresses.length === 0, addresses);
  check(
    'guide: invents no phone number either',
    !/\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/.test(GUIDE),
  );
  check('guide: leaves a blank for the owner to fill', /Send your report to: `_+`/.test(GUIDE));

  for (const [what, re] of [
    ['signs win', /Signs win\. Always\./i],
    ['driver judgment wins', /Your judgment wins/i],
    ['never make an unsafe turnaround', /Never make an unsafe turnaround/i],
    [
      'no U-turn, driveway, lot, shoulder, backing',
      /do not use a driveway.*do not use a private lot.*do not back into traffic.*do not use the shoulder/i,
    ],
    [
      'do not follow an unsafe instruction',
      /Do not follow an instruction that is physically unsafe/i,
    ],
    ['keep a second way to navigate', /Keep a second way to navigate/i],
    ['verify the destination', /make sure it is the place you actually mean/i],
    ['enable voice while stationary', /Turn voice on while you are stopped/i],
    ['what off-route means', /Means Navigator noticed you are not on the planned route/i],
    [
      'what to do if rerouting produces nothing',
      /If it just sits on "Rerouting" and nothing comes/i,
    ],
    ['what to do if the map position is wrong', /If the map shows you in the wrong place/i],
    ['what to do if the route looks wrong', /If the route looks wrong/i],
    ['what to do if it freezes', /If the app freezes or goes blank/i],
    ['how to make a report', /Tap \*\*Report a problem\*\*/i],
    ['what the build number is for', /Every report needs it/i],
    ['when to stop using it', /Stop using Navigator and call me immediately if/i],
    ['it is a pilot', /Navigator is a \*\*pilot\*\*/i],
    ['the truck profile gaps', /It does not send:/i],
  ] as const) {
    check(`guide: tells the driver — ${what}`, re.test(GUIDE_FLAT), what);
  }

  check(
    'guide: promises no legal guarantee',
    /Guarantee a route is legal for your truck/i.test(GUIDE_FLAT) &&
      /What Navigator will never do/i.test(GUIDE_FLAT),
  );
  check(
    'guide: is honest that no turnaround data exists',
    /It does not have that data and it does not pretend to/i.test(GUIDE_FLAT),
  );
  check(
    'guide: asks for a report even when nothing went wrong',
    /including the ones where nothing went wrong/i.test(GUIDE_FLAT),
  );
  check(
    'guide: states the report carries no location',
    /It does not contain where you were/i.test(GUIDE_FLAT),
  );
}

console.log(`navigator-pilot-docs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
