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

console.log(`\nta-petro-audit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
