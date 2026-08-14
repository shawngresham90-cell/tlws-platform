/**
 * The clock-limit marker: pin, zone, or nothing.
 *
 * "Here is where your clock runs out" is one of the Trip Planner's central
 * promises, and a driver reads it to decide where to spend the night. So
 * the difference between a point and a region has to survive all the way
 * to the pixel, and there must be no fourth outcome that quietly guesses.
 *
 * A guessed pin is worse than no pin: it is equally confident, occasionally
 * tens of miles wrong, and wrong in the direction that strands a driver —
 * assumed speed always places the marker further along than heavy traffic
 * will allow.
 */
import {
  clockLimitMarker,
  isMappable,
  CANNOT_MAP,
  ZONE_EXPLANATION,
} from '@/lib/trip-planner/clock-limit-marker';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const METERS_PER_MILE = 1609.344;

/** A 200-point corridor whose actions each take `minutesPer` minutes. */
function corridor(steps: number, mileStep: number, minutesPer: number) {
  const positions = Array.from({ length: steps + 1 }, (_, i) => ({
    lat: 33 + i * 0.02,
    lng: -84,
  }));
  const maneuvers: HereManeuver[] = Array.from({ length: steps }, (_, i) => ({
    action: i === 0 ? 'depart' : 'turn',
    instruction: `step ${i}`,
    direction: null,
    severity: null,
    offset: i,
    lengthM: mileStep * METERS_PER_MILE,
    durationS: minutesPer * 60,
  }));
  return {
    maneuvers,
    positions,
    totalSeconds: steps * minutesPer * 60,
    totalMeters: steps * mileStep * METERS_PER_MILE,
  };
}

/* ============ a tight projection earns a pin ========================= */
{
  // 60 actions of 5 minutes each: well under the coarse threshold.
  const route = corridor(60, 5, 5);
  const m = clockLimitMarker({ ...route, targetSeconds: 100 * 60 });

  check('tight timing produces a pin', m.kind === 'pin', m);
  if (m.kind === 'pin') {
    check(
      'the pin carries a real position',
      Number.isFinite(m.position.lat) && Number.isFinite(m.position.lng),
      m.position,
    );
    check(
      'and the position is on the corridor, not at its ends',
      m.position.lat > 33 && m.position.lat < 33 + 60 * 0.02,
      m.position,
    );
    check('the pin states the driving time it represents', m.atSeconds === 100 * 60);
  }
  check('a pin is mappable', isMappable(m));
}

/* ============ a coarse projection earns a zone, never a pin ========== */
{
  // 20 actions of 25 minutes each: past the coarse threshold.
  const route = corridor(20, 25, 25);
  const m = clockLimitMarker({ ...route, targetSeconds: 260 * 60 });

  check('coarse timing produces a zone, not a pin', m.kind === 'zone', m);
  if (m.kind === 'zone') {
    check('the zone has two distinct ends', m.from.lat !== m.to.lat || m.from.lng !== m.to.lng, m);
    check('and states how wide the uncertainty is', m.spanMinutes === 25, m.spanMinutes);
    check('the zone is mappable', isMappable(m));
  }
  check(
    'the zone caption never reads as a margin of error around a point',
    /not a single point/i.test(ZONE_EXPLANATION),
    ZONE_EXPLANATION,
  );
}

/* ============ missing geometry maps nothing ========================== */
{
  const route = corridor(60, 5, 5);

  const noGeometry = clockLimitMarker({
    ...route,
    positions: [],
    targetSeconds: 100 * 60,
  });
  check('no geometry produces no marker', noGeometry.kind === 'none', noGeometry);
  check(
    '...and shows the exact sentence the milestone specifies',
    noGeometry.kind === 'none' && noGeometry.notice === CANNOT_MAP,
    noGeometry,
  );
  check(
    '...with a diagnosable reason kept apart from the driver-facing line',
    noGeometry.kind === 'none' && /geometry/i.test(noGeometry.detail),
    noGeometry,
  );
  check('a refusal is not mappable', !isMappable(noGeometry));

  const noTiming = clockLimitMarker({
    ...route,
    maneuvers: [
      {
        action: 'depart',
        instruction: 'Head north.',
        direction: null,
        severity: null,
        offset: 0,
        lengthM: 1000,
        durationS: null,
      },
    ],
    targetSeconds: 100 * 60,
  });
  check('no provider timing produces no marker', noTiming.kind === 'none', noTiming);
  check(
    '...with the same driver-facing sentence',
    noTiming.kind === 'none' && noTiming.notice === CANNOT_MAP,
  );

  // Timings that contradict the route summary must not place a marker.
  const inconsistent = clockLimitMarker({
    ...route,
    totalSeconds: route.totalSeconds * 3,
    targetSeconds: 100 * 60,
  });
  check(
    'timings that contradict the route summary place nothing',
    inconsistent.kind === 'none',
    inconsistent,
  );

  // A clock that outlasts the trip is a different answer from a pin at
  // the destination, and must not be drawn as one.
  const past = clockLimitMarker({ ...route, targetSeconds: route.totalSeconds + 600 });
  check('a clock that outlasts the route places nothing', past.kind === 'none', past);
  check(
    '...and says why, rather than pinning the destination',
    past.kind === 'none' && /past the route/i.test(past.detail),
    past,
  );
}

/* ============ structural: there is no fourth, guessing outcome ======= */
{
  const src = readFileSync('src/lib/trip-planner/clock-limit-marker.ts', 'utf8');
  const code = src.replace(/^\s*\*.*$/gm, '');
  check('the marker module carries no mph constant', !/\bmph\b/i.test(code));
  check('and never imports the straight-line estimator', !/route-estimate/.test(code));
  check(
    'exactly three outcomes exist',
    ["kind: 'pin'", "kind: 'zone'", "kind: 'none'"].every((k) => src.includes(k)) &&
      !/kind: 'estimate'|kind: 'approx'/.test(src),
  );
}

console.log(`trip-planner-clock-marker: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
