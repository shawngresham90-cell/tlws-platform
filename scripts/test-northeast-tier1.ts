/**
 * Northeast MD/DE Tier-1 geocode + publish — manifest integrity + guarded-SQL validation.
 *
 * Offline. Validates data/imports/northeast-tier1/{manifest,expectations}.json and
 * the guarded SQL against the live-DB CHECK constraints, the project's Census
 * confidence rule (Exact -> high), and the milestone authorization scope
 * (only lat/lng + geocode metadata + is_published, only on the 28 Tier-1 ids,
 * held networks excluded, quarantined rows never written).
 *
 * Run:
 *   npx esbuild scripts/test-northeast-tier1.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-northeast-tier1.cjs && node /tmp/test-northeast-tier1.cjs
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const GEO_SOURCE = new Set(['import', 'batch-csv', 'interpolation', 'external-api', 'manual']);
const GEO_CONF = new Set(['high', 'medium', 'low']);
const COORD_STATUS = new Set(['unverified', 'machine-checked', 'manually-verified', 'disputed']);
const BBOX: Record<string, [number, number, number, number]> = {
  DE: [38.45, 39.84, -75.79, -75.04],
  MD: [37.9, 39.73, -79.49, -75.04],
};

type P = {
  id: string;
  name: string;
  category_slug: string;
  state: string;
  lat: number;
  lng: number;
  match_type: string;
  in_state_bbox: boolean;
  master_cross_check_m: number | null;
  geocode_source: string;
  geocode_confidence: string;
  coord_verification_status: string;
  decision: string;
};
type Q = { id: string; name: string; state: string; decision: string; reason: string };

const m = JSON.parse(readFileSync('data/imports/northeast-tier1/manifest.json', 'utf8')) as {
  publish: P[];
  held_or_quarantined: Q[];
};
const exp = JSON.parse(readFileSync('data/imports/northeast-tier1/expectations.json', 'utf8')) as {
  publish_ids: string[];
  geocode_de_ids: string[];
  geocode_md_ids: string[];
  quarantine_ids: string[];
  held_network_ids: string[];
};
const pub = m.publish;
const q = m.held_or_quarantined;
const allIds = [...pub, ...q].map((r) => r.id);

// ---- counts + id integrity ----
check('28 Tier-1 rows total', pub.length + q.length === 28, String(pub.length + q.length));
check('14 to publish', pub.length === 14, String(pub.length));
check('14 held/quarantined', q.length === 14, String(q.length));
check('all 28 ids unique', new Set(allIds).size === 28);
check(
  'held-network ids disjoint from the 28',
  exp.held_network_ids.every((id) => !allIds.includes(id)),
);

// ---- publish rows honor DB CHECK constraints + the Census Exact=high rule ----
for (const r of pub) {
  check(`${r.name}: match Exact`, r.match_type === 'Exact', r.match_type);
  check(`${r.name}: confidence high`, r.geocode_confidence === 'high', r.geocode_confidence);
  check(`${r.name}: confidence valid`, GEO_CONF.has(r.geocode_confidence));
  check(`${r.name}: source valid`, GEO_SOURCE.has(r.geocode_source), r.geocode_source);
  check(`${r.name}: coord status valid`, COORD_STATUS.has(r.coord_verification_status));
  check(`${r.name}: lat in range`, r.lat >= -90 && r.lat <= 90, String(r.lat));
  check(`${r.name}: lng in range`, r.lng >= -180 && r.lng <= 180, String(r.lng));
  check(`${r.name}: not 0,0`, !(r.lat === 0 && r.lng === 0));
  const b = BBOX[r.state];
  check(
    `${r.name}: in ${r.state} bbox`,
    !!b && r.lat >= b[0] && r.lat <= b[1] && r.lng >= b[2] && r.lng <= b[3],
  );
  check(`${r.name}: state bbox flag`, r.in_state_bbox === true);
  check(`${r.name}: decision=publish`, r.decision === 'publish');
  if (r.master_cross_check_m !== null)
    check(
      `${r.name}: master cross-check < 500m`,
      r.master_cross_check_m < 500,
      `${r.master_cross_check_m}m`,
    );
}

// ---- quarantined rows carry a reason and are never in the publish set ----
const pubIds = new Set(pub.map((r) => r.id));
for (const r of q) {
  check(
    `quarantine ${r.name}: decision valid`,
    r.decision === 'held' || r.decision === 'quarantined',
    r.decision,
  );
  check(`quarantine ${r.name}: has reason`, !!r.reason && r.reason.length > 10);
  check(`quarantine ${r.name}: not in publish set`, !pubIds.has(r.id));
}

// ---- expectations reconcile ----
check(
  'expectations publish_ids match',
  JSON.stringify(exp.publish_ids.slice().sort()) === JSON.stringify(pub.map((r) => r.id).sort()),
);
check('DE publish count = 4', exp.geocode_de_ids.length === 4);
check('MD publish count = 10', exp.geocode_md_ids.length === 10);
check(
  'quarantine ids match',
  JSON.stringify(exp.quarantine_ids.slice().sort()) === JSON.stringify(q.map((r) => r.id).sort()),
);

// ---- guarded SQL: authorized fields only, guards present, held ids never written ----
const AUTH = new Set([
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
function setColumns(sqlRaw: string): string[] {
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
  return readFileSync(`data/imports/northeast-tier1/${f}`, 'utf8');
}
const geo = read('GEOCODE.sql');
const canary = read('CANARY-publish.sql');
const remaining = read('PUBLISH-remaining.sql');
const rbGeo = read('ROLLBACK-geocode.sql');
const rbPub = read('ROLLBACK-publish.sql');

check(
  'GEOCODE sets only authorized geocode fields',
  setColumns(geo).every((c) => AUTH.has(c)),
  setColumns(geo).join(','),
);
check('GEOCODE sets all 6 authorized fields', new Set(setColumns(geo)).size === AUTH.size);
check('GEOCODE blank-only (lat IS NULL)', /lat IS NULL/i.test(geo));
check('GEOCODE has guards', /ROW_COUNT/i.test(geo) && /RAISE EXCEPTION/i.test(geo));
check(
  'GEOCODE one state per block (DE + MD)',
  /state = 'DE'/.test(geo) && /state = 'MD'/.test(geo),
);

for (const [label, sql] of [
  ['CANARY', canary],
  ['REMAINING', remaining],
] as const) {
  check(
    `${label} sets only is_published`,
    JSON.stringify([...new Set(setColumns(sql))]) === JSON.stringify(['is_published']),
  );
  check(
    `${label} requires coordinates`,
    /lat IS NOT NULL/i.test(sql) && /lng IS NOT NULL/i.test(sql),
  );
  check(`${label} has guards`, /ROW_COUNT/i.test(sql) && /RAISE EXCEPTION/i.test(sql));
}
check(
  'ROLLBACK-geocode nulls only authorized fields',
  setColumns(rbGeo).every((c) => AUTH.has(c)),
);
check(
  'ROLLBACK-geocode matches on written value',
  /l\.lat\s*=\s*v\.lat/i.test(rbGeo) && /l\.lng\s*=\s*v\.lng/i.test(rbGeo),
);
check(
  'ROLLBACK-publish sets only is_published',
  JSON.stringify([...new Set(setColumns(rbPub))]) === JSON.stringify(['is_published']),
);

for (const [label, sql] of [
  ['GEOCODE', geo],
  ['CANARY', canary],
  ['REMAINING', remaining],
  ['ROLLBACK-geocode', rbGeo],
  ['ROLLBACK-publish', rbPub],
] as const) {
  const cols = setColumns(sql);
  for (const f of FORBIDDEN) check(`${label}: no forbidden SET '${f}'`, !cols.includes(f));
  check(
    `${label}: no held-network id`,
    exp.held_network_ids.every((id) => !sql.includes(id)),
  );
  check(
    `${label}: no quarantined id in a write`,
    label === 'ROLLBACK-geocode' || label === 'ROLLBACK-publish'
      ? true
      : exp.quarantine_ids.every((id) => !sql.includes(id)),
  );
}

// every publish id is geocoded and published exactly once (canary XOR remaining)
for (const id of exp.publish_ids) {
  check(`${id.slice(0, 8)}: geocoded`, geo.includes(id));
  const inCanary = canary.includes(id);
  const inRemaining = remaining.includes(id);
  check(`${id.slice(0, 8)}: published exactly once`, inCanary !== inRemaining);
}

console.log(`northeast-tier1: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
