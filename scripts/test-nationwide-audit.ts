/**
 * Nationwide audit — manifest integrity, exclusion, and guarded-SQL validation.
 *
 * Offline. Validates data/imports/nationwide-audit/{manifest,expectations}.json
 * and the guarded SQL against the live-DB CHECK constraints, the project's
 * Census confidence rule (Exact -> high), and the milestone's authorization
 * scope: only lat/lng + geocode metadata + is_published are ever written, only
 * on approved ids, held/quarantined ids never appear in a write, publication
 * always requires coordinates, and rollback is symmetric.
 *
 * Run:
 *   npx esbuild scripts/test-nationwide-audit.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-nationwide-audit.cjs && node /tmp/test-nationwide-audit.cjs
 */
import { readFileSync } from 'node:fs';
import { interstateSlug, exitSlug } from '@/lib/directory/interstates';

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
const CATEGORIES = new Set([
  'parking',
  'truck-stops',
  'cat-scales',
  'truck-washes',
  'tire-repair',
  'weigh-stations',
  'hotels-truck-parking',
  'cdl-schools',
  'roadside-service',
]);
// generous state bounding boxes (deg): [latMin, latMax, lngMin, lngMax]
const BBOX: Record<string, [number, number, number, number]> = {
  AL: [30.14, 35.01, -88.48, -84.88],
  AR: [33.0, 36.5, -94.62, -89.64],
  FL: [24.4, 31.01, -87.64, -79.97],
  GA: [30.35, 35.01, -85.61, -80.83],
  IN: [37.77, 41.77, -88.1, -84.78],
  KY: [36.49, 39.15, -89.58, -81.96],
  NC: [33.83, 36.59, -84.33, -75.45],
  OH: [38.4, 42.33, -84.83, -80.51],
  SC: [32.03, 35.22, -83.36, -78.54],
  TN: [34.98, 36.68, -90.31, -81.65],
  VA: [36.54, 39.47, -83.68, -75.24],
};
const HELD_BRAND = /love'?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton/i;

type Row = {
  id: string;
  name: string;
  category_slug: string;
  city: string;
  state: string;
  interstate: string | null;
  exit_number: string | null;
  lat: number;
  lng: number;
  census_input: string;
  census_matched: string;
  match_type: string;
  geocode_source: string;
  geocode_confidence: string;
  coord_verification_status: string;
  decision: string;
};
const m = JSON.parse(readFileSync('data/imports/nationwide-audit/manifest.json', 'utf8')) as {
  approved: Row[];
  canary_ids: string[];
  gate_excluded: { id: string; reason: string; detail: string }[];
  counts: { approved: number; canary: number; remaining: number };
};
const exp = JSON.parse(readFileSync('data/imports/nationwide-audit/expectations.json', 'utf8')) as {
  approved_count: number;
  canary_count: number;
  remaining_count: number;
  approved_ids: string[];
  canary_ids: string[];
  accounting_519: Record<string, number>;
  expected_after: Record<string, number>;
};

const rows = m.approved;

// ---- counts + accounting ----
check('approved count matches header', rows.length === m.counts.approved, String(rows.length));
check('approved count matches expectations', rows.length === exp.approved_count);
check('canary + remaining = approved', m.counts.canary + m.counts.remaining === rows.length);
check('ids unique', new Set(rows.map((r) => r.id)).size === rows.length);
check(
  'accounting reconciles to 519',
  Object.values(exp.accounting_519).reduce((a, b) => a + b, 0) === 519,
  String(Object.values(exp.accounting_519).reduce((a, b) => a + b, 0)),
);
check(
  'expected published after = 1037 + approved',
  exp.expected_after.published === 1037 + rows.length,
);
check('expected geo stays 0', exp.expected_after.geo === 0);
check('expected is_indexable stays 0', exp.expected_after.is_indexable === 0);

// ---- every approved row satisfies the publication standard ----
for (const r of rows) {
  check(`${r.name}: Exact match`, r.match_type === 'Exact', r.match_type);
  check(`${r.name}: high confidence`, r.geocode_confidence === 'high');
  check(`${r.name}: confidence in vocab`, GEO_CONF.has(r.geocode_confidence));
  check(`${r.name}: source in vocab`, GEO_SOURCE.has(r.geocode_source));
  check(`${r.name}: coord status in vocab`, COORD_STATUS.has(r.coord_verification_status));
  check(`${r.name}: category supported`, CATEGORIES.has(r.category_slug), r.category_slug);
  check(`${r.name}: decision=publish`, r.decision === 'publish');
  check(`${r.name}: lat range`, r.lat >= -90 && r.lat <= 90);
  check(`${r.name}: lng range`, r.lng >= -180 && r.lng <= 180);
  check(`${r.name}: not 0,0`, !(r.lat === 0 && r.lng === 0));
  const b = BBOX[r.state];
  check(
    `${r.name}: inside ${r.state} bbox`,
    !!b && r.lat >= b[0] && r.lat <= b[1] && r.lng >= b[2] && r.lng <= b[3],
    `${r.lat},${r.lng}`,
  );
  check(`${r.name}: name free of held brand`, !HELD_BRAND.test(r.name), r.name);
  // census evidence present and self-consistent
  check(`${r.name}: has census evidence`, !!r.census_input && !!r.census_matched);
  const mState = r.census_matched.split(',')[2]?.trim().toUpperCase();
  check(`${r.name}: matched state = row state`, mState === r.state, `${mState} vs ${r.state}`);
  // interstate / exit, when present, must round-trip through the app's own route helpers
  if (r.interstate) {
    const s = interstateSlug(r.interstate);
    if (s) check(`${r.name}: interstate slug`, /^i\d{1,3}$/.test(s), String(s));
  }
  if (r.exit_number) {
    check(`${r.name}: exit slug`, /^exit-[a-z0-9-]+$/.test(exitSlug(r.exit_number)));
  }
}

// ---- canary: diverse and a strict subset ----
const ids = new Set(rows.map((r) => r.id));
check(
  'canary ids are approved ids',
  m.canary_ids.every((i) => ids.has(i)),
);
check('canary <= 10', m.canary_ids.length <= 10, String(m.canary_ids.length));
check(
  'canary ids match expectations',
  JSON.stringify(m.canary_ids) === JSON.stringify(exp.canary_ids),
);
const canaryRows = rows.filter((r) => m.canary_ids.includes(r.id));
check('canary spans >= 3 categories', new Set(canaryRows.map((r) => r.category_slug)).size >= 3);
check('canary spans >= 3 states', new Set(canaryRows.map((r) => r.state)).size >= 3);

// ---- gate exclusions are documented and never in the approved set ----
check('gate exclusions documented', m.gate_excluded.length >= 1);
for (const g of m.gate_excluded) {
  check(`gate ${g.id.slice(0, 8)}: has reason`, !!g.reason && !!g.detail);
  check(`gate ${g.id.slice(0, 8)}: not approved`, !ids.has(g.id));
}

// ---- guarded SQL ----
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
  'amenities',
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
const read = (f: string) => readFileSync(`data/imports/nationwide-audit/${f}`, 'utf8');
const geo = read('GEOCODE.sql');
const canary = read('CANARY-publish.sql');
const remaining = read('PUBLISH-remaining.sql');
const rbGeo = read('ROLLBACK-geocode.sql');
const rbPub = read('ROLLBACK-publish.sql');

check(
  'GEOCODE sets only authorized fields',
  setColumns(geo).every((c) => AUTH.has(c)),
);
check('GEOCODE sets all 6 authorized fields', new Set(setColumns(geo)).size === AUTH.size);
check('GEOCODE is blank-only', /lat IS NULL/i.test(geo) && /lng IS NULL/i.test(geo));
check('GEOCODE guards + raises', /GET DIAGNOSTICS/i.test(geo) && /RAISE EXCEPTION/i.test(geo));
for (const [label, sql] of [
  ['CANARY', canary],
  ['BATCH', remaining],
] as const) {
  check(
    `${label}: sets only is_published`,
    JSON.stringify([...new Set(setColumns(sql))]) === JSON.stringify(['is_published']),
  );
  check(
    `${label}: requires coordinates`,
    /lat IS NOT NULL/i.test(sql) && /lng IS NOT NULL/i.test(sql),
  );
  check(`${label}: guards + raises`, /GET DIAGNOSTICS/i.test(sql) && /RAISE EXCEPTION/i.test(sql));
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
  ['BATCH', remaining],
  ['ROLLBACK-geocode', rbGeo],
  ['ROLLBACK-publish', rbPub],
] as const) {
  const cols = setColumns(sql);
  for (const f of FORBIDDEN) check(`${label}: no forbidden SET '${f}'`, !cols.includes(f));
  for (const g of m.gate_excluded) {
    check(`${label}: excluded id absent`, !sql.includes(g.id), g.id.slice(0, 8));
  }
}
// one state per transaction: every guarded block pins a single state
const stateBlocks = geo.match(/state = '[A-Z]{2}'/g) ?? [];
check('GEOCODE pins a state per block', stateBlocks.length >= 11, String(stateBlocks.length));
// every approved id is geocoded, and published exactly once (canary XOR batch)
for (const r of rows) {
  check(`${r.id.slice(0, 8)}: in GEOCODE`, geo.includes(r.id));
  check(`${r.id.slice(0, 8)}: published once`, canary.includes(r.id) !== remaining.includes(r.id));
  check(`${r.id.slice(0, 8)}: in rollbacks`, rbGeo.includes(r.id) && rbPub.includes(r.id));
}

console.log(`nationwide-audit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
