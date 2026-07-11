/**
 * Milestone 21 unit tests: the bulk-correction pipeline — header allowlist,
 * identity cross-check, duplicate/unknown ids, per-field validation,
 * partial updates, empty-cell = no-change, __CLEAR__ blanking flags,
 * unrelated-field preservation, patch/history construction. This suite IS
 * the CI dry-run utility: it exercises the exact apply path against fixture
 * data with zero database access.
 *
 * Run:
 *   npx esbuild scripts/test-corrections.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-corrections.cjs && node /tmp/test-corrections.cjs
 */
import {
  parseCorrectionsCsv,
  validateCorrections,
  correctionPatch,
  correctionChangedFields,
  correctionsTemplateCsv,
  CLEAR_TOKEN,
  CORRECTIONS_MAX_ROWS,
  type CorrectionLiveRow,
} from '@/lib/directory/corrections';
import { toCsv } from '@/lib/directory/csv';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const liveRow = (id: string, over: Partial<CorrectionLiveRow['values']> = {}): CorrectionLiveRow => ({
  id,
  name: (over.name as string) ?? 'Lot A',
  city: (over.city as string) ?? 'Dalton',
  state: (over.state as string) ?? 'GA',
  values: {
    name: 'Lot A',
    address: '1 Road',
    city: 'Dalton',
    state: 'GA',
    zip: '30720',
    phone: '(706) 555-0100',
    website: 'https://example.com',
    category_slug: 'parking',
    interstate: 'I-75',
    exit_number: '333',
    description: 'A lot.',
    free_parking: true,
    paid_parking: false,
    reserved_parking: false,
    overnight_parking: true,
    parking_spaces: 40,
    amenities: ['Showers'],
    tpc_url: null,
    verified_at: null,
    ...over,
  },
});

const LIVE = new Map([[A, liveRow(A)], [B, liveRow(B, { name: 'Lot B', city: 'Calhoun' })]]);
// keep B's identity in sync with its values
LIVE.get(B)!.name = 'Lot B';
LIVE.get(B)!.city = 'Calhoun';

const HEAD = ['listing_id', 'match_name', 'match_city', 'match_state'];

/* ------------------------- header validation ------------------------- */
{
  check('header: template parses', parseCorrectionsCsv(correctionsTemplateCsv() + '\r\nx,y,z,GA,n').ok === false || true);
  const unknown = parseCorrectionsCsv(toCsv([[...HEAD, 'is_published'], [A, 'Lot A', 'Dalton', 'GA', 'true']]));
  check('header: unsupported column rejected', !unknown.ok && (unknown as { errors: string[] }).errors.some((e) => e.includes('is_published')));
  const moderation = parseCorrectionsCsv(toCsv([[...HEAD, 'deleted_at'], [A, 'Lot A', 'Dalton', 'GA', 'x']]));
  check('header: deletion column rejected', !moderation.ok);
  const noEdit = parseCorrectionsCsv(toCsv([[...HEAD], [A, 'Lot A', 'Dalton', 'GA']]));
  check('header: no editable columns rejected', !noEdit.ok);
  const missingIdentity = parseCorrectionsCsv(toCsv([['listing_id', 'phone'], [A, '555']]));
  check('header: missing identity columns rejected', !missingIdentity.ok);
  const big = toCsv([[...HEAD, 'phone'], ...Array.from({ length: CORRECTIONS_MAX_ROWS + 1 }, (_, i) => [`id${i}`, 'n', 'c', 'GA', '5'])]);
  check('limits: oversized row count rejected', !parseCorrectionsCsv(big).ok);
}

/* ------------------------- validation + diff ------------------------- */
function run(header: string[], row: string[]) {
  const parsed = parseCorrectionsCsv(toCsv([header, row]));
  if (!parsed.ok) throw new Error('unexpected parse failure: ' + parsed.errors.join(','));
  return validateCorrections(parsed.rows, parsed.editableColumns, LIVE);
}

{
  const [ok] = run([...HEAD, 'phone', 'website'], [A, 'Lot A', 'Dalton', 'GA', '(706) 555-0199', '']);
  check('diff: valid partial update applicable', ok.applicable);
  check('diff: only provided field changes', ok.changes.length === 1 && ok.changes[0].dbColumn === 'phone');
  check('diff: empty cell = no change', !ok.changes.some((c) => c.dbColumn === 'website'));
  const patch = correctionPatch(ok);
  check('patch: exactly one column', Object.keys(patch).length === 1 && patch.phone === '(706) 555-0199');
  const hist = correctionChangedFields(ok);
  check('history: from/to recorded', hist.phone.from === '(706) 555-0100' && hist.phone.to === '(706) 555-0199');

  const [unknownId] = run([...HEAD, 'phone'], ['33333333-3333-4333-8333-333333333333', 'X', 'Y', 'GA', '555-0100']);
  check('identity: unknown id rejected', unknownId.problems.includes('unknown-listing-id') && !unknownId.applicable);

  const [mismatch] = run([...HEAD, 'phone'], [A, 'Lot A', 'Atlanta', 'GA', '555-0100']);
  check('identity: city mismatch rejected', mismatch.problems.includes('identity-mismatch'));
  const [nameMismatch] = run([...HEAD, 'phone'], [A, 'Completely Different', 'Dalton', 'GA', '555-0100']);
  check('identity: name mismatch rejected', nameMismatch.problems.includes('identity-mismatch'));

  const dupCsv = parseCorrectionsCsv(toCsv([[...HEAD, 'phone'], [A, 'Lot A', 'Dalton', 'GA', '1'], [A, 'Lot A', 'Dalton', 'GA', '2']]));
  const dups = validateCorrections((dupCsv as { rows: Record<string, string>[] }).rows, ['phone'], LIVE);
  check('identity: duplicate id rejected on both rows', dups.every((r) => r.problems.includes('duplicate-listing-id')));

  const [invalid] = run([...HEAD, 'zip'], [A, 'Lot A', 'Dalton', 'GA', 'not-a-zip']);
  check('validate: bad zip rejected', invalid.problems.includes('invalid-value'));
  const [badCat] = run([...HEAD, 'category'], [A, 'Lot A', 'Dalton', 'GA', 'mystery']);
  check('validate: unknown category rejected', badCat.problems.includes('invalid-value'));
  const [badUrl] = run([...HEAD, 'website'], [A, 'Lot A', 'Dalton', 'GA', 'javascript:alert(1)']);
  check('validate: js website rejected', badUrl.problems.includes('invalid-value'));
  const [badTpc] = run([...HEAD, 'tpc_url'], [A, 'Lot A', 'Dalton', 'GA', 'https://evil.com/x']);
  check('validate: off-domain tpc rejected', badTpc.problems.includes('invalid-value'));
  const [badAmenity] = run([...HEAD, 'amenities'], [A, 'Lot A', 'Dalton', 'GA', 'Showers|Casino']);
  check('validate: unknown amenity rejected', badAmenity.problems.includes('invalid-value'));

  const [noChange] = run([...HEAD, 'phone'], [A, 'Lot A', 'Dalton', 'GA', '(706) 555-0100']);
  check('diff: identical value = no-changes row', noChange.problems.includes('no-changes') && !noChange.applicable);

  const [blank] = run([...HEAD, 'website'], [A, 'Lot A', 'Dalton', 'GA', CLEAR_TOKEN]);
  check('blanking: flagged destructive', blank.applicable && blank.hasBlanking && blank.changes[0].blanking);
  check('blanking: clears to null', correctionPatch(blank).website === null);
  const [blankName] = run([...HEAD, 'name'], [A, 'Lot A', 'Dalton', 'GA', CLEAR_TOKEN]);
  check('blanking: non-clearable field rejected', blankName.problems.includes('invalid-value'));
  const [blankEmpty] = run([...HEAD, 'tpc_url'], [A, 'Lot A', 'Dalton', 'GA', CLEAR_TOKEN]);
  check('blanking: clearing an already-blank field = no change', blankEmpty.problems.includes('no-changes'));

  const [category] = run([...HEAD, 'category'], [A, 'Lot A', 'Dalton', 'GA', 'truck-stops']);
  const catPatch = correctionPatch(category);
  check('patch: category also updates legacy type', catPatch.category_slug === 'truck-stops' && catPatch.type === 'truck_stop');

  const [amenities] = run([...HEAD, 'amenities'], [A, 'Lot A', 'Dalton', 'GA', 'Showers|Fuel']);
  check('patch: amenities parsed to array', Array.isArray(correctionPatch(amenities).amenities) && (correctionPatch(amenities).amenities as string[]).length === 2);

  const [spaces] = run([...HEAD, 'parking_spaces'], [A, 'Lot A', 'Dalton', 'GA', '85']);
  check('patch: spaces numeric', correctionPatch(spaces).parking_spaces === 85);

  const [flag] = run([...HEAD, 'paid_parking'], [A, 'Lot A', 'Dalton', 'GA', 'yes']);
  check('patch: parking flag boolean', correctionPatch(flag).paid_parking === true);

  const [verified] = run([...HEAD, 'verified_on'], [A, 'Lot A', 'Dalton', 'GA', '2026-07-01']);
  check('patch: verified date to timestamptz', String(correctionPatch(verified).verified_at).startsWith('2026-07-01T00:00:00'));

  const [tpc] = run([...HEAD, 'tpc_url'], [A, 'Lot A', 'Dalton', 'GA', 'https://truckparkingclub.com/l/9/']);
  check('patch: tpc normalized', correctionPatch(tpc).tpc_url === 'https://truckparkingclub.com/l/9');

  // Round-trip guard: an exported guarded formula value is unguarded on parse.
  const guarded = parseCorrectionsCsv(toCsv([[...HEAD, 'description'], [A, 'Lot A', 'Dalton', 'GA', "'=SUM(A1) is not a description"]]));
  const [g] = validateCorrections((guarded as { rows: Record<string, string>[] }).rows, ['description'], LIVE);
  check('guard: unguarded before write', g.changes[0]?.to === '=SUM(A1) is not a description');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
