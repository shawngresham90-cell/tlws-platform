/**
 * TA / Petro / TA Express — read-only GAP ANALYSIS.
 *
 * This is NOT an import and produces NO importable manifest. Official TA data
 * is unreachable from this environment (see ACCESS-BLOCKED.md), so there is no
 * source of record and nothing may be approved.
 *
 * What it does: quantify, per state, the distance between what the directory
 * holds today and what a fresh official export would have to resolve. That
 * scopes the work and sizes the request, without treating unverified material
 * as authoritative.
 *
 * Inputs:
 *   data/imports/locmaster20260725.xlsx   STALE REFERENCE ONLY. Provenance
 *                                         unknown, no documented download path,
 *                                         no recorded checksum of origin. Used
 *                                         here for SHAPE and MAGNITUDE only.
 *                                         No value from it is ever imported.
 *   data/sources/ta-master/2026-07-27/DB-STATE-SNAPSHOT.tsv
 *                                         Read-only per-state counts exported
 *                                         from production 2026-07-27.
 *
 * Run: node scripts/ta-gap-analysis.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const OUT = 'data/sources/ta-master/2026-07-27';
const REF = 'data/imports/locmaster20260725.xlsx';

/* The reference file is checksummed so this analysis is pinned to one exact
 * artifact — not so the file becomes trustworthy. It does not. */
const REF_SHA = '5ebe0e9f034153536fe3946a3e5cc3d5a45c9a59b010131d5ccee20e21553303';
const sha = createHash('sha256').update(readFileSync(REF)).digest('hex');
if (sha !== REF_SHA) {
  console.error(`Reference file changed.\n  expected ${REF_SHA}\n  got      ${sha}`);
  process.exit(1);
}

const raw = execFileSync(
  'python3',
  [
    '-c',
    `
import openpyxl, json, sys
wb = openpyxl.load_workbook(${JSON.stringify(REF)}, read_only=True, data_only=True)
ws = wb["sheet1"]
rows = list(ws.iter_rows(values_only=True))
hdr = [h for h in rows[0]]
out = []
seen = {}
for r in rows[1:]:
    d = {}
    for i, h in enumerate(hdr):
        if h is None:
            continue
        # duplicate header labels exist; keep the first non-null
        if h in d and d[h] is not None:
            continue
        d[h] = r[i]
    out.append(d)
sys.stdout.write(json.dumps({"header": [h for h in hdr if h], "rows": out}))
`,
  ],
  { maxBuffer: 1 << 28, encoding: 'utf8' },
);
const { rows: ref } = JSON.parse(raw);

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/* ---- U.S. state names -> postal codes. The reference spells states out. ---- */
const STATE_CODE = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

/* ============================== COMPLETE ACCOUNTING =======================
 * Every reference row ends in exactly one bucket. Because there is no official
 * source, NOTHING can be `approved`. The buckets that exist here are the
 * honest ones: unsupported (no authoritative source behind it), service-only,
 * non-U.S., and quarantined.
 */
const buckets = {
  approved: [], // stays empty by construction — no source of record
  duplicate: [],
  conflict: [],
  held: [],
  unsupported: [],
  'non-us': [],
  'service-only': [],
  quarantined: [],
};

const bySiteId = new Map();
for (const r of ref) {
  const siteId = String(r['Site ID'] ?? '').trim();
  const stateName = String(r.State ?? '').trim();
  const code = STATE_CODE[stateName] ?? null;
  const spaces = num(r['Truck Parking Spaces']);
  const lat = num(r.Latitude);
  const lng = num(r.Longitude);

  const row = {
    site_id: siteId,
    brand: String(r.Brand ?? '').trim(),
    location_id: String(r['Location ID'] ?? '').trim(),
    state_name: stateName,
    state: code ?? '',
    city: String(r.City ?? '').trim(),
    name: String(r.Location ?? '').trim(),
    directions: String(r.Directions ?? '').trim(),
    truck_parking_spaces: spaces ?? '',
    has_coordinate: lat !== null && lng !== null,
    weigh_scale: r['Weigh Scale'] ? 'y' : '',
    showers: num(r.Showers) ?? '',
  };

  if (!siteId) {
    row.disposition = 'quarantined';
    row.reason = 'no stable operator Site ID in the reference row';
    buckets.quarantined.push(row);
    continue;
  }
  if (bySiteId.has(siteId)) {
    row.disposition = 'duplicate';
    row.reason = `Site ID ${siteId} appears more than once in the reference file`;
    buckets.duplicate.push(row);
    continue;
  }
  bySiteId.set(siteId, row);

  if (!code) {
    row.disposition = 'non-us';
    row.reason = `state "${stateName}" is not a U.S. state or DC`;
    buckets['non-us'].push(row);
    continue;
  }
  if (lat === null || lng === null) {
    row.disposition = 'quarantined';
    row.reason = 'no coordinate in the reference row';
    buckets.quarantined.push(row);
    continue;
  }
  if ((spaces ?? 0) <= 0) {
    row.disposition = 'service-only';
    row.reason =
      'no stated truck parking; a network site with no confirmed parking is never route-usable parking';
    buckets['service-only'].push(row);
    continue;
  }

  /* Everything that survives is a plausible truck-parking location — and it
   * STILL cannot be approved, because the file behind it is not an
   * authoritative source of record. */
  row.disposition = 'unsupported';
  row.reason =
    'plausible route-usable parking, but no authoritative source of record — an official TA export is required before any of this may be imported';
  buckets.unsupported.push(row);
}

/* ------------------------------ per-state gap ---------------------------- */
const dbState = new Map(
  readFileSync(`${OUT}/DB-STATE-SNAPSHOT.tsv`, 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => {
      const [state, rowsN, usable] = l.split('\t');
      return [state, { db_rows: Number(rowsN), route_usable: Number(usable) }];
    }),
);

const refByState = new Map();
for (const r of [...buckets.unsupported, ...buckets['service-only']]) {
  const e = refByState.get(r.state) ?? { ref_rows: 0, ref_with_parking: 0 };
  e.ref_rows++;
  if (r.disposition === 'unsupported') e.ref_with_parking++;
  refByState.set(r.state, e);
}

const states = [...new Set([...dbState.keys(), ...refByState.keys()])].sort();
const gap = states.map((s) => {
  const d = dbState.get(s) ?? { db_rows: 0, route_usable: 0 };
  const r = refByState.get(s) ?? { ref_rows: 0, ref_with_parking: 0 };
  return {
    state: s,
    db_rows: d.db_rows,
    db_route_usable: d.route_usable,
    reference_rows: r.ref_rows,
    reference_with_parking: r.ref_with_parking,
    row_delta: d.db_rows - r.ref_rows,
    route_usable_shortfall: Math.max(0, r.ref_with_parking - d.route_usable),
    note:
      d.db_rows > r.ref_rows
        ? 'directory holds MORE rows than the reference lists — duplicates, closures or non-network rows to resolve'
        : d.db_rows < r.ref_rows
          ? 'directory holds FEWER rows than the reference lists — possible missing locations'
          : 'row counts agree',
  };
});

/* ---------------------------------------------------------------- write --- */
const csv = (rowsIn, cols) =>
  [
    cols.join(','),
    ...rowsIn.map((r) =>
      cols
        .map((c) => {
          const s = String(r[c] ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    ),
  ].join('\n') + '\n';

const ACC_COLS = [
  'site_id',
  'brand',
  'location_id',
  'state',
  'state_name',
  'city',
  'name',
  'truck_parking_spaces',
  'has_coordinate',
  'weigh_scale',
  'showers',
  'disposition',
  'reason',
];
const all = Object.values(buckets).flat();

writeFileSync(`${OUT}/REFERENCE-ACCOUNTING.csv`, csv(all, ACC_COLS));
writeFileSync(
  `${OUT}/STATE-GAP.csv`,
  csv(gap, [
    'state',
    'db_rows',
    'db_route_usable',
    'reference_rows',
    'reference_with_parking',
    'row_delta',
    'route_usable_shortfall',
    'note',
  ]),
);
writeFileSync(
  `${OUT}/reference-profile.json`,
  JSON.stringify(
    {
      file: REF,
      sha256: sha,
      status: 'STALE REFERENCE ONLY — not a source of record, nothing importable',
      provenance: 'unknown; no documented official download path, no origin checksum',
      data_rows: ref.length,
      brands: Object.fromEntries(
        [
          ...ref.reduce(
            (m, r) =>
              m.set(String(r.Brand ?? '').trim(), (m.get(String(r.Brand ?? '').trim()) ?? 0) + 1),
            new Map(),
          ),
        ].sort((a, b) => b[1] - a[1]),
      ),
      accounting: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
      totals: {
        reference_rows: ref.length,
        directory_ta_rows: [...dbState.values()].reduce((a, v) => a + v.db_rows, 0),
        directory_route_usable: [...dbState.values()].reduce((a, v) => a + v.route_usable, 0),
        reference_with_parking: buckets.unsupported.length,
        stated_spaces_reference_only: buckets.unsupported.reduce(
          (a, r) => a + Number(r.truck_parking_spaces || 0),
          0,
        ),
      },
      rules: {
        nothing_approved:
          'The approved bucket is empty by construction. No row may be approved without an official TA source of record.',
        no_import: 'This analysis produces no SQL and no import manifest.',
        no_invented_values:
          'No coordinate, space count, amenity or name is invented or copied into the directory.',
      },
    },
    null,
    2,
  ) + '\n',
);

/* ------------------------------------------------------------------ report */
console.log(`reference rows              ${ref.length}`);
for (const [k, v] of Object.entries(buckets)) {
  console.log(`  ${k.padEnd(14)} ${String(v.length).padStart(4)}`);
}
const sum = Object.values(buckets).reduce((a, v) => a + v.length, 0);
console.log(
  `  ${'TOTAL'.padEnd(14)} ${String(sum).padStart(4)}  -> ${sum === ref.length ? 'OK, every row accounted for' : 'MISMATCH'}`,
);
console.log(
  `\napproved                    ${buckets.approved.length}  (must be 0 — no source of record)`,
);

const dbRows = [...dbState.values()].reduce((a, v) => a + v.db_rows, 0);
const dbUsable = [...dbState.values()].reduce((a, v) => a + v.route_usable, 0);
console.log(`\ndirectory TA-network rows   ${dbRows}`);
console.log(`  route-usable today        ${dbUsable}`);
console.log(`reference rows w/ parking   ${buckets.unsupported.length}`);
console.log(`\nstates where the directory holds MORE rows than the reference lists:`);
for (const g of gap.filter((x) => x.row_delta > 0).sort((a, b) => b.row_delta - a.row_delta)) {
  console.log(
    `  ${g.state}  db ${String(g.db_rows).padStart(3)} vs ref ${String(g.reference_rows).padStart(3)}  (+${g.row_delta})`,
  );
}
console.log(`\nlargest route-usable shortfalls (states where parking is not yet route-usable):`);
for (const g of gap
  .filter((x) => x.route_usable_shortfall > 0)
  .sort((a, b) => b.route_usable_shortfall - a.route_usable_shortfall)
  .slice(0, 12)) {
  console.log(
    `  ${g.state}  usable ${String(g.db_route_usable).padStart(3)} of ${String(g.reference_with_parking).padStart(3)} referenced  (short ${g.route_usable_shortfall})`,
  );
}
