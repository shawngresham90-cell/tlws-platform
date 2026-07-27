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

/* --------------------------------------------- eligibility (the parking gate) */
// Truck parking requires BOTH an explicit space count > 0 AND the operator's
// own overnight-parking flag. Neither alone is sufficient, and a store type
// that is not a Travel Stop is not truck parking however it is flagged.
const quarantine = [];
const eligible = [];
for (const n of normalized) {
  const reasons = [];
  if (n.store_type !== 'Travel Stop') reasons.push(`store-type-not-travel-stop:${n.store_type}`);
  if (!(n.parking_spaces > 0)) reasons.push('no-stated-truck-parking-spaces');
  if (n.overnight_parking !== true) reasons.push('overnight-parking-not-confirmed');
  if (n.lat === null || n.lng === null || n.lat === 0 || n.lng === 0)
    reasons.push('no-usable-coordinate');
  if (n.lat < 24 || n.lat > 49.5 || n.lng < -125 || n.lng > -66.5)
    reasons.push('coordinate-outside-continental-envelope');
  if (reasons.length) quarantine.push({ ...n, quarantine_reason: reasons.join('; ') });
  else eligible.push(n);
}

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

const byStore = new Map();
for (const s of snap) {
  if (!s.store_number) continue;
  byStore.set(s.store_number, [...(byStore.get(s.store_number) ?? []), s]);
}

const recon = [];
const conflicts = [];
for (const e of eligible) {
  const hits = byStore.get(e.source_ref) ?? [];
  if (!hits.length) {
    recon.push({ ...e, disposition: 'net-new', db_ids: '', note: '' });
    continue;
  }
  // A store number that resolves to more than one state is a defect in OUR
  // data: Love's store numbers are globally unique.
  const states = [...new Set(hits.map((h) => h.state))];
  if (states.length > 1 || !states.includes(e.state)) {
    conflicts.push({
      source_ref: e.source_ref,
      source_state: e.state,
      source_city: e.city,
      db_states: states.join('+'),
      db_rows: hits.map((h) => `${h.id}:${h.state}/${h.city}:${h.name}`).join(' || '),
      conflict: states.includes(e.state)
        ? 'store-number-used-in-multiple-states'
        : 'store-number-state-mismatch',
    });
  }
  const matched = hits.filter((h) => h.state === e.state);
  recon.push({
    ...e,
    disposition: matched.length ? 'update-existing' : 'net-new-state-conflict',
    db_ids: matched.map((h) => h.id).join(' '),
    note: matched.length > 1 ? `${matched.length} colocated DB rows share this site` : '',
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
  `${DIR}/RECONCILIATION.csv`,
  csv(recon, [...NORM_COLS, 'disposition', 'db_ids', 'note']),
);
writeFileSync(
  `${DIR}/CONFLICTS.csv`,
  csv(conflicts, ['source_ref', 'source_state', 'source_city', 'db_states', 'conflict', 'db_rows']),
);

/* ------------------------------------------------------------------ report */
const by = (xs, f) => Object.fromEntries([...counter(xs.map(f))].sort((a, b) => b[1] - a[1]));
console.log(`source rows          ${normalized.length}`);
console.log(`eligible truck parking ${eligible.length}`);
console.log(`quarantined          ${quarantine.length}`);
console.log(`\nquarantine reasons:`);
for (const [k, v] of Object.entries(by(quarantine, (q) => q.quarantine_reason)))
  console.log(`  ${v.toString().padStart(4)}  ${k}`);
console.log(`\ndispositions:`);
for (const [k, v] of Object.entries(by(recon, (r) => r.disposition)))
  console.log(`  ${v.toString().padStart(4)}  ${k}`);
console.log(`\nconflicts: ${conflicts.length}`);
for (const c of conflicts)
  console.log(
    `  #${c.source_ref} source=${c.source_state}/${c.source_city} db=${c.db_states} [${c.conflict}]`,
  );
console.log(`\ncolocated sites (>1 DB row): ${recon.filter((r) => r.note).length}`);
console.log(`states in eligible set: ${new Set(eligible.map((e) => e.state)).size}`);
console.log(`corridors: ${new Set(eligible.map((e) => e.interstate).filter(Boolean)).size}`);
console.log(`total stated truck spaces: ${eligible.reduce((a, e) => a + e.parking_spaces, 0)}`);
