/**
 * Unit tests for two foundational pure utils every import/export/map flow
 * depends on: the CSV parser/serializer (`lib/directory/csv`) including the
 * spreadsheet formula-injection guard, and the geodesy/coordinate-validation
 * primitives (`lib/map/geo`).
 *
 * Run:
 *   npx esbuild scripts/test-csv-geo.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-csv-geo.cjs && node /tmp/test-csv-geo.cjs
 */
import { parseCsv, toCsv, safeCsvCell, unguardCsvCell } from '@/lib/directory/csv';
import {
  haversineMiles,
  coordinateIssues,
  isValidUsCoordinate,
  withDistance,
  sortByDistance,
  withinRadius,
} from '@/lib/map/geo';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ============================ CSV ============================ */

/* ---- parseCsv ---- */
{
  check('simple row', eq(parseCsv('a,b,c'), [['a', 'b', 'c']]));
  check('two rows LF', eq(parseCsv('a,b\nc,d'), [['a', 'b'], ['c', 'd']]));
  check('CRLF rows', eq(parseCsv('a,b\r\nc,d'), [['a', 'b'], ['c', 'd']]));
  check('quoted comma stays in cell', eq(parseCsv('"a,b",c'), [['a,b', 'c']]));
  check('quoted newline stays in cell', eq(parseCsv('"a\nb",c'), [['a\nb', 'c']]));
  check('escaped quote ("")', eq(parseCsv('"a""b",c'), [['a"b', 'c']]));
  check('BOM stripped', eq(parseCsv('﻿a,b'), [['a', 'b']]));
  check('trailing cell (no final newline)', eq(parseCsv('a,b,c'), [['a', 'b', 'c']]));
  check('blank lines dropped', eq(parseCsv('a,b\n\n\nc,d'), [['a', 'b'], ['c', 'd']]));
  check('empty input → no rows', eq(parseCsv(''), []));
  check('trailing empty cell preserved', eq(parseCsv('a,'), [['a', '']]));
}

/* ---- toCsv + escaping ---- */
{
  check('toCsv simple', toCsv([['a', 'b']]) === 'a,b');
  check('toCsv CRLF between rows', toCsv([['a'], ['b']]) === 'a\r\nb');
  check('toCsv escapes comma', toCsv([['a,b', 'c']]) === '"a,b",c');
  check('toCsv escapes quote (doubles it)', toCsv([['a"b']]) === '"a""b"');
  check('toCsv escapes newline', toCsv([['a\nb']]) === '"a\nb"');
  check('toCsv null/undefined → empty', toCsv([[null, undefined, 'x']]) === ',,x');
  check('toCsv number + boolean stringified', toCsv([[1, true]]) === '1,true');
}

/* ---- round trip ---- */
{
  const rows = [
    ['name', 'note'],
    ['Pilot #404', 'has, comma'],
    ['Love\'s', 'line\nbreak'],
    ['Quote "Q"', 'plain'],
  ];
  check('parseCsv(toCsv(rows)) round-trips tricky values', eq(parseCsv(toCsv(rows)), rows));
}

/* ---- formula-injection guard ---- */
{
  for (const c of ['=', '+', '-', '@', '\t']) {
    check(`safeCsvCell guards leading "${c === '\t' ? '\\t' : c}"`, safeCsvCell(`${c}cmd`) === `'${c}cmd`);
  }
  check('safeCsvCell leaves plain text', safeCsvCell('Pilot #404') === 'Pilot #404');
  check('safeCsvCell leaves interior symbol', safeCsvCell('a=b') === 'a=b');
  check('unguardCsvCell strips guard on formula char', unguardCsvCell("'=SUM(A1)") === '=SUM(A1)');
  check('unguardCsvCell leaves a real leading apostrophe', unguardCsvCell("'hello") === "'hello");
  check('safeCsvCell → unguardCsvCell round-trips a formula cell', unguardCsvCell(safeCsvCell('=1+1')) === '=1+1');
}

/* ============================ GEO ============================ */

/* ---- haversineMiles ---- */
{
  check('zero distance for same point', haversineMiles({ lat: 36, lng: -86 }, { lat: 36, lng: -86 }) === 0);
  const oneDegLat = haversineMiles({ lat: 36, lng: -86 }, { lat: 37, lng: -86 });
  check('~69 miles per degree of latitude', Math.abs(oneDegLat - 69.09) < 0.5, oneDegLat);
  // Nashville ↔ Knoxville ≈ 160–180 mi
  const nashKnox = haversineMiles({ lat: 36.16, lng: -86.78 }, { lat: 35.96, lng: -83.92 });
  check('Nashville↔Knoxville in plausible range', nashKnox > 150 && nashKnox < 185, nashKnox);
}

/* ---- coordinateIssues / isValidUsCoordinate ---- */
{
  check('valid US coord → no issues', eq(coordinateIssues(36.16, -86.78), []));
  check('valid US coord isValidUsCoordinate', isValidUsCoordinate(36.16, -86.78));
  check('NaN → not-finite (short-circuits)', eq(coordinateIssues(NaN, -86), ['not-finite']));
  check('Infinity → not-finite', eq(coordinateIssues(36, Infinity), ['not-finite']));
  check('lat out of range', coordinateIssues(200, -86).includes('lat-out-of-range'));
  check('lng out of range', coordinateIssues(36, 200).includes('lng-out-of-range'));
  check('0,0 → zero-zero (null island)', coordinateIssues(0, 0).includes('zero-zero'));
  check('London (in range, outside US) → outside-us', eq(coordinateIssues(51.5, -0.12), ['outside-us']));
  check('0,0 is not a valid US coordinate', !isValidUsCoordinate(0, 0));
  check('London is not a valid US coordinate', !isValidUsCoordinate(51.5, -0.12));
}

/* ---- withDistance / sortByDistance / withinRadius ---- */
{
  const origin = { lat: 36.0, lng: -86.0 };
  const items = [
    { id: 'far', lat: 38.0, lng: -86.0 },
    { id: 'near', lat: 36.1, lng: -86.0 },
    { id: 'nocoords' },
  ] as { id: string; lat?: number; lng?: number }[];
  const withD = withDistance(items, origin);
  check('withDistance drops rows without coords', withD.length === 2);
  check('withDistance attaches distanceMiles', withD.every((i) => typeof i.distanceMiles === 'number'));
  const sorted = sortByDistance(withD);
  check('sortByDistance nearest first', sorted[0].id === 'near' && sorted[1].id === 'far');
  const near = withinRadius(sorted, 50);
  check('withinRadius keeps only close items', near.length === 1 && near[0].id === 'near', near.map((n) => n.id));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
