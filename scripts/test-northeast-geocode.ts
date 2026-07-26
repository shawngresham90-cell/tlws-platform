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

console.log(`northeast-geocode: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
