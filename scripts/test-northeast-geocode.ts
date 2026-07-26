/**
 * Northeast MD/DE geocode + publish — manifest integrity + guard validation.
 *
 * Offline. Validates data/imports/northeast-md-de/manifest.json and
 * expectations.json plus the geocoding batch CSV against the live-DB CHECK
 * constraints and the milestone's authorization scope: only lat/lng +
 * geocode metadata + is_published are ever proposed, only for the 6 documented
 * MD/DE ids, held networks excluded, deferred rows carry no coordinate.
 *
 * Run:
 *   npx esbuild scripts/test-northeast-geocode.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-northeast-geocode.cjs && node /tmp/test-northeast-geocode.cjs
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const GEO_SOURCE = new Set(['import', 'batch-csv', 'interpolation', 'external-api', 'manual']);
const GEO_CONF = new Set(['high', 'medium', 'low']);
const COORD_STATUS = new Set(['unverified', 'machine-checked', 'manually-verified', 'disputed']);

type G = {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  geocode_source: string;
  geocode_confidence: string;
  coord_verification_status: string;
  cross_check_distance_m: number;
  interstate_decision: string;
  exit_decision: string;
  publish: boolean;
};
type D = {
  id: string;
  state: string;
  lat?: number | null;
  lng?: number | null;
  geocode_source: string | null;
  publish: boolean;
  geocode_decision: string;
};
const m = JSON.parse(readFileSync('data/imports/northeast-md-de/manifest.json', 'utf8')) as {
  counts: Record<string, number>;
  geocode_and_publish: G[];
  deferred: D[];
  held_networks_excluded: { id: string }[];
};
const exp = JSON.parse(readFileSync('data/imports/northeast-md-de/expectations.json', 'utf8')) as {
  geocode_ids: string[];
  publish_ids: string[];
  deferred_ids: string[];
  held_excluded_ids: string[];
};

const geo = m.geocode_and_publish;
const def = m.deferred;

// ---- counts ----
check('6 candidates total', geo.length + def.length === 6, String(geo.length + def.length));
check('3 to geocode+publish', geo.length === 3, String(geo.length));
check('3 deferred', def.length === 3, String(def.length));
check('3 held networks excluded', m.held_networks_excluded.length === 3);
check('candidate ids all unique', new Set([...geo, ...def].map((r) => r.id)).size === 6);

// ---- geocode rows honor DB CHECK constraints + evidence bar ----
for (const r of geo) {
  check(`${r.name}: lat in range`, r.lat >= -90 && r.lat <= 90, String(r.lat));
  check(`${r.name}: lng in range`, r.lng >= -180 && r.lng <= 180, String(r.lng));
  check(`${r.name}: not 0,0`, !(r.lat === 0 && r.lng === 0));
  check(
    `${r.name}: in MD bbox`,
    r.lat >= 37.9 && r.lat <= 39.8 && r.lng >= -79.6 && r.lng <= -75.0,
  );
  check(`${r.name}: state MD`, r.state === 'MD', r.state);
  check(`${r.name}: geocode_source valid`, GEO_SOURCE.has(r.geocode_source), r.geocode_source);
  check(`${r.name}: confidence valid`, GEO_CONF.has(r.geocode_confidence), r.geocode_confidence);
  check(`${r.name}: confidence high`, r.geocode_confidence === 'high', r.geocode_confidence);
  check(
    `${r.name}: coord status valid`,
    COORD_STATUS.has(r.coord_verification_status),
    r.coord_verification_status,
  );
  check(
    `${r.name}: two-source agreement < 500m`,
    r.cross_check_distance_m < 500,
    `${r.cross_check_distance_m}m`,
  );
  check(`${r.name}: publish true`, r.publish === true);
  // interstate/exit already populated on these rows — must NOT be overwritten
  check(`${r.name}: interstate not overwritten`, r.interstate_decision === 'skip-existing');
  check(`${r.name}: exit not overwritten`, r.exit_decision === 'skip-existing');
}

// ---- deferred rows carry no coordinate and are not published ----
for (const r of def) {
  check(`deferred ${r.id}: no lat`, r.lat === undefined || r.lat === null);
  check(`deferred ${r.id}: no lng`, r.lng === undefined || r.lng === null);
  check(`deferred ${r.id}: no geocode_source`, !r.geocode_source);
  check(`deferred ${r.id}: publish false`, r.publish === false);
  check(`deferred ${r.id}: decision=deferred`, r.geocode_decision === 'deferred');
}

// ---- expectations line up with the manifest ----
check(
  'expectations geocode_ids match',
  JSON.stringify(exp.geocode_ids.slice().sort()) === JSON.stringify(geo.map((r) => r.id).sort()),
);
check(
  'publish set == geocode set',
  JSON.stringify(exp.publish_ids.slice().sort()) === JSON.stringify(geo.map((r) => r.id).sort()),
);
check(
  'deferred ids match',
  JSON.stringify(exp.deferred_ids.slice().sort()) === JSON.stringify(def.map((r) => r.id).sort()),
);
// held ids are disjoint from candidate ids (never in a write set)
const candidateIds = new Set([...geo, ...def].map((r) => r.id));
check(
  'held ids disjoint from candidates',
  exp.held_excluded_ids.every((id) => !candidateIds.has(id)),
);

// ---- batch CSV: only action=ready & confidence=high are the 3 geocode rows ----
const csv = readFileSync('data/geocoding/northeast-md-de-batch-2026-07-26.csv', 'utf8')
  .trim()
  .split('\n');
const header = csv[0].split(',');
const iAction = header.indexOf('action');
const iConf = header.indexOf('confidence');
const iId = header.indexOf('listing_id');
const dataLines = csv.slice(1);
// split respecting simple quoted fields (addresses may contain commas)
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
const ready = dataLines.map(fields).filter((f) => f[iAction] === 'ready');
check('batch CSV: 3 ready rows', ready.length === 3, String(ready.length));
check(
  'batch CSV: all ready are high',
  ready.every((f) => f[iConf] === 'high'),
);
check(
  'batch CSV: ready ids == geocode ids',
  JSON.stringify(ready.map((f) => f[iId]).sort()) === JSON.stringify(geo.map((r) => r.id).sort()),
);
check('batch CSV: 6 data rows', dataLines.length === 6, String(dataLines.length));

// ---- guarded SQL: only authorized fields written, guards present, rollback symmetric ----
const AUTHORIZED_GEOCODE = new Set([
  'lat',
  'lng',
  'geocode_source',
  'geocode_confidence',
  'coord_verification_status',
  'last_geocoded_at',
]);
const FORBIDDEN = [
  'name',
  'address',
  'slug',
  'detail_slug',
  'type',
  'category_slug',
  'description',
  'interstate',
  'exit_number',
  'is_indexable',
  'geo',
  'completeness_score',
  'is_featured',
  'source',
];
const IDS = geo.map((r) => r.id);
function setColumns(sqlRaw: string): string[] {
  // capture each SET ... (FROM|WHERE) block and return the assigned column names.
  // Strip `--` line comments first so the word "set" in prose can't match.
  const sql = sqlRaw.replace(/--[^\n]*/g, '');
  const cols: string[] = [];
  const re = /\bset\b([\s\S]*?)\b(from|where)\b/gi;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(sql)) !== null) {
    for (const part of mm[1].split(',')) {
      const lhs = part.split('=')[0].trim().replace(/^l\./, '');
      if (/^[a-z_]+$/.test(lhs)) cols.push(lhs);
    }
  }
  return cols;
}
function read(f: string): string {
  return readFileSync(`data/imports/northeast-md-de/${f}`, 'utf8');
}
const geocodeSql = read('GEOCODE.sql');
const canarySql = read('CANARY-publish.sql');
const rbGeo = read('ROLLBACK-geocode.sql');
const rbPub = read('ROLLBACK-publish.sql');

const geocodeCols = setColumns(geocodeSql);
check(
  'GEOCODE.sql sets only authorized fields',
  geocodeCols.every((c) => AUTHORIZED_GEOCODE.has(c)),
  geocodeCols.join(','),
);
check(
  'GEOCODE.sql sets all 6 authorized fields',
  AUTHORIZED_GEOCODE.size === new Set(geocodeCols).size,
);
check('GEOCODE.sql blank-only (lat IS NULL)', /lat IS NULL/i.test(geocodeSql));
check(
  'GEOCODE.sql has ROW_COUNT guard',
  /ROW_COUNT/i.test(geocodeSql) && /RAISE EXCEPTION/i.test(geocodeSql),
);
check('GEOCODE.sql expects 3', /<>\s*3/.test(geocodeSql));

check(
  'CANARY sets only is_published',
  JSON.stringify(setColumns(canarySql)) === JSON.stringify(['is_published']),
);
check(
  'CANARY requires coordinates (lat/lng NOT NULL)',
  /lat IS NOT NULL/i.test(canarySql) && /lng IS NOT NULL/i.test(canarySql),
);
check(
  'CANARY has ROW_COUNT guard expecting 3',
  /ROW_COUNT/i.test(canarySql) && /<>\s*3/.test(canarySql),
);

// rollback symmetry: geocode rollback nulls exactly the authorized fields and matches on value
const rbCols = setColumns(rbGeo);
check(
  'ROLLBACK-geocode nulls exactly the authorized fields',
  new Set(rbCols).size === AUTHORIZED_GEOCODE.size &&
    rbCols.every((c) => AUTHORIZED_GEOCODE.has(c)),
);
check(
  'ROLLBACK-geocode matches on written value (l.lat = v.lat)',
  /l\.lat\s*=\s*v\.lat/i.test(rbGeo) && /l\.lng\s*=\s*v\.lng/i.test(rbGeo),
);
check(
  'ROLLBACK-publish sets only is_published',
  JSON.stringify(setColumns(rbPub)) === JSON.stringify(['is_published']),
);

// no forbidden field appears in any SET clause of any write/rollback script
for (const sql of [geocodeSql, canarySql, rbGeo, rbPub]) {
  const cols = setColumns(sql);
  for (const f of FORBIDDEN) check(`no forbidden SET '${f}'`, !cols.includes(f), f);
}
// every write/rollback references exactly the 3 geocode ids
for (const [label, sql] of [
  ['GEOCODE', geocodeSql],
  ['CANARY', canarySql],
  ['ROLLBACK-geocode', rbGeo],
  ['ROLLBACK-publish', rbPub],
] as const) {
  check(
    `${label} references all 3 ids`,
    IDS.every((id) => sql.includes(id)),
  );
}
// held-network ids must never appear in any write/rollback script
for (const [label, sql] of [
  ['GEOCODE', geocodeSql],
  ['CANARY', canarySql],
] as const) {
  check(
    `${label} excludes held ids`,
    exp.held_excluded_ids.every((id) => !sql.includes(id)),
  );
}

console.log(`northeast-geocode: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
