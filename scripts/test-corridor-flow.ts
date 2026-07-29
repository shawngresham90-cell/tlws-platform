/**
 * Corridor-flow engine tests (driver-first parking navigation). Pure logic —
 * no network, no database. The release-blocking properties: positions come
 * ONLY from strictly-parseable exit numbers (never guessed), direction maps
 * to travel order per interstate numbering convention, and card labels are
 * honest about unknown counts and unconfirmed overnight access.
 *
 * Run:
 *   npx esbuild scripts/test-corridor-flow.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-corridor-flow.cjs \
 *   && node /tmp/test-corridor-flow.cjs
 */
import {
  parseExitPosition,
  directionsForInterstate,
  sortOrderForDirection,
  isCorridorDirection,
  interstateFromSlug,
  interstateToSlug,
  buildCorridorList,
  resolveRoutePosition,
  spacesLabel,
  costChips,
  overnightLabel,
} from '@/lib/directory/corridor';
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

/* ------------------------------------------------ strict position parsing */
check('parses "41"', parseExitPosition('41') === 41);
check('parses "41A"', parseExitPosition('41A') === 41);
check('parses " 41b "', parseExitPosition(' 41b ') === 41);
check('parses "2"', parseExitPosition('2') === 2);
check('rejects compound "11/I-49, Exit 39"', parseExitPosition('11/I-49, Exit 39') === null);
check('rejects "146/I-80, Exit 173"', parseExitPosition('146/I-80, Exit 173') === null);
check('rejects range "256/257"', parseExitPosition('256/257') === null);
check('rejects street "Third St"', parseExitPosition('Third St') === null);
check('rejects "OH-49"', parseExitPosition('OH-49') === null);
check('rejects null', parseExitPosition(null) === null);
check('rejects empty', parseExitPosition('') === null);
check('rejects "E Wyandot Rd"', parseExitPosition('E Wyandot Rd') === null);

/* --------------------------------------------------- direction convention */
check(
  'I-75 (odd) is north/south',
  directionsForInterstate('I-75').join(',') === 'northbound,southbound',
);
check('I-95 (odd) is north/south', directionsForInterstate('I-95')[0] === 'northbound');
check(
  'I-80 (even) is east/west',
  directionsForInterstate('I-80').join(',') === 'eastbound,westbound',
);
check('I-10 (even) is east/west', directionsForInterstate('I-10')[0] === 'eastbound');
check(
  'I-285 (aux of 85, odd) is north/south',
  directionsForInterstate('I-285')[0] === 'northbound',
);
check('I-294 (aux of 94, even) is east/west', directionsForInterstate('I-294')[0] === 'eastbound');
check('northbound sorts ascending', sortOrderForDirection('northbound') === 'asc');
check('eastbound sorts ascending', sortOrderForDirection('eastbound') === 'asc');
check('southbound sorts descending', sortOrderForDirection('southbound') === 'desc');
check('westbound sorts descending', sortOrderForDirection('westbound') === 'desc');
check(
  'validates direction strings',
  isCorridorDirection('northbound') && !isCorridorDirection('north'),
);

/* ----------------------------------------------------------- slug mapping */
check('slug → designation', interstateFromSlug('i-75') === 'I-75');
check('designation → slug', interstateToSlug('I-75') === 'i-75');
check('rejects malformed slug', interstateFromSlug('i75') === null);
check('rejects non-interstate slug', interstateFromSlug('us-13') === null);

/* --------------------------------------------------------- list building */
const entry = (over: Partial<DirectoryEntry>): DirectoryEntry =>
  ({
    id: over.id ?? 'x',
    category: 'truck-stops',
    name: over.name ?? 'Stop',
    state: 'GA',
    city: 'Test',
    slug: 's',
    featured: false,
    indexable: false,
    ...over,
  }) as DirectoryEntry;

const list = buildCorridorList([
  entry({ id: 'a', name: 'Mid', exitNumber: '201' }),
  entry({ id: 'b', name: 'Low', exitNumber: '2' }),
  entry({ id: 'c', name: 'NoPos', exitNumber: 'Third St' }),
  entry({ id: 'd', name: 'High', exitNumber: '320' }),
  entry({ id: 'e', name: 'Lettered', exitNumber: '18B' }),
  entry({ id: 'f', name: 'Missing' }),
]);
check('positioned count = 4', list.positioned.length === 4);
check('unpositioned count = 2 (never guessed)', list.unpositioned.length === 2);
check(
  'ascending order is 2, 18, 201, 320',
  list.positioned.map((l) => l.position).join(',') === '2,18,201,320',
);
check('label keeps the letter', list.positioned[1].positionLabel === 'EXIT 18B');
check(
  'unpositioned rows carry no label',
  list.unpositioned.every((l) => l.positionLabel === null && l.position === null),
);
check(
  'compound exit is in the unverified section, not sorted in',
  list.unpositioned.some((l) => l.entry.id === 'c'),
);

/* -------------------------------- route-position honesty: MM vs EXIT vs none */
// The database has NO mile-marker column (only exit_number) — mileMarker is
// only ever set from a separately verified value, so these tests pin the
// contract: MM label ⟺ verified mileMarker; exit numbers are NEVER
// relabeled as MM; no verified position → unpositioned, never guessed.
const mixed = buildCorridorList([
  entry({ id: 'mmInt', name: 'Verified MM', mileMarker: 72 }),
  entry({ id: 'mmDec', name: 'Decimal MM', mileMarker: 71.5 }),
  entry({ id: 'exOnly', name: 'Exit only', exitNumber: '41A' }),
  entry({ id: 'noPos', name: 'No position' }),
]);
const byId = (id: string) => mixed.positioned.find((l) => l.entry.id === id);
check('verified MM: labeled "MM 72"', byId('mmInt')?.positionLabel === 'MM 72');
check('verified MM: kind is mile-marker', byId('mmInt')?.positionKind === 'mile-marker');
check('decimal MM: labeled "MM 71.5"', byId('mmDec')?.positionLabel === 'MM 71.5');
check('decimal MM: numeric position kept', byId('mmDec')?.position === 71.5);
check('exit only: labeled "EXIT 41A"', byId('exOnly')?.positionLabel === 'EXIT 41A');
check('exit only: kind is exit', byId('exOnly')?.positionKind === 'exit');
check(
  'exit numbers are NEVER labeled MM',
  mixed.positioned
    .filter((l) => l.positionKind === 'exit')
    .every((l) => l.positionLabel!.startsWith('EXIT ') && !l.positionLabel!.startsWith('MM')),
);
check(
  'mixed list orders by numeric route position (41 < 71.5 < 72)',
  mixed.positioned.map((l) => l.entry.id).join(',') === 'exOnly,mmDec,mmInt',
  mixed.positioned.map((l) => `${l.entry.id}:${l.position}`),
);
check(
  'missing route position → unpositioned, never guessed',
  mixed.unpositioned.length === 1 && mixed.unpositioned[0].entry.id === 'noPos',
);
check(
  'verified MM wins over exit number when both exist',
  (() => {
    const r = resolveRoutePosition({ mileMarker: 10, exitNumber: '99' });
    return r?.positionKind === 'mile-marker' && r.position === 10 && r.positionLabel === 'MM 10';
  })(),
);
check(
  'exit is never coerced to MM by resolver',
  resolveRoutePosition({ exitNumber: '41' })?.positionLabel === 'EXIT 41',
);
const reversedPositions = [...mixed.positioned].reverse().map((l) => l.position!);
check(
  'HIGH → LOW reversal is strictly descending',
  reversedPositions.every((p, i) => i === 0 || p < reversedPositions[i - 1]),
  reversedPositions,
);
check(
  'exit-only fixture list carries only EXIT labels (no MM without a verified value)',
  list.positioned.every((l) => l.positionLabel!.startsWith('EXIT ')),
);

/* ------------------------------------------------------------ card labels */
check('spaces: number', spacesLabel(85) === '85 truck spaces');
check('spaces: unknown never shows a number', spacesLabel(undefined) === 'Truck spaces unknown');
check(
  'spaces: zero is operator-reported none',
  spacesLabel(0) === 'No truck parking (operator-reported)',
);
check(
  'cost chips from amenity chips',
  costChips(entry({ amenities: ['Free parking', 'Reserved'] })).join(',') === 'FREE,RESERVED',
);
check('no chips when no cost data', costChips(entry({})).length === 0);
// M3: overnight truth reads overnight_status ONLY. The legacy boolean's
// "Overnight OK" chip must never produce a confirmed claim.
check(
  'overnight confirmed only from overnight_status',
  overnightLabel(entry({ overnightStatus: 'confirmed' })) === 'Overnight confirmed',
);
check(
  'legacy "Overnight OK" chip alone never confirms',
  overnightLabel(entry({ amenities: ['Overnight OK'] })) === 'Overnight unknown',
);
check(
  'prohibited surfaces as its own label',
  overnightLabel(entry({ overnightStatus: 'prohibited' })) === 'Overnight prohibited',
);
check('overnight unknown otherwise', overnightLabel(entry({})) === 'Overnight unknown');

console.log(`corridor-flow: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
