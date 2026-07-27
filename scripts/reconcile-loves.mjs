/**
 * Love's intake — steps 2-6 of data/imports/nationwide-parking-2026-07-26/INTAKE-PROCESS.md.
 *
 * READ-ONLY against the source file, and it touches no database: the existing
 * directory rows are supplied as a committed snapshot exported by a read-only
 * query (DB-SNAPSHOT.tsv), so this is reproducible offline and in CI.
 *
 * Written AFTER the real file arrived, against its real headers — per the
 * intake rule that no parser is built speculatively.
 *
 * Emits, into data/sources/loves-master/2026-07-27/:
 *   PROFILE.json        what the file actually contains
 *   normalized.csv      the parsed + normalized rows
 *   RECONCILIATION.csv  update / net-new / conflict per store
 *   quarantine.csv      everything refused, with an exact reason
 *
 * Run: node scripts/reconcile-loves.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DIR = 'data/sources/loves-master/2026-07-27';
const XLSX = `${DIR}/LovesSearchResults.xlsx`;

/* ---- checksum the raw file every run: the parse is only valid for this file */
const EXPECTED_SHA = 'ec5146ee475af473d037ed4913e4f9b4c1059c737581ff93d2b2eefcc5a89ab2';
const sha = createHash('sha256').update(readFileSync(XLSX)).digest('hex');
if (sha !== EXPECTED_SHA) {
  console.error(`Source file checksum changed.\n  expected ${EXPECTED_SHA}\n  got      ${sha}`);
  console.error('Re-profile before trusting any mapping. Refusing to continue.');
  process.exit(1);
}

/* ---- read the sheet via python/openpyxl (no JS xlsx dependency in this repo) */
const raw = execFileSync(
  'python3',
  [
    '-c',
    `
import openpyxl, json, sys
wb = openpyxl.load_workbook(${JSON.stringify(XLSX)}, read_only=True, data_only=True)
ws = wb["Love's Locations"]
rows = list(ws.iter_rows(values_only=True))
hdr = [h for h in rows[2]]
out = []
for r in rows[3:]:
    out.append({h: r[i] for i, h in enumerate(hdr) if h})
sys.stdout.write(json.dumps({"header": [h for h in hdr if h], "rows": out}))
`,
  ],
  { maxBuffer: 1 << 28, encoding: 'utf8' },
);
const { header, rows } = JSON.parse(raw);

/* ------------------------------------------------------------------ profile */
const counter = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const profile = {
  source_file: 'LovesSearchResults.xlsx',
  sha256: sha,
  sheet: "Love's Locations",
  header_row_index: 2,
  columns: header.length,
  data_rows: rows.length,
  store_type: Object.fromEntries(counter(rows.map((r) => r.StoreType))),
  states: [...new Set(rows.map((r) => r.State))].sort(),
  coordinate_range: {
    lat: [Math.min(...rows.map((r) => r.Latitude)), Math.max(...rows.map((r) => r.Latitude))],
    lng: [Math.min(...rows.map((r) => r.Longitude)), Math.max(...rows.map((r) => r.Longitude))],
  },
  null_rates: Object.fromEntries(
    [
      'StoreNumber',
      'State',
      'City',
      'Address',
      'Zip',
      'Latitude',
      'Longitude',
      'ParkingSpaces',
    ].map((c) => [c, rows.filter((r) => r[c] === null || r[c] === undefined).length]),
  ),
  // Columns the acquisition manifest asked for that this export does NOT carry.
  missing_expected_columns: ['name', 'status'],
};

/* --------------------------------------------------------------- normalize */
// Love's ships no name column, so the name is DERIVED and that is recorded.
// Store type drives it: a Truck Service site is not a "Travel Stop".
const NAME_BY_TYPE = {
  'Travel Stop': (n) => `Love's Travel Stop #${n}`,
  'Country Store': (n) => `Love's Country Store #${n}`,
  'Truck Service': (n) => `Love's Truck Care #${n}`,
  'Car Stop': (n) => `Love's Car Stop #${n}`,
  'Service Center': (n) => `Love's Service Center #${n}`,
};

const corridorOf = (hwy) => {
  const m = /^(I-\d{1,3})\b/.exec(String(hwy ?? '').trim());
  return m ? m[1] : null;
};
const exitOf = (hwy) => {
  const m = /^I-\d{1,3}\s*\/\s*(.+)$/.exec(String(hwy ?? '').trim());
  return m ? m[1].trim() : null;
};
const yn = (v) => (v === 'Y' ? true : v === 'N' ? false : null);

const normalized = rows.map((r) => ({
  source_ref: String(r.StoreNumber),
  name: (NAME_BY_TYPE[r.StoreType] ?? ((n) => `Love's #${n}`))(r.StoreNumber),
  store_type: r.StoreType,
  address: (r.Address ?? '').trim(),
  city: (r.City ?? '').trim(),
  state: (r.State ?? '').trim().toUpperCase(),
  zip: String(r.Zip ?? '').trim(),
  lat: num(r.Latitude),
  lng: num(r.Longitude),
  interstate: corridorOf(r.HighwayOrExit),
  exit_number: exitOf(r.HighwayOrExit),
  // Only what the source states. Absent stays null — never 0, never a default.
  parking_spaces: num(r.ParkingSpaces),
  overnight_parking: yn(r.overnightparking),
  showers: yn(r.privateshowers),
  cat_scale: yn(r.catscales),
  // Fuel prices are deliberately NOT carried: the file stamps them to a single
  // minute and they would be stale before the page rendered.
}));

/* ============================ THE TWO SEPARATE GATES ======================= */
//
// Gate 2a — DIRECTORY coverage:  615 active Travel Stops.
// Gate 2b — OVERNIGHT coverage:  604 of those with overnightparking = Y.
//
// They are deliberately not the same number and must never be reported as one.
// The 11 Travel Stops flagged overnightparking = N are real Love's locations
// and belong in the directory as truck stops — but must NEVER be offered as
// overnight / HOS-rest parking. #201 Elk City also states 0 spaces, so it does
// not qualify as parking of any kind.
//
// Everything that is not a Travel Stop (Country Store, Truck Service, Car Stop,
// Service Center) is outside the directory-coverage universe for this gate and
// is quarantined with a reason.

const travelStops = normalized.filter((n) => n.store_type === 'Travel Stop');
const nonDirectory = normalized.filter((n) => n.store_type !== 'Travel Stop');

const coordOk = (n) =>
  n.lat !== null &&
  n.lng !== null &&
  n.lat !== 0 &&
  n.lng !== 0 &&
  n.lat >= 24 &&
  n.lat <= 49.5 &&
  n.lng >= -125 &&
  n.lng <= -66.5;

const overnightEligible = (n) => n.overnight_parking === true && n.parking_spaces > 0;

const overnight = travelStops.filter((n) => overnightEligible(n) && coordOk(n));
const nonOvernight = travelStops.filter((n) => !overnightEligible(n));

// Quarantine: never silently dropped, always with an exact reason.
const quarantine = [
  ...nonDirectory.map((n) => ({
    ...n,
    quarantine_reason: `not-a-travel-stop:${n.store_type}; outside-loves-directory-coverage-gate`,
  })),
  ...nonOvernight.map((n) => ({
    ...n,
    quarantine_reason:
      n.parking_spaces === 0
        ? 'overnight-parking-not-permitted; zero-stated-spaces; IN DIRECTORY as truck stop, NEVER as parking'
        : 'overnight-parking-not-permitted; IN DIRECTORY as truck stop, NEVER as overnight parking',
  })),
];

/* --------------------------- reconcile against the committed DB snapshot */
// Snapshot columns: id, store_number, state, city, category_slug, published, has_coord, name
const snap = readFileSync(`${DIR}/DB-SNAPSHOT.tsv`, 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .map((l) => {
    const [id, store_number, state, city, category_slug, published, has_coord, name] =
      l.split('\t');
    return { id, store_number, state, city, category_slug, published, has_coord, name };
  });

// Rows whose name starts with another brand carry that brand's numbering, not
// a Love's store number (e.g. "Boss Truck Shop #40 (at Love's)"). Excluded from
// the store-number join so they cannot produce a phantom match.
const FOREIGN_BRAND = /^(boss truck shop|speedco)\b/i;
const byStore = new Map();
for (const s of snap) {
  if (!s.store_number || FOREIGN_BRAND.test(s.name)) continue;
  byStore.set(s.store_number, [...(byStore.get(s.store_number) ?? []), s]);
}

// THE MAP-PIN RULE. Exactly one DB row per physical Love's carries the
// coordinate: the `truck-stops` row. CAT scale, truck care, truck wash and
// roadside rows at the same address are reconciled as service records and get
// NO coordinate, so the coordinate-collision guard is never weakened and the
// map never shows two pins for one site.
const MAP_PIN_CATEGORY = 'truck-stops';

const directory = [];
const conflicts = [];
const enrichment = []; // matched truck-stops row -> gets the coordinate
const serviceRows = []; // colocated service rows -> reconciled, no coordinate
const netNew = [];

for (const t of travelStops) {
  const hits = byStore.get(t.source_ref) ?? [];
  const overnight_ok = overnightEligible(t);

  if (!hits.length) {
    directory.push({
      ...t,
      overnight_eligible: overnight_ok,
      disposition: 'net-new',
      db_ids: '',
      note: '',
    });
    netNew.push({ ...t, overnight_eligible: overnight_ok });
    continue;
  }

  const states = [...new Set(hits.map((h) => h.state))];
  if (states.length > 1 || !states.includes(t.state)) {
    conflicts.push({
      source_ref: t.source_ref,
      source_state: t.state,
      source_city: t.city,
      db_states: states.join('+'),
      db_rows: hits.map((h) => `${h.id}:${h.state}/${h.city}:${h.name}`).join(' || '),
      conflict: states.includes(t.state)
        ? 'store-number-used-in-multiple-states'
        : 'store-number-state-mismatch',
    });
  }

  const matched = hits.filter((h) => h.state === t.state);
  if (!matched.length) {
    directory.push({
      ...t,
      overnight_eligible: overnight_ok,
      disposition: 'net-new-state-conflict',
      db_ids: '',
      note: 'store number resolves to a different state in the DB',
    });
    continue;
  }

  const pin = matched.filter((h) => h.category_slug === MAP_PIN_CATEGORY);
  const services = matched.filter((h) => h.category_slug !== MAP_PIN_CATEGORY);

  for (const p of pin) {
    enrichment.push({
      db_id: p.id,
      source_ref: t.source_ref,
      name: p.name,
      state: t.state,
      city: t.city,
      lat: t.lat,
      lng: t.lng,
      interstate: t.interstate ?? '',
      exit_number: t.exit_number ?? '',
      parking_spaces: t.parking_spaces,
      overnight_eligible: overnight_ok,
      currently_published: p.published,
      currently_has_coord: p.has_coord,
      receives_map_pin: true,
    });
  }
  for (const sv of services) {
    serviceRows.push({
      db_id: sv.id,
      source_ref: t.source_ref,
      name: sv.name,
      category_slug: sv.category_slug,
      state: sv.state,
      city: sv.city,
      currently_published: sv.published,
      receives_map_pin: false,
      note: "colocated service record at the same Love's site — reconciled, no coordinate, no second map pin",
    });
  }

  directory.push({
    ...t,
    overnight_eligible: overnight_ok,
    disposition: pin.length ? 'update-existing' : 'net-new-pin-missing',
    db_ids: matched.map((h) => h.id).join(' '),
    note: services.length ? `${services.length} colocated service row(s), no map pin` : '',
  });
}

/* ------------------------------------------------------------------- write */
const csv = (rowsIn, cols) =>
  [
    cols.join(','),
    ...rowsIn.map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? '';
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    ),
  ].join('\n') + '\n';

const NORM_COLS = [
  'source_ref',
  'name',
  'store_type',
  'address',
  'city',
  'state',
  'zip',
  'lat',
  'lng',
  'interstate',
  'exit_number',
  'parking_spaces',
  'overnight_parking',
  'showers',
  'cat_scale',
];

writeFileSync(`${DIR}/PROFILE.json`, JSON.stringify(profile, null, 2) + '\n');
writeFileSync(`${DIR}/normalized.csv`, csv(normalized, NORM_COLS));
writeFileSync(`${DIR}/quarantine.csv`, csv(quarantine, [...NORM_COLS, 'quarantine_reason']));
writeFileSync(
  `${DIR}/DIRECTORY-615.csv`,
  csv(directory, [...NORM_COLS, 'overnight_eligible', 'disposition', 'db_ids', 'note']),
);
writeFileSync(`${DIR}/OVERNIGHT-604.csv`, csv(overnight, NORM_COLS));
writeFileSync(
  `${DIR}/NON-OVERNIGHT-11.csv`,
  csv(
    nonOvernight.map((n) => ({
      ...n,
      directory_representation: 'truck stop',
      parking_representation: 'NONE — never offered as overnight/HOS-rest parking',
    })),
    [...NORM_COLS, 'directory_representation', 'parking_representation'],
  ),
);
writeFileSync(`${DIR}/NET-NEW.csv`, csv(netNew, [...NORM_COLS, 'overnight_eligible']));
writeFileSync(
  `${DIR}/ENRICHMENT-PLAN.csv`,
  csv(enrichment, [
    'db_id',
    'source_ref',
    'name',
    'state',
    'city',
    'lat',
    'lng',
    'interstate',
    'exit_number',
    'parking_spaces',
    'overnight_eligible',
    'currently_published',
    'currently_has_coord',
    'receives_map_pin',
  ]),
);
writeFileSync(
  `${DIR}/COLOCATED-SERVICE-ROWS.csv`,
  csv(serviceRows, [
    'db_id',
    'source_ref',
    'name',
    'category_slug',
    'state',
    'city',
    'currently_published',
    'receives_map_pin',
    'note',
  ]),
);
writeFileSync(
  `${DIR}/CONFLICTS.csv`,
  csv(conflicts, ['source_ref', 'source_state', 'source_city', 'db_states', 'conflict', 'db_rows']),
);

/* ------------------------------------------------------------------ report */
const by = (xs, f) => Object.fromEntries([...counter(xs.map(f))].sort((a, b) => b[1] - a[1]));
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

console.log(`source rows                       ${normalized.length}`);
console.log(`GATE 2a directory (Travel Stops)  ${travelStops.length}`);
console.log(`GATE 2b overnight-parking         ${overnight.length}`);
console.log(
  `  non-overnight Travel Stops      ${nonOvernight.length}  (directory yes, parking never)`,
);
console.log(`  outside directory gate          ${nonDirectory.length}`);
console.log(`quarantined (with reason)         ${quarantine.length}`);
console.log(`\ndirectory dispositions:`);
for (const [k, v] of Object.entries(by(directory, (r) => r.disposition)))
  console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log(`\nenrichment plan (map pins)        ${enrichment.length}`);
console.log(`colocated service rows (no pin)   ${serviceRows.length}`);
console.log(`net-new                           ${netNew.length}`);
console.log(`\nconflicts: ${conflicts.length}`);
for (const c of conflicts)
  console.log(
    `  #${c.source_ref} source=${c.source_state}/${c.source_city} db=${c.db_states} [${c.conflict}]`,
  );
console.log(`\ncoverage:`);
console.log(`  states (directory)   ${new Set(travelStops.map((t) => t.state)).size}`);
console.log(`  states (overnight)   ${new Set(overnight.map((t) => t.state)).size}`);
console.log(
  `  corridors (overnight)${new Set(overnight.map((t) => t.interstate).filter(Boolean)).size}`,
);
console.log(`  stated spaces        ${sum(overnight, (t) => t.parking_spaces)}`);
console.log(
  `\nintegrity: ${travelStops.length} = ${overnight.length} overnight + ${nonOvernight.length} non-overnight ` +
    `-> ${overnight.length + nonOvernight.length === travelStops.length ? 'OK' : 'MISMATCH'}`,
);
console.log(
  `           ${normalized.length} = ${travelStops.length} travel stops + ${nonDirectory.length} other ` +
    `-> ${travelStops.length + nonDirectory.length === normalized.length ? 'OK' : 'MISMATCH'}`,
);
