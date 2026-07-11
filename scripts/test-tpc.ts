/**
 * Milestone 21 unit tests: Truck Parking Club domain — URL validation
 * (approved domain only, https only, deceptive-subdomain/IP/localhost/
 * credential rejection, trailing-slash normalization), candidate detection,
 * warnings, the correction-CSV pipeline (identity cross-check, duplicates,
 * applicability, overwrite flags), and the CSV formula-injection guard.
 *
 * Run:
 *   npx esbuild scripts/test-tpc.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-tpc.cjs && node /tmp/test-tpc.cjs
 */
import {
  validateTpcUrl,
  tpcUrlsEqual,
  isTpcCandidate,
  tpcWarnings,
  parseTpcCsv,
  validateTpcBatch,
  tpcCandidatesCsv,
  TPC_CSV_COLUMNS,
  type TpcListingRef,
} from '@/lib/directory/tpc';
import { safeCsvCell, unguardCsvCell, toCsv } from '@/lib/directory/csv';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ------------------------- URL validation ------------------------- */
{
  const ok = validateTpcUrl('https://truckparkingclub.com/listing/abc');
  check('url: apex domain ok', ok.ok && ok.normalized === 'https://truckparkingclub.com/listing/abc');
  const www = validateTpcUrl('https://www.truckparkingclub.com/listing/abc/');
  check('url: www ok + trailing slash normalized', www.ok && www.normalized === 'https://www.truckparkingclub.com/listing/abc');
  const query = validateTpcUrl('https://truckparkingclub.com/l/x?ref=tlws');
  check('url: query preserved', query.ok && query.normalized.endsWith('?ref=tlws'));
  const root = validateTpcUrl('https://truckparkingclub.com/');
  check('url: root normalizes', root.ok && root.normalized === 'https://truckparkingclub.com');

  check('url: http rejected', !validateTpcUrl('http://truckparkingclub.com/x').ok);
  check('url: javascript rejected', !validateTpcUrl('javascript:alert(1)').ok);
  check('url: data rejected', !validateTpcUrl('data:text/html,<b>x</b>').ok);
  check('url: file rejected', !validateTpcUrl('file:///etc/passwd').ok);
  check('url: localhost rejected', !validateTpcUrl('https://localhost/x').ok);
  check('url: IP rejected', !validateTpcUrl('https://192.168.0.1/x').ok);
  check('url: unexpected domain rejected', !validateTpcUrl('https://evil.com/truckparkingclub').ok);
  check('url: deceptive subdomain rejected', !validateTpcUrl('https://truckparkingclub.com.evil.io/x').ok);
  check('url: sub-subdomain rejected', !validateTpcUrl('https://app.truckparkingclub.com/x').ok);
  check('url: lookalike rejected', !validateTpcUrl('https://truckparking-club.com/x').ok);
  check('url: credentials rejected', !validateTpcUrl('https://user:pass@truckparkingclub.com/x').ok);
  check('url: port rejected', !validateTpcUrl('https://truckparkingclub.com:8443/x').ok);
  check('url: malformed rejected', !validateTpcUrl('not a url').ok && !validateTpcUrl('').ok);
  check('url: equality via normalization', tpcUrlsEqual('https://truckparkingclub.com/a/', 'https://truckparkingclub.com/a'));
}

/* ------------------------- candidates + warnings ------------------------- */
const ref = (over: Partial<TpcListingRef>): TpcListingRef => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'Stop',
  category: 'truck-stops',
  address: '1 Road',
  city: 'Dalton',
  state: 'GA',
  tpcUrl: null,
  published: true,
  detailSlug: 'x',
  ...over,
});
{
  check('candidate: TPC-branded name', isTpcCandidate(ref({ name: 'Truck Parking Club - 11775 Snyder Rd' })));
  check('candidate: parking category', isTpcCandidate(ref({ category: 'parking' })));
  check('candidate: not when URL present', !isTpcCandidate(ref({ category: 'parking', tpcUrl: 'https://truckparkingclub.com/x' })));
  check('candidate: unrelated category not a candidate', !isTpcCandidate(ref({ category: 'cat-scales' })));

  const rows = [
    ref({ id: 'a', name: 'Lot A', category: 'parking', tpcUrl: 'https://truckparkingclub.com/l/1', address: null }),
    ref({ id: 'b', name: 'Lot B', category: 'parking', tpcUrl: 'https://truckparkingclub.com/l/2/' }),
    ref({ id: 'c', name: 'Lot C', category: 'parking', tpcUrl: 'https://truckparkingclub.com/l/2' }),
    ref({ id: 'd', name: 'Scale D', category: 'cat-scales', tpcUrl: 'https://truckparkingclub.com/l/3' }),
    ref({ id: 'e', name: 'Lot E', category: 'parking', tpcUrl: 'https://evil.com/x' }),
  ];
  const warnings = tpcWarnings(rows);
  const kinds = (id: string) => warnings.filter((w) => w.id === id).map((w) => w.kind);
  check('warn: published no address', kinds('a').includes('no-address'));
  check('warn: duplicate URL across listings (normalized)', kinds('b').includes('duplicate-url') && kinds('c').includes('duplicate-url'));
  check('warn: not parking related', kinds('d').includes('not-parking-related'));
  check('warn: invalid stored URL', kinds('e').includes('invalid-url'));
  check('warn: clean row silent', kinds('b').length === 1);
}

/* ------------------------- CSV pipeline ------------------------- */
{
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';
  const C = '33333333-3333-4333-8333-333333333333';
  const live = new Map<string, TpcListingRef>([
    [A, ref({ id: A, name: 'Lot A', city: 'Dalton', state: 'GA', address: '1 Road', tpcUrl: null })],
    [B, ref({ id: B, name: 'Lot B', city: 'Calhoun', state: 'GA', address: '2 Road', tpcUrl: 'https://truckparkingclub.com/old' })],
  ]);

  const csv = toCsv([
    [...TPC_CSV_COLUMNS],
    [A, 'Lot A', 'parking', '1 Road', 'Dalton', 'GA', '', 'https://truckparkingclub.com/new-a', 'set'],
    [B, 'Lot B', 'parking', '2 Road', 'Calhoun', 'GA', 'https://truckparkingclub.com/old', 'https://truckparkingclub.com/new-b', 'set'],
    [C, 'Ghost', 'parking', '3 Road', 'Macon', 'GA', '', 'https://truckparkingclub.com/x', 'set'],
    [A, 'Lot A', 'parking', '1 Road', 'Dalton', 'GA', '', 'https://truckparkingclub.com/dup', 'set'],
  ]);
  const parsed = parseTpcCsv(csv);
  check('csv: parses all rows', parsed.rows.length === 4 && parsed.errors.length === 0);
  const validated = validateTpcBatch(parsed.rows, live);
  check('csv: duplicate id flagged on both', validated.filter((r) => r.problems.includes('duplicate-listing-id')).length === 2);
  check('csv: unknown id flagged', validated.find((r) => r.listing_id === C)?.problems.includes('unknown-listing-id') === true);
  const rowB = validated.find((r) => r.listing_id === B)!;
  check('csv: valid set applicable', rowB.applicable);
  check('csv: overwrite flagged', rowB.wouldOverwrite);
  check('csv: nextValue normalized', rowB.nextValue === 'https://truckparkingclub.com/new-b');

  const mismatch = validateTpcBatch(
    parseTpcCsv(toCsv([
      [...TPC_CSV_COLUMNS],
      [A, 'Lot A', 'parking', '1 Road', 'Atlanta', 'GA', '', 'https://truckparkingclub.com/x', 'set'],
    ])).rows,
    live,
  )[0];
  check('csv: identity mismatch (wrong city)', mismatch.problems.includes('identity-mismatch') && !mismatch.applicable);

  const invalid = validateTpcBatch(
    parseTpcCsv(toCsv([
      [...TPC_CSV_COLUMNS],
      [A, 'Lot A', 'parking', '1 Road', 'Dalton', 'GA', '', 'https://evil.com/x', 'set'],
    ])).rows,
    live,
  )[0];
  check('csv: invalid url not applicable', invalid.problems.includes('invalid-url') && !invalid.applicable);

  const clear = validateTpcBatch(
    parseTpcCsv(toCsv([
      [...TPC_CSV_COLUMNS],
      [B, 'Lot B', 'parking', '2 Road', 'Calhoun', 'GA', 'https://truckparkingclub.com/old', '', 'clear'],
    ])).rows,
    live,
  )[0];
  check('csv: clear applicable with null nextValue', clear.applicable && clear.nextValue === null);

  const skip = validateTpcBatch(
    parseTpcCsv(toCsv([
      [...TPC_CSV_COLUMNS],
      [A, 'Lot A', 'parking', '1 Road', 'Dalton', 'GA', '', '', 'skip'],
    ])).rows,
    live,
  )[0];
  check('csv: skip never applicable', !skip.applicable && skip.problems.includes('skip-action'));

  const noChange = validateTpcBatch(
    parseTpcCsv(toCsv([
      [...TPC_CSV_COLUMNS],
      [B, 'Lot B', 'parking', '2 Road', 'Calhoun', 'GA', '', 'https://truckparkingclub.com/old/', 'set'],
    ])).rows,
    live,
  )[0];
  check('csv: same URL (normalized) is no-change', noChange.problems.includes('no-change'));

  check('csv: missing column fatal', parseTpcCsv('listing_id,city\n1,x').errors.length === 1);
}

/* ------------------------- formula-injection guard ------------------------- */
{
  check('guard: = prefixed', safeCsvCell('=SUM(A1)') === "'=SUM(A1)");
  check('guard: + prefixed', safeCsvCell('+1') === "'+1");
  check('guard: - prefixed', safeCsvCell('-cmd') === "'-cmd");
  check('guard: @ prefixed', safeCsvCell('@x') === "'@x");
  check('guard: normal text untouched', safeCsvCell('Pilot #4558') === 'Pilot #4558');
  check('guard: round-trip unguard', unguardCsvCell(safeCsvCell('=SUM(A1)')) === '=SUM(A1)');
  check('guard: legit apostrophe kept', unguardCsvCell("'quoted") === "'quoted");
  const csv = tpcCandidatesCsv([ref({ id: 'x', name: '=HYPERLINK("evil")', category: 'parking' })]);
  check('guard: candidate export guarded', csv.includes("'=HYPERLINK"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
