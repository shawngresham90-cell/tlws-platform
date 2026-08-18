/*
 * TP-2 bench generator — canned /api/trip-planner/quote responses for the
 * corridor viewport bench, computed by the REAL composeQuote against the
 * deterministic I-75 fixture (no network, no providers).
 *
 * CLI: node <bundled> <out.json>. Writes:
 *   { limited:   { quote, expectedKinds },     — cycle-limited, with via
 *     reachable: { quote, expectedKinds } }    — fresh clocks, with via
 *
 * `expectedKinds` is read FROM the generated plan, so the bench asserts
 * what this build actually produces rather than a hand-typed list that
 * could drift.
 */
import { writeFileSync } from 'node:fs';
import {
  corridorRoute,
  corridorListings,
  corridorRoutingResult,
  DALTON_ORIGIN,
  ATLANTA_VIA,
  MACON_DESTINATION,
} from '../fixtures/i75-corridor';
import { composeQuote } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';

const out = process.argv[2];
if (!out) {
  console.error('usage: tp2-corridor-gen <out.json>');
  process.exit(2);
}

const route = corridorRoute({ via: true });
const deps = {
  loadListings: async () => corridorListings(),
  weather: nullWeatherPort,
  fuelPrice: async () => null,
  routing: { name: 'fixture', route: async () => corridorRoutingResult(route) },
};

const base = {
  origin: DALTON_ORIGIN,
  via: ATLANTA_VIA,
  destination: MACON_DESTINATION,
  departAtMs: 1_770_000_000_000,
  fuelLevelFraction: 1,
  mpg: DEFAULT_TRUCK_PROFILE.mpg,
  tankGallons: DEFAULT_TRUCK_PROFILE.tankGallons,
  truck: {
    heightFt: DEFAULT_TRUCK_PROFILE.heightFt,
    widthFt: DEFAULT_TRUCK_PROFILE.widthFt,
    lengthFt: DEFAULT_TRUCK_PROFILE.lengthFt,
    grossWeightLbs: DEFAULT_TRUCK_PROFILE.grossWeightLbs,
    axles: DEFAULT_TRUCK_PROFILE.axles,
    hazmatClass: null,
  },
  avoid: [] as never[],
  bufferMin: 60,
};

async function main() {
  // Fresh clocks: the whole corridor is legally coverable.
  const reachable = await composeQuote(
    {
      ...base,
      clocks: {
        cycleRule: '70/8',
        drivingUsedMin: 0,
        windowElapsedMin: -1,
        drivingSinceBreakMin: 0,
        cycleUsedMin: 0,
      },
    } as never,
    deps,
  );
  // A worn cycle: 4200 − 4110 = 90 minutes left. The cycle binds and the
  // plan must end at a parking stop with the clock-update boundary.
  const limited = await composeQuote(
    {
      ...base,
      clocks: {
        cycleRule: '70/8',
        drivingUsedMin: 60,
        windowElapsedMin: 120,
        drivingSinceBreakMin: 60,
        cycleUsedMin: 4110,
      },
    } as never,
    deps,
  );

  if (!reachable.ok || !limited.ok) {
    console.error('generator: composeQuote failed', reachable, limited);
    process.exit(1);
  }
  const kinds = (q: typeof reachable): string[] =>
    q.ok && q.tripPlan.status !== 'unavailable' ? q.tripPlan.events.map((e) => e.kind) : [];

  const reachKinds = kinds(reachable);
  const limitedKinds = kinds(limited);
  if (!reachKinds.includes('destination') || !limitedKinds.includes('clock-update')) {
    console.error('generator: scenarios did not produce the expected shapes', {
      reachKinds,
      limitedKinds,
    });
    process.exit(1);
  }

  writeFileSync(
    out,
    JSON.stringify({
      reachable: { quote: reachable, expectedKinds: reachKinds },
      limited: { quote: limited, expectedKinds: limitedKinds },
    }),
  );
  console.log(`tp2-corridor-gen: reachable=[${reachKinds}] limited=[${limitedKinds}]`);
}

void main();
