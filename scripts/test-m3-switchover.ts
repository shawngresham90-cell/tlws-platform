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
  'data layer narrows overnight_status through toOvernightStatus',
  /overnightStatus:\s*toOvernightStatus\(row\.overnight_status\)/.test(dataSrc),
);
check(
  'unrecognized status degrades to unknown, never a claim',
  /value === 'confirmed' \|\| value === 'prohibited' \? value : 'unknown'/.test(dataSrc),
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

console.log(`m3-switchover: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
