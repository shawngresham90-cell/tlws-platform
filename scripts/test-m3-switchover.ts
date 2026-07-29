/**
 * M3 runtime switchover tests (2026-07-29). The directory data layer now
 * reads the columns migration 047 added and M2 populated:
 *
 *   - `mile_marker` / `mile_marker_source` reach DirectoryEntry, so the
 *     corridor engine can label "MM" when (and only when) a verified value
 *     exists. No exit number is ever copied into mile_marker.
 *   - `overnight_status` is the ONLY source of an overnight claim. The
 *     legacy `overnight_parking` boolean — surfaced as the "Overnight OK"
 *     amenity chip — can never produce "Overnight confirmed", so the 330
 *     unreviewed legacy rows read "unknown" (Option A).
 *   - Unrecognized / missing status degrades to 'unknown', never a claim.
 *
 * Filesystem + pure-function only; no database access, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { overnightLabel, resolveRoutePosition, buildCorridorList } from '@/lib/directory/corridor';
import {
  OVERNIGHT_CONFIRMED_CHIP,
  OVERNIGHT_PROHIBITED_CHIP,
  isConfirmedOvernight,
  overnightChipFor,
  overnightLabelFor,
} from '@/lib/directory/overnight';
import {
  hasConfirmedTruckParking,
  rankCandidates,
  scoreCandidate,
} from '@/lib/trip-planner/directory-layer';
import type { DirectoryEntry } from '@/lib/directory/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const base: DirectoryEntry = {
  id: '1',
  category: 'truck-stops',
  name: 'Test Stop',
  state: 'GA',
  city: 'Macon',
  slug: 'test-stop',
};
const entry = (over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({ ...base, ...over });

/* ------------------------------------------------- overnight_status only */
check(
  'confirmed status → confirmed label',
  overnightLabel(entry({ overnightStatus: 'confirmed' })) === 'Overnight confirmed',
);
check(
  'prohibited status → prohibited label',
  overnightLabel(entry({ overnightStatus: 'prohibited' })) === 'Overnight prohibited',
);
check(
  'unknown status → unknown label',
  overnightLabel(entry({ overnightStatus: 'unknown' })) === 'Overnight unknown',
);
check('absent status → unknown label', overnightLabel(entry({})) === 'Overnight unknown');
check(
  'legacy boolean chip cannot confirm (Option A: 330 legacy rows stay unknown)',
  overnightLabel(entry({ amenities: ['Overnight OK', 'Showers'] })) === 'Overnight unknown',
);
check(
  'legacy chip cannot downgrade a confirmed row either',
  overnightLabel(entry({ overnightStatus: 'confirmed', amenities: [] })) === 'Overnight confirmed',
);

/* ------------------------------------------------------ mile_marker wiring */
const mm = resolveRoutePosition({ mileMarker: 5.6, exitNumber: undefined });
check(
  'verified mile marker labels MM with its decimal',
  mm?.positionLabel === 'MM 5.6' && mm?.positionKind === 'mile-marker',
);
const exitOnly = resolveRoutePosition({ mileMarker: undefined, exitNumber: '144' });
check(
  'exit number stays EXIT, never MM',
  exitOnly?.positionLabel === 'EXIT 144' && exitOnly?.positionKind === 'exit',
);
check(
  'mile marker outranks exit when both exist (and does not adopt the exit value)',
  resolveRoutePosition({ mileMarker: 25, exitNumber: '144' })?.positionLabel === 'MM 25',
);
const mixed = buildCorridorList([
  entry({ id: 'a', name: 'A', mileMarker: 10 }),
  entry({ id: 'b', name: 'B', exitNumber: '5' }),
  entry({ id: 'c', name: 'C', exitNumber: 'Third St' }),
]);
check(
  'positioned rows sort on the shared mileage scale',
  mixed.positioned.map((p) => p.entry.id).join(',') === 'b,a',
);
check(
  'unparseable position stays unpositioned',
  mixed.unpositioned.map((p) => p.entry.id).join(',') === 'c',
);

/* --------------------------------------------------- data-layer contract */
const dataSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/directory/data.ts'), 'utf8');
for (const col of [
  'mile_marker',
  'mile_marker_source',
  'overnight_status',
  'overnight_status_source',
]) {
  check(`data layer selects ${col}`, new RegExp(`['\`, ]${col}[,'\`\\s]`).test(dataSrc));
}
check(
  'data layer maps mile_marker → mileMarker',
  /mileMarker:\s*typeof row\.mile_marker/.test(dataSrc),
);
check(
  'data layer narrows overnight_status through the shared vocabulary',
  /overnightStatus:\s*normalizeOvernightStatus\(row\.overnight_status\)/.test(dataSrc),
);
check(
  'data layer derives the overnight chip from status, not the boolean',
  /overnightChipFor\(row\.overnight_status\)/.test(dataSrc) &&
    !/row\.overnight_parking\)\s*chips\.push/.test(dataSrc),
);
const overnightSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/directory/overnight.ts'),
  'utf8',
);
check(
  'unrecognized status degrades to unknown, never a claim',
  /value === 'confirmed' \|\| value === 'prohibited' \? value : 'unknown'/.test(overnightSrc),
);
check(
  'exit_number is never mapped into mileMarker',
  !/mileMarker:[^,\n]*exit_number/.test(dataSrc),
);

/* ------------------------------------------------ no write-path regression */
check(
  'switchover is read-only (no insert/update/delete added to the data layer)',
  !/\.(insert|update|upsert|delete)\(/.test(dataSrc),
);
const corridorSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/directory/corridor.ts'),
  'utf8',
);
// Strip comments first — the doc block explains WHY the legacy chip is
// ignored, and that prose must not be mistaken for a read of it.
const corridorCode = corridorSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(
  'corridor engine no longer reads the legacy boolean chip for overnight',
  !/overnight ok/i.test(corridorCode),
);
check(
  'overnightLabel body reads overnightStatus and nothing else',
  /export function overnightLabel[\s\S]*?\n}/
    .exec(corridorCode)?.[0]
    ?.includes('entry.overnightStatus') === true &&
    !/export function overnightLabel[\s\S]*?\n}/.exec(corridorCode)?.[0]?.includes('amenities'),
);

/* ============================================================ application-wide
 * The switchover must be consistent on EVERY public surface, not just the
 * corridor. These checks encode the owner's rules (2026-07-29, Option A).
 * ========================================================================= */

/* ---- production-shaped cohort: 541 evidence-backed + 330 legacy-true ---- */
const loves = Array.from({ length: 541 }, (_, i) =>
  entry({
    id: `loves-${i}`,
    name: `Love's ${i}`,
    parkingSpaces: 60,
    overnightStatus: 'confirmed',
    overnightStatusSource: 'official-operator-export',
    amenities: [OVERNIGHT_CONFIRMED_CHIP],
  }),
);
// The legacy rows: overnight_parking = true, but NO evidence — status stays
// 'unknown' and the old "Overnight OK" chip is gone from the data layer.
const legacy = Array.from({ length: 330 }, (_, i) =>
  entry({ id: `legacy-${i}`, name: `Legacy ${i}`, parkingSpaces: 40, overnightStatus: 'unknown' }),
);
const cohort = [...loves, ...legacy];
check(
  'exactly 541 rows render "Overnight confirmed"',
  cohort.filter((e) => overnightLabel(e) === 'Overnight confirmed').length === 541,
);
check(
  'exactly the 330 legacy rows render "Overnight unknown"',
  cohort.filter((e) => overnightLabel(e) === 'Overnight unknown').length === 330 &&
    legacy.every((e) => overnightLabel(e) === 'Overnight unknown'),
);
check(
  'the three states render as three distinct strings',
  new Set([
    overnightLabelFor('confirmed'),
    overnightLabelFor('prohibited'),
    overnightLabelFor('unknown'),
  ]).size === 3,
);

/* ---------------------------------------- confirmed-overnight filter gate */
const prohibited = entry({ id: 'p', overnightStatus: 'prohibited', parkingSpaces: 50 });
const unknown = entry({ id: 'u', overnightStatus: 'unknown', parkingSpaces: 50 });
const confirmed = entry({ id: 'c', overnightStatus: 'confirmed', parkingSpaces: 50 });
check(
  'only confirmed passes isConfirmedOvernight',
  isConfirmedOvernight(confirmed.overnightStatus) &&
    !isConfirmedOvernight(unknown.overnightStatus) &&
    !isConfirmedOvernight(prohibited.overnightStatus),
);
check(
  'the confirmed-overnight amenity filter matches confirmed rows only',
  [confirmed, unknown, prohibited].filter((e) =>
    (overnightChipFor(e.overnightStatus) ? [overnightChipFor(e.overnightStatus)!] : []).includes(
      OVERNIGHT_CONFIRMED_CHIP,
    ),
  ).length === 1,
);
check('unknown emits no chip (absence is not a claim)', overnightChipFor('unknown') === null);
check(
  'prohibited emits its own chip, never the confirmed one',
  overnightChipFor('prohibited') === OVERNIGHT_PROHIBITED_CHIP &&
    overnightChipFor('prohibited') !== OVERNIGHT_CONFIRMED_CHIP,
);
check(
  'unrecognized/garbage status never becomes confirmed',
  ['yes', 'true', '1', 'OK', null, undefined, {}].every(
    (v) => !isConfirmedOvernight(v) && overnightLabelFor(v) === 'Overnight unknown',
  ),
);

/* ------------------------------------------------- planner: needs + gates */
const cand = (over: Record<string, unknown> = {}) => ({
  id: 'x',
  name: 'X',
  categorySlug: 'truck-stops',
  position: { lat: 33, lng: -84 },
  routeMile: 10,
  offRouteMiles: 0.2,
  parkingSpaces: 50,
  overnightParking: true, // legacy boolean deliberately TRUE everywhere here
  freeParking: null,
  paidParking: null,
  reservationUrl: null,
  amenities: [],
  fuelBrands: [],
  coordVerificationStatus: null,
  state: 'GA',
  interstate: 'I-75',
  exitNumber: '41',
  ...over,
});
const win = { fromMile: 0, toMile: 100 };
const overnightIds = (list: ReturnType<typeof cand>[]) =>
  rankCandidates(list as never, 'overnight', win)
    .map((r) => r.candidate.id)
    .sort();

check(
  'prohibited never appears in an overnight recommendation',
  !overnightIds([cand({ id: 'proh', overnightStatus: 'prohibited' })]).includes('proh'),
);
check(
  'unknown may still appear in general parking results (labeled honestly)',
  rankCandidates([cand({ id: 'unk', overnightStatus: 'unknown' })] as never, 'parking', win)
    .length === 1,
);
check(
  'legacy boolean true + unknown status earns NO overnight credit',
  (scoreCandidate(cand({ overnightStatus: 'unknown' }) as never, 'overnight', {}).components
    .overnightAllowed ?? 0) === 0,
);
check(
  'confirmed status earns the overnight credit',
  (scoreCandidate(cand({ overnightStatus: 'confirmed' }) as never, 'overnight', {}).components
    .overnightAllowed ?? 0) === 10,
);
check(
  'absent status is treated as unknown by the planner, never confirmed',
  (scoreCandidate(cand({}) as never, 'overnight', {}).components.overnightAllowed ?? 0) === 0,
);

/* ---- hard parking gates unchanged (rule 4: zero/unknown spaces excluded) */
check(
  'zero-space rows stay excluded from parking recommendations',
  rankCandidates(
    [cand({ id: 'zero', parkingSpaces: 0, overnightStatus: 'confirmed' })] as never,
    'parking',
    win,
  ).length === 0,
);
check(
  'unknown-space rows stay excluded from parking recommendations',
  rankCandidates(
    [cand({ id: 'nospaces', parkingSpaces: null, overnightStatus: 'confirmed' })] as never,
    'overnight',
    win,
  ).length === 0,
);
check(
  'hasConfirmedTruckParking is unchanged (positive spaces only)',
  hasConfirmedTruckParking(1) && !hasConfirmedTruckParking(0) && !hasConfirmedTruckParking(null),
);

/* -------------------- no public surface converts the boolean into a claim */
const PUBLIC_SURFACES = [
  'src/lib/directory/data.ts',
  'src/lib/directory/corridor.ts',
  'src/lib/directory/faq.ts',
  'src/lib/directory/completeness.ts',
  'src/lib/map/explore.ts',
  'src/lib/trip-planner/directory-layer.ts',
  'src/components/directory/CorridorFlow.tsx',
  'src/app/(directory)/directory/[category]/truck-parking/page.tsx',
];
for (const f of PUBLIC_SURFACES) {
  const code = fs
    .readFileSync(path.join(process.cwd(), f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  check(`${path.basename(f)}: no legacy "Overnight OK" chip remains`, !/Overnight OK/i.test(code));
  // A "claim conversion" is the legacy boolean feeding a ternary or a
  // logical AND. `?? false` is null-normalization of pass-through data and
  // is not a claim, so the lookahead excludes `??`.
  check(
    `${path.basename(f)}: legacy boolean never produces an overnight claim`,
    !/(overnight_parking|overnightParking)\s*(\?(?!\?)|&&)/.test(code),
  );
}

/* ------------------------------------------------- admin: legacy labeling */
const formSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/admin/directory/ListingForm.tsx'),
  'utf8',
);
check('admin labels the legacy boolean "Legacy reference"', /Legacy reference/i.test(formSrc));
check(
  'admin shows the authoritative three-way status',
  /overnight_status === 'confirmed'/.test(formSrc) &&
    /overnight_status === 'prohibited'/.test(formSrc) &&
    /Unknown/.test(formSrc),
);
check(
  'admin does not auto-correct the database from the legacy boolean',
  !/overnight_status\s*[:=]\s*.*overnight_parking/.test(formSrc),
);

/* ----------------------------------- mile_marker: verified reads only */
const allSrc = PUBLIC_SURFACES.map((f) =>
  fs.readFileSync(path.join(process.cwd(), f), 'utf8'),
).join('\n');
check(
  'no surface assigns an exit number into a mile marker',
  !/mileMarker\s*[:=][^;\n]*exit/i.test(allSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
);

console.log(`m3-switchover: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
