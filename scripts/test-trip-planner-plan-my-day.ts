/**
 * Plan My Day — the assembler that every number on the results screen
 * comes from.
 *
 * WHY ONE FUNCTION. The clock-limit marker, the break, the three parking
 * choices and the weather section are all answers to "where will this
 * truck be, and when". Computed separately, they drift: a screen ends up
 * telling a driver their clock dies at 6:40 and offering them a stop at
 * 7:10. They are derived from ONE axis here, and a single `timing` value
 * decides whether each can be answered at all.
 *
 * These checks prove the refusals hold together — that a caller cannot
 * render a confident plan by accident, because whatever could not be
 * computed is ABSENT rather than defaulted.
 */
import {
  planMyDay,
  parkingHeadline,
  PARKING_CHOICES,
  PARKING_SHORTFALL_NOTE,
  NOT_AN_ELD,
} from '@/lib/trip-planner/plan-my-day';
import { PLANNING_AID_ONLY } from '@/lib/trip-planner/drive-window';
import { CANNOT_MAP } from '@/lib/trip-planner/clock-limit-marker';
import {
  thinRoute,
  planMapPoints,
  MAX_ROUTE_POINTS,
  NO_ROUTE_LINE,
} from '@/lib/trip-planner/plan-map';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { RemainingClocks, StopCandidate } from '@/lib/trip-planner/types';

/** Both ends in the United States — the only shape NWS may answer for. */
const US_ROUTE = {
  origin: 'US',
  destination: 'US',
  crossBorder: false,
  fullyUS: true,
  touchesCanada: false,
} as const;
/** Both ends in Canada. */
const CA_ROUTE = {
  origin: 'CA',
  destination: 'CA',
  crossBorder: false,
  fullyUS: false,
  touchesCanada: true,
} as const;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const T0 = 1_750_000_000_000;
const METERS_PER_MILE = 1609.344;
const ISO = new Date(T0).toISOString();

/** 120 five-minute actions: 600 miles, 600 minutes, tight windows. */
function route(minutesPer = 5, steps = 120, mileStep = 5) {
  return {
    positions: Array.from({ length: steps + 1 }, (_, i) => ({ lat: 33 + i * 0.01, lng: -84 })),
    maneuvers: Array.from({ length: steps }, (_, i) => ({
      action: i === 0 ? 'depart' : 'turn',
      instruction: `step ${i}`,
      direction: null,
      severity: null,
      offset: i,
      lengthM: mileStep * METERS_PER_MILE,
      durationS: minutesPer * 60,
    })) as HereManeuver[],
    totalSeconds: steps * minutesPer * 60,
    totalMeters: steps * mileStep * METERS_PER_MILE,
  };
}

function clocks(over: Partial<RemainingClocks> = {}): RemainingClocks {
  return {
    drivingMin: 400,
    windowMin: 500,
    untilBreakMin: 200,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: 400,
    ...over,
  };
}

function stop(id: string, routeMile: number, over: Partial<StopCandidate> = {}): StopCandidate {
  return {
    id,
    name: id,
    categorySlug: 'truck-stops',
    position: { lat: 35, lng: -85 },
    routeMile,
    offRouteMiles: 1,
    parkingSpaces: 80,
    freeParking: true,
    reservationUrl: null,
    amenities: ['showers'],
    fuelBrands: [],
    coordVerificationStatus: 'manually-verified',
    overnightStatus: 'allowed',
    ...over,
  } as StopCandidate;
}

function base(over: Partial<Parameters<typeof planMyDay>[0]> = {}) {
  return planMyDay({
    ...route(),
    baseSeconds: 120 * 5 * 60 - 900,
    departureTimeParam: ISO,
    isEstimate: false,
    clocks: clocks(),
    bufferMin: 45,
    departAtMs: T0,
    candidates: [stop('a', 60), stop('b', 120), stop('c', 180), stop('d', 240)],
    alerts: [],
    region: US_ROUTE,
    alertSource: 'nws-us',
    ...over,
  });
}

/* ============ the whole plan, when everything is available ========== */
{
  const p = base();
  check('traffic is proven live from the baseline', p.traffic.confidence === 'live', p.traffic);
  check('a driving window is produced', p.window !== null, p.windowProblem);
  check('the clock limit is mapped', p.clockLimit.kind === 'pin', p.clockLimit);
  check('the stop target is mapped separately', p.stopTarget.kind === 'pin', p.stopTarget);
  check(
    'and the stop target sits EARLIER than the clock limit',
    p.clockLimit.kind !== 'none' &&
      p.stopTarget.kind !== 'none' &&
      p.stopTarget.atSeconds < p.clockLimit.atSeconds,
    { limit: p.clockLimit, target: p.stopTarget },
  );
  check('a break is planned inside the drive', p.breakPlan?.required === true, p.breakPlan);
  check('and the break is mapped too', p.breakMarker !== null && p.breakMarker.kind !== 'none');
  check(
    `at most ${PARKING_CHOICES} parking choices are offered`,
    p.parking.length <= PARKING_CHOICES,
    p.parking.length,
  );
  check(
    'each choice carries an arrival time',
    p.parking.every((c) => c.arriveAtMs > T0),
  );
  check(
    'each choice carries the clock left on arrival',
    p.parking.every((c) => c.clockLeftMin >= 45),
  );
  check(
    'each choice carries detour distance',
    p.parking.every((c) => Number.isFinite(c.detourMiles)),
  );
  check(
    'each choice carries a confidence source',
    p.parking.every((c) => c.source.length > 0),
  );
  check('ELD authority is always stated', p.disclaimers.includes(NOT_AN_ELD));
  check('and planning-aid-only is always stated', p.disclaimers.includes(PLANNING_AID_ONLY));
}

/* ============ clocks unset: no HOS-aware plan at all ================ */
{
  const p = base({ clocks: null });
  check('no window without clocks', p.window === null);
  check('...and it says why', /Clocks not set/i.test(p.windowProblem ?? ''), p.windowProblem);
  check('no clock-limit marker is drawn', p.clockLimit.kind === 'none', p.clockLimit);
  check(
    '...with the specified sentence',
    p.clockLimit.kind === 'none' && p.clockLimit.notice === CANNOT_MAP,
  );
  check('no break is claimed', p.breakPlan === null && p.breakMarker === null);
  check('no parking eligibility is offered', p.parking.length === 0);
  check(
    '...and it names clocks as the reason',
    /clocks/i.test(p.parkingProblem ?? ''),
    p.parkingProblem,
  );
  // Traffic does NOT depend on clocks and is still answered.
  check('traffic is still reported without clocks', p.traffic.confidence === 'live');
}

/* ============ an estimate produces no HOS geography ================= */
{
  const p = base({ isEstimate: true });
  check('estimate: no clock-limit marker', p.clockLimit.kind === 'none', p.clockLimit);
  check('estimate: no stop-target marker', p.stopTarget.kind === 'none');
  check('estimate: no break placed', p.breakPlan?.required === null, p.breakPlan);
  check('estimate: no parking eligibility', p.parking.length === 0);
  check(
    'estimate: parking says timing, not absence of parking',
    /cannot determine/i.test(p.parkingProblem ?? ''),
    p.parkingProblem,
  );
  check('estimate: weather refuses rather than guessing', p.weather.ok === false, p.weather);

  /*
   * THE WHOLE PROHIBITION, IN ONE ASSERTION.
   *
   * The six claims below are the ones a straight-line estimate could
   * plausibly be talked into making, and each is individually checked
   * above. They are checked TOGETHER here as well, deliberately: the
   * individual checks can each keep passing while a seventh surface —
   * a new field, a new panel — starts claiming something. This one is
   * written to be extended whenever the plan grows a new answer, and to
   * fail loudly the moment any of them comes back.
   *
   * `base()` deliberately feeds a real baseline, a real departure time
   * and four reachable candidates, so nothing here passes because the
   * fixture was starved.
   */
  const estimateClaims = {
    liveTraffic: p.traffic.confidence === 'live',
    clockGeography: p.clockLimit.kind !== 'none' || p.stopTarget.kind !== 'none',
    breakGeography: p.breakMarker !== null || p.breakPlan?.required === true,
    parkingEligibility: p.parking.length > 0 || p.map.parking.length > 0,
    timedWeather: p.weather.ok === true,
    drawnRoute: p.map.route.length > 0,
  };
  check(
    'estimate: claims NOTHING — no live traffic, clock, break, parking, weather or road',
    Object.values(estimateClaims).every((claimed) => claimed === false),
    estimateClaims,
  );
}

/* ============ traffic unproven is never labelled live =============== */
{
  const p = base({ baseSeconds: null });
  check('no baseline means not live', p.traffic.confidence === 'unconfirmed', p.traffic);
  check('...and the plan still computes', p.window !== null && p.clockLimit.kind === 'pin');

  const any = base({ departureTimeParam: 'any' });
  check('departureTime=any is never live', any.traffic.confidence === 'not-requested');
}

/* ============ fewer than three choices stays short and says so ====== */
{
  const p = base({ candidates: [stop('only', 60)] });
  check('a single reachable stop is offered alone', p.parking.length === 1, p.parking.length);
  check(
    '...under a heading that matches what actually qualified',
    p.parkingHeadline === '1 safe parking option found',
    p.parkingHeadline,
  );
  check(
    '...and the shortfall is stated rather than padded',
    p.parkingProblem === PARKING_SHORTFALL_NOTE,
    p.parkingProblem,
  );

  const none = base({ candidates: [stop('far', 590)] });
  check('no reachable stop yields no choices', none.parking.length === 0);
  check(
    '...under the no-option heading, never a promise of three',
    none.parkingHeadline === 'No parking option meets your safe stopping window',
    none.parkingHeadline,
  );

  /*
   * THE HEADING MOVES, THE LIST NEVER GROWS. Padding back to three is the
   * failure the safety filter exists to prevent, so the wording is pinned
   * exactly at each count.
   */
  const headings: [number, string][] = [
    [3, 'Your 3 safest parking options'],
    [2, '2 safe parking options found'],
    [1, '1 safe parking option found'],
    [0, 'No parking option meets your safe stopping window'],
  ];
  for (const [count, expected] of headings) {
    check(
      `heading for ${count} option(s) is exact`,
      parkingHeadline(count) === expected,
      parkingHeadline(count),
    );
  }
  check(
    'three qualifying stops earn the full heading',
    base().parkingHeadline === 'Your 3 safest parking options',
    base().parkingHeadline,
  );
  check(
    'and three qualifying stops carry no shortfall note',
    base().parkingProblem === null,
    base().parkingProblem,
  );
  check(
    '...and says nothing is reachable inside the clock',
    /reachable inside your clock/i.test(none.parkingProblem ?? ''),
    none.parkingProblem,
  );
}

/* ============ Canada is disclosed, never answered with NWS ========== */
{
  const p = base({ region: CA_ROUTE });
  check('canada: weather refuses', p.weather.ok === false, p.weather);
  check(
    'canada: with the region reason, not a timing one',
    p.weather.ok === false && p.weather.reason === 'region-unsupported',
    p.weather,
  );
  check(
    'canada: and points at Environment Canada',
    p.weather.ok === false && /Environment Canada/.test(p.weather.notice),
  );
}

/* ============ a coarse route yields a zone, not a pin =============== */
{
  // 25-minute actions: past the coarse threshold.
  const p = base({ ...route(25, 24, 25), totalSeconds: 24 * 25 * 60 });
  check('coarse timing maps the clock limit as a zone', p.clockLimit.kind === 'zone', p.clockLimit);
  check(
    '...carrying its own width',
    p.clockLimit.kind === 'zone' && p.clockLimit.spanMinutes === 25,
    p.clockLimit,
  );
}

/* ============ four internal slots never become four rows =========== */
{
  /*
   * THE ENGINE'S FOUR NAMED SLOTS ARE INTERNAL. Last reservable, best
   * reservable, backup reservable and last free are how the original
   * product framed a corridor, and they stay — but the driver was
   * promised THREE options, so four eligible stops must display three.
   * Nothing is forced in from a slot: the three are the top-scored
   * survivors of the safety filter, and a fourth simply does not appear.
   */
  const four = base({
    candidates: [
      stop('res-far', 300, { reservationUrl: 'https://example.test/a' }),
      stop('res-mid', 200, { reservationUrl: 'https://example.test/b' }),
      stop('res-near', 100, { reservationUrl: 'https://example.test/c' }),
      stop('free-far', 250),
    ],
  });
  check(
    'four eligible stops display exactly three',
    four.parking.length === 3,
    four.parking.length,
  );
  check(
    '...under the full heading, because three did qualify',
    four.parkingHeadline === 'Your 3 safest parking options',
    four.parkingHeadline,
  );
  check('...with no shortfall note', four.parkingProblem === null, four.parkingProblem);
  check(
    '...and every displayed stop is distinct',
    new Set(four.parking.map((c) => c.candidate.id)).size === four.parking.length,
    four.parking.map((c) => c.candidate.id),
  );

  /* ---- duplicates are one place, not three options ------------------ */
  const dupes = base({
    candidates: [
      stop('lot-a', 120, { name: 'Ringgold Travel Center' }),
      // The SAME lot, re-submitted under different ids: what a duplicate
      // directory record actually looks like — same name, same spot.
      stop('lot-a-dup', 120, { name: 'Ringgold Travel Center' }),
      stop('lot-a-dup2', 120, { name: 'ringgold travel center' }),
      stop('elsewhere', 200, { name: 'Elsewhere Plaza', position: { lat: 36, lng: -86 } }),
    ],
  });
  check(
    'three records of one lot collapse to a single option',
    dupes.parking.length === 2,
    dupes.parking.map((c) => c.candidate.id),
  );
  check(
    '...and the heading reflects what really qualified',
    dupes.parkingHeadline === '2 safe parking options found',
    dupes.parkingHeadline,
  );
  check(
    '...with the shortfall note, because fewer than three survived',
    dupes.parkingProblem === PARKING_SHORTFALL_NOTE,
    dupes.parkingProblem,
  );

  /* ---- an unsafe stop can never buy its way in ---------------------- */
  const mixed = base({
    candidates: [
      // Maximally attractive and NOT reachable: 590 miles out.
      stop('tempting', 590, {
        reservationUrl: 'https://example.test/x',
        parkingSpaces: 500,
        offRouteMiles: 0,
      }),
      stop('safe-1', 80),
      stop('safe-2', 140, { name: 'Second Stop', position: { lat: 36, lng: -86 } }),
    ],
  });
  const ids = mixed.parking.map((c) => c.candidate.id);
  check('an unreachable stop never enters the displayed three', !ids.includes('tempting'), ids);
  check('...even though it outscores everything shown', mixed.parking.length === 2, ids);
  check(
    '...and every displayed stop still clears the buffer',
    mixed.parking.every((c) => c.clockLeftMin >= 45),
    mixed.parking.map((c) => c.clockLeftMin),
  );
}

/* ============ what the results map is allowed to draw =============== */
{
  /*
   * The map is the one surface where a refused answer could sneak back
   * in as a pixel: a line, a pin or a zone drawn from data that failed a
   * filter looks exactly as authoritative as one that passed. These
   * prove the layers are built from the FILTERED lists, not the raw ones.
   */
  const p = base();
  check('the map carries the provider road geometry', p.map.route.length >= 2, p.map.route.length);
  check('and says nothing is wrong with it', p.map.routeProblem === null, p.map.routeProblem);
  check(
    'the drawn line is thinned to a phone-sized payload',
    p.map.route.length <= MAX_ROUTE_POINTS,
    p.map.route.length,
  );
  check(
    'the map plots exactly the parking the screen offered — no more',
    p.map.parking.length === p.parking.length,
    { map: p.map.parking.length, shown: p.parking.length },
  );
  check(
    '...and exactly the same stops, by id',
    p.map.parking.map((m) => m.id).join(',') === p.parking.map((c) => c.candidate.id).join(','),
    p.map.parking.map((m) => m.id),
  );

  /* ---- an unsafe stop is not a pin either ---------------------------- */
  const mixed = base({
    candidates: [
      stop('tempting', 590, { parkingSpaces: 500, offRouteMiles: 0 }),
      stop('safe-1', 80),
      stop('safe-2', 140, { name: 'Second Stop', position: { lat: 36, lng: -86 } }),
    ],
  });
  check(
    'a stop too far to reach is never drawn on the map',
    !mixed.map.parking.some((m) => m.id === 'tempting'),
    mixed.map.parking.map((m) => m.id),
  );

  /* ---- an estimate draws no road ------------------------------------- */
  const est = base({ isEstimate: true });
  check(
    'an estimate cannot claim live traffic even when handed a baseline',
    // `base()` passes a real baseSeconds and a real departure time. On an
    // estimate both are meaningless, and the screen prints "Live traffic
    // included" off exactly this verdict — so it must not survive.
    est.traffic.confidence !== 'live',
    est.traffic,
  );
  check('an estimated route draws no line at all', est.map.route.length === 0, est.map.route);
  check('and says why, in the driver’s words', est.map.routeProblem === NO_ROUTE_LINE);
  check(
    'an estimate maps no parking either — nothing was reachable to prove',
    est.map.parking.length === 0,
  );

  /* ---- thinning keeps the shape it claims to ------------------------- */
  const long = Array.from({ length: 5000 }, (_, i) => ({ lat: 30 + i * 0.001, lng: -90 }));
  const thin = thinRoute(long, 400);
  check('thinning respects its cap', thin.length === 400, thin.length);
  check(
    'thinning keeps both ends, so the line still starts and finishes on the route',
    thin[0].lat === long[0].lat && thin[thin.length - 1].lat === long[long.length - 1].lat,
  );
  const short = [
    { lat: 1, lng: 1 },
    { lat: 2, lng: 2 },
  ];
  check(
    'a route already short enough is passed through untouched',
    thinRoute(short, 400).length === 2,
  );

  /* ---- the camera sees the zones, not just the pins ------------------ */
  const zoned = base({ ...route(20, 30, 20) });
  const pts = planMapPoints(zoned.map, [zoned.clockLimit, zoned.stopTarget]);
  check(
    'coarse timing produces a zone rather than a pin',
    zoned.clockLimit.kind === 'zone',
    zoned.clockLimit.kind,
  );
  const zone = zoned.clockLimit;
  check(
    'and both ends of that zone are inside the camera fit',
    zone.kind === 'zone' &&
      pts.some((q) => q.lat === zone.from.lat) &&
      pts.some((q) => q.lat === zone.to.lat),
  );

  /* ---- no window, nothing placed ------------------------------------- */
  const noClocks = base({ clocks: null });
  check(
    'with no clocks entered the map places no HOS marker',
    noClocks.clockLimit.kind === 'none' && noClocks.stopTarget.kind === 'none',
  );
  check(
    'and offers no parking pins to tap instead',
    noClocks.map.parking.length === 0,
    noClocks.map.parking,
  );
}

console.log(`trip-planner-plan-my-day: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
