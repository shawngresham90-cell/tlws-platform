/**
 * What one second of navigation costs the map projection.
 *
 * The driving screen recomputes `lifecycle.mapData()` on every accepted
 * GPS fix — once a second, for hours. This measures the two things that
 * projection does per call against route sizes a long haul actually
 * produces, so the cost is a number rather than an intuition:
 *
 *   1. copying the route geometry for the map, and
 *   2. locating the next maneuver's position along that geometry.
 *
 * Run:
 *   npx esbuild scripts/bench/navigator-map-data.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/bench-map-data.cjs \
 *   && node /tmp/bench-map-data.cjs
 */
import { createNavigationLifecycle } from '@/lib/navigator/navigation-lifecycle';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { LatLng } from '@/lib/map/bounds';

const MI_PER_DEG_LAT = 69.0937;
const T0 = 1_754_000_000_000;
const TRUCK: TruckProfile = {
  lengthFt: 73,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80_000,
  axles: 5,
  hazmatClass: null,
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.8,
};

/**
 * Point counts chosen from what the provider actually returns: a local
 * delivery, a day's run, and a two-day haul at full provider resolution.
 */
const SIZES = [500, 5_000, 20_000];
const CALLS = 600; // ten minutes of driving at 1 Hz

function route(points: number): LatLng[] {
  const out: LatLng[] = [];
  const spacingMi = 0.02;
  for (let i = 0; i < points; i++)
    out.push({ lat: 35 + (i * spacingMi) / MI_PER_DEG_LAT, lng: -85 });
  return out;
}

async function measure(points: number) {
  const positions = route(points);
  const destination: DestinationInfo = {
    position: positions[positions.length - 1],
    facility: 'distribution-center',
    positionSource: 'geocode',
  };
  const life = createNavigationLifecycle({
    planPort: async () => ({
      kind: 'route',
      routeId: `bench-${points}`,
      positions,
      distanceMiles: Number(((points - 1) * 0.02).toFixed(1)),
      durationSeconds: 3600,
      maneuvers: [
        { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
        {
          action: 'turn',
          instruction: 'Turn right.',
          direction: 'right',
          offset: Math.floor(points * 0.75),
        },
        { action: 'arrive', instruction: 'Arrive.', direction: null, offset: points - 1 },
      ],
      validationState: 'valid',
      warnings: [],
    }),
    replacementPort: async () => ({ kind: 'failure', reason: 'unused' }),
  });
  const planned = await life.plan(
    { origin: positions[0], destination: destination.position, truck: TRUCK, departAtMs: T0 },
    destination,
    T0,
  );
  if (!planned.ok) throw new Error(`bench plan failed: ${planned.reason}`);
  life.startNavigation(T0 + 1000);

  // Feed a fix so a maneuver is live, which is what makes the projection
  // do its full job (an idle screen would flatter the numbers).
  life.tick(
    {
      fix: { lat: 35.2, lng: -85, accuracyM: 8, tMs: T0 + 2000, speedMph: 60, headingDeg: 0 },
      health: 'good',
      lastFixMs: T0 + 2000,
      accuracyM: 8,
      speedMph: 60,
      headingDeg: 0,
      deadReckoning: false,
    },
    T0 + 2000,
  );

  const start = process.hrtime.bigint();
  let sink = 0;
  for (let i = 0; i < CALLS; i++) sink += life.mapData().geometry.length;
  const ns = Number(process.hrtime.bigint() - start);
  return { points, sink, perCallMs: ns / CALLS / 1e6, totalMs: ns / 1e6 };
}

async function main() {
  console.log(`mapData() cost — ${CALLS} calls (ten minutes of driving at 1 Hz)\n`);
  console.log('  points      per call      per 10 min');
  for (const points of SIZES) {
    const r = await measure(points);
    console.log(
      `  ${String(r.points).padStart(6)}   ${r.perCallMs.toFixed(3).padStart(8)} ms   ${r.totalMs
        .toFixed(0)
        .padStart(8)} ms`,
    );
  }
}

void main();
