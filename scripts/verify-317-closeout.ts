/**
 * Love's #317 Skippers VA closeout verification (2026-07-28).
 *
 * Feeds #317's exact live post-write values through the REAL trip-planner
 * recommendation contract — toStopCandidates → recommendParking /
 * rankCandidates / scoreCandidate / selectLastStops — alongside the
 * zero-space control (#201 Elk City's exact live values) to prove the
 * newly published row is recommendation-eligible and the zero-space /
 * unknown-count guards did not weaken.
 *
 * Run:
 *   npx esbuild scripts/verify-317-closeout.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/verify-317-closeout.cjs \
 *   && node /tmp/verify-317-closeout.cjs
 */
import {
  toStopCandidates,
  recommendParking,
  rankCandidates,
  scoreCandidate,
  hasConfirmedTruckParking,
  type DirectoryListing,
  type RoutePoint,
} from '@/lib/trip-planner/directory-layer';
import { selectLastStops } from '@/lib/trip-planner/last-stop';
import { buildRoute, type RemainingClocks } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const listing = (over: Partial<DirectoryListing>): DirectoryListing => ({
  id: '',
  name: '',
  categorySlug: 'truck-stops',
  lat: null,
  lng: null,
  city: null,
  state: null,
  interstate: null,
  exitNumber: null,
  parkingSpaces: null,
  overnightParking: null,
  freeParking: null,
  paidParking: null,
  reservationUrl: null,
  amenities: null,
  fuelBrands: null,
  coordVerificationStatus: null,
  ...over,
});

// #317's exact live post-write values.
const store317 = listing({
  id: '5a5fa4df-c324-4405-bdb6-977ffb7f01a5',
  name: "Love's Travel Stop #317",
  lat: 36.605447,
  lng: -77.560647,
  city: 'Skippers',
  state: 'VA',
  parkingSpaces: 72,
  overnightParking: true,
  coordVerificationStatus: 'machine-checked',
});
// Zero-space control: #201 Elk City's exact live values.
const zeroControl = listing({
  id: 'zero-space-control-201',
  name: "Love's Travel Stop #201",
  lat: 35.423039,
  lng: -99.372528,
  city: 'Elk City',
  state: 'OK',
  parkingSpaces: 0,
  overnightParking: false,
});
// Unknown-count control: no space claim at all.
const unknownControl = listing({
  id: 'unknown-space-control',
  name: 'Unknown-count truck stop',
  lat: 36.605447,
  lng: -77.560647,
  parkingSpaces: null,
  overnightParking: true,
});

const routePoints: RoutePoint[] = [
  { position: { lat: 36.605447, lng: -77.560647 }, routeMile: 10 },
  { position: { lat: 35.423039, lng: -99.372528 }, routeMile: 20 },
];

const candidates = toStopCandidates([store317, zeroControl, unknownControl], routePoints);
check('all three listings project onto the route', candidates.length === 3, candidates.length);

const window = { fromMile: 0, toMile: 100 };
const recs = recommendParking(candidates, window);
const recIds = recs.map((r) => r.candidate.id);

// --- #317 now enters parking recommendations ---
check('#317 is recommended for parking', recIds.includes(store317.id), recIds);
const rec317 = recs.find((r) => r.candidate.id === store317.id);
check(
  '#317 scores overnightAllowed = 10',
  rec317?.score.components.overnightAllowed === 10,
  rec317?.score.components,
);
check(
  '#317 machine-checked coordinate scores 8',
  rec317?.score.components.coordinates === 8,
  rec317?.score.components,
);
check(
  '#317 also ranked for the parking need',
  rankCandidates(candidates, 'parking', window)
    .map((r) => r.candidate.id)
    .includes(store317.id),
);

// --- the guards did not weaken ---
check('zero-space control is NOT recommended', !recIds.includes(zeroControl.id));
check('unknown-count control is NOT recommended', !recIds.includes(unknownControl.id));
check(
  'zero-space excluded from rankCandidates(overnight) too',
  !rankCandidates(candidates, 'overnight', window)
    .map((r) => r.candidate.id)
    .includes(zeroControl.id),
);
check(
  'unknown-count excluded from rankCandidates(parking) too',
  !rankCandidates(candidates, 'parking', window)
    .map((r) => r.candidate.id)
    .includes(unknownControl.id),
);
check('hasConfirmedTruckParking(72) is true', hasConfirmedTruckParking(72) === true);
check('hasConfirmedTruckParking(0) is still false', hasConfirmedTruckParking(0) === false);
check('hasConfirmedTruckParking(null) is still false', hasConfirmedTruckParking(null) === false);
check(
  'overnight need scores #317 above an overnight-false twin',
  scoreCandidate(candidates.find((c) => c.id === store317.id)!, 'overnight').total >
    scoreCandidate(
      toStopCandidates(
        [{ ...store317, id: 'twin-no-overnight', overnightParking: false }],
        routePoints,
      )[0],
      'overnight',
    ).total,
);

// --- last-stop: free-parking probes (eligibility axis: reservable/free) ---
const route = buildRoute([
  {
    seq: 0,
    from: { label: 'A', position: { lat: 36.6, lng: -77.56 } },
    to: { label: 'B', position: { lat: 35.42, lng: -99.37 } },
    distanceMiles: 100,
    avgSpeedMph: 60,
  },
]);
const clocks: RemainingClocks = {
  drivingMin: 11 * 60,
  windowMin: 14 * 60,
  untilBreakMin: 8 * 60,
  cycleMin: 60 * 60,
  legalDrivingMin: 11 * 60,
  limitedBy: '11-hour',
};
const freeProbe = toStopCandidates(
  [
    { ...store317, id: 'probe-317-free', freeParking: true },
    { ...zeroControl, id: 'probe-zero-free', freeParking: true },
  ],
  routePoints,
);
const last = selectLastStops({ route, candidates: freeProbe, clocks, departAtMs: 1753660800000 });
const slotIds = last.slots.map((s) => s.candidate.id);
check('free-parking #317 probe occupies a last-stop slot', slotIds.includes('probe-317-free'), {
  slotIds,
});
check(
  'zero-space row never enters a last-stop slot even when explicitly free',
  !slotIds.includes('probe-zero-free'),
);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
