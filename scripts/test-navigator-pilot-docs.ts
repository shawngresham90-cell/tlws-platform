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
 *   - the driver guide may name exactly ONE report destination — the
 *     address the owner selected on 2026-08-10 — and nothing else. Any
 *     other email, any phone number, any chat channel and any link still
 *     fail, because an invented destination would route truck-route
 *     defect reports to nobody.
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
    // Trip restore (pilot round 3, item 4) is the driving screen's one
    // sanctioned storage path — the planned ROUTE in sessionStorage,
    // never the name, never a position trail. Discipline pinned in
    // test-navigator-trip-restore; sanctioned call shapes scrubbed here,
    // everything else still banned.
    const scrubbed = f.endsWith('DrivingScreen.tsx')
      ? src
          .replace(/sessionStorage\s*\.\s*(getItem|setItem|removeItem)\s*\(/g, 'TRIP_RESTORE_(')
          .replace(/typeof sessionStorage/g, 'TRIP_RESTORE_GUARD')
      : src;
    check(
      `persistence: ${f} reaches no store`,
      !/localStorage|sessionStorage|indexedDB|supabase/i.test(scrubbed),
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
  // #272 merged 2026-08-10. The document must say merged AND not
  // road-verified — the second half is the one that keeps Wave 1 honest.
  check(
    'limits: is honest that #272 is merged but not road-verified',
    /merged but not road-verified/i.test(LIMITS_FLAT) &&
      /road retest is \*\*NOT PERFORMED\*\*/i.test(LIMITS.replace(/\s+/g, ' ')) &&
      !/which is unmerged/i.test(LIMITS_FLAT),
  );
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

  // Every incident answers the same seven questions, so nothing is half-written.
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
    // Incident 14 writes it as "Engineering triage, in this order:" — same field.
    check(
      `playbook: incident ${i + 1} has an engineering triage line`,
      /\*\*Engineering triage/.test(block),
    );
    check(`playbook: incident ${i + 1} has a resume line`, /\*\*Resume/.test(block));
  }

  // The banner at the top advertises the field list. It drifted once already —
  // it promised six while every entry answered seven — so it is now pinned to
  // the fields actually asserted above rather than left as free prose. Scoped
  // to the preamble so the incidents themselves cannot satisfy it.
  const banner = flat(PLAYBOOK.slice(0, PLAYBOOK.indexOf('\n## ')));
  check(
    'playbook: banner advertises seven questions, not six',
    /the same seven questions/.test(banner),
  );
  for (const field of [
    '**Severity**',
    '**Tell the driver**',
    '**Pilot posture**',
    '**Collect**',
    '**Keep using Navigator?**',
    '**Engineering triage**',
    '**Resume when**',
  ]) {
    check(`playbook: banner names ${field}`, banner.includes(field), field);
  }
  // This playbook says STOP; the stop policy says STOP IMMEDIATELY and the
  // module's id is `stop-immediately`. Same posture, two spellings — the
  // banner has to bridge them or an owner grepping one document for the
  // other's word finds nothing at the moment it matters.
  check(
    'playbook: banner reconciles STOP with the policy id',
    /STOP here is the policy's STOP IMMEDIATELY/.test(banner) &&
      banner.includes('`stop-immediately`'),
  );

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
  // The report destination was an owner decision, deliberately left blank
  // until the owner made it. On 2026-08-10 the owner selected the address
  // below. The guard's job is unchanged in spirit: no INVENTED destination
  // may appear. Exactly this owner-approved address is allowed; changing it
  // means changing this constant, which is an owner decision, on purpose.
  const OWNER_APPROVED_REPORT_DESTINATION = 'shawngresham90@gmail.com';

  check(
    'guide: records the destination as owner-selected, not invented',
    /Report destination — owner-selected/.test(GUIDE_FLAT) &&
      /chosen by the owner on 2026-08-10/.test(GUIDE_FLAT),
  );
  check(
    'guide: sends reports to exactly the owner-approved address',
    GUIDE.includes(`**Send your report to: \`${OWNER_APPROVED_REPORT_DESTINATION}\`**`),
  );
  check(
    'guide: no blank remains to suggest the decision is still open',
    !/Send your report to: `_+`/.test(GUIDE) && !/OWNER DECISION REQUIRED/.test(GUIDE),
  );
  // The negative that matters: no OTHER destination of any kind may appear.
  // Email and phone were the obvious two; a Slack channel, a chat workspace or a
  // form URL would fill the line just as wrongly, so they are guarded too.
  const addresses = [...GUIDE.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]);
  check(
    'guide: names no email address other than the owner-approved one',
    addresses.length > 0 && addresses.every((a) => a === OWNER_APPROVED_REPORT_DESTINATION),
    addresses,
  );
  check(
    'guide: invents no phone number either',
    !/\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/.test(GUIDE),
  );
  const channels = [...GUIDE.matchAll(/\b(?:slack|discord|teams|whatsapp|telegram)\b/gi)].map(
    (m) => m[0],
  );
  check('guide: invents no chat channel to send reports to', channels.length === 0, channels);
  const links = [...GUIDE.matchAll(/(?:https?:\/\/|\bwww\.)\S+/gi)].map((m) => m[0]);
  check('guide: invents no form or link destination', links.length === 0, links);
  check(
    'limits: records the same owner-selected destination',
    LIMITS.includes(`\`${OWNER_APPROVED_REPORT_DESTINATION}\``) &&
      /Resolved 2026-08-10/.test(LIMITS_FLAT),
  );

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
    // Matches incident 13 and Wave 0 step 11.4: the driver must be told the
    // 12-hour re-ask is by design, or a normal expiry reads as a lockout.
    ['the pilot password lasts 12 hours', /the pilot password lasts 12 hours/i],
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

/* ---------------- heading-up: the blocker is recorded, not papered over */

// The final pilot milestone required heading-up OR an honest, measured
// blocker. The blocker shipped. These pins keep the record honest: the
// evidence document exists with both measurements, the limitations doc
// says plainly that navigation is north-up, the decision is the owner's
// (decision 6), and the probe that produced the numbers is committed so
// they can be reproduced.
{
  const BLOCKER = readFileSync('docs/operations/navigator-heading-up-blocker.md', 'utf8');
  const BLOCKER_FLAT = flat(BLOCKER);
  check(
    'heading-up: the blocker doc says NOT IMPLEMENTED, on purpose',
    /NOT IMPLEMENTED, on purpose/.test(BLOCKER_FLAT),
  );
  check(
    'heading-up: the no-bearing-API measurement is recorded',
    BLOCKER.includes('"hasBearing":false') && BLOCKER.includes('"leafletVersion":"1.9.4"'),
  );
  check(
    'heading-up: the CSS-rotation coordinate desync is recorded with numbers',
    BLOCKER.includes('{"x":200,"y":300}') && BLOCKER.includes('{"x":368,"y":363}'),
  );
  check(
    'heading-up: the inverted-drag measurement is recorded',
    BLOCKER.includes('"dLat":-0.011882'),
  );
  check(
    'heading-up: icon-only rotation is explicitly NOT claimed as heading-up',
    /Rotating only the truck icon does not satisfy/.test(BLOCKER_FLAT),
  );
  check(
    'heading-up: the probe behind the numbers is committed and named',
    BLOCKER.includes('scripts/bench/navigator-rotation-probe.mjs') &&
      readFileSync('scripts/bench/navigator-rotation-probe.mjs', 'utf8').includes(
        'latLngToContainerPoint',
      ),
  );
  // Heading-up SHIPPED (owner decision 6, path B — the MapLibre
  // migration). What the limitations doc must now say is what is still
  // true: guidance rotates, everything else is north-up on purpose, the
  // heading is inferred from movement, and no compass is read.
  check(
    'limits: heading-up guidance is stated, with north-up kept where it is clearer',
    /Live guidance is heading-up; every other map is north-up/.test(LIMITS_FLAT),
  );
  check(
    'limits: the heading is described as inferred, never invented while parked',
    /The heading is inferred, and says so/.test(LIMITS_FLAT) &&
      /parked truck at a cold start has no heading/.test(LIMITS_FLAT),
  );
  check(
    'limits: no compass / no orientation sensor is stated plainly',
    /No compass/.test(LIMITS_FLAT) && /no motion permission is requested/.test(LIMITS_FLAT),
  );
  check(
    'limits: owner decision 6 is recorded as RESOLVED by the MapLibre migration',
    /\| 6 \|[\s\S]{0,400}Resolved/i.test(LIMITS_FLAT) && /MapLibre GL migration/.test(LIMITS_FLAT),
  );
  check(
    'limits: and Leaflet is explained as still present for the directory maps',
    /directory and parking maps\*{0,2} still use it/.test(LIMITS_FLAT),
  );
}

console.log(`navigator-pilot-docs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
