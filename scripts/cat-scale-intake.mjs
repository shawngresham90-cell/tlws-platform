/**
 * CAT Scale extraction.csv — secure LOCAL-ONLY intake, accounting and
 * read-only reconciliation (2026-07-29 milestone).
 *
 * The raw CSV is proprietary and is NEVER committed: this script reads it
 * from CAT_SCALE_CSV (a path outside the repository), verifies its SHA-256
 * against the pinned receipt value, and strips the two private columns
 * (ManagerName, FaxNumber) at the moment of parsing — they never reach any
 * output, log, or file this script writes.
 *
 * Outputs
 *   Committed (aggregates ONLY — per the owner's CAT Scale use policy,
 *   nothing tabulated from the export may be committed or published):
 *     data/imports/cat-scale-2026-07-29/ACCOUNTING.json
 *   Local only (gitignored — private/internal reconciliation and planning):
 *     data/imports/cat-scale-2026-07-29/local/RECONCILIATION.json
 *     data/imports/cat-scale-2026-07-29/local/CANADA-HELD-MANIFEST.json
 *     data/imports/cat-scale-2026-07-29/local/us-full.json
 *     data/imports/cat-scale-2026-07-29/local/reconciliation-full.json
 *
 * Read-only: this script never talks to the database. It consumes a
 * previously captured read-only snapshot of the 207 existing cat-scales
 * rows (DB_SNAPSHOT path below, also outside the repo).
 */
import { createHash } from 'node:crypto';
import { parseRouteText, hostBrand, hostStoreNumber } from './cat-scale-route-parse.mjs';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EXPECTED_SHA256 = '82d72c33bea798e3d4fdac9af4ac17c8f05f55c8ae3814253008026035b8f959';
const CSV_PATH = process.env.CAT_SCALE_CSV;
const DB_SNAPSHOT = process.env.CAT_SCALE_DB_SNAPSHOT;
const OUT_DIR = path.join(process.cwd(), 'data/imports/cat-scale-2026-07-29');
const LOCAL_DIR = path.join(OUT_DIR, 'local');

if (!CSV_PATH || !fs.existsSync(CSV_PATH)) {
  console.error(
    'CAT_SCALE_CSV is not set or does not exist. This tool is local-only by design —\n' +
      'the proprietary CSV is never committed, so CI cannot (and must not) run it.',
  );
  process.exit(2);
}

const rawBuf = fs.readFileSync(CSV_PATH);
const sha = createHash('sha256').update(rawBuf).digest('hex');
if (sha !== EXPECTED_SHA256) {
  console.error(`checksum mismatch:\n  expected ${EXPECTED_SHA256}\n  got      ${sha}`);
  process.exit(1);
}

/* ------------------------------------------------------------- CSV parse */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

const table = parseCsv(rawBuf.toString('utf8'));
const header = table[0];
const PRIVATE_COLUMNS = ['ManagerName', 'FaxNumber'];
const col = Object.fromEntries(header.map((h, i) => [h, i]));
for (const required of [
  'CATScaleNumber',
  'State',
  'InterstateCity',
  'TruckstopName',
  'InterstateAddress',
  'InterstatePostalCode',
  'PhoneNumber',
  'Latitude',
  'Longitude',
  'URL',
  ...PRIVATE_COLUMNS,
]) {
  if (!(required in col)) {
    console.error(`header drift: column ${required} missing — re-audit before proceeding`);
    process.exit(1);
  }
}

// Privacy boundary: build records WITHOUT the private columns. Nothing past
// this line can see ManagerName or FaxNumber.
const records = table.slice(1).map((r, idx) => ({
  line: idx + 2,
  catScaleNumber: (r[col.CATScaleNumber] ?? '').trim(),
  state: (r[col.State] ?? '').trim().toUpperCase(),
  city: (r[col.InterstateCity] ?? '').trim(), // source field means CITY
  hostName: (r[col.TruckstopName] ?? '').trim(), // source field means HOST FACILITY
  routeText: (r[col.InterstateAddress] ?? '').trim(), // unstructured route/address text
  postalCode: (r[col.InterstatePostalCode] ?? '').trim(),
  phone: (r[col.PhoneNumber] ?? '').trim(),
  lat: Number.parseFloat(r[col.Latitude] ?? ''),
  lng: Number.parseFloat(r[col.Longitude] ?? ''),
  url: (r[col.URL] ?? '').trim(),
}));

/* -------------------------------------------------------- US / Canada split */
const CA_PROVINCES = new Set([
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
]);
const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
    ' ',
  ),
);

// Legacy province spellings observed in the export (verified by coordinates:
// all 'MAN' rows sit in the Winnipeg area). Normalized before the split so
// Canada accounts to exactly 50.
const PROVINCE_ALIASES = { MAN: 'MB', PQ: 'QC', NF: 'NL' };
for (const r of records) if (PROVINCE_ALIASES[r.state]) r.state = PROVINCE_ALIASES[r.state];

const canada = records.filter((r) => CA_PROVINCES.has(r.state));
const us = records.filter((r) => US_STATES.has(r.state));
const unknownState = records.filter((r) => !CA_PROVINCES.has(r.state) && !US_STATES.has(r.state));

/* ------------------------------------------------------------ route parse */
// Shared, side-effect-free parser module (also exercised by the CI harness).
const normCity = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

/* --------------------------------------------------------------- accounting */
const nonBlankNumbers = records.filter((r) => r.catScaleNumber !== '');
const numberSet = new Set(nonBlankNumbers.map((r) => r.catScaleNumber));
const dupNumbers = nonBlankNumbers.length - numberSet.size;
const validCoord = (r) =>
  Number.isFinite(r.lat) &&
  Number.isFinite(r.lng) &&
  Math.abs(r.lat) <= 90 &&
  Math.abs(r.lng) <= 180 &&
  !(r.lat === 0 && r.lng === 0);
const usValidCoords = us.filter(validCoord).length;
const caValidCoords = canada.filter(validCoord).length;

const usParsed = us.map((r) => ({ ...r, parse: parseRouteText(r.routeText) }));
const routeClassCounts = {};
for (const r of usParsed)
  routeClassCounts[r.parse.routeClass] = (routeClassCounts[r.parse.routeClass] ?? 0) + 1;

const stateCounts = {};
for (const r of us) stateCounts[r.state] = (stateCounts[r.state] ?? 0) + 1;
const interstateCounts = {};
for (const r of usParsed)
  if (r.parse.routeClass === 'interstate')
    interstateCounts[r.parse.route] = (interstateCounts[r.parse.route] ?? 0) + 1;

// Multi-scale complexes: >1 scale number at the same host+city+state.
const complexKey = (r) =>
  `${hostBrand(r.hostName) ?? r.hostName.toLowerCase()}|${hostStoreNumber(r.hostName) ?? ''}|${normCity(r.city)}|${r.state}`;
const complexGroups = new Map();
for (const r of usParsed) {
  const k = complexKey(r);
  if (!complexGroups.has(k)) complexGroups.set(k, []);
  complexGroups.get(k).push(r);
}
const multiScaleComplexes = [...complexGroups.values()].filter((g) => g.length > 1);

/* ------------------------------------------------------- reconciliation */
if (!DB_SNAPSHOT || !fs.existsSync(DB_SNAPSHOT)) {
  console.error('CAT_SCALE_DB_SNAPSHOT missing — run the read-only DB capture first.');
  process.exit(2);
}
const dbRows = JSON.parse(fs.readFileSync(DB_SNAPSHOT, 'utf8'));
const dbByStateExit = new Map();
for (const d of dbRows) {
  if (d.interstate && d.exit) {
    const k = `${d.state}|${d.interstate}|${String(d.exit).trim().toUpperCase()}`;
    if (!dbByStateExit.has(k)) dbByStateExit.set(k, []);
    dbByStateExit.get(k).push(d);
  }
}

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.7613;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// NOTE: no production row stores a CAT Scale number (audited 2026-07-29;
// host store numbers like "Love's #368" are NOT scale numbers and are never
// used as such). Exact-number matching therefore yields zero by definition;
// identity matching uses state+interstate+exit, host brand/store, city, zip
// and coordinate proximity.
const classified = [];
for (const r of usParsed) {
  const brand = hostBrand(r.hostName);
  const store = hostStoreNumber(r.hostName);
  let cls = null;
  let matched = null;
  let via = null;

  if (r.catScaleNumber === '' || !US_STATES.has(r.state)) {
    cls = 'quarantined';
    via = 'missing scale number or state';
  } else if (!validCoord(r)) {
    cls = 'quarantined';
    via = 'invalid coordinates';
  } else {
    // Key 1: state + interstate + exit.
    const candidates = [];
    if (r.parse.routeClass === 'interstate' && r.parse.exit) {
      const k = `${r.state}|${r.parse.route}|${r.parse.exit}`;
      for (const d of dbByStateExit.get(k) ?? [])
        candidates.push({ d, via: 'state+interstate+exit' });
    }
    // Key 2: brand/store + city + state.
    for (const d of dbRows) {
      if (d.state !== r.state) continue;
      const dBrand = hostBrand(d.name);
      const dStore = hostStoreNumber(d.name);
      if (
        brand &&
        dBrand === brand &&
        (normCity(d.city) === normCity(r.city) || (store && dStore === store))
      ) {
        if (!candidates.some((c) => c.d.id === d.id))
          candidates.push({ d, via: 'brand+city/store' });
      }
    }
    // Key 3: coordinate proximity (DB rows with coords only).
    for (const d of dbRows) {
      if (d.lat == null || d.state !== r.state) continue;
      if (milesBetween(r.lat, r.lng, d.lat, d.lng) <= 0.5) {
        if (!candidates.some((c) => c.d.id === d.id))
          candidates.push({ d, via: 'proximity<=0.5mi' });
      }
    }

    const distinct = [...new Map(candidates.map((c) => [c.d.id, c])).values()];
    if (distinct.length === 0) {
      cls = 'net-new';
    } else if (distinct.length === 1) {
      const { d, via: v } = distinct[0];
      const dBrand = hostBrand(d.name);
      if (brand && dBrand && brand !== dBrand) {
        cls = 'identity-conflict';
        via = `${v}; brand mismatch ${brand} vs ${dBrand}`;
        matched = d.id;
      } else {
        // One production row, brands agree (or one side brandless).
        const enrichable = d.lat == null; // 175 of 207 rows lack coordinates
        cls = enrichable ? 'enrichment-candidate' : 'exact-match';
        via = v;
        matched = d.id;
      }
    } else {
      cls = 'possible-duplicate';
      via = distinct.map((c) => c.via).join(' & ');
      matched = distinct.map((c) => c.d.id).join(',');
    }
  }
  classified.push({ r, cls, matched, via });
}

// Multi-scale complexes stay legitimate: rows in a >1 group that classified
// identically onto the SAME production row are re-labeled multi-scale (they
// are separate scales at one complex, not duplicates of each other).
const byMatch = new Map();
for (const c of classified) {
  if (!c.matched || c.matched.includes(',')) continue;
  if (!byMatch.has(c.matched)) byMatch.set(c.matched, []);
  byMatch.get(c.matched).push(c);
}
for (const group of byMatch.values()) {
  if (group.length > 1) for (const c of group) c.cls = 'multi-scale-complex';
}

const classCounts = {};
for (const c of classified) classCounts[c.cls] = (classCounts[c.cls] ?? 0) + 1;

/* ------------------------------------------------------------- outputs */
fs.mkdirSync(LOCAL_DIR, { recursive: true });

const accounting = {
  generatedFrom: { sha256: EXPECTED_SHA256, records: records.length },
  totals: {
    all: records.length,
    us: us.length,
    canadaHeld: canada.length,
    unknownState: unknownState.length,
    uniqueNonBlankScaleNumbers: numberSet.size,
    blankScaleNumbers: records.length - nonBlankNumbers.length,
    duplicateScaleNumbers: dupNumbers,
    usValidCoords,
    canadaValidCoords: caValidCoords,
  },
  privacy: {
    strippedColumns: PRIVATE_COLUMNS,
    note: 'ManagerName and FaxNumber are dropped at parse time and appear in no output.',
  },
  usRouteClasses: routeClassCounts,
  usStateCounts: stateCounts,
  usInterstateCounts: interstateCounts,
  multiScaleComplexes: {
    complexes: multiScaleComplexes.length,
    scalesInvolved: multiScaleComplexes.reduce((n, g) => n + g.length, 0),
  },
  reconciliation: classCounts,
};
fs.writeFileSync(path.join(OUT_DIR, 'ACCOUNTING.json'), JSON.stringify(accounting, null, 2));

// Safe committed manifest: scale number → class only (no names, cities,
// coordinates, addresses or phones — does not reproduce the dataset).
const safeReconciliation = Object.fromEntries(
  classified.map((c) => [
    c.r.catScaleNumber,
    c.matched ? { class: c.cls, matchedLocationId: c.matched } : { class: c.cls },
  ]),
);
fs.writeFileSync(
  path.join(LOCAL_DIR, 'RECONCILIATION.json'),
  JSON.stringify({ sha256: EXPECTED_SHA256, us: safeReconciliation }, null, 2),
);

// Canada-held manifest (50 rows expected): identity fields only.
fs.writeFileSync(
  path.join(LOCAL_DIR, 'CANADA-HELD-MANIFEST.json'),
  JSON.stringify(
    {
      decision:
        'All Canadian rows are excluded from US import candidates, coverage totals, launch gates and runtime results. Held for possible future expansion. No Canadian import is authorized.',
      count: canada.length,
      rows: canada.map((r) => ({
        catScaleNumber: r.catScaleNumber,
        province: r.state,
        city: r.city,
        host: r.hostName,
      })),
    },
    null,
    2,
  ),
);

// Full detail stays LOCAL (gitignored) for the future authorized import.
fs.writeFileSync(path.join(LOCAL_DIR, 'us-full.json'), JSON.stringify(usParsed, null, 1));
fs.writeFileSync(
  path.join(LOCAL_DIR, 'reconciliation-full.json'),
  JSON.stringify(
    classified.map((c) => ({ ...c.r, class: c.cls, matched: c.matched, via: c.via })),
    null,
    1,
  ),
);

console.log(JSON.stringify(accounting.totals, null, 2));
console.log('route classes:', JSON.stringify(routeClassCounts));
console.log('reconciliation:', JSON.stringify(classCounts));
console.log(
  'multi-scale complexes:',
  multiScaleComplexes.length,
  'covering',
  accounting.multiScaleComplexes.scalesInvolved,
  'scales',
);
console.log('unknown-state rows:', unknownState.length);
