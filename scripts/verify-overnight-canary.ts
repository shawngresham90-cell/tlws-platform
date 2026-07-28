/**
 * Overnight-confirmation canary verification (2026-07-28).
 *
 * Feeds the two canary rows (#307 GA, #364 TN) through the REAL trip-planner
 * recommendation contract — toStopCandidates → recommendParking /
 * scoreCandidate / selectLastStops — using their exact live post-write
 * values, alongside two controls:
 *   - a zero-space directory-only row (#201 Elk City's exact live values),
 *     which must NEVER be recommended, and
 *   - a pre-flip twin (overnightParking=false) to prove the flip is what
 *     moves the overnightAllowed score component from 0 to 10.
 *
 * Run:
 *   npx esbuild scripts/verify-overnight-canary.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/verify-overnight-canary.cjs \
 *   && node /tmp/verify-overnight-canary.cjs
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

// Exact live post-write values of the two canaries.
const canary307 = listing({
  id: '4c23e030-e4d3-473c-a3b8-cfafc1599bc4',
  name: "Love's Travel Stop #307",
  lat: 33.208091,
  lng: -84.05852,
  city: 'Jackson',
  state: 'GA',
  parkingSpaces: 50,
  overnightParking: true,
});
const canary364 = listing({
  id: '08d24d71-a131-473b-9ffd-cc56b92b5466',
  name: "Love's Travel Stop #364",
  lat: 35.291951,
  lng: -84.818048,
  city: 'Charleston',
  state: 'TN',
  parkingSpaces: 85,
  overnightParking: true,
  coordVerificationStatus: 'manually-verified',
});
// Control A: #201 Elk City exact live values — operator-confirmed ZERO spaces.
const zeroControl = listing({
  id: '7acf5fa7-zero-space-control',
  name: "Love's Travel Stop #201",
  lat: 35.423039,
  lng: -99.372528,
  city: 'Elk City',
  state: 'OK',
  parkingSpaces: 0,
  overnightParking: false,
});
// Control B: pre-flip twin of #307 (overnight still false).
const preFlipTwin = listing({
  id: 'pre-flip-twin-307',
  name: "Love's Travel Stop #307 (pre-flip twin)",
  lat: 33.208091,
  lng: -84.05852,
  state: 'GA',
  parkingSpaces: 50,
  overnightParking: false,
});

// Route points placed exactly at each listing's coordinate so projection
// succeeds with 0 off-route miles — the contract under test is the parking
// recommendation, not the projector.
const routePoints: RoutePoint[] = [
  { position: { lat: 33.208091, lng: -84.05852 }, routeMile: 10 },
  { position: { lat: 35.291951, lng: -84.818048 }, routeMile: 20 },
  { position: { lat: 35.423039, lng: -99.372528 }, routeMile: 30 },
];

const candidates = toStopCandidates([canary307, canary364, zeroControl, preFlipTwin], routePoints);
check('all four listings project onto the route', candidates.length === 4, candidates.length);

const window = { fromMile: 0, toMile: 100 };
const recs = recommendParking(candidates, window);
const recIds = recs.map((r) => r.candidate.id);

// --- the canaries now enter parking recommendations ---
check('#307 is recommended for parking', recIds.includes(canary307.id));
check('#364 is recommended for parking', recIds.includes(canary364.id));

const rec307 = recs.find((r) => r.candidate.id === canary307.id);
const rec364 = recs.find((r) => r.candidate.id === canary364.id);
check(
  '#307 scores overnightAllowed = 10',
  rec307?.score.components.overnightAllowed === 10,
  rec307?.score.components,
);
check(
  '#364 scores overnightAllowed = 10',
  rec364?.score.components.overnightAllowed === 10,
  rec364?.score.components,
);

// --- the flip is exactly what moved the score ---
const twinRec = recs.find((r) => r.candidate.id === preFlipTwin.id);
check(
  'pre-flip twin still recommendable (positive spaces) but overnightAllowed = 0',
  twinRec !== undefined && twinRec.score.components.overnightAllowed === 0,
  twinRec?.score.components,
);
const c307 = candidates.find((c) => c.id === canary307.id)!;
const twin = candidates.find((c) => c.id === preFlipTwin.id)!;
check(
  'flip adds exactly +10 to the overnight score (all else equal)',
  scoreCandidate(c307, 'overnight').total - scoreCandidate(twin, 'overnight').total === 10,
);

// --- the zero-space guard did not weaken ---
check('#201 zero-space control is NOT recommended', !recIds.includes(zeroControl.id));
check(
  'zero-space control also excluded from rankCandidates(overnight)',
  !rankCandidates(candidates, 'overnight', window)
    .map((r) => r.candidate.id)
    .includes(zeroControl.id),
);
check('hasConfirmedTruckParking(0) is still false', hasConfirmedTruckParking(0) === false);
check('hasConfirmedTruckParking(null) is still false', hasConfirmedTruckParking(null) === false);
check('hasConfirmedTruckParking(50) is true', hasConfirmedTruckParking(50) === true);

// --- last-stop contract: canaries eligible, zero-space never in any slot ---
const route = buildRoute([
  {
    seq: 0,
    from: { label: 'A', position: { lat: 33.2, lng: -84.06 } },
    to: { label: 'B', position: { lat: 35.3, lng: -84.82 } },
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
// Last-stop slots require a reservable or explicitly-free candidate — that
// eligibility axis is orthogonal to the overnight flip. Probe it with
// free-parking twins: the canary twin must take a slot, the zero-space twin
// must never take one even when explicitly free.
const freeProbe = toStopCandidates(
  [
    { ...canary307, id: 'probe-307-free', freeParking: true },
    { ...zeroControl, id: 'probe-zero-free', freeParking: true },
  ],
  routePoints,
);
const last = selectLastStops({
  route,
  candidates: freeProbe,
  clocks,
  departAtMs: 1753660800000,
});
const slotIds = last.slots.map((s) => s.candidate.id);
check('free-parking canary twin occupies a last-stop slot', slotIds.includes('probe-307-free'), {
  slotIds,
  usable: last.usableDriveMin,
});
check(
  'zero-space row never enters a last-stop slot even when explicitly free',
  !slotIds.includes('probe-zero-free'),
);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
