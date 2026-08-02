/**
 * Offline tests for the direction-of-travel projection. Pure math, no network,
 * no clock, no globals. Run:
 *
 *   npx esbuild scripts/test-direction-of-travel.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-direction-of-travel.cjs && node /tmp/test-direction-of-travel.cjs
 *
 * Geometry is checked against hand-computable cases: one degree of latitude is
 * about 69 miles, due north of an origin bears 000°, due east bears 090°. The
 * cases that matter most are the ones where the answer must be "I don't know" —
 * a missing heading, a garbage heading, a candidate sitting on top of the driver
 * — because those are exactly where a plausible-looking guess would mislead.
 */
import {
  directionOfTravel,
  initialBearingDegrees,
  isAhead,
  isUsableHeading,
  normalizeHeading,
  relativeBearingDegrees,
} from '@/lib/navigator/direction-of-travel';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
function near(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/** Dallas, TX. Arbitrary but fixed — every expectation below is relative to it. */
const ORIGIN = { lat: 32.7767, lng: -96.797 };
const DUE_NORTH = { lat: 33.7767, lng: -96.797 };
const DUE_SOUTH = { lat: 31.7767, lng: -96.797 };
const DUE_EAST = { lat: 32.7767, lng: -95.797 };
const DUE_WEST = { lat: 32.7767, lng: -97.797 };
const NORTHEAST = { lat: 33.4767, lng: -96.097 };
const SOUTHWEST = { lat: 32.0767, lng: -97.497 };

/* ------------------------------------------------------ heading normalization */

check('0 normalizes to 0', normalizeHeading(0) === 0);
check('359 normalizes to 359', normalizeHeading(359) === 359);
check('360 wraps to 0', normalizeHeading(360) === 0);
check('370 wraps to 10', normalizeHeading(370) === 10);
check('-10 wraps to 350', normalizeHeading(-10) === 350);
check('-370 wraps to 350', normalizeHeading(-370) === 350);
check('720 wraps to 0', normalizeHeading(720) === 0);

check('a finite number is a usable heading', isUsableHeading(0) && isUsableHeading(359.9));
check('null is not a usable heading', !isUsableHeading(null));
check('undefined is not a usable heading', !isUsableHeading(undefined));
check('NaN is not a usable heading', !isUsableHeading(NaN));
check('Infinity is not a usable heading', !isUsableHeading(Infinity));
check('-Infinity is not a usable heading', !isUsableHeading(-Infinity));
check('a numeric string is not a usable heading', !isUsableHeading('90'));

/* ---------------------------------------------------------- relative bearing */

check('bearing 010 against heading 000 is +10', near(relativeBearingDegrees(10, 0), 10, 1e-9));
check('bearing 350 against heading 000 is -10', near(relativeBearingDegrees(350, 0), -10, 1e-9));
check(
  'bearing 001 against heading 359 is +2 (wraparound)',
  near(relativeBearingDegrees(1, 359), 2, 1e-9),
);
check(
  'bearing 359 against heading 001 is -2 (wraparound)',
  near(relativeBearingDegrees(359, 1), -2, 1e-9),
);
check('exactly opposite normalizes to +180, not -180', relativeBearingDegrees(180, 0) === 180);

/* ------------------------------------------------------------------ bearings */

check('due north bears 000', near(initialBearingDegrees(ORIGIN, DUE_NORTH), 0, 0.01));
check('due south bears 180', near(initialBearingDegrees(ORIGIN, DUE_SOUTH), 180, 0.01));
check('due east bears ~090', near(initialBearingDegrees(ORIGIN, DUE_EAST), 90, 0.5));
check('due west bears ~270', near(initialBearingDegrees(ORIGIN, DUE_WEST), 270, 0.5));

/* --------------------------------------------------------- ahead and behind */

{
  const r = directionOfTravel(ORIGIN, 0, DUE_NORTH);
  check('directly ahead reads as ahead', r.relation === 'ahead', r);
  check('directly ahead: ~69 miles of latitude', near(r.distanceMiles, 69, 0.5), r.distanceMiles);
  check(
    'directly ahead: along-track equals the full distance',
    r.alongTrackMiles !== null && near(r.alongTrackMiles, r.distanceMiles, 1e-6),
  );
  check(
    'directly ahead: no lateral offset',
    r.crossTrackMiles !== null && near(r.crossTrackMiles, 0, 1e-6),
  );
  check('directly ahead: relative bearing ~0', near(r.relativeBearingDegrees ?? 999, 0, 0.01));
}

{
  const r = directionOfTravel(ORIGIN, 0, DUE_SOUTH);
  check('directly behind reads as behind', r.relation === 'behind', r);
  check(
    'directly behind: along-track is negative and full magnitude',
    r.alongTrackMiles !== null && near(r.alongTrackMiles, -r.distanceMiles, 1e-6),
  );
}

check(
  'heading south, a northern candidate is behind',
  directionOfTravel(ORIGIN, 180, DUE_NORTH).relation === 'behind',
);
check(
  'heading south, a southern candidate is ahead',
  directionOfTravel(ORIGIN, 180, DUE_SOUTH).relation === 'ahead',
);

/* ---------------------------------------------------------------- lateral */

{
  const right = directionOfTravel(ORIGIN, 0, DUE_EAST);
  check('heading north, due east is lateral', right.relation === 'lateral', right);
  check(
    'heading north, due east is to the RIGHT (positive cross-track)',
    right.crossTrackMiles !== null && right.crossTrackMiles > 0,
    right.crossTrackMiles,
  );
  check(
    'heading north, due east has ~zero along-track',
    right.alongTrackMiles !== null && near(right.alongTrackMiles, 0, 1),
    right.alongTrackMiles,
  );

  const left = directionOfTravel(ORIGIN, 0, DUE_WEST);
  check('heading north, due west is lateral', left.relation === 'lateral', left);
  check(
    'heading north, due west is to the LEFT (negative cross-track)',
    left.crossTrackMiles !== null && left.crossTrackMiles < 0,
    left.crossTrackMiles,
  );
  check(
    'left and right are mirror images',
    left.crossTrackMiles !== null &&
      right.crossTrackMiles !== null &&
      near(left.crossTrackMiles, -right.crossTrackMiles, 0.5),
  );
}

/* ------------------------------------------------- diagonal (NE / SW) headings */

check(
  'heading northeast, a northeast candidate is ahead',
  directionOfTravel(ORIGIN, 45, NORTHEAST).relation === 'ahead',
);
check(
  'heading northeast, a southwest candidate is behind',
  directionOfTravel(ORIGIN, 45, SOUTHWEST).relation === 'behind',
);
check(
  'heading southwest, a southwest candidate is ahead',
  directionOfTravel(ORIGIN, 225, SOUTHWEST).relation === 'ahead',
);
check(
  'heading southwest, a northeast candidate is behind',
  directionOfTravel(ORIGIN, 225, NORTHEAST).relation === 'behind',
);

/* ---------------------------------------------------- heading wraparound 0/360 */

check(
  'heading 359 still sees due north as ahead',
  directionOfTravel(ORIGIN, 359, DUE_NORTH).relation === 'ahead',
);
check(
  'heading 001 still sees due north as ahead',
  directionOfTravel(ORIGIN, 1, DUE_NORTH).relation === 'ahead',
);
check(
  'heading 360 behaves exactly like heading 0',
  JSON.stringify(directionOfTravel(ORIGIN, 360, DUE_NORTH)) ===
    JSON.stringify(directionOfTravel(ORIGIN, 0, DUE_NORTH)),
);
check(
  'heading -1 behaves exactly like heading 359',
  JSON.stringify(directionOfTravel(ORIGIN, -1, DUE_NORTH)) ===
    JSON.stringify(directionOfTravel(ORIGIN, 359, DUE_NORTH)),
);
check(
  'heading 719 behaves exactly like heading 359',
  JSON.stringify(directionOfTravel(ORIGIN, 719, DUE_NORTH)) ===
    JSON.stringify(directionOfTravel(ORIGIN, 359, DUE_NORTH)),
);

/* ------------------------------------------------- missing / invalid heading */

for (const bad of [null, undefined, NaN, Infinity, -Infinity]) {
  const r = directionOfTravel(ORIGIN, bad as number | null | undefined, DUE_NORTH);
  const label = String(bad);
  check(`heading ${label} → relation unknown`, r.relation === 'unknown', r);
  check(`heading ${label} → along-track is null, not guessed`, r.alongTrackMiles === null);
  check(`heading ${label} → cross-track is null, not guessed`, r.crossTrackMiles === null);
  check(`heading ${label} → relative bearing is null`, r.relativeBearingDegrees === null);
  check(`heading ${label} → distance is still reported`, near(r.distanceMiles, 69, 0.5));
  check(`heading ${label} → absolute bearing is still reported`, r.bearingDegrees !== null);
  check(
    `heading ${label} → isAhead is false, never a coin flip`,
    !isAhead(ORIGIN, bad as null, DUE_NORTH),
  );
}

/* --------------------------------------------- same and near-zero coordinates */

{
  const r = directionOfTravel(ORIGIN, 0, ORIGIN);
  check('the same coordinate reads as coincident', r.relation === 'coincident', r);
  check('the same coordinate has zero distance', r.distanceMiles === 0);
  check('the same coordinate reports no bearing', r.bearingDegrees === null);
  check('the same coordinate reports no along-track', r.alongTrackMiles === null);
  check('the same coordinate reports no cross-track', r.crossTrackMiles === null);
}

{
  // ~0.0007 miles north — well inside civilian GPS scatter.
  const r = directionOfTravel(ORIGIN, 0, { lat: ORIGIN.lat + 0.00001, lng: ORIGIN.lng });
  check('a near-zero-distance candidate reads as coincident', r.relation === 'coincident', r);
  check('a near-zero-distance candidate reports no bearing', r.bearingDegrees === null);
}

{
  // Just outside the coincidence window: ~0.07 miles. Should classify normally.
  const r = directionOfTravel(ORIGIN, 0, { lat: ORIGIN.lat + 0.001, lng: ORIGIN.lng });
  check('just past the coincidence window, classification resumes', r.relation === 'ahead', r);
}

check(
  'the coincidence window is configurable',
  directionOfTravel(ORIGIN, 0, DUE_NORTH, { coincidentMiles: 100 }).relation === 'coincident',
);

/* -------------------------------------------------------------- antimeridian */

{
  const west = { lat: 0, lng: 179.95 };
  const east = { lat: 0, lng: -179.95 };
  const r = directionOfTravel(west, 90, east);
  check(
    'a pair straddling the antimeridian is ~6.9 miles apart, not half the globe',
    near(r.distanceMiles, 6.909, 0.05),
    r.distanceMiles,
  );
  check(
    'across the antimeridian, due east still bears ~090',
    near(r.bearingDegrees ?? 999, 90, 0.1),
  );
  check('heading east across the antimeridian reads as ahead', r.relation === 'ahead', r);
  check(
    'along-track across the antimeridian equals the full distance',
    r.alongTrackMiles !== null && near(r.alongTrackMiles, r.distanceMiles, 1e-6),
  );
  check(
    'the reverse crossing is symmetric',
    near(directionOfTravel(east, 270, west).distanceMiles, r.distanceMiles, 1e-9),
  );
  check(
    'heading west across the antimeridian from the west side reads as behind',
    directionOfTravel(west, 270, east).relation === 'behind',
  );
}

/* ------------------------------------------------------------- cone option */

{
  // Due east is 90° off a northward heading: lateral under any legal cone.
  check(
    'a wide cone still cannot make a perpendicular candidate "ahead"',
    directionOfTravel(ORIGIN, 0, DUE_EAST, { coneDegrees: 89 }).relation === 'lateral',
  );
  // 45° off-heading: ahead under the default 60° cone, lateral under a tight 30°.
  const offset = { lat: 33.4767, lng: -96.097 };
  check(
    'a 45-degree offset is ahead under the default cone',
    directionOfTravel(ORIGIN, 0, offset).relation === 'ahead',
  );
  check(
    'the same offset is lateral under a tight cone',
    directionOfTravel(ORIGIN, 0, offset, { coneDegrees: 30 }).relation === 'lateral',
  );
  for (const bad of [0, -5, 90, 180, NaN, Infinity, undefined]) {
    check(
      `an out-of-range cone (${String(bad)}) falls back to the default rather than misclassifying`,
      JSON.stringify(directionOfTravel(ORIGIN, 0, offset, { coneDegrees: bad as number })) ===
        JSON.stringify(directionOfTravel(ORIGIN, 0, offset)),
    );
  }
}

/* -------------------------------------------------------------- determinism */

{
  const runs = [1, 2, 3].map(() => JSON.stringify(directionOfTravel(ORIGIN, 37.5, NORTHEAST)));
  check('repeated identical inputs give byte-identical results', new Set(runs).size === 1, runs);
}

{
  // Ahead and behind must be mutually exclusive and exhaustive of the cones.
  let contradictions = 0;
  for (let heading = 0; heading < 360; heading += 7) {
    for (const target of [DUE_NORTH, DUE_SOUTH, DUE_EAST, DUE_WEST, NORTHEAST, SOUTHWEST]) {
      const r = directionOfTravel(ORIGIN, heading, target);
      const aheadByRelation = r.relation === 'ahead';
      const aheadBySign = (r.alongTrackMiles ?? 0) > 0;
      if (aheadByRelation && !aheadBySign) contradictions++;
      if (r.relation === 'behind' && aheadBySign) contradictions++;
      if (aheadByRelation !== isAhead(ORIGIN, heading, target)) contradictions++;
    }
  }
  check('relation and along-track sign never disagree across the compass', contradictions === 0, {
    contradictions,
  });
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
