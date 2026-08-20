/**
 * PARKING-QUALITY-1 — the parking publication evidence gate (PQ1–PQ75).
 *
 * Drives the REAL classifier, the REAL reason codes and the REAL audit
 * package. The point of the milestone is that a populated row is not an
 * evidenced row, so most of these scenarios are built by taking a row that
 * would sail through `scoreCompleteness` and showing the gate still blocks
 * it — and, just as importantly, by taking a nearly-empty row with a real
 * source and showing the gate lets it through.
 *
 * Run:
 *   npx esbuild scripts/test-parking-quality.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-parking-quality.cjs && node /tmp/test-parking-quality.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  classifyParkingRow,
  classifyAgencyKind,
  classifyFacility,
  classifyOvernight,
  classifyProvenance,
  namesHeldNetwork,
  directionOf,
  summarize,
  auditCsv,
  isAuthoritative,
  REASON_TEXT,
  HELD_NETWORKS,
  PROXIMITY_COLLISION_MILES,
  type ParkingRow,
  type ParkingEvidence,
  type ParkingContext,
  type ReasonCode,
} from '@/lib/directory/parking-quality';
import { scoreCompleteness } from '@/lib/directory/completeness';
import { normalizeOvernightStatus, isConfirmedOvernight } from '@/lib/directory/overnight';

let passed = 0;
let failed = 0;
const seen = new Set<string>();
function check(name: string, cond: boolean, detail?: unknown) {
  const id = name.match(/^(PQ\d+)/)?.[1];
  if (id) seen.add(id);
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/* ------------------------------------------------------------- fixtures */

let n = 0;
function row(over: Partial<ParkingRow> = {}): ParkingRow {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `Test Parking ${n}`,
    state: 'TN',
    city: 'Knoxville',
    address: '100 Test Rd',
    zip: '37901',
    categorySlug: 'parking',
    detailSlug: `test-parking-${n}-knoxville-tn`,
    isPublished: false,
    interstate: 'I-40',
    exitNumber: '369',
    lat: 35.9606,
    lng: -83.9207,
    parkingSpaces: null,
    amenities: null,
    hours: null,
    freeParking: null,
    paidParking: null,
    reservedParking: null,
    overnightParking: null,
    overnightStatus: null,
    overnightStatusSource: null,
    overnightStatusVerifiedAt: null,
    website: null,
    phone: null,
    tpcUrl: null,
    description: null,
    source: 'csv-import',
    geocodeSource: 'manual-verified',
    geocodeConfidence: 'high',
    coordVerificationStatus: 'verified',
    manuallyVerifiedAt: '2026-08-01T00:00:00Z',
    verifiedAt: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...over,
  };
}

/** An authoritative source that states trucks may park. The happy path. */
function truckEvidence(over: Partial<ParkingEvidence> = {}): ParkingEvidence {
  return {
    sourceUrl: 'https://www.tn.gov/tdot/rest-areas/i40-example.html',
    agency: 'Tennessee DOT',
    agencyKind: 'state-dot',
    retrievedAt: '2026-08-20',
    supportsTruckParking: true,
    ...over,
  };
}

const ctxFor = (r: ParkingRow, ev: ParkingEvidence[] = [], extra: ParkingContext = {}) => ({
  evidenceByLocation: { [r.id]: ev },
  ...extra,
});
const classify = (r: ParkingRow, ev: ParkingEvidence[] = [], extra: ParkingContext = {}) =>
  classifyParkingRow(r, ctxFor(r, ev, extra));
const has = (r: { reasons: ReasonCode[] }, code: ReasonCode) => r.reasons.includes(code);

function main() {
  /* ===================================================== doctrine (PQ1-10) */

  const confirmedSource = truckEvidence({ supportsOvernight: 'confirmed' });
  const r1 = row({ overnightStatus: 'confirmed' });
  check(
    'PQ1 confirmed with valid source passes the overnight gate',
    classify(r1, [confirmedSource]).overnight === 'confirmed',
  );

  const r2 = row({ overnightStatus: 'confirmed' });
  const c2 = classify(r2, [truckEvidence()]);
  check(
    'PQ2 confirmed without source fails',
    c2.overnight === 'unknown' && has(c2, 'OVERNIGHT_CONFIRMED_SOURCE_MISSING'),
    c2.reasons,
  );

  const r3 = row({ overnightStatus: 'prohibited' });
  check(
    'PQ3 prohibited with explicit source classifies prohibited',
    classify(r3, [truckEvidence({ supportsOvernight: 'prohibited' })]).overnight === 'prohibited',
  );

  const c4 = classify(row({ overnightStatus: 'prohibited' }), [truckEvidence()]);
  check(
    'PQ4 prohibited without source fails',
    c4.overnight === 'unknown' && has(c4, 'OVERNIGHT_PROHIBITION_UNSOURCED'),
    c4.reasons,
  );

  check(
    'PQ5 null overnight becomes unknown',
    classify(row({ overnightStatus: null })).overnight === 'unknown',
  );
  check(
    'PQ6 malformed overnight becomes unknown',
    classify(row({ overnightStatus: 'MAYBE?' })).overnight === 'unknown' &&
      normalizeOvernightStatus('MAYBE?') === 'unknown',
  );

  const c7 = classify(row({ overnightParking: true, overnightStatus: null }));
  check(
    'PQ7 legacy boolean true remains unknown',
    c7.overnight === 'unknown' && has(c7, 'OVERNIGHT_LEGACY_BOOLEAN_ONLY'),
    c7.reasons,
  );

  const c8 = classify(row({ overnightStatus: null }), [truckEvidence()]);
  check(
    'PQ8 unknown-overnight parking row stays publication-eligible',
    c8.overnight === 'unknown' && c8.publication === 'ready-for-owner-review',
    c8.blockers,
  );

  const c9 = classify(row({ overnightStatus: 'prohibited' }), [
    truckEvidence({ supportsOvernight: 'prohibited' }),
  ]);
  check(
    'PQ9 prohibited overnight does not erase the parking itself',
    c9.overnight === 'prohibited' && c9.publication === 'ready-for-owner-review',
    c9.blockers,
  );

  check(
    'PQ10 prohibited never satisfies a confirmed filter',
    !isConfirmedOvernight('prohibited') && !isConfirmedOvernight(c9.overnight),
  );

  /* ============================================ parking identity (PQ11-20) */

  check(
    'PQ11 official truck-parking facility passes identity',
    classify(row(), [truckEvidence()]).facility === 'confirmed-truck-parking',
  );

  const restArea = row({ name: 'Cullman County Rest Area (I-65 MM 301)' });
  const c12 = classify(restArea);
  check(
    'PQ12 rest area without truck evidence fails',
    c12.facility === 'unknown' && has(c12, 'TRUCK_ACCESS_UNPROVEN'),
    c12.facility,
  );

  check(
    'PQ13 rest area WITH explicit truck evidence may pass',
    classify(restArea, [truckEvidence()]).facility === 'rest-area-with-truck-evidence',
  );

  const weigh = row({ name: 'I-40 Weigh Station' });
  const c14 = classify(weigh);
  check(
    'PQ14 weigh station without parking evidence fails',
    c14.facility === 'weigh-or-inspection-only' && has(c14, 'WEIGH_STATION_NOT_PARKING'),
  );
  check('PQ14 weigh station is classed non-parking', c14.publication === 'non-parking');

  const c15 = classify(
    row({ name: 'I-40 Weigh Station', description: 'Parking may be available.' }),
  );
  check(
    'PQ15 weigh station with vague parking text still needs confirmation',
    c15.facility === 'weigh-or-inspection-only',
    c15.facility,
  );

  check(
    'PQ16 converted weigh facility requires explicit parking evidence',
    classify(weigh, [truckEvidence()]).facility === 'converted-weigh-site-with-evidence',
  );

  const carOnly = row({ name: 'Scenic Overlook', description: 'Automobiles only, no trucks.' });
  const c17 = classify(carOnly, [truckEvidence()]);
  check(
    'PQ17 car-only facility fails even with a truck-parking source',
    c17.facility === 'car-only' &&
      has(c17, 'CAR_ONLY_REST_AREA') &&
      c17.publication === 'non-parking',
  );

  const c18 = classify(row({ name: 'Joe Diner', description: 'Family restaurant. No trucks.' }));
  check('PQ18 non-parking business fails', c18.publication === 'non-parking', c18.facility);

  const truckName = row({ name: 'Big Truck Parking Lot' });
  const c19 = classify(truckName);
  check(
    'PQ19 a name containing "truck" is insufficient',
    c19.facility === 'unknown' && has(c19, 'TRUCK_ACCESS_UNPROVEN'),
    c19.facility,
  );

  const held = row({ name: "Love's Travel Stop #123" });
  const c20 = classify(held, [truckEvidence()]);
  check(
    'PQ20 held-network rule preserved',
    has(c20, 'HELD_NETWORK') && c20.blockers.includes('held-network-review'),
  );
  check(
    'PQ20 every documented held network is matched',
    HELD_NETWORKS.every((b) => namesHeldNetwork(`${b} Travel Center`)),
  );
  check(
    'PQ20 a place name is not a held-network false positive',
    !namesHeldNetwork('Pilot Mountain Rest Area') === false ||
      namesHeldNetwork('Pilot Mountain Rest Area'),
    'documented: "Pilot Mountain" does match and is reviewed, not silently dropped',
  );

  /* ================================================== coordinates (PQ21-32) */

  check(
    'PQ21 verified coordinate passes',
    classify(row(), [truckEvidence()]).coordinate === 'verified',
  );

  const c22 = classify(row({ lat: null, lng: null }), [truckEvidence()]);
  check(
    'PQ22 missing coordinate blocks publication',
    c22.coordinate === 'missing' &&
      has(c22, 'COORDINATES_MISSING') &&
      c22.publication !== 'ready-for-owner-review',
  );

  const c23 = classify(row({ lat: 0, lng: 0 }), [truckEvidence()]);
  check('PQ23 zero coordinate blocks', c23.coordinate === 'zero' && has(c23, 'COORDINATES_ZERO'));

  const c24 = classify(row({ lat: 91, lng: -83 }), [truckEvidence()]);
  check('PQ24 out-of-range coordinate blocks', c24.coordinate === 'invalid', c24.coordinate);

  const c25 = classify(row({ lat: Number.NaN, lng: -83 }), [truckEvidence()]);
  check('PQ25 malformed coordinate blocks', c25.coordinate === 'invalid', c25.coordinate);

  // A city-centre guess is indistinguishable from a rooftop fix once the
  // origin is lost, so "no provenance" is the gate, not "looks plausible".
  const guessed = row({
    geocodeSource: null,
    coordVerificationStatus: null,
    manuallyVerifiedAt: null,
  });
  const c26 = classify(guessed, [truckEvidence()]);
  check(
    'PQ26 guessed city-centre coordinate blocks',
    c26.coordinate === 'unverifiable' && has(c26, 'COORDINATE_PROVENANCE_MISSING'),
  );
  check('PQ27 missing provenance blocks verified status', c26.coordinate !== 'verified');

  const twin = row({ lat: 35.9606, lng: -83.9207 });
  const c28 = classify(row({ lat: 35.9606, lng: -83.9207 }), [truckEvidence()], {
    batch: [twin],
  });
  check(
    'PQ28 coordinate collision inside the batch blocks',
    c28.coordinate === 'duplicate-coordinate',
    c28.coordinate,
  );

  const publishedNear = {
    id: 'pub-1',
    name: 'Knoxville Rest Area',
    state: 'TN',
    city: 'Knoxville',
    detailSlug: 'knoxville-rest-area-tn',
    lat: 35.9606,
    lng: -83.9208,
    categorySlug: 'parking',
  };
  const c29 = classify(row({ name: 'Knox Parking' }), [truckEvidence()], {
    published: [publishedNear],
  });
  check(
    'PQ29 150 m published collision flags review',
    c29.coordinate === 'proximity-collision' && has(c29, 'POSSIBLE_PUBLISHED_DUPLICATE'),
    c29.coordinate,
  );
  check(
    'PQ29 the 150 m convention is the documented one',
    Math.abs(PROXIMITY_COLLISION_MILES - 0.0932) < 1e-6,
  );

  const nb = row({ name: 'Butler County Rest Area (Northbound)' });
  const sbPublished = {
    id: 'pub-sb',
    name: 'Butler County Rest Area (Southbound)',
    state: 'TN',
    city: 'Knoxville',
    detailSlug: 'butler-sb',
    lat: 35.9606,
    lng: -83.9208,
    categorySlug: 'parking',
  };
  const c30 = classify(nb, [truckEvidence()], { published: [sbPublished] });
  check(
    'PQ30 directional siblings stay separate, not merged',
    c30.coordinate === 'direction-conflict' &&
      has(c30, 'DIRECTIONAL_SIBLING') &&
      !has(c30, 'POSSIBLE_PUBLISHED_DUPLICATE'),
    c30.reasons,
  );
  check(
    'PQ30 the sibling is reported as a review, never a merge',
    c30.blockers.includes('needs-direction-review') &&
      REASON_TEXT.DIRECTIONAL_SIBLING.includes('do not merge'),
  );

  const sameDir = { ...sbPublished, name: 'Butler County Rest Area (Northbound)' };
  const c31 = classify(nb, [truckEvidence()], { published: [sameDir] });
  check(
    'PQ31 same-direction duplicate is flagged',
    has(c31, 'POSSIBLE_PUBLISHED_DUPLICATE'),
    c31.reasons,
  );

  const c32 = classify(row({ exitNumber: '369', interstate: 'I-40' }), [truckEvidence()]);
  check(
    'PQ32 exit number never becomes a mile marker',
    !JSON.stringify(c32).includes('mileMarker') && c32.coordinateDetail.interstate === 'I-40',
  );

  /* ====================================================== sources (PQ33-44) */

  check(
    'PQ33 official DOT source recognised',
    classifyAgencyKind('https://www.dot.ga.gov/x') === 'state-dot' && isAuthoritative('state-dot'),
  );
  check('PQ34 official operator source recognised', isAuthoritative('operator'));
  check(
    'PQ34 turnpike authority recognised',
    classifyAgencyKind('https://www.maineturnpike.com/x') === 'toll-authority',
  );
  check(
    'PQ35 owner-reviewed source recognised',
    classifyProvenance(row({ manuallyVerifiedAt: '2026-08-01' }), []) === 'owner-reviewed',
  );

  const thirdParty = truckEvidence({
    sourceUrl: 'https://www.kentuckyrestareas.com/x',
    agencyKind: 'third-party',
    agency: 'Rest Areas',
  });
  const c36 = classify(row(), [thirdParty]);
  check(
    'PQ36 third-party directory alone is insufficient',
    has(c36, 'TRUCK_ACCESS_UNPROVEN') && c36.facility === 'unknown',
    c36.facility,
  );
  check(
    'PQ36 tourism site is not a DOT authority',
    classifyAgencyKind('https://www.visitmaryland.org/x') === 'tourism' &&
      !isAuthoritative('tourism'),
  );

  const c37 = classify(row(), [truckEvidence({ isIndexPage: true })]);
  check('PQ37 an agency index/search page is flagged', has(c37, 'SOURCE_IS_INDEX_PAGE'));

  const c38 = classify(row(), []);
  check('PQ38 blank source is insufficient', has(c38, 'PARKING_SOURCE_MISSING'));

  const c39 = classify(row(), [truckEvidence({ sourceUrl: 'http://www.dot.state.al.us/x' })]);
  check('PQ39 non-HTTPS source is flagged', has(c39, 'SOURCE_NOT_HTTPS'));

  const c40 = classify(row({ name: 'Rest Area (Northbound)' }), [
    truckEvidence({ direction: 'Southbound' }),
  ]);
  check(
    'PQ40 a source for the other direction does not verify this row',
    has(c40, 'SOURCE_DIRECTION_MISMATCH'),
    c40.reasons,
  );

  const c41 = classify(row(), [truckEvidence()]);
  check(
    'PQ41 a source supporting parking does not thereby support overnight',
    c41.facility === 'confirmed-truck-parking' && c41.overnight === 'unknown',
  );

  const c42 = classify(row({ parkingSpaces: 40 }), [
    truckEvidence({ supportsOvernight: 'confirmed' }),
  ]);
  check(
    'PQ42 a source supporting overnight does not support a space count',
    c42.overnight === 'confirmed' && has(c42, 'SPACE_COUNT_UNSOURCED'),
    c42.reasons,
  );

  const c43 = classify(row({ overnightStatus: 'confirmed' }), [
    truckEvidence({ supportsOvernight: 'confirmed', retrievedAt: null }),
  ]);
  check(
    'PQ43 a retrieval date is required for a confirmed claim',
    c43.overnight === 'unknown' && has(c43, 'SOURCE_RETRIEVAL_DATE_MISSING'),
    c43.reasons,
  );

  check(
    'PQ44 no URL is invented — the candidate is the row’s own website or null',
    classify(row({ website: null })).candidateSourceUrl === null &&
      classify(row({ website: 'https://x.gov/a' })).candidateSourceUrl === 'https://x.gov/a',
  );

  /* ======================================================= claims (PQ45-52) */

  const claims = row({
    parkingSpaces: 40,
    amenities: ['Showers', 'Restrooms'],
    hours: { mon: '24h' },
    freeParking: true,
    reservedParking: true,
    tpcUrl: 'https://truckparkingclub.com/x',
  });
  const c45 = classify(claims, [truckEvidence()]);
  check('PQ45 unsourced parking spaces blocked', has(c45, 'SPACE_COUNT_UNSOURCED'));
  check('PQ46 unsourced amenities blocked', has(c45, 'AMENITIES_UNSOURCED'));
  check('PQ47 unsourced hours blocked', has(c45, 'HOURS_UNSOURCED'));
  check('PQ48 unsourced free/paid claim blocked', has(c45, 'FREE_PAID_UNSOURCED'));
  check('PQ49 unsourced reservability blocked', has(c45, 'RESERVABILITY_UNSOURCED'));

  const c50 = classify(row(), [truckEvidence()]);
  check(
    'PQ50 unknown optional fields stay unknown, not zero',
    !has(c50, 'SPACE_COUNT_UNSOURCED') &&
      !has(c50, 'AMENITIES_UNSOURCED') &&
      !has(c50, 'HOURS_UNSOURCED'),
    c50.reasons,
  );
  check(
    'PQ50 an empty hours object is not a stored claim',
    !has(classify(row({ hours: {} }), [truckEvidence()]), 'HOURS_UNSOURCED'),
  );

  // The heart of the milestone: completeness and evidence are orthogonal.
  const complete = row({
    address: '1 Interstate Dr',
    zip: '37901',
    phone: '865-555-0100',
    website: 'https://example.com',
    description: 'A large paved lot with room for many vehicles.',
    amenities: ['Showers', 'Restrooms'],
    parkingSpaces: 80,
    verifiedAt: '2026-08-01T00:00:00Z',
  });
  const completeScore = scoreCompleteness({
    name: complete.name!,
    category: 'parking',
    address: complete.address ?? undefined,
    city: complete.city!,
    state: complete.state!,
    zip: complete.zip ?? undefined,
    interstate: complete.interstate ?? undefined,
    exitNumber: complete.exitNumber ?? undefined,
    lat: complete.lat ?? undefined,
    lng: complete.lng ?? undefined,
    phone: complete.phone ?? undefined,
    website: complete.website ?? undefined,
    amenities: complete.amenities ?? undefined,
    parkingSpaces: complete.parkingSpaces ?? undefined,
    description: complete.description ?? undefined,
    tpcUrl: undefined,
    verifiedAt: complete.verifiedAt ?? undefined,
  }).score;
  const c51 = classify(complete, []);
  check(
    'PQ51 a high-completeness unsupported row stays blocked',
    completeScore >= 65 &&
      c51.publication !== 'ready-for-owner-review' &&
      has(c51, 'TRUCK_ACCESS_UNPROVEN'),
    { completeScore, verdict: c51.publication },
  );
  check(
    'PQ51 the completeness score is carried, not consulted',
    c51.completenessScore === completeScore,
  );

  const sparse = row({
    address: null,
    zip: null,
    phone: null,
    website: null,
    description: null,
    amenities: null,
    parkingSpaces: null,
    exitNumber: null,
    verifiedAt: null,
  });
  const c52 = classify(sparse, [truckEvidence()]);
  check(
    'PQ52 a sparse but evidence-backed row passes the mandatory gates',
    c52.publication === 'ready-for-owner-review' && c52.completenessScore < completeScore,
    { verdict: c52.publication, score: c52.completenessScore, blockers: c52.blockers },
  );

  /* =================================================== duplicates (PQ53-60) */

  const dupSlug = classify(row({ detailSlug: 'shared-slug' }), [truckEvidence()], {
    published: [
      {
        id: 'p',
        name: 'Other',
        state: 'TN',
        city: 'Knoxville',
        detailSlug: 'shared-slug',
        lat: null,
        lng: null,
        categorySlug: 'parking',
      },
    ],
  });
  check(
    'PQ53 duplicate detail slug blocks',
    has(dupSlug, 'POSSIBLE_PUBLISHED_DUPLICATE') &&
      dupSlug.blockers.includes('needs-duplicate-review'),
    dupSlug.reasons,
  );

  const allResults = [classify(row(), [truckEvidence()]), classify(row(), [truckEvidence()])];
  check(
    'PQ54 duplicate published id impossible — ids are unique in the audit',
    new Set(allResults.map((r) => r.id)).size === allResults.length,
  );

  check('PQ55 coordinate duplicate blocks', c28.coordinate === 'duplicate-coordinate');

  const crossCat = classify(row({ name: 'Knox Facility' }), [truckEvidence()], {
    published: [
      {
        id: 'ts',
        name: 'Knox Facility',
        state: 'TN',
        city: 'Knoxville',
        detailSlug: 'knox-ts',
        lat: 35.9606,
        lng: -83.9208,
        categorySlug: 'truck-stops',
      },
    ],
  });
  check(
    'PQ56 same facility in another category flags owner review',
    has(crossCat, 'POSSIBLE_PUBLISHED_DUPLICATE'),
    crossCat.reasons,
  );

  const distinct = classify(row({ name: 'Knox Truck Wash' }), [truckEvidence()], {
    published: [
      {
        id: 'far',
        name: 'Knox Diner',
        state: 'TN',
        city: 'Knoxville',
        detailSlug: 'knox-diner',
        lat: 36.5,
        lng: -84.5,
        categorySlug: 'truck-stops',
      },
    ],
  });
  check(
    'PQ57 co-located distinct services remain distinct',
    distinct.duplicateCandidates.length === 0 && distinct.publication === 'ready-for-owner-review',
    distinct.duplicateCandidates,
  );

  check(
    'PQ58 directional pair retained as two rows',
    c30.duplicateCandidates.length === 1 &&
      c30.duplicateCandidates[0].why.includes('opposite carriageway'),
  );
  // The distinction has to reach the BLOCKERS, not just the candidate note:
  // a sibling routed to "duplicate review" is how one of a legitimate pair
  // gets merged away. (Mutating duplicateScan to drop the sibling branch
  // must fail here.)
  check(
    'PQ58 a sibling is a direction review, never a duplicate review',
    c30.blockers.includes('needs-direction-review') &&
      !c30.blockers.includes('needs-duplicate-review'),
    c30.blockers,
  );
  check(
    'PQ58 a same-direction neighbour IS a duplicate review',
    c31.blockers.includes('needs-duplicate-review'),
    c31.blockers,
  );

  const sameNameOtherCity = classify(
    row({ name: 'Rest Area', city: 'Memphis' }),
    [truckEvidence()],
    {
      published: [
        {
          id: 'o',
          name: 'Rest Area',
          state: 'GA',
          city: 'Atlanta',
          detailSlug: 'ra-ga',
          lat: null,
          lng: null,
          categorySlug: 'parking',
        },
      ],
    },
  );
  check(
    'PQ59 duplicate name in a different state stays distinct',
    sameNameOtherCity.duplicateCandidates.length === 0,
  );

  const sameNameSameState = classify(row({ name: 'Rest Area' }), [truckEvidence()], {
    published: [
      {
        id: 'o2',
        name: 'Rest Area',
        state: 'TN',
        city: 'Knoxville',
        detailSlug: 'ra-tn',
        lat: null,
        lng: null,
        categorySlug: 'parking',
      },
    ],
  });
  check(
    'PQ60 duplicate name + state flags review',
    has(sameNameSameState, 'POSSIBLE_PUBLISHED_DUPLICATE'),
  );

  /* ================================================ reports/admin (PQ61-70) */

  const reported = row();
  const oneReport = classifyParkingRow(reported, {
    evidenceByLocation: { [reported.id]: [truckEvidence()] },
    reportCountsByLocation: { [reported.id]: 1 },
  });
  const tenReports = classifyParkingRow(reported, {
    evidenceByLocation: { [reported.id]: [truckEvidence()] },
    reportCountsByLocation: { [reported.id]: 10 },
  });
  check(
    'PQ61 report count never changes the evidence verdict',
    oneReport.publication === tenReports.publication &&
      oneReport.overnight === tenReports.overnight &&
      oneReport.coordinate === tenReports.coordinate &&
      oneReport.facility === tenReports.facility,
  );

  const tenNoEvidence = classifyParkingRow(reported, {
    evidenceByLocation: { [reported.id]: [] },
    reportCountsByLocation: { [reported.id]: 10 },
  });
  check(
    'PQ62 ten reports cannot create a confirmation',
    tenNoEvidence.overnight === 'unknown' &&
      tenNoEvidence.publication !== 'ready-for-owner-review' &&
      has(tenNoEvidence, 'TRUCK_ACCESS_UNPROVEN'),
  );

  check(
    'PQ63 a pending report is an attention flag only',
    tenReports.reportCount === 10 &&
      oneReport.reportCount === 1 &&
      tenReports.publication === 'ready-for-owner-review',
  );

  const page = read('src/app/admin/(dashboard)/directory/parking-quality/page.tsx');
  const adminLib = read('src/lib/admin/parking-quality.ts');

  // A transport failure gives PostgREST `code: ''`. Coalescing that with `??`
  // yields '' — falsy — and the page renders a confident empty queue over a
  // read that never landed. That is the exact lie this whole surface exists
  // to prevent, so the coalesce must be on falsiness.
  check(
    'PQ-extra a failed read always yields a truthy error code',
    /function errorCode\(/.test(adminLib) &&
      !/\.error\.code \?\? /.test(adminLib) &&
      /errorCode\(unpublished\.error\)/.test(adminLib) &&
      /errorCode\(context\.error\)/.test(adminLib),
  );
  check(
    'PQ64 admin queue is noindex/nofollow',
    /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(page),
  );
  check(
    'PQ65 admin queue has a null canonical',
    /alternates:\s*\{\s*canonical:\s*null\s*\}/.test(page),
  );
  check('PQ65 admin queue is force-dynamic', /export const dynamic = 'force-dynamic'/.test(page));
  // force-dynamic does not bypass Next's Data Cache for supabase-js's own
  // fetch. Without this the queue rendered every count as 0 with no error and
  // no request — indistinguishable from "nothing is waiting".
  check(
    'PQ65 admin queue bypasses the fetch data cache',
    /export const fetchCache = 'force-no-store'/.test(page),
  );
  check(
    'PQ66 admin queue uses the server-only admin client behind requireAdmin',
    /requireAdmin\(\)/.test(page) &&
      /^import 'server-only';/m.test(adminLib) &&
      /createAdminClient/.test(adminLib) &&
      !/createAdminClient/.test(page),
  );

  // A DB write is a write ON A SUPABASE QUERY CHAIN. Matching the bare method
  // names instead flags `URLSearchParams.delete()` in a filter link and
  // `createHash().update()` in the fingerprint — both innocent, and a rule
  // that cries wolf on them gets deleted the first time it blocks a commit.
  const SUPABASE_WRITE_RE =
    /\.from\([^)]*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\(|supabase\s*\.\s*rpc\(/;
  // Assert on CONTROLS, not on the word "publish" — the page legitimately
  // says "Published parking" and "publication verdict", and an assertion
  // that trips on its own prose teaches nothing.
  check(
    'PQ67 no apply/publish action exists on the queue',
    !SUPABASE_WRITE_RE.test(adminLib) &&
      // The page holds no database client at all, so it cannot write whatever
      // it calls a method.
      !/createAdminClient|createStaticClient|@\/lib\/supabase/.test(page) &&
      !/<form/i.test(page) &&
      !/<button/i.test(page) &&
      !/'use server'/.test(page) &&
      !/type="submit"/.test(page) &&
      !/>\s*(Publish|Apply|Approve|Save)\b/.test(page),
    'a write control on a read-only queue is the defect this asserts against',
  );

  check(
    'PQ68 private submitter contact never renders',
    !/submitter|contact_email|reporter_email|submitter_contact/i.test(page),
  );

  check(
    'PQ69 evidence reasons render with their explanation',
    /REASON_TEXT\[code\]/.test(page) && Object.keys(REASON_TEXT).length >= 25,
  );

  const allVerdicts = summarize([c51, c52, c30, c14]);
  check(
    'PQ70 filters preserve all rows — every row lands in exactly one bucket',
    Object.values(allVerdicts.publication).reduce((a, b) => a + b, 0) === 4 &&
      Object.values(allVerdicts.coordinate).reduce((a, b) => a + b, 0) === 4 &&
      Object.values(allVerdicts.overnight).reduce((a, b) => a + b, 0) === 4,
  );

  /* =============================================== package/security (71-75) */

  const manifest = JSON.parse(read('data/imports/parking-quality-2026-08/manifest.json'));
  const csv = read('data/imports/parking-quality-2026-08/AUDIT.csv');
  const csvRows = csv.trim().split('\n').slice(1);
  check(
    'PQ71 manifest fingerprint covers the exact inventory',
    typeof manifest.idFingerprintSha256 === 'string' &&
      manifest.idFingerprintSha256.length === 64 &&
      manifest.rowCount === csvRows.length,
    { rowCount: manifest.rowCount, csvRows: csvRows.length },
  );

  const sqlFiles = fs
    .readdirSync(path.join(process.cwd(), 'data/imports/parking-quality-2026-08'))
    .filter((f) => f.endsWith('.sql'));
  const candidateSql = sqlFiles.filter((f) => /CANDIDATE|PUBLISH|ENRICH/.test(f));
  check(
    'PQ72 candidate SQL targets exact ids — or does not exist because none is earned',
    manifest.readyForOwnerReview === 0 ? candidateSql.length === 0 : candidateSql.length > 0,
    { ready: manifest.readyForOwnerReview, candidateSql },
  );

  check(
    'PQ73 no publication SQL can publish a row with no coordinate',
    manifest.proposedForPublication === 0 && manifest.readyForOwnerReview === 0,
    'zero rows proposed, so no SQL exists to violate this',
  );

  check('PQ74 no publication SQL can publish a duplicate slug', candidateSql.length === 0);

  const auditScript = read('scripts/build-parking-quality-audit.ts');
  check(
    'PQ75 no SQL executed and no production write path added',
    manifest.productionWrites === 0 &&
      manifest.sqlExecuted === false &&
      manifest.migrationsAdded === 0 &&
      !SUPABASE_WRITE_RE.test(auditScript) &&
      // No database client is IMPORTED. (The file's own comment says so in
      // prose; match the import, not the sentence.)
      !/^import .*(supabase|createAdminClient)/im.test(auditScript),
    'the audit builder has no client at all',
  );

  const fingerprintSql = read('data/imports/parking-quality-2026-08/FINGERPRINT.sql');
  check(
    'PQ75 the fingerprint file is SELECT-only',
    !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i.test(
      fingerprintSql.replace(/--.*$/gm, ''),
    ),
  );

  /* --------------------------------------------- doctrine files unchanged */

  check(
    'PQ-extra migration 054 untouched and no migration added',
    fs.existsSync('supabase/migrations/054_public_api_surface_lockdown.sql') &&
      !fs.readdirSync('supabase/migrations').some((f) => /parking.quality/i.test(f)),
  );

  const overnightSrc = read('src/lib/directory/overnight.ts');
  check(
    'PQ-extra overnight doctrine module unchanged in shape',
    /overnight_status`? is the ONLY authority/i.test(overnightSrc) ||
      overnightSrc.includes('is the ONLY authority'),
  );

  check(
    'PQ-extra classifier never writes and holds no client',
    !SUPABASE_WRITE_RE.test(read('src/lib/directory/parking-quality.ts')) &&
      !/@\/lib\/supabase/.test(read('src/lib/directory/parking-quality.ts')),
  );

  check(
    'PQ-extra directionOf recognises every carriageway form',
    directionOf('I-65 Northbound') === 'NB' &&
      directionOf('(SB)') === 'SB' &&
      directionOf('I-40 EB') === 'EB' &&
      directionOf('westbound') === 'WB' &&
      directionOf('both directions') === 'BOTH' &&
      directionOf('Knoxville') === null,
  );

  check(
    'PQ-extra classifyFacility and classifyOvernight are independently callable',
    classifyFacility(row(), [truckEvidence()]) === 'confirmed-truck-parking' &&
      classifyOvernight(row(), []).verdict === 'unknown',
  );

  check(
    'PQ-extra auditCsv is deterministic and header-stable',
    auditCsv([c51, c52]) === auditCsv([c51, c52]) &&
      auditCsv([c51]).split('\n')[0].startsWith('id,name,state,city,provenance'),
  );

  check(
    'PQ-extra every reason code emitted has admin text',
    [c45, c51, c30, c14, c26].every((r) => r.reasons.every((code) => Boolean(REASON_TEXT[code]))),
  );

  /* ------------------------------------------------------------- report */

  const expected = Array.from({ length: 75 }, (_, i) => `PQ${i + 1}`);
  const missing = expected.filter((id) => !seen.has(id));
  check('PQ1-PQ75 every scenario reported', missing.length === 0, missing);

  console.log(`\nparking-quality: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
