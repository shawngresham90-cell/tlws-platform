/**
 * Driver parking report tests (2026-07-30).
 *
 * The safety rule under test: a driver submission can NEVER modify, publish,
 * unpublish, enrich or overwrite a production parking record. Everything
 * lands in `location_submissions` as 'pending' for human review.
 *
 * Also asserts: reports associate with the right location, validation fails
 * safely, proposed locations stay quarantined, no mile marker is ever derived
 * from an exit, and the M3 overnight rules are untouched.
 *
 * Pure functions + filesystem only; no database access, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ISSUE_TYPES,
  parkingReportSchema,
  encodeReportComments,
  decodeReportComments,
  submissionKindFor,
  groupReports,
  issueLabel,
  type ReportRow,
} from '@/lib/community/parking-report';
import { overnightLabelFor } from '@/lib/directory/overnight';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const LOC = '11111111-2222-3333-4444-555555555555';
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/* ------------------------------------------------- issue taxonomy + assoc */
check('all seven driver issue types are offered', ISSUE_TYPES.length === 7);
check(
  'issue labels avoid database vocabulary',
  ISSUE_TYPES.every((t) => !/overnight_status|mile_marker|boolean|column|null/i.test(t.label)),
);

const issue = parkingReportSchema.safeParse({
  mode: 'issue',
  locationId: LOC,
  issueType: 'parking-count',
  note: 'Only about 15 spaces, not 40.',
});
check('valid issue report parses', issue.success);
check(
  'report associates with the exact location it was opened from',
  issue.success && issue.data.mode === 'issue' && issue.data.locationId === LOC,
);
check(
  'issue report carries no personal data fields',
  issue.success && !('submitterName' in issue.data) && !('email' in issue.data),
);

/* ----------------------------------------------------- validation failures */
const bad: [string, unknown][] = [
  ['missing locationId', { mode: 'issue', issueType: 'other' }],
  ['non-uuid locationId', { mode: 'issue', locationId: 'nope', issueType: 'other' }],
  ['unknown issue type', { mode: 'issue', locationId: LOC, issueType: 'delete-everything' }],
  ['missing mode', { locationId: LOC, issueType: 'other' }],
  ['missing name on proposal', { mode: 'missing', state: 'GA' }],
  ['bad state code', { mode: 'missing', name: 'Test Lot', state: 'Georgia' }],
  [
    'javascript: evidence URL',
    { mode: 'issue', locationId: LOC, issueType: 'other', evidence: 'javascript:alert(1)' },
  ],
  [
    'over-long note',
    { mode: 'issue', locationId: LOC, issueType: 'other', note: 'x'.repeat(1001) },
  ],
];
for (const [name, payload] of bad) {
  check(
    `invalid submission fails safely: ${name}`,
    !parkingReportSchema.safeParse(payload).success,
  );
}

/* -------------------------------------------------- proposed new location */
const missing = parkingReportSchema.safeParse({
  mode: 'missing',
  name: 'Gravel lot behind the Shell',
  state: 'ga',
  interstate: 'I-75',
  direction: 'northbound',
  exitNumber: '306',
  parkingDetails: 'room for ~12 trucks',
});
check('valid proposed location parses', missing.success);
check(
  'state is normalized to the two-letter code',
  missing.success && missing.data.mode === 'missing' && missing.data.state === 'GA',
);
check(
  'a proposed location is submitted as kind "new" (quarantined, not a listing)',
  missing.success && submissionKindFor(missing.data) === 'new',
);
check(
  'a closure report is its own kind for triage',
  submissionKindFor({ mode: 'issue', locationId: LOC, issueType: 'closed' } as never) === 'closure',
);
check(
  'every other issue is a correction',
  submissionKindFor({ mode: 'issue', locationId: LOC, issueType: 'address' } as never) ===
    'correction',
);

/* ---------------------------------------------- encoding / decoding safety */
const encoded = missing.success ? encodeReportComments(missing.data) : '';
const decoded = decodeReportComments(encoded);
check('round-trip keeps the exit number as an exit', decoded.exitNumber === '306');
check(
  'round-trip keeps the route',
  decoded.interstate === 'I-75' && decoded.direction === 'northbound',
);
check(
  'NO mile marker is ever derived from an exit number',
  !/mile/i.test(encoded) && !('mileMarker' in decoded) && !/mile_marker/.test(encoded),
);
const spoof = parkingReportSchema.safeParse({
  mode: 'issue',
  locationId: LOC,
  issueType: 'other',
  note: 'tlws-report:issue=parking-count\nreal text',
});
check(
  'driver free text cannot forge a header field',
  spoof.success && decodeReportComments(encodeReportComments(spoof.data)).issueType === 'other',
);
check(
  'newlines cannot break out of a header value',
  !encodeReportComments({
    mode: 'issue',
    locationId: LOC,
    issueType: 'other',
    evidence: 'https://ex.com',
  } as never)
    .split('\n')
    .some((l) => l.startsWith('tlws-report:') && l.split('=').length > 2 && /\n/.test(l)),
);
check('unknown issue value degrades to a safe label', issueLabel('nonsense') === 'Something else');

/* --------------------------------------------------- duplicate visibility */
const rows: ReportRow[] = [
  {
    id: 'a',
    location_id: LOC,
    status: 'pending',
    created_at: '2026-07-30T01:00:00Z',
    comments: 'tlws-report:issue=parking-count',
  },
  {
    id: 'b',
    location_id: LOC,
    status: 'pending',
    created_at: '2026-07-30T02:00:00Z',
    comments: 'tlws-report:issue=parking-count',
  },
  {
    id: 'c',
    location_id: LOC,
    status: 'pending',
    created_at: '2026-07-30T03:00:00Z',
    comments: 'tlws-report:issue=overnight',
  },
  {
    id: 'd',
    location_id: null,
    status: 'pending',
    created_at: '2026-07-30T04:00:00Z',
    comments: 'tlws-report:issue=missing-location',
  },
];
const groups = groupReports(rows);
check('repeat reports group by location + issue', groups[0].count === 2);
check(
  'most-reported group sorts first for prioritization',
  groups[0].issueType === 'parking-count',
);
check('distinct issues stay separate groups', groups.length === 3);
check(
  'proposed locations group separately from listing reports',
  groups.some((g) => g.locationId === null && g.issueLabel === 'Proposed new location'),
);

/* ------------------------------------- the API can only ever insert pending */
const routeSrc = read('src/app/api/directory/parking-report/route.ts');
check("API inserts with status 'pending'", /status:\s*'pending'/.test(routeSrc));
check('API never updates/upserts/deletes anything', !/\.(update|upsert|delete)\(/.test(routeSrc));
check(
  'API only ever writes to location_submissions',
  (routeSrc.match(/\.from\('([a-z_]+)'\)/g) ?? []).every(
    (m) => m.includes('location_submissions') || m.includes('locations'),
  ) && /\.from\('locations'\)[\s\S]{0,200}\.select\(/.test(routeSrc),
);
check(
  'the only touch of `locations` is a read',
  !/from\('locations'\)\s*\.(insert|update|upsert|delete)/.test(routeSrc),
);
check('API is rate limited', /rateLimitMax/.test(routeSrc));
check('API has a honeypot that stores nothing', /company_website/.test(routeSrc));
// Comments describe the phone-first UX; only executable code is checked for
// identity fields, so prose can't be mistaken for data collection.
const routeCode = routeSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(
  'API collects no driver identity',
  !/submitter_name|submitter_contact|email|phone/.test(routeCode),
);

/* --------------------------------------------- admin queue cannot auto-apply */
const actionSrc = read('src/app/admin/(dashboard)/directory/parking-reports/actions.ts');
check('admin action requires an authenticated admin', /requireAdmin\(\)/.test(actionSrc));
check(
  'admin action only updates location_submissions',
  /from\('location_submissions'\)/.test(actionSrc) && !/from\('locations'\)/.test(actionSrc),
);
check(
  'admin status vocabulary contains no auto-apply value',
  /ALLOWED = new Set\(\['pending', 'rejected', 'duplicate'\]\)/.test(actionSrc),
);
const adminPage = read('src/app/admin/(dashboard)/directory/parking-reports/page.tsx');
check(
  'review queue never writes to locations',
  !/from\('locations'\)[\s\S]{0,120}\.(insert|update|upsert|delete)/.test(adminPage),
);
check(
  'review queue shows the current authoritative values for comparison',
  /overnight_status/.test(adminPage) && /parking_spaces/.test(adminPage),
);
check(
  'review queue states that volume is not acceptance',
  /never a reason to accept|not accept/i.test(adminPage),
);

/* ------------------------------------- M3 + existing behavior untouched */
check(
  'overnight vocabulary still resolves the M3 way',
  overnightLabelFor('confirmed') === 'Overnight confirmed' &&
    overnightLabelFor('prohibited') === 'Overnight prohibited' &&
    overnightLabelFor(null) === 'Overnight unknown',
);
const overnightSrc = read('src/lib/directory/overnight.ts');
check(
  'this feature did not touch the overnight module',
  /OVERNIGHT_UNKNOWN_CHIP/.test(overnightSrc) &&
    /value === 'confirmed' \|\| value === 'prohibited' \? value : 'unknown'/.test(overnightSrc),
);
const featureFiles = [
  'src/lib/community/parking-report.ts',
  'src/app/api/directory/parking-report/route.ts',
  'src/components/directory/ReportParkingSheet.tsx',
];
for (const f of featureFiles) {
  const src = read(f);
  check(
    `${path.basename(f)}: does not write overnight_status`,
    !/overnight_status\s*[:=]/.test(src),
  );
  check(`${path.basename(f)}: does not touch mile_marker`, !/mile_marker/.test(src));
}

/* ------------------------------------------- proposed migration stays inert */
const mig = read('data/plans/parking-reports-2026-07-30/PROPOSED-MIGRATION.sql');
check('proposed migration carries the INERT banner', mig.includes('INERT PLAN — DO NOT EXECUTE'));
check(
  'proposed migration has zero executable SQL lines',
  mig
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .filter((l) => l.trim().length > 0).length === 0,
);
check('proposed migration adds no mile_marker column', !/add column[^;]*mile_marker/i.test(mig));
check(
  'proposed migration is not in the applied-migrations directory',
  !fs.existsSync(path.join(process.cwd(), 'supabase/migrations/048_parking_reports.sql')),
);

/* ------------------------------------------------------- mobile ergonomics */
const sheet = read('src/components/directory/ReportParkingSheet.tsx');
check('sheet targets are >= 48px', /min-h-\[48px\]/.test(sheet));
check('sheet close control is >= 44px', /min-h-\[44px\]/.test(sheet));
check(
  'sheet is a labeled modal dialog',
  /role="dialog"/.test(sheet) && /aria-modal="true"/.test(sheet),
);
check('sheet supports Escape to close', /'Escape'/.test(sheet));
check('sheet scrolls instead of overflowing a phone', /max-h-\[88vh\]/.test(sheet));
check(
  'issue mode needs exactly one required choice before sending',
  /disabled=\{sending \|\| \(mode === 'issue' && !issueType\)\}/.test(sheet),
);
check(
  'driver is told nothing changes automatically',
  /nothing on the map changes automatically|reviewed by a human|review queue/i.test(sheet),
);
check(
  'driver is told we collect no name and no location',
  /don&rsquo;t ask\s*\n?\s*for your name|track your location/i.test(sheet),
);

console.log(`parking-reports: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
