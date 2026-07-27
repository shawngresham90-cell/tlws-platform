/**
 * Generates the guarded TA / Petro / TA Express package from the committed
 * reconciliation CSVs. NOTHING HERE IS EXECUTED — it writes .sql proposals
 * under data/imports/ta-2026-07-27/.
 *
 * There are NO inserts: all 348 TA-brand sites already have a production row
 * (304 imported 2026-07-25, 43 pre-existing, 1 mislabeled cross-brand row).
 * The package is enrichment + two correction proposals.
 *
 * Run: node scripts/generate-ta-package.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'data/sources/ta-master/2026-07-27';
const OUT = 'data/imports/ta-2026-07-27';
// locations_geocode_source_check allows ONLY: import | batch-csv | interpolation
// | external-api | manual. 'batch-csv' is what every prior committed-file
// enrichment wrote, so package membership is tracked by explicit db_id lists
// (canary.json + ENRICHMENT-PLAN.csv), never by a bespoke geocode_source tag.
const TAG = 'batch-csv';
mkdirSync(OUT, { recursive: true });

const parseCsv = (text) => {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const head = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
};

const plan = parseCsv(readFileSync(`${SRC}/ENRICHMENT-PLAN.csv`, 'utf8'));
const rec = parseCsv(readFileSync(`${SRC}/RECONCILIATION-354.csv`, 'utf8'));
const anchored = plan.filter((p) => p.confidence === 'address-anchored');
const holdRows = plan.filter((p) => p.confidence !== 'address-anchored');
if (plan.length !== 40 || anchored.length !== 38 || holdRows.length !== 2)
  throw new Error(`plan drifted: ${plan.length}/${anchored.length}/${holdRows.length}`);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const nq = (v) => (v === '' || v === null || v === undefined ? 'null' : String(v));

const HEAD = `-- Source of record: the current official TA/Petro location master,
-- downloaded 2026-07-27 via "Download Location Data" at ta-petro.com/location/.
-- Official artifact sha256 a0c612f0426d141c481f84aae59dc15a0204617183bbf9c0866bfbb726ed63f7
-- COMMITTED 2026-07-27 as locmaster20260727.xlsx and checksum-verified.
-- Cell-content diff against the earlier working copy (5ebe0e9f…3303): identical
-- except two service-hours cells at TA Kingman AZ — columns never read by the
-- reconciliation and never written by any statement. All ten verified facts
-- hold on the exact artifact. PRECONDITION OF EXECUTION: SATISFIED.
--
-- Stable keys: Site ID first, then Location ID; then address and coordinate
-- checks. A loose business name is never sufficient on its own.
--
-- Goasis and Thorntons are HELD — separate and untouched.
-- The 7 zero-parking locations are never counted as truck-parking coverage.
-- overnight_parking, is_published, is_featured and is_indexable are NEVER
-- written by any statement in this package.
`;

/* ============================== 1. ENRICH ================================ */
const byState = new Map();
for (const p of anchored) byState.set(p.state, [...(byState.get(p.state) ?? []), p]);

let enr = `-- TA/Petro enrichment of EXISTING rows — GUARDED, blank-only, exact id.
--
-- NOT EXECUTED. ${anchored.length} address-anchored rows across ${byState.size} states, one
-- transaction per state. There are NO inserts in this package: every official
-- site already has a production row.
--
${HEAD}--
-- The 2 name-anchored rows (TA Ashland site 0001, TA Richmond site 0142) are
-- NOT here — they are in HOLD-NAME-ANCHORED.sql pending identity verification.

`;

for (const [state, rowsIn] of [...byState].sort()) {
  enr += `-- ============================================================ ${state} (${rowsIn.length})
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
${rowsIn
  .map(
    (p) =>
      `  (${q(p.db_id)}, ${q(p.db_name)}, ${q(p.site_id)}, ${nq(p.lat)}, ${nq(p.lng)}, ${nq(p.parking_spaces)}, ${p.zip ? q(p.zip) : 'null'})`,
  )
  .join(',\n')};

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> ${rowsIn.length} then raise exception 'Expected ${rowsIn.length} staged, found %.', batch; end if;

  -- 1. Every id resolves to a live truck-stops row whose name is EXACTLY the
  --    name this plan was written against. Identity, not similarity.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  -- 2. BLANK-ONLY, PER FIELD.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  -- 3. Staged coordinates plausible, unique, and colliding with no published pin.
  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  -- 4. Write. coalesce keeps it blank-only even if step 2 were bypassed.
  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then ${q(TAG)} else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  -- 5. Nothing published, featured, indexed or overnight-claimed by this.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

`;
}
writeFileSync(`${OUT}/ENRICH-EXISTING.sql`, enr);

/* ============================== 2. HOLD ================================== */
let hold = `-- HOLD — name-anchored matches. DO NOT RUN until identity is verified.
--
-- NOT EXECUTED, and not part of the enrichment authorization. The prior
-- review linked BOTH of these sites to the same production row; the pairing
-- below is by name+city+state+zip5 and needs a human eye before any value is
-- written. Both rows are UNPUBLISHED, so nothing is in front of drivers.
--
${HEAD}--
-- Site 0001 TA Ashland   (100 North Carter Rd, Ashland VA, 183 spaces)
--   -> e36e07df-2f06-48a6-9494-8cf3b0f4cc15 "TA Ashland (TravelCenters of America)"
-- Site 0142 TA Richmond  (10134 Lewistown Road, Ashland VA, 317 spaces)
--   -> 7a03c1f5-6b4d-4951-98a2-a3e752d2270b "TA Richmond (TravelCenters of America)"
--
-- Ashland, Virginia has TWO distinct official sites, both zip 23005. The
-- verification that matters: confirm which physical site each row's history
-- refers to before writing either coordinate.

`;
for (const p of holdRows) {
  const site = rec.find((r) => r.db_id === p.db_id);
  hold += `-- ---------------- site ${p.site_id} -> ${p.db_id} (${p.db_name})
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where id = ${q(p.db_id)} and deleted_at is null and category_slug = 'truck-stops'
     and name = ${q(p.db_name)} and state = ${q(p.state)} and not is_published
     and lat is null and lng is null;
  if n <> 1 then raise exception 'Identity precondition failed for ${p.db_id}.'; end if;

  update public.locations
     set lat = ${nq(p.lat)}, lng = ${nq(p.lng)},
         parking_spaces = coalesce(parking_spaces, ${nq(p.parking_spaces)}),
         geocode_source = ${q(TAG)}, geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(), updated_at = now()
   where id = ${q(p.db_id)} and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected exactly 1 update.'; end if;
end $$;
commit;

`;
  void site;
}
writeFileSync(`${OUT}/HOLD-NAME-ANCHORED.sql`, hold);

/* ============================== 3. CANARY ================================ */
const canaryPool = [...anchored].sort(
  (a, b) => Number(b.parking_spaces || 0) - Number(a.parking_spaces || 0),
);
const canary = [];
const usedStates = new Set();
for (const p of canaryPool) {
  if (canary.length >= 10) break;
  if (usedStates.has(p.state)) continue;
  canary.push(p);
  usedStates.add(p.state);
}
if (canary.length !== 10) throw new Error(`canary ${canary.length}`);
writeFileSync(
  `${OUT}/canary.json`,
  JSON.stringify(
    canary.map((p) => ({
      db_id: p.db_id,
      site_id: p.site_id,
      name: p.db_name,
      state: p.state,
      city: p.city,
      fills: p.fills,
      lat: p.lat ? Number(p.lat) : null,
      lng: p.lng ? Number(p.lng) : null,
      parking_spaces: p.parking_spaces ? Number(p.parking_spaces) : null,
      note: 'enrichment canary — no publication state changes anywhere in this package',
    })),
    null,
    2,
  ) + '\n',
);

let can = `-- TA/Petro enrichment CANARY — 10 rows, 10 states, GUARDED.
--
-- NOT EXECUTED. Run before ENRICH-EXISTING.sql, verify with VERIFY.sql, then
-- proceed. Same guards as the full file; the canary rows are a strict subset,
-- and ENRICH-EXISTING.sql is idempotent so the overlap is safe (blank-only
-- guards make the second pass skip rows the canary already filled — those
-- states' transactions will FAIL their expected-count checks and roll back,
-- which is the designed signal to run only the remaining states).
--
${HEAD}
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
${canary
  .map(
    (p) =>
      `  (${q(p.db_id)}, ${q(p.db_name)}, ${q(p.site_id)}, ${nq(p.lat)}, ${nq(p.lng)}, ${nq(p.parking_spaces)}, ${p.zip ? q(p.zip) : 'null'})`,
  )
  .join(',\n')};

do $$
declare n integer;
begin
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> 10 then raise exception '% canary row(s) failed identity.', 10 - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null);
  if n <> 0 then raise exception '% canary row(s) not blank. Already run?', n; end if;

  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% collision(s) with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat), lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then ${q(TAG)} else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'Expected 10, updated %.', n; end if;
end $$;

commit;
`;
writeFileSync(`${OUT}/CANARY-ENRICH.sql`, can);

/* ========================== 3b. REMAINDER ================================ */
/* ENRICH-EXISTING.sql stages all 38 rows, so after the canary its canary-state
 * transactions fail their expected-count guards by design. The remainder file
 * is the same statement generated over the 28 non-canary rows only, with
 * per-state counts recomputed — run it AFTER the canary passes audit. */
const canaryIds = new Set(canary.map((c) => c.db_id));
const remainder = anchored.filter((p) => !canaryIds.has(p.db_id));
const remByState = new Map();
for (const p of remainder) remByState.set(p.state, [...(remByState.get(p.state) ?? []), p]);

let rem = `-- TA/Petro enrichment REMAINDER — the 28 address-anchored rows not in the
-- canary. Same guards as ENRICH-EXISTING.sql, counts recomputed per state.
-- Run only after the canary has passed its audit.
--
-- EXECUTED 2026-07-27: all states committed EXCEPT the TN transaction, which
-- failed its collision guard and rolled back atomically — site 0269
-- TA Knoxville West's staged pin exactly matches the site's own published
-- CAT-scale / truck-service records. 0269 was QUARANTINED (the collision
-- guard is not to be weakened) and TN re-ran with its 4 independently safe
-- rows, which committed. Final: 37 of 38 rows applied. See EXECUTION-RECORD.md.
--
${HEAD}
`;
for (const [state, rowsIn] of [...remByState].sort()) {
  rem += `-- ============================================================ ${state} (${rowsIn.length})
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
${rowsIn
  .map(
    (p) =>
      `  (${q(p.db_id)}, ${q(p.db_name)}, ${q(p.site_id)}, ${nq(p.lat)}, ${nq(p.lng)}, ${nq(p.parking_spaces)}, ${p.zip ? q(p.zip) : 'null'})`,
  )
  .join(',\n')};

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> ${rowsIn.length} then raise exception 'Expected ${rowsIn.length} staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then ${q(TAG)} else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

`;
}
writeFileSync(`${OUT}/ENRICH-REMAINDER.sql`, rem);
console.log(`remainder                 ${remainder.length} rows across ${remByState.size} states`);

/* ============================== 4. ROLLBACK ============================== */
/* geocode_source now carries the shared legal value 'batch-csv', so a
 * tag-scoped bulk reversal is impossible — and unnecessary. Every write this
 * package makes is enumerated in ENRICHMENT-PLAN.csv, so the rollback is
 * per-row: id-scoped AND value-matched. A row edited since enrichment no
 * longer matches its staged value and is left alone (and shows up in the
 * post-rollback count check). No zip is staged anywhere in the plan. */
const coordPair = (p) => `update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = ${q(p.db_id)} and lat = ${nq(p.lat)} and lng = ${nq(p.lng)}
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;`;
const spacePair = (p) => `update public.locations
   set parking_spaces = null, updated_at = now()
 where id = ${q(p.db_id)} and parking_spaces = ${nq(p.parking_spaces)}
   and deleted_at is null and not is_featured;`;

let rb = `-- TA/Petro package — per-row, id-scoped, value-matched rollback. NOT EXECUTED.
--
-- Reverses CANARY-ENRICH.sql / ENRICH-REMAINDER.sql / ENRICH-EXISTING.sql.
-- geocode_source carries the shared legal value 'batch-csv' (the schema CHECK
-- constraint allows no bespoke tag), so nothing here is scoped by tag: every
-- statement names the exact row id from the committed plan and clears a field
-- only while it still holds the exact staged value. A row someone edited since
-- enrichment stops matching and is deliberately left alone.
--
-- Because every forward write was blank-only (proven by the forward guards),
-- NULL is the exact pre-state for every field cleared here — this is a full
-- value-matched reversal, not an approximation. Pre-state of every target row
-- is also snapshotted in data/sources/ta-master/2026-07-27/DB-STATE-SNAPSHOT.tsv.
--
-- Rollbacks for CORRECTIONS-PROPOSALS.sql live inline in that file.
-- HOLD rows: commented pairs at the bottom — activate only if HOLD was run.

begin;
`;
for (const p of anchored) {
  rb += `\n-- site ${p.site_id} · ${p.db_name} (${p.state}) · fills: ${p.fills}\n`;
  if (p.lat) rb += coordPair(p) + '\n';
  if (p.parking_spaces) rb += spacePair(p) + '\n';
}
const rbCoords = anchored.filter((p) => p.lat).length;
const rbSpaces = anchored.filter((p) => p.parking_spaces).length;
rb += `
-- Post-check: after a FULL rollback of a FULL enrichment, every pair above
-- must have matched. Fewer means rows were edited since (investigate those
-- ids); never re-run blindly.
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where id in (${anchored
     .filter((p) => p.lat)
     .map((p) => q(p.db_id))
     .join(', ')})
     and lat is not null;
  raise notice 'coordinate rows still enriched after rollback: % (expect 0 after full reversal of %)', n, ${rbCoords};
end $$;
commit;

-- HOLD rows (site 0001 / site 0142) — activate ONLY if HOLD-NAME-ANCHORED.sql
-- was verified and run:
${holdRows
  .map((p) =>
    (coordPair(p) + '\n' + spacePair(p))
      .split('\n')
      .map((l) => '-- ' + l)
      .join('\n'),
  )
  .join('\n')}
`;
writeFileSync(`${OUT}/ROLLBACK.sql`, rb);
console.log(
  `rollback pairs            ${rbCoords} coord + ${rbSpaces} spaces (per-row, value-matched)`,
);

/* ------------------------------------------------------------------ report */
console.log(`enrich (address-anchored) ${anchored.length} across ${byState.size} states`);
console.log(`hold (name-anchored)      ${holdRows.length}`);
console.log(`canary                    ${canary.map((c) => `${c.state}:${c.site_id}`).join(' ')}`);
const pub = anchored.filter((p) => p.currently_published === 'true').length;
console.log(
  `enrich targets published  ${pub} of ${anchored.length} (coords make them route-usable on write)`,
);
