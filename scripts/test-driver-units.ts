/**
 * Pilot round 1 — US driver units. The live passenger test read HERE's
 * metric instruction text ("Go for 33 m") as miles. These checks pin the
 * three layers of the repair:
 *   1. the HERE request asks for imperial instruction wording
 *   2. the driver-facing distance formatter (ft under 0.1 mi, else miles)
 *   3. the screens use the formatter — no meters anywhere in driver UI
 *
 * Run: npx esbuild scripts/test-driver-units.ts --bundle --platform=node \
 *   --format=cjs --alias:@=./src --outfile=/tmp/test-driver-units.cjs \
 *   && node /tmp/test-driver-units.cjs
 */
import { readFileSync } from 'node:fs';
import { formatDriverDistanceMi, formatAccuracyFt } from '@/lib/navigator/format-units';
import { buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import type { RoutingRequest } from '@/lib/trip-planner/providers';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ------------------------------------------------------------- formatter
const M = 1 / 1609.344; // meters → miles
check("33 m (the live pilot's reading) → '100 ft'", formatDriverDistanceMi(33 * M) === '100 ft');
check("137 m (the live pilot's reading) → '450 ft'", formatDriverDistanceMi(137 * M) === '450 ft');
check('owner example: 250 ft', formatDriverDistanceMi(250 / 5280) === '250 ft');
check('owner example: 800 ft', formatDriverDistanceMi(800 / 5280) === '800 ft');
check('owner example: 0.2 mi', formatDriverDistanceMi(0.2) === '0.2 mi');
check('owner example: 1.4 mi', formatDriverDistanceMi(1.4) === '1.4 mi');
check('owner example: 25.7 mi', formatDriverDistanceMi(25.7) === '25.7 mi');
// The owner's examples put 800 ft (= 0.15 mi) in feet and 0.2 mi in miles,
// so the cutover is 0.2 mi — reconciling the "under 0.1 mile" wording with
// its own examples in the examples' favor.
check('boundary: 0.2 mi exactly is miles', formatDriverDistanceMi(0.2) === '0.2 mi');
check(
  'boundary: just under 0.2 mi is feet',
  formatDriverDistanceMi(0.19) === '1000 ft',
  formatDriverDistanceMi(0.19),
);
check("zero → floor of '50 ft' (never '0 ft')", formatDriverDistanceMi(0) === '50 ft');
check('null/undefined/NaN → em dash', formatDriverDistanceMi(null) === '—');
check('undefined → em dash', formatDriverDistanceMi(undefined) === '—');
check('NaN → em dash', formatDriverDistanceMi(Number.NaN) === '—');
check('negative → em dash', formatDriverDistanceMi(-1) === '—');
check("accuracy 25 m → '±80 ft'", formatAccuracyFt(25) === '±80 ft', formatAccuracyFt(25));
check("accuracy 3 m → '±10 ft' floor", formatAccuracyFt(3) === '±10 ft');
check('accuracy NaN → em dash', formatAccuracyFt(Number.NaN) === '—');

// The formatter NEVER emits a bare meters unit.
for (const mi of [0, 0.01, 0.05, 0.099, 0.1, 0.5, 3.3, 25.7, 210.4]) {
  const out = formatDriverDistanceMi(mi);
  check(`no meters in output for ${mi} mi (${out})`, !/\d\s*m\b/.test(out) || / mi$/.test(out));
}

// -------------------------------------------------- HERE request wording
const req: RoutingRequest = {
  origin: { lat: 35.0456, lng: -85.3097 },
  destination: { lat: 36.1627, lng: -86.7816 },
  waypoints: [],
  truck: {
    lengthFt: 73,
    heightFt: 13.5,
    widthFt: 8.5,
    grossWeightLbs: 80_000,
    axles: 5,
    hazmatClass: null,
    tankGallons: 200,
    mpg: 6.5,
    fuelSafetyFactor: 0.8,
  },
  departAtMs: 1_754_000_000_000,
};
const q = new URL(buildHereRouteUrl(req, 'TESTKEY')).searchParams;
check('HERE request: units=imperial (instruction text in ft/mi)', q.get('units') === 'imperial');
check(
  'HERE request: instructions still requested (units applies to their wording)',
  q.get('return') === 'polyline,summary,actions,instructions',
);

// -------------------------------------------------------- screen wiring
const driving = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
// The screen calls the UNIT-AWARE wrapper (`formatDistance(mi, metric)`),
// which delegates to formatDriverDistanceMi in imperial and to the km
// formatter in metric. The pin follows the call site rather than the
// inner function, because the whole point of the wrapper is that no
// screen chooses a unit system for itself.
check(
  'DrivingScreen: maneuver distance and remaining distance use the formatter',
  (driving.match(/formatDistance\(/g) ?? []).length >= 2,
);
check(
  'DrivingScreen: the formatter is unit-aware — every call passes the preference',
  (driving.match(/formatDistance\([^)]*,\s*metric\)/g) ?? []).length ===
    (driving.match(/formatDistance\(/g) ?? []).length,
);
check(
  'DrivingScreen: no raw toFixed-mi maneuver line remains',
  !driving.includes("distanceMi?.toFixed(1) ?? '—'} mi"),
);
const status = readFileSync('src/components/navigator/NavigatorStatus.tsx', 'utf8');
check(
  'NavigatorStatus: accuracy goes through the unit-aware formatter (feet in US mode)',
  status.includes('formatAccuracy(fix.accuracyM, metric)'),
);
check('NavigatorStatus: the ±meters string is gone', !status.includes('} m`'));
check(
  'NavigatorStatus: speed goes through the formatter, not a hand-written mph string',
  status.includes('formatSpeed(position.speedMph, metric)') &&
    !status.includes('Math.round(position.speedMph)} mph'),
);
const gps = readFileSync('src/lib/navigator/gps-session.ts', 'utf8');
check('speed pipeline is mph end to end (GPS m/s converted once)', gps.includes('MPS_TO_MPH'));
// The unit WORD is never typed into a screen. Every unit a driver reads
// comes out of format-units, which is what lets one preference switch
// them all and what stops a screen from printing "mph" beside a value
// the formatter rendered in km/h.
check(
  'DrivingScreen: no hand-written unit words — speed comes from the formatter',
  !/[^a-z]mph[^a-z]/i.test(driving.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) &&
    !/km\s*\/?\s*h/i.test(driving),
);

console.log(`driver-units: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
