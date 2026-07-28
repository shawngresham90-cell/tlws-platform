/**
 * NTAD canary package tests — static verification of the PREPARED
 * (unexecuted) insert package in data/imports/ntad-2026-07-28/. Pure file
 * checks — no network, no database. The release-blocking properties:
 * provenance is pinned, directions are explicit, no parking count or
 * overnight claim is stored (nothing 2019-only may look current), held
 * rows never appear in executable SQL, and the rollback is value-matched.
 *
 * Run:
 *   npx esbuild scripts/test-ntad-canary.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-ntad-canary.cjs \
 *   && node /tmp/test-ntad-canary.cjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const dir = join(process.cwd(), 'data/imports/ntad-2026-07-28');
const insertSql = readFileSync(join(dir, 'CANARY-INSERT.sql'), 'utf8');
const rollbackSql = readFileSync(join(dir, 'CANARY-ROLLBACK.sql'), 'utf8');
const verifySql = readFileSync(join(dir, 'CANARY-VERIFY.sql'), 'utf8');
const manifest = JSON.parse(readFileSync(join(dir, 'CANARY-MANIFEST.json'), 'utf8')) as {
  source: string;
  sourceSha256: string;
  approved: Array<{
    name: string;
    state: string;
    lat: number;
    lng: number;
    detail_slug: string;
    direction: string;
    parkingSpacesInserted: null;
    overnightInserted: boolean;
  }>;
  held: Array<{ name: string; state: string; reason: string }>;
};

/* ------------------------------------------------------------- provenance */
check('manifest pins the canonical source tag', manifest.source === 'ntad-2019-v04');
check(
  'manifest records the verified archive sha256',
  manifest.sourceSha256 === 'd32ebfebb0b84f68057be9d949d9ef13db3da014647042c75329aaf12a762b42',
);
check('exactly 5 approved rows', manifest.approved.length === 5);
check('exactly 3 held rows', manifest.held.length === 3);
check(
  "insert SQL tags every row with source 'ntad-2019-v04'",
  (insertSql.match(/'ntad-2019-v04'/g) ?? []).length >= 3,
);
check(
  'insert SQL never writes any other source value',
  !/source\s*=\s*'(?!ntad-2019-v04)/.test(
    insertSql.replace(/is distinct from 'ntad-2019-v04'/g, ''),
  ),
);

/* -------------------------------------------- every approved row in the SQL */
for (const row of manifest.approved) {
  check(`SQL contains ${row.state} slug`, insertSql.includes(`'${row.detail_slug}'`));
  check(`SQL contains ${row.state} exact latitude`, insertSql.includes(String(row.lat)));
  check(`SQL contains ${row.state} exact longitude`, insertSql.includes(String(row.lng)));
  check(
    `rollback deletes ${row.state} by slug + value match`,
    rollbackSql.includes(`'${row.detail_slug}'`),
  );
  check(`rollback pins ${row.state} latitude`, rollbackSql.includes(String(row.lat)));
}

/* --------------------------------------------------- direction protection */
const DIRECTION_TOKENS = /north|south|east|west|northbound|southbound|eastbound|westbound/i;
for (const row of manifest.approved) {
  if (row.direction === 'both-directions-single-facility') {
    check(
      `${row.state}: bidirectional facility documented (Smyrna only)`,
      row.state === 'DE' && row.name.includes('US 13'),
    );
  } else {
    check(`${row.state}: name carries its direction`, DIRECTION_TOKENS.test(row.name), row.name);
    check(`${row.state}: direction is in the SQL name too`, insertSql.includes(row.name), row.name);
  }
}

/* -------------------- counts: nothing 2019-only may masquerade as current */
for (const row of manifest.approved) {
  check(`${row.state}: parking_spaces inserted as NULL`, row.parkingSpacesInserted === null);
  check(`${row.state}: overnight inserted as false`, row.overnightInserted === false);
}
// The INSERT's VALUES tuple sets (…, null, false, false, 'ntad-2019-v04', …)
check(
  'SQL inserts NULL spaces + overnight false + unpublished',
  /null,\s*false,\s*false,\s*'ntad-2019-v04'/.test(insertSql),
);
// No positive or zero space count literal is written anywhere.
check('SQL sets no parking_spaces literal', !/parking_spaces\s*=\s*\d/.test(insertSql));
// Zero-space exclusion contract: NULL spaces fail hasConfirmedTruckParking,
// verify SQL asserts recommendation ineligibility explicitly.
check(
  'verify SQL asserts zero recommendation-eligible package rows',
  verifySql.includes('recommendation_eligible_should_be_0'),
);

/* ----------------------------------------------- forbidden fields / flags */
// Scan only executable lines — the file's comments legitimately NAME the
// forbidden fields while documenting that they are never written.
const executableSql = insertSql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .toLowerCase();
for (const banned of ['is_featured', 'is_indexable', ' geo', 'geography(', 'st_setsrid']) {
  check(`insert SQL statements never write ${banned.trim()}`, !executableSql.includes(banned));
}
check(
  'insert SQL publishes nothing (is_published only ever false)',
  !/is_published\s*=\s*true/i.test(insertSql) && !/true,\s*'ntad-2019-v04'/.test(insertSql),
);

/* -------------------------------------------------------------- held rows */
for (const held of manifest.held) {
  check(
    `held row "${held.name}" absent from insert SQL statements`,
    !insertSql.split('HELD')[0].includes(held.name),
  );
  check(`held row "${held.name}" has a recorded reason`, held.reason.length > 20);
}
check(
  'Grand Bay never appears as an INSERT value',
  !/values[\s\S]*Grand Bay/i.test(insertSql.split('HELD')[0]),
);

/* --------------------------------------------------------- guard presence */
check(
  'identity guard present (different-source slug aborts)',
  insertSql.includes("is distinct from 'ntad-2019-v04'"),
);
check(
  'idempotency skip present (same-source slug skips)',
  insertSql.includes('skipped := skipped + 1'),
);
check('collision guard present (±0.0015° box abort)', insertSql.includes('0.0015'));
check('row-count guard present', insertSql.includes('get diagnostics'));
check(
  'total-count guard present (5 processed or abort)',
  insertSql.includes('inserted + skipped <> 5'),
);
check(
  'rollback refuses published or altered rows',
  rollbackSql.includes('is_published = false') && rollbackSql.includes('parking_spaces is null'),
);

console.log(`ntad-canary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
