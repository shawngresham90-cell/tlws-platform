/**
 * Nationwide truck-parking expansion — gate tests.
 *
 * These are deliberately biting. The failure this suite exists to prevent is
 * a plausible-looking parking record reaching the directory when it is
 * actually a weigh station, a car-only rest area, a private lot with no
 * source, a duplicate carriageway, or a facility with no coordinate. Each of
 * those has a test that fails loudly rather than a comment asking someone to
 * be careful.
 *
 * Everything here runs offline against the committed manifest and SQL.
 *
 * Run:
 *   npx esbuild scripts/test-parking-expansion.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const DIR = 'data/imports/nationwide-parking-2026-07-26';
const csv = readFileSync(`${DIR}/RECONCILIATION-216.csv`, 'utf8');
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'));
const apply = readFileSync(`${DIR}/ENRICH-TEMPLATE.sql`, 'utf8');
const publish = readFileSync(`${DIR}/PUBLISH-TEMPLATE.sql`, 'utf8');
const rollback = readFileSync(`${DIR}/ROLLBACK-TEMPLATE.sql`, 'utf8');
const reconcile = readFileSync(`${DIR}/RECONCILE.sql`, 'utf8');
const fingerprint = readFileSync(`${DIR}/FINGERPRINT.sql`, 'utf8');

type Row = Record<string, string>;

/** Minimal RFC4180 reader — facility names carry commas and apostrophes, and a
 *  split(',') mangles them into undefined fields that quietly skip tests. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
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
}

const rows: Row[] = parseCsv(csv.trim());

/* ------------------------------- the manifest is the live set ------------- */
{
  check('216 rows reconciled', rows.length === 216, rows.length);
  check(
    'every row carries a disposition',
    rows.every((r) => r.tier_disposition && r.tier_disposition.length > 0),
  );
  check(
    'every row is either A-PENDING-COORDINATE or an explicit C: reason',
    rows.every(
      (r) => r.tier_disposition === 'A-PENDING-COORDINATE' || r.tier_disposition.startsWith('C:'),
    ),
  );
  check('no row id repeats', new Set(rows.map((r) => r.id)).size === 216);
  check(
    'the CSV id digest is recorded so the copy can be re-proved',
    reconcile.includes('1d707c73ad5f2aad741a20b7d88c7d92') &&
      manifest.database_scope_id_digest === '1d707c73ad5f2aad741a20b7d88c7d92',
  );
}

/* ------------------------------------- ACCIDENTAL PUBLICATION ------------- */
// The single most damaging failure mode: something in this package publishing.
{
  check('Tier A approved for publication is zero', manifest.tier_a_approved_for_publication === 0);
  check('no canary is proposed', manifest.canary_proposed === 0);
  check(
    'no candidate is marked eligible for a canary',
    manifest.candidates.every((c: { eligible_for_canary: boolean }) => !c.eligible_for_canary),
  );
  check(
    'any future insert defaults to unpublished',
    manifest.defaults_for_any_future_insert.is_published === false,
  );
  check(
    'any future insert defaults to unfeatured',
    manifest.defaults_for_any_future_insert.is_featured === false,
  );
  check(
    'is_indexable is left unchanged, not set',
    manifest.defaults_for_any_future_insert.is_indexable === 'unchanged',
  );

  // The enrichment statement must never publish, and must prove it afterwards.
  check('enrichment sets no is_published', !/set[\s\S]{0,400}?is_published\s*=/i.test(apply));
  check('enrichment sets no is_featured', !/set[\s\S]{0,400}?is_featured\s*=/i.test(apply));
  check(
    'enrichment post-checks that nothing became published',
    /Enrichment must never publish/.test(apply),
  );
  // No statement in the package may touch indexability.
  for (const [label, sql] of [
    ['enrich', apply],
    ['publish', publish],
    ['rollback', rollback],
  ] as const) {
    check(`${label} never writes is_indexable`, !/is_indexable\s*=/i.test(sql));
  }
  // Nothing is inserted this run.
  check(
    'no statement inserts into locations',
    ![apply, publish, rollback].some((s) => /insert\s+into\s+public\.locations/i.test(s)),
  );
}

/* ------------------------------------------- MISSING COORDINATES ---------- */
{
  check(
    'publication requires a coordinate in the guard',
    /Publication requires one/.test(publish) && /lat is null or l\.lng is null/i.test(publish),
  );
  check(
    'publication re-enforces coordinates at the write itself',
    /where id in \(select id from _publish\)[\s\S]{0,120}lat is not null and lng is not null/i.test(
      publish,
    ),
  );
  check('publication rejects a zero coordinate', /l\.lat = 0 or l\.lng = 0/.test(publish));
  check(
    'every pending candidate has a null coordinate (none invented)',
    manifest.candidates.every(
      (c: { lat: unknown; lng: unknown }) => c.lat === null && c.lng === null,
    ),
  );
}

/* --------------------------------------------- WEIGH STATIONS ------------- */
// A weigh station is not parking. Only an explicit agency confirmation moves
// one, and nothing in the pending set may be an unconfirmed scale.
{
  const weigh = rows.filter((r) => r.facility_type === 'weigh_inspection');
  check('43 weigh/inspection rows identified', weigh.length === 43, weigh.length);
  check(
    'no weigh/inspection row is pending publication',
    weigh.every((r) => r.tier_disposition.startsWith('C:')),
    weigh.filter((r) => !r.tier_disposition.startsWith('C:')).map((r) => r.name),
  );
  check(
    'weigh rows without parking evidence are quarantined as inspection-only',
    weigh
      .filter((r) => r.truck_parking_evidence === 'no')
      .every((r) => r.tier_disposition === 'C:quarantine-inspection-only-no-parking-evidence'),
  );
  check(
    'a weigh row WITH parking text still needs confirmation, not a pass',
    weigh
      .filter((r) => r.truck_parking_evidence === 'yes')
      .every((r) => r.tier_disposition === 'C:quarantine-weigh-needs-parking-confirmation'),
  );
  // The converted-site exception must be typed as parking, not inspection.
  const converted = rows.filter((r) => /former .*weigh station|weigh station,/i.test(r.name));
  check(
    'TDOT converted weigh stations are typed truck_parking, not weigh',
    converted.length > 0 && converted.every((r) => r.facility_type === 'truck_parking'),
    converted.map((r) => `${r.name} -> ${r.facility_type}`),
  );
  check(
    'the classifier matches "former weigh station" BEFORE the generic weigh rule',
    reconcile.indexOf('former .*weigh station') < reconcile.indexOf("THEN 'weigh_inspection'"),
  );
}

/* ------------------------------------------------ CAR-ONLY ---------------- */
// A rest area is not automatically truck parking.
{
  const restish = rows.filter((r) =>
    ['rest_area', 'welcome_center', 'service_plaza'].includes(r.facility_type),
  );
  check(
    'no rest area / welcome centre is pending without truck-parking evidence',
    restish
      .filter((r) => r.tier_disposition === 'A-PENDING-COORDINATE')
      .every((r) => r.truck_parking_evidence === 'yes'),
  );
  check(
    'rest areas with no truck-parking evidence are quarantined, not assumed',
    restish
      .filter((r) => r.truck_parking_evidence === 'no' && r.source_class === 'official')
      .every((r) => r.tier_disposition === 'C:quarantine-truck-parking-unconfirmed'),
  );
}

/* ------------------------------------------ BLANK SOURCE EVIDENCE --------- */
{
  check(
    'no pending row rests on a third-party or missing source',
    rows
      .filter((r) => r.tier_disposition === 'A-PENDING-COORDINATE')
      .every((r) => r.source_class === 'official'),
  );
  check(
    'third-party and sourceless rows are quarantined by that name',
    rows
      .filter(
        (r) =>
          r.source_class !== 'official' &&
          !['non_parking_business', 'weigh_inspection'].includes(r.facility_type),
      )
      .every((r) => r.tier_disposition === 'C:quarantine-no-official-source'),
  );
  check(
    'enrichment refuses blank or non-https provenance',
    /blank or non-https source evidence/.test(apply),
  );
  check('enrichment requires a named source agency', /btrim\(source_agency\) = ''/.test(apply));
  check(
    'every pending candidate names the agency whose dataset is required',
    manifest.candidates.every((c: { source_agency: string }) => !!c.source_agency),
  );
  check(
    'no candidate claims a source_url it never fetched',
    manifest.candidates.every((c: { source_url: unknown }) => c.source_url === null),
  );
  check(
    'no candidate invents a space count, hours, or amenities',
    manifest.candidates.every(
      (c: { parking_spaces: unknown; hours_or_restrictions: unknown; amenities: unknown }) =>
        c.parking_spaces === null && c.hours_or_restrictions === null && c.amenities === null,
    ),
  );
}

/* ------------------------------- DUPLICATE DIRECTIONAL FACILITIES --------- */
{
  const base = (n: string) =>
    n
      .toLowerCase()
      .replace(/\b(nb|sb|eb|wb|northbound|southbound|eastbound|westbound)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const pairsIn = (pred: (r: Row) => boolean) => {
    const groups = new Map<string, Row[]>();
    for (const r of rows.filter(pred)) {
      const k = `${r.state}|${r.interstate}|${base(r.name)}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  };
  const PARKING_TYPES = ['rest_area', 'welcome_center', 'service_plaza', 'truck_parking'];
  const parkingPairs = pairsIn((r) => PARKING_TYPES.includes(r.facility_type));
  const weighPairs = pairsIn((r) => r.facility_type === 'weigh_inspection');
  const pairs = pairsIn((r) => r.facility_type !== 'non_parking_business');

  check(
    '8 directional pairs among parking facilities',
    parkingPairs.length === 8,
    parkingPairs.length,
  );
  check('8 directional pairs among weigh stations', weighPairs.length === 8, weighPairs.length);
  check(
    '16 directional pairs in total, 32 rows',
    pairs.length === 16 && pairs.flat().length === 32,
  );
  check(
    'both halves of every pair carry a direction',
    pairs.every((g) => g.every((r) => r.direction !== '')),
    pairs.filter((g) => g.some((r) => r.direction === '')).map((g) => g[0].name),
  );
  check(
    'the two halves of a pair never share a direction',
    pairs.every((g) => new Set(g.map((r) => r.direction)).size === g.length),
  );
  check(
    'directional pairs are kept as separate rows, never merged',
    pairs.every((g) => new Set(g.map((r) => r.id)).size === g.length),
  );
  check(
    'enrichment refuses two facilities sharing one coordinate',
    /shared by more than one facility in this batch/.test(apply),
  );

  // Same physical facility split across categories must be flagged, not silently published.
  const sameFacility = manifest.candidates.filter(
    (c: { same_facility_group?: string }) => c.same_facility_group,
  );
  check('4 same-facility rows flagged (2 MDTA plazas)', sameFacility.length === 4);
  check(
    'they resolve to exactly 2 physical facilities',
    new Set(
      sameFacility.map((c: { same_facility_group: string }) =>
        c.same_facility_group.replace(/ \(.*\)$/, ''),
      ),
    ).size === 2,
  );
  check(
    'publication rechecks duplicates inside the transaction against live data',
    /duplicate detail_slug\(s\) inside the batch/.test(publish) &&
      /collide with an already-published detail_slug/.test(publish),
  );
  check(
    'publication rejects a coordinate-proximity collision',
    /within ~150 m of a published location/.test(publish),
  );
}

/* ------------------------------------------------ HELD NETWORKS ----------- */
{
  const HELD = /love'?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton/i;
  check(
    'no reconciled row names a held network',
    rows.every((r) => !HELD.test(r.name)),
    rows.filter((r) => HELD.test(r.name)).map((r) => r.name),
  );
  check(
    'no candidate names a held network',
    manifest.candidates.every((c: { name: string }) => !HELD.test(c.name)),
  );
  check('enrichment asserts no held network', /name a held network/.test(apply));
  check('publication asserts no held network', /name a held network/.test(publish));
  check(
    'the fingerprint tracks held rows as must-not-change, not must-be-zero',
    /held_published_MUST_NOT_CHANGE/.test(fingerprint),
  );
}

/* --------------------------- INTERSTATE / EXIT FORMATTING ----------------- */
{
  const parking = rows.filter((r) => r.facility_type !== 'non_parking_business');
  check(
    'every parking-relevant row has a corridor',
    parking.every((r) => r.interstate.length > 0),
  );
  check(
    'every corridor matches I-<number>',
    parking.every((r) => /^I-\d{1,3}$/.test(r.interstate)),
    [...new Set(parking.map((r) => r.interstate))].filter((i) => !/^I-\d{1,3}$/.test(i)),
  );
  check(
    'direction, when present, is one of NB/SB/EB/WB',
    rows.every((r) => r.direction === '' || ['NB', 'SB', 'EB', 'WB'].includes(r.direction)),
  );
  check(
    'candidates record direction as null rather than an empty string',
    manifest.candidates.every(
      (c: { direction: string | null }) =>
        c.direction === null || ['NB', 'SB', 'EB', 'WB'].includes(c.direction),
    ),
  );
}

/* --------------------------------------- THE GA CARSON ANOMALY ------------ */
{
  const ga = manifest.candidates.find(
    (c: { id: string }) => c.id === '49bf9a34-856c-4427-b94b-c8af02009a4c',
  );
  check('the GA Carson row is present in the manifest', !!ga);
  check('it is quarantined', ga?.confidence === 'quarantined');
  check('it is not canary-eligible', ga?.eligible_for_canary === false);
  check(
    'its quarantine reason names the conflict',
    /Carson is a VDOT facility/.test(ga?.quarantine_reason ?? ''),
  );
  check(
    'the VA original is a separate row',
    manifest.candidates.some(
      (c: { id: string }) => c.id === '0b924a84-cb2d-4876-b433-f63fdfa47c78',
    ),
  );
}

/* ------------------------------------------ ROLLBACK COMPLETENESS --------- */
{
  check('a rollback exists for publication', /UNPUBLISH/.test(rollback));
  check('a rollback exists for enrichment', /DE-ENRICH/.test(rollback));
  check(
    'the de-enrich rollback is value-matched, not blind',
    /no longer hold the coordinate this rollback was written against/.test(rollback),
  );
  check(
    'the de-enrich rollback restores every column enrichment wrote',
    [
      'lat = null',
      'lng = null',
      'geocode_source = null',
      'geocode_confidence = null',
      'coord_verification_status = null',
      'last_geocoded_at = null',
    ].every((c) => rollback.includes(c)),
  );
  check(
    'rollback refuses to strip a coordinate from a published page',
    /Run the UNPUBLISH block first/.test(rollback),
  );
  // Symmetry: everything the forward statements write must be reversible.
  const written = [
    'lat',
    'lng',
    'geocode_source',
    'geocode_confidence',
    'coord_verification_status',
    'last_geocoded_at',
  ];
  check(
    'every enriched column appears in the rollback',
    written.every((c) => rollback.includes(c)),
    written.filter((c) => !rollback.includes(c)),
  );
  check('both rollback blocks are transactional', (rollback.match(/^begin;/gm) ?? []).length === 2);
  check('both rollback blocks commit', (rollback.match(/^commit;/gm) ?? []).length === 2);
}

/* ------------------------------------------------ GUARD SHAPE ------------- */
{
  for (const [label, sql] of [
    ['enrich', apply],
    ['publish', publish],
  ] as const) {
    check(`${label} is transactional`, /^begin;/m.test(sql) && /^commit;/m.test(sql));
    check(`${label} asserts an exact ROW_COUNT`, /get diagnostics n = row_count/i.test(sql));
    check(`${label} raises on an unexpected row count`, /Expected to \w+ exactly/.test(sql));
    check(`${label} matches rows by exact id, never by name`, !/where\s+l?\.?name\s*=/i.test(sql));
  }
  check('enrichment is blank-only', /lat is null and lng is null/i.test(apply));
  check(
    'enrichment refuses to overwrite an existing coordinate',
    /already carry coordinates\. This statement never overwrites/.test(apply),
  );
  check(
    'enrichment bounds-checks against the row own state',
    /_bounds b on b\.state = l\.state/.test(apply),
  );
  check(
    'an unknown state fails closed rather than skipping the bounds check',
    /no bounding box on file\. Add it to _bounds rather than skipping the check/.test(apply),
  );
  check('publication runs one state per transaction', /target_state/.test(publish));
  check(
    'no template is executable as committed (empty VALUES list)',
    /values\s*\n\s*--/.test(apply) && /values\s*\n\s*--/.test(publish),
  );
}

/* ------------------------------------------------ READ-ONLY RUN ----------- */
{
  check(
    'RECONCILE.sql is read-only',
    !/\b(insert|update|delete|truncate|alter|drop)\b/i.test(reconcile.replace(/--[^\n]*/g, '')),
  );
  check(
    'FINGERPRINT.sql is read-only',
    !/\b(insert|update|delete|truncate|alter|drop)\b/i.test(fingerprint.replace(/--[^\n]*/g, '')),
  );
  check(
    'the blocked-source record exists and names the policy, not a workaround',
    /connect_rejected/.test(readFileSync(`${DIR}/BLOCKED-SOURCES.md`, 'utf8')),
  );
}

console.log(`\nparking-expansion: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
