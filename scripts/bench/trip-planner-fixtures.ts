/**
 * The twelve plans the browser bench renders, produced by the REAL engine.
 *
 * WHY THESE ARE GENERATED AND NOT HAND-WRITTEN JSON. The bench needs a
 * plan whose clock limit is a zone, one whose parking list is exactly
 * two, one that refuses to map anything at all. Typing that JSON by hand
 * would make the bench a test of my typing: the payloads would drift from
 * `planMyDay` the first time a field moved, and every scenario would
 * still render green because the fixture, not the engine, decided what
 * the screen received.
 *
 * So each scenario is an INPUT — route shape, clocks, candidates, alerts
 * — and the plan is whatever `planMyDay` actually returns for it. If the
 * engine stops producing a zone for coarse timing, the zone scenario
 * stops being a zone scenario and the bench's own assertion fails, which
 * is the behaviour we want from a fixture.
 *
 * WHAT THESE FIXTURES ARE NOT. They are provider-SHAPED, not
 * provider-SOURCED: the maneuvers carry the same offsets, lengths and
 * durations HERE returns, but no HERE request was made to obtain them.
 * The live round trip is unproven here and is recorded as such in the
 * bench report and the ops doc.
 *
 * Run:
 *   npx esbuild scripts/bench/trip-planner-fixtures.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src \
 *     --outfile=/tmp/tp-fixtures.cjs && node /tmp/tp-fixtures.cjs <out.json>
 */
import { writeFileSync } from 'node:fs';
import { planMyDay, type PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { RemainingClocks, StopCandidate } from '@/lib/trip-planner/types';
import type { WeatherAlert } from '@/lib/trip-planner/providers';

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

const T0 = Date.UTC(2026, 7, 14, 14, 0, 0);
const METERS_PER_MILE = 1609.344;

/**
 * A route as the provider describes one: N actions, each with a duration,
 * a length and an offset into the polyline.
 *
 * `minutesPer` is the lever the scenarios pull. Short actions give the
 * projector tight windows and earn a pin; long ones leave it honestly
 * unsure and produce a zone. That is the same threshold the engine
 * applies in production — nothing here lowers it.
 */
function route(minutesPer = 5, steps = 120, mileStep = 5) {
  return {
    positions: Array.from({ length: steps + 1 }, (_, i) => ({
      lat: 33 + i * 0.012,
      lng: -84 - i * 0.004,
    })),
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

let seq = 0;
function stop(name: string, routeMile: number, over: Partial<StopCandidate> = {}): StopCandidate {
  seq += 1;
  return {
    id: `stop-${seq}`,
    name,
    categorySlug: 'truck-stops',
    // Distinct positions: co-located stops are deduped by the engine, and
    // a fixture that accidentally stacks them would silently shorten
    // every list it feeds.
    position: { lat: 33 + routeMile * 0.0024, lng: -84 - routeMile * 0.0008 },
    routeMile,
    offRouteMiles: 1.2,
    parkingSpaces: 80,
    freeParking: true,
    paidParking: null,
    overnightParking: true,
    overnightStatus: 'confirmed',
    reservationUrl: null,
    amenities: ['Showers', 'Scales'],
    fuelBrands: ['Pilot'],
    coordVerificationStatus: 'manually-verified',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '296',
    ...over,
  };
}

type Input = Parameters<typeof planMyDay>[0];

function plan(over: Partial<Input> = {}): PlanMyDay {
  const r = route();
  return planMyDay({
    ...r,
    // A baseline BELOW the returned duration is the provider's own proof
    // that traffic was applied to this number.
    baseSeconds: r.totalSeconds - 900,
    departureTimeParam: new Date(T0).toISOString(),
    isEstimate: false,
    clocks: clocks(),
    bufferMin: 45,
    departAtMs: T0,
    candidates: [
      stop('Northbound Travel Center', 60),
      stop('Exit 112 Truck Plaza', 120),
      stop('Riverside Fuel Stop', 180),
      stop('Statehouse Truck Stop', 240),
    ],
    alerts: [],
    region: US_ROUTE,
    alertSource: 'nws-us',
    ...over,
  });
}

const alert = (headline: string, fromMile: number, expiresMs: number): WeatherAlert => ({
  headline,
  severity: 'warning',
  fromMile,
  toMile: fromMile + 40,
  expiresMs,
});

/**
 * The twelve scenarios, each with the ONE fact the bench asserts about
 * it. The expectation is written here beside the input so a scenario
 * that stops producing the state it is named for fails loudly instead of
 * quietly rendering something else.
 */
const SCENARIOS: { key: string; title: string; expect: string; plan: PlanMyDay }[] = [
  {
    key: 'full-plan',
    title: 'Everything available: pin, break, three parking choices',
    expect: 'clockLimit=pin, parking=3',
    plan: plan(),
  },
  {
    key: 'two-parking',
    title: 'Only two stops clear the buffer',
    expect: 'parking=2 with the shortfall note',
    plan: plan({ candidates: [stop('Northbound Travel Center', 60), stop('Exit 112 Plaza', 130)] }),
  },
  {
    key: 'one-parking',
    title: 'A single safe option',
    expect: 'parking=1 with the shortfall note',
    plan: plan({ candidates: [stop('Lone Pine Truck Stop', 90)] }),
  },
  {
    key: 'zero-parking',
    title: 'Nothing on this corridor is reachable in time',
    expect: 'parking=0 and the no-option heading',
    plan: plan({ candidates: [stop('Far Side Plaza', 580), stop('Too Far Fuel', 595)] }),
  },
  {
    key: 'coarse-zone',
    title: 'Provider timing is coarse — a zone, never a pin',
    expect: 'clockLimit=zone',
    plan: (() => {
      const r = route(20, 30, 20);
      return planMyDay({
        ...r,
        baseSeconds: r.totalSeconds - 600,
        departureTimeParam: new Date(T0).toISOString(),
        isEstimate: false,
        clocks: clocks(),
        bufferMin: 45,
        departAtMs: T0,
        candidates: [stop('Wide Window Truck Stop', 100), stop('Second Wide Stop', 200)],
        alerts: [],
        region: US_ROUTE,
        alertSource: 'nws-us',
      });
    })(),
  },
  {
    key: 'cannot-map',
    title: 'Timing without geometry — the clock limit cannot be placed',
    expect: 'clockLimit=none with the exact refusal sentence',
    plan: plan({ positions: [] }),
  },
  {
    key: 'no-clocks',
    title: 'Clocks never entered',
    expect: 'no window, no HOS marker, no parking',
    plan: plan({ clocks: null }),
  },
  {
    key: 'estimate',
    title: 'A straight-line estimate — no road, no HOS timing',
    expect: 'no route line, timing refusals throughout',
    // Exactly what `composeQuote` sends for an estimate: no baseline and
    // no departure time, because neither was ever asked of a provider.
    plan: plan({ isEstimate: true, baseSeconds: null, departureTimeParam: null }),
  },
  {
    key: 'canada',
    title: 'A route into Canada',
    expect: 'weather refused, Environment Canada link offered',
    plan: plan({ region: CA_ROUTE }),
  },
  {
    key: 'traffic-unconfirmed',
    title: 'Traffic requested but the baseline was not returned',
    expect: 'traffic status unavailable, never "live"',
    plan: plan({ baseSeconds: null }),
  },
  {
    key: 'weather-alerts',
    title: 'A trucking-relevant alert on the route',
    expect: 'the alert is shown with the time it is reached',
    plan: plan({ alerts: [alert('Winter Storm Warning', 150, T0 + 8 * 3_600_000)] }),
  },
  {
    key: 'tight-clocks',
    title: 'A driver almost out of hours',
    expect: 'a short window and a much earlier stop target',
    plan: plan({
      clocks: clocks({
        drivingMin: 95,
        windowMin: 140,
        untilBreakMin: 40,
        legalDrivingMin: 95,
      }),
      // One stop near enough to still clear a 95-minute clock minus a
      // 45-minute buffer, so this scenario shows a SHORT plan rather
      // than repeating the empty-list one.
      candidates: [stop('Near Exit Truck Stop', 30), stop('Statehouse Truck Stop', 240)],
    }),
  },
];

const out = process.argv[2];
if (typeof out !== 'string' || out === '') {
  console.error('usage: trip-planner-fixtures <out.json>');
  process.exit(1);
}
writeFileSync(out, JSON.stringify(SCENARIOS, null, 2));
console.log(`wrote ${SCENARIOS.length} scenarios to ${out}`);
