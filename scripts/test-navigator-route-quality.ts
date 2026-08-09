/**
 * Truck-profile coverage and route plausibility.
 *
 * Two questions, both asked from the truck's side rather than the code's.
 *
 * FIRST: does every truck property the driver believes is being honoured
 * actually reach the provider? The coverage table is not trusted here —
 * its 'sent' column is RE-DERIVED from the real URL builder, so the table
 * cannot drift away from the wire without this failing. A field claimed
 * as sent but absent from the URL fails; a field claimed absent but
 * present in the URL fails too. The table is documentation with a test
 * behind it, which is the only kind worth writing.
 *
 * SECOND: does the plausibility check stay advisory? The dangerous
 * failure mode for a route-quality check on a TRUCK is not missing a bad
 * route — it is rejecting good ones. A truck route is supposed to be
 * longer: it goes around the low bridge. Several cases below exist purely
 * to prove that ordinary, legitimately-long truck routes produce NO
 * findings.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-route-quality.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-navigator-route-quality.cjs && node /tmp/test-navigator-route-quality.cjs
 */
import { readFileSync } from 'node:fs';
import { buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import {
  TRUCK_PROFILE_COVERAGE,
  driverAssurances,
  gapFields,
  sentFields,
  silentDrops,
} from '@/lib/navigator/truck-profile-coverage';
import {
  DEFAULT_PLAUSIBILITY,
  assessRoutePlausibility,
  plausibilityLines,
} from '@/lib/navigator/route-plausibility';
import type { LatLng } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/* ================================================ profile coverage vs wire */

const URL_STRING = buildHereRouteUrl(
  {
    origin: { lat: 35.0, lng: -85.0 },
    destination: { lat: 36.0, lng: -86.0 },
    waypoints: [],
    truck: { ...DEFAULT_TRUCK_PROFILE, hazmatClass: '3' },
    departAtMs: Date.parse('2026-08-09T12:00:00.000Z'),
    avoid: ['tollRoad'],
  },
  'TEST-KEY-NOT-A-REAL-KEY',
);
const wire = new URL(URL_STRING).searchParams;

for (const field of TRUCK_PROFILE_COVERAGE) {
  if (field.status === 'sent') {
    check(
      `coverage: "${field.label}" claims the wire and is on it (${field.wireParam})`,
      field.wireParam !== null && wire.has(field.wireParam),
      { param: field.wireParam },
    );
    check(
      `coverage: "${field.label}" is sent with a non-empty value`,
      field.wireParam !== null && (wire.get(field.wireParam) ?? '') !== '',
    );
  } else {
    check(
      `coverage: "${field.label}" claims it is NOT sent, and no such parameter exists`,
      field.wireParam === null,
    );
  }
}

check('coverage: twelve fields audited', TRUCK_PROFILE_COVERAGE.length === 12);
check(
  'coverage: field ids are unique',
  new Set(TRUCK_PROFILE_COVERAGE.map((f) => f.id)).size === 12,
);
check(
  'coverage: every field explains why a truck cares',
  TRUCK_PROFILE_COVERAGE.every((f) => f.why.length > 10),
);
check('coverage: eight fields reach the wire', sentFields().length === 8);
check('coverage: four do not', gapFields().length === 4);

/*
 * The specific defect the audit hunted: a value the app asks for, stores,
 * and then silently discards on the way out. There are none — every gap
 * is a gap in the MODEL, which a driver can be shown, rather than a value
 * quietly dropped. This assertion is the audit's actual result.
 */
check(
  'coverage: NO field is modelled and then silently dropped',
  silentDrops().length === 0,
  silentDrops(),
);

/*
 * Vehicle type is the consequential one. Nothing names it, so the
 * provider substitutes its own default while the app's default profile
 * is a 70 ft, 5-axle combination. Pinned as a known gap rather than
 * fixed here: sending an unverified parameter risks a rejected request,
 * which turns a slightly-wrong route into no route at all.
 */
{
  const vt = TRUCK_PROFILE_COVERAGE.find((f) => f.id === 'vehicle-type');
  check('coverage: vehicle type is declared a provider default', vt?.status === 'provider-default');
  check(
    'coverage: and no vehicle type is on the wire',
    !wire.has('truck[type]') && !wire.has('vehicle[type]'),
  );
  check(
    'coverage: the default profile really is a combination unit',
    DEFAULT_TRUCK_PROFILE.lengthFt >= 60 && DEFAULT_TRUCK_PROFILE.axles >= 5,
  );
}
{
  // Per-axle weight, trailer count and tunnel category are not modelled.
  for (const id of ['weight-per-axle', 'trailer-count', 'tunnel-category']) {
    const f = TRUCK_PROFILE_COVERAGE.find((x) => x.id === id);
    check(`coverage: ${id} is declared not-modelled`, f?.status === 'not-modelled');
    check(`coverage: ${id} has no app field`, f?.appField === null);
  }
  check('coverage: no per-axle weight on the wire', !wire.has('truck[weightPerAxle]'));
  check('coverage: no trailer count on the wire', !wire.has('truck[trailerCount]'));
  check('coverage: no tunnel category on the wire', !wire.has('truck[tunnelCategory]'));
}

{
  // The disclosure returns BOTH halves. A screen that lists only what
  // works reads as a guarantee.
  const a = driverAssurances();
  check('disclosure: names what IS routed around', a.routedAround.includes('Height'));
  check('disclosure: and what is NOT', a.notRoutedAround.includes('Vehicle type'));
  check(
    'disclosure: the two halves account for every field',
    a.routedAround.length + a.notRoutedAround.length === TRUCK_PROFILE_COVERAGE.length,
  );
  check(
    'disclosure: nothing appears in both halves',
    a.routedAround.every((l) => !a.notRoutedAround.includes(l)),
  );
}

check(
  'coverage: the module is data and functions only — no provider call',
  !/\bfetch\s*\(|process\.env/.test(
    readFileSync('src/lib/navigator/truck-profile-coverage.ts', 'utf8'),
  ),
);

/* ==================================================== route plausibility */

function leg(from: LatLng, to: LatLng, n: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i <= n; i += 1) {
    out.push({
      lat: from.lat + ((to.lat - from.lat) * i) / n,
      lng: from.lng + ((to.lng - from.lng) * i) / n,
    });
  }
  return out;
}

const A: LatLng = { lat: 35.0, lng: -85.0 };
const B: LatLng = { lat: 35.5, lng: -85.0 };

/*
 * A truck route is SUPPOSED to be longer than the crow flies. These are
 * the cases that must stay silent, and they are the reason the detour
 * threshold sits at 4x rather than somewhere tighter.
 */
{
  const straightish = assessRoutePlausibility({ geometry: leg(A, B, 40), destination: B });
  check('plausible: a direct route raises nothing', straightish.length === 0, straightish);
}
{
  // A dogleg around a restriction: ~2x the straight line. Ordinary.
  const via: LatLng = { lat: 35.25, lng: -85.35 };
  const dogleg = [...leg(A, via, 20), ...leg(via, B, 20)];
  const f = assessRoutePlausibility({ geometry: dogleg, destination: B });
  check('plausible: a 2x detour around a restriction raises nothing', f.length === 0, f);
}
{
  // A mountain crossing at ~3x. Still legitimate for a truck.
  const via1: LatLng = { lat: 35.1, lng: -85.6 };
  const via2: LatLng = { lat: 35.4, lng: -85.6 };
  const mountain = [...leg(A, via1, 15), ...leg(via1, via2, 15), ...leg(via2, B, 15)];
  const f = assessRoutePlausibility({ geometry: mountain, destination: B });
  check('plausible: a 3x mountain crossing raises nothing', f.length === 0, f);
}

{
  // Now something a human would question: a 6x wander.
  const f = assessRoutePlausibility({
    geometry: leg(A, B, 40),
    destination: B,
    reportedMiles: haversineish(A, B) * 6,
  });
  check(
    'implausible: a 6x route is flagged',
    f.some((x) => x.code === 'extreme-detour'),
  );
  check(
    'implausible: and the message says it can still be correct for a truck',
    f.some((x) => x.code === 'extreme-detour' && /can be correct for a truck/.test(x.message)),
  );
  check(
    'implausible: the finding carries the number, not just an opinion',
    f.some((x) => x.code === 'extreme-detour' && x.measured >= 5.5),
  );
}
{
  // A short trip cannot produce a meaningful ratio; 200 ft of yard
  // manoeuvring must not read as a 10x detour.
  const near: LatLng = { lat: 35.0005, lng: -85.0 };
  const f = assessRoutePlausibility({
    geometry: leg(A, near, 10),
    destination: near,
    reportedMiles: 0.4,
  });
  check(
    'plausible: a very short trip is never called a detour',
    !f.some((x) => x.code === 'extreme-detour'),
    f,
  );
}

{
  // A loop: the route passes the same place repeatedly.
  const loopPoint: LatLng = { lat: 35.2, lng: -85.0 };
  const loop = [
    ...leg(A, loopPoint, 10),
    ...leg(loopPoint, { lat: 35.2, lng: -85.05 }, 5),
    ...leg({ lat: 35.2, lng: -85.05 }, loopPoint, 5),
    ...leg(loopPoint, { lat: 35.2, lng: -84.95 }, 5),
    ...leg({ lat: 35.2, lng: -84.95 }, loopPoint, 5),
    ...leg(loopPoint, B, 10),
  ];
  const f = assessRoutePlausibility({ geometry: loop, destination: B });
  check(
    'implausible: a route that circles the same spot is flagged',
    f.some((x) => x.code === 'repeated-segment'),
  );
}

{
  // Doubling back: out 40 miles, then back toward the start.
  const far: LatLng = { lat: 35.6, lng: -85.0 };
  const back = [
    ...leg(A, far, 30),
    ...leg(far, { lat: 35.05, lng: -85.0 }, 30),
    ...leg({ lat: 35.05, lng: -85.0 }, B, 20),
  ];
  const f = assessRoutePlausibility({ geometry: back, destination: B });
  check(
    'implausible: doubling back toward the origin is flagged',
    f.some((x) => x.code === 'doubles-back'),
  );
  check(
    'implausible: and the distance is stated in miles',
    f.some((x) => x.code === 'doubles-back' && x.measured > 5),
  );
}

{
  // The route ends somewhere else. This is the arrival defect a driver
  // discovers at a locked gate.
  const elsewhere: LatLng = { lat: 35.55, lng: -85.02 };
  const f = assessRoutePlausibility({ geometry: leg(A, elsewhere, 40), destination: B });
  check(
    'implausible: ending away from the searched place is flagged',
    f.some((x) => x.code === 'destination-mismatch'),
  );
}
{
  // Ending at the front door rather than the exact pin is normal.
  const doorstep: LatLng = { lat: 35.5015, lng: -85.0 };
  const f = assessRoutePlausibility({ geometry: leg(A, doorstep, 40), destination: B });
  check(
    'plausible: ending a tenth of a mile away is not a mismatch',
    !f.some((x) => x.code === 'destination-mismatch'),
    f,
  );
}

{
  const f = assessRoutePlausibility({ geometry: [], destination: B });
  check(
    'degenerate: an empty geometry is reported, not thrown',
    f.length === 1 && f[0].code === 'degenerate-geometry',
  );
  const one = assessRoutePlausibility({ geometry: [A], destination: B });
  check(
    'degenerate: a single point is reported too',
    one.length === 1 && one[0].code === 'degenerate-geometry',
  );
  check('degenerate: and nothing else is guessed from it', one.length === 1);
}

/*
 * The rail that matters most. This check exists to fail loudly if anyone
 * ever wires plausibility into a refusal path: truck legality outranks
 * route length, and a long route is the normal shape of a legal one.
 */
{
  const src = readFileSync('src/lib/navigator/route-plausibility.ts', 'utf8');
  check(
    'rail: plausibility never rejects',
    !/\breject|refuse|throw new/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
  );
  check('rail: every finding is advisory text plus a number', TRUE_FINDING_SHAPE());
  check(
    'rail: the module is not imported by the validator that CAN refuse',
    !readFileSync('src/lib/navigator/route-validation.ts', 'utf8').includes('route-plausibility'),
  );
}
function TRUE_FINDING_SHAPE(): boolean {
  const f = assessRoutePlausibility({
    geometry: leg(A, B, 10),
    destination: B,
    reportedMiles: haversineish(A, B) * 9,
  });
  return f.every(
    (x) => typeof x.message === 'string' && x.message.length > 0 && Number.isFinite(x.measured),
  );
}

check('lines: a clean route says so', plausibilityLines([])[1] === '  nothing unusual');
check('lines: findings are headed for the report', plausibilityLines([])[0] === 'ROUTE CHECK');

check(
  'config: the detour threshold leaves room for real truck routes',
  DEFAULT_PLAUSIBILITY.detourRatio >= 3,
  DEFAULT_PLAUSIBILITY.detourRatio,
);

/** Straight-line miles, mirroring the module's own metric for fixtures. */
function haversineish(a: LatLng, b: LatLng): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

console.log(`\nnavigator-route-quality: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
