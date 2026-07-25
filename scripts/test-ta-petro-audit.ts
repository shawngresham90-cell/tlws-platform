/**
 * TA/Petro audit tests (offline, no network, no DB).
 * Covers state normalization, conservative amenity mapping (no invented
 * Wi-Fi/Restrooms/Security/CAT-Scale), the four verdicts, and determinism.
 */
import {
  normalizeState,
  mapAmenities,
  mapRow,
  auditRows,
  disposeRows,
  OTHER_BRANDS,
  type ProdRow,
  type WorkbookRow,
} from './imports/ta-petro-audit';

let passed = 0,
  failed = 0;
const check = (n: string, c: boolean, d?: unknown) => {
  if (c) passed++;
  else {
    failed++;
    console.log('FAIL:', n, d ?? '');
  }
};

/* state normalization */
check('state: full name → code', normalizeState('Pennsylvania') === 'PA');
check('state: code passthrough', normalizeState('tn') === 'TN');
check('state: District of Columbia', normalizeState('District of Columbia') === 'DC');
check('state: unknown → empty', normalizeState('Ontario') === '');
check('state: blank → empty', normalizeState('') === '');

/* conservative amenity mapping */
const full: WorkbookRow = {
  Showers: 11,
  'Full Service Restaurant': 'Fuddruckers',
  'QSR(s)': null,
  'Total Diesel Dispensers/Lanes': 8,
  'Laundry Room': 'y',
  'Service Bays': 4,
  'Weigh Scale': 1,
  'Courtesy Wifi In Restaurant Fast Food Area': null,
};
const a = mapAmenities(full);
check('amenity: Showers from count', a.includes('Showers'));
check('amenity: Food from restaurant', a.includes('Food'));
check('amenity: Fuel from diesel lanes', a.includes('Fuel'));
check('amenity: Laundry from y', a.includes('Laundry'));
check('amenity: Repair from service bays', a.includes('Repair'));
check('amenity: Wi-Fi NEVER set (no source data)', !a.includes('Wi-Fi'));
check('amenity: Restrooms NEVER set (no column)', !a.includes('Restrooms'));
check('amenity: Security NEVER set (no column)', !a.includes('Security'));
check('amenity: CAT Scale NEVER asserted from generic Weigh Scale', !a.includes('CAT Scale'));
check('scalePresent recorded separately', mapRow(full).scalePresent === true);
check(
  'amenity: zero showers → no Showers',
  !mapAmenities({ ...full, Showers: 0 }).includes('Showers'),
);
check('amenity: QSR alone gives Food', mapAmenities({ 'QSR(s)': 'Subway' }).includes('Food'));
check('amenity: empty row → none', mapAmenities({}).length === 0);

/* verdicts */
const prod: ProdRow[] = [
  {
    id: 'p1',
    name: 'TA Ashland',
    address: '100 North Carter Rd',
    city: 'Ashland',
    state: 'VA',
    lat: 37.7598,
    lng: -77.4631,
    type: 'truck_stop',
  },
  {
    id: 'p2',
    name: 'Petro Knoxville',
    address: '999 Other Rd',
    city: 'Knoxville',
    state: 'TN',
    lat: 35.9,
    lng: -84.1,
    type: 'truck_stop',
  },
];
const base = {
  Brand: 'TA',
  'Site ID': 'X',
  Location: 'TA Nowhere',
  Address: '1 New Rd',
  City: 'Nowhereville',
  State: 'Texas',
  Zipcode: '75001',
  Phone: '214-555-0100',
  Latitude: 32.9,
  Longitude: -96.8,
  'Total Diesel Dispensers/Lanes': 8,
};

const res = auditRows(
  [
    {
      ...base,
      Location: 'TA Ashland',
      City: 'Ashland',
      State: 'Virginia',
      Address: '100 North Carter Rd',
      Latitude: 37.7598,
      Longitude: -77.4631,
    }, // exact dup key
    { ...base, Location: 'TA Somewhere Else', City: 'Knoxville', State: 'Tennessee' }, // same-operator city
    { ...base }, // net-new
    { ...base, Brand: 'Goasis' }, // non-core brand
    { ...base, State: 'Ontario' }, // bad state
  ],
  prod,
);

check(
  'verdict: exact dup key → existing-match',
  res[0].verdict === 'existing-match',
  res[0].reasons,
);
check(
  'verdict: same-operator city → probable-duplicate',
  res[1].verdict === 'probable-duplicate',
  res[1].reasons,
);
check(
  'verdict: clean new row → net-new-candidate',
  res[2].verdict === 'net-new-candidate',
  res[2].reasons,
);
check(
  'verdict: non-core brand → rejected-or-ambiguous',
  res[3].verdict === 'rejected-or-ambiguous',
);
check('verdict: bad state → rejected-or-ambiguous', res[4].verdict === 'rejected-or-ambiguous');
check('existing-match records matched id', res[0].matchedId === 'p1');
check('coordinates preserved as supplied', res[2].lat === 32.9 && res[2].lng === -96.8);
check('state normalized in output', res[2].state === 'TX');

/* in-workbook duplicate detection */
const dupRes = auditRows([{ ...base }, { ...base }], prod);
check(
  'in-workbook duplicate flagged',
  dupRes[1].verdict === 'rejected-or-ambiguous' &&
    dupRes[1].reasons.some((r) => r.startsWith('duplicate-within-workbook')),
);

/* determinism */
check(
  'deterministic rerun',
  JSON.stringify(auditRows([{ ...base }], prod)) === JSON.stringify(auditRows([{ ...base }], prod)),
);

/* ---- approved disposition rules ---- */
const dprod: ProdRow[] = [
  {
    id: 'm1',
    name: 'TA Somewhere #151',
    address: '1 Same Rd',
    city: 'Town',
    state: 'TX',
    lat: null,
    lng: null,
    type: 'truck_stop',
  },
  {
    id: 'm2',
    name: 'CAT Scale at TA Elsewhere',
    address: '2 Other Rd',
    city: 'Elseville',
    state: 'TX',
    lat: null,
    lng: null,
    type: 'other',
  },
  {
    id: 'm3',
    name: 'TA Exact',
    address: '3 Exact Rd',
    city: 'Exactville',
    state: 'TX',
    lat: null,
    lng: null,
    type: 'truck_stop',
  },
];
const dmap = new Map(dprod.map((p) => [p.id, { ...p, blanks: ['lat/lng', 'parking_spaces'] }]));
const dbase = {
  Brand: 'TA',
  'Site ID': 'D',
  Address: '1 Same Rd',
  City: 'Town',
  State: 'Texas',
  Zipcode: '75001',
  Latitude: 32.9,
  Longitude: -96.8,
  'Total Diesel Dispensers/Lanes': 8,
};

const d1 = disposeRows(auditRows([{ ...dbase, Location: 'TA Somewhere' }], dprod), dmap);
check(
  'dispose: same-type addr match, name differs → manual-review-merge',
  d1[0].disposition === 'manual-review-merge',
  d1[0],
);
check(
  'dispose: fillable blanks surfaced from existing record',
  d1[0].fillableBlanks.includes('lat/lng'),
);

const d2 = disposeRows(
  auditRows(
    [{ ...dbase, Location: 'TA Elsewhere', Address: '2 Other Rd', City: 'Elseville' }],
    dprod,
  ),
  dmap,
);
check(
  'dispose: different-category co-located match → keep-separate',
  d2[0].disposition === 'keep-separate',
  d2[0],
);
check('dispose: keep-separate proposes no field fills', d2[0].fillableBlanks.length === 0);

// Exact name+city+state is intercepted by the canonical dup key BEFORE any
// merge tier, so it lands in existing-match (the importer drops the row).
// Because the address signal also requires city+state equality, the
// 'exact-merge' tier is unreachable by construction — documented, not assumed.
const d3 = disposeRows(
  auditRows([{ ...dbase, Location: 'TA Exact', Address: '3 Exact Rd', City: 'Exactville' }], dprod),
  dmap,
);
check(
  'dispose: exact name+city+state → existing-match (dup key intercepts first)',
  d3[0].disposition === 'existing-match',
  d3[0].disposition,
);
check(
  'dispose: exact-merge tier is unreachable via probable-duplicate',
  d3[0].disposition !== 'exact-merge',
);

const d4 = disposeRows(
  auditRows([{ ...dbase, Brand: 'Goasis', Location: 'Goasis X', City: 'Nowhere' }], dprod),
  dmap,
);
check('dispose: Goasis → other-pending-category', d4[0].disposition === 'other-pending-category');
const d5 = disposeRows(
  auditRows([{ ...dbase, Brand: 'Thorntons', Location: 'Thorntons X', City: 'Nowhere' }], dprod),
  dmap,
);
check(
  'dispose: Thorntons → other-pending-category',
  d5[0].disposition === 'other-pending-category',
);
check(
  'dispose: non-core brands never enter the truck-stop import set',
  d4[0].disposition !== 'net-new' && d5[0].disposition !== 'net-new',
);
check(
  'OTHER_BRANDS holds exactly Goasis + Thorntons',
  OTHER_BRANDS.size === 2 && OTHER_BRANDS.has('GOASIS') && OTHER_BRANDS.has('THORNTONS'),
);

const d6 = disposeRows(
  auditRows([{ ...dbase, Location: 'TA Brand New', City: 'Freshtown' }], dprod),
  dmap,
);
check('dispose: unmatched row → net-new', d6[0].disposition === 'net-new');
check(
  'dispose: CAT Scale never asserted in any disposition',
  [...d1, ...d2, ...d3, ...d4, ...d5, ...d6].every((r) => !r.amenities.includes('CAT Scale')),
);
check(
  'dispose: deterministic',
  JSON.stringify(disposeRows(auditRows([{ ...dbase, Location: 'TA Somewhere' }], dprod), dmap)) ===
    JSON.stringify(disposeRows(auditRows([{ ...dbase, Location: 'TA Somewhere' }], dprod), dmap)),
);

console.log(`\nta-petro-audit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
