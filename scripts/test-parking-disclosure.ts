/**
 * Zero-parking disclosure tests. Pure logic — no network, no database.
 * The release-blocking property: an operator-confirmed ZERO must render as an
 * explicit "no truck parking" statement, an UNKNOWN count must render nothing
 * (never "0", never "none"), and a positive count must render as the number.
 *
 * Run:
 *   npx esbuild scripts/test-parking-disclosure.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-parking-disclosure.cjs \
 *   && node /tmp/test-parking-disclosure.cjs
 */
import {
  isOperatorReportedZeroParking,
  truckParkingFactValue,
  ZERO_PARKING_NOTICE,
} from '@/lib/directory/parking-disclosure';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

// --- isOperatorReportedZeroParking: fires ONLY on a finite, exact zero ---
check('zero → notice fires', isOperatorReportedZeroParking(0) === true);
check('positive → no notice', isOperatorReportedZeroParking(75) === false);
check('null (unknown) → no notice', isOperatorReportedZeroParking(null) === false);
check('undefined → no notice', isOperatorReportedZeroParking(undefined) === false);
check('NaN → no notice', isOperatorReportedZeroParking(NaN) === false);
check('Infinity → no notice', isOperatorReportedZeroParking(Infinity) === false);
check('string "0" → no notice (type-strict)', isOperatorReportedZeroParking('0') === false);
check(
  'negative → no notice (invalid data is not a zero claim)',
  isOperatorReportedZeroParking(-1) === false,
);

// --- truckParkingFactValue: unknown renders NOTHING, zero renders words ---
check('unknown (null) renders nothing', truckParkingFactValue(null) === null);
check('unknown (undefined) renders nothing', truckParkingFactValue(undefined) === null);
check('NaN renders nothing', truckParkingFactValue(NaN) === null);
check('negative renders nothing', truckParkingFactValue(-5) === null);
check(
  'zero renders the explicit no-parking wording, never "0"',
  truckParkingFactValue(0) === 'None reported by the operator',
);
check('positive renders the count', truckParkingFactValue(75) === '75');
check('positive renders the count (1)', truckParkingFactValue(1) === '1');

// --- the notice copy states the operator attribution and the prohibition ---
check(
  'notice names the operator as the source',
  ZERO_PARKING_NOTICE.toLowerCase().includes('operator reports no truck parking'),
);
check('notice tells the driver not to plan a stop', /do not plan/i.test(ZERO_PARKING_NOTICE));

// --- the zero wording can never be mistaken for a positive count ---
check('zero wording contains no digits', !/\d/.test(String(truckParkingFactValue(0))));

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
