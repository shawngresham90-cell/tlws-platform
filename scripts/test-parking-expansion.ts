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

/* ------------------------------- LAUNCH GATE ------------------------------ */
// The gate is the launch decision. If these thresholds drift, or the preserved
// baseline is quietly edited to look better, the build fails.
{
  const gate = readFileSync(`${DIR}/LAUNCH-GATE.md`, 'utf8');

  check('the gate declares the product not ready', /NOT READY/.test(gate));
  check(
    'total rows is explicitly rejected as the coverage metric',
    /Total rows are not the coverage metric/i.test(gate),
  );

  // All eight required thresholds, verbatim.
  for (const [label, pattern] of [
    ['Truck Parking Club 100%', /Truck Parking Club feed \|\s*\*\*100 %\*\*/],
    ["Love's 100%", /Love's Travel Stops \|\s*\*\*100 %\*\*/],
    ['Pilot/Flying J/ONE9 100%', /Pilot, Flying J and ONE9 \|\s*\*\*100 %\*\*/],
    ['TA/Petro/TA Express 100%', /TA, Petro and TA Express \|\s*\*\*100 %\*\*/],
    ['rest areas >= 95%', /rest areas, welcome centers, service plazas \|\s*\*\*≥ 95 %\*\*/],
    [
      'weigh stations 100% separate',
      /weigh stations, \*\*classified separately\*\* \|\s*\*\*100 %\*\*/,
    ],
    ['freight corridors >= 95%', /major freight corridors \|\s*\*\*≥ 95 %\*\*/],
    ['all Interstates >= 85%', /all Interstates \|\s*\*\*≥ 85 %\*\*/],
  ] as const) {
    check(`gate requires ${label}`, pattern.test(gate), gate.match(/\|.*%.*\|/g)?.slice(0, 8));
  }
  check('no gate line currently passes', !/\|\s*✅\s*\|/.test(gate));

  // The preserved baseline must keep reporting the real numbers.
  for (const [label, pattern] of [
    ['76 published parking', /\*\*76\*\*/],
    ['31 mappable', /\*\*31\*\*/],
    ['10 states covered', /\*\*10\*\*/],
    ['40 states with none', /\*\*40\*\*/],
    ['I-95 zero', /Published parking on \*\*I-95\*\* \|\s*\*\*0\*\*/],
    ['216 reconciled', /\*\*216\*\*/],
    ['Tier A zero', /\*\*Tier A candidates\*\* \|\s*\*\*0\*\*/],
    ['635 of 1,165 missing coordinates', /\*\*635 of 1,165\*\*/],
  ] as const) {
    check(`baseline preserves ${label}`, pattern.test(gate));
  }
  check(
    'Tier A = 0 is attributed to inaccessible coordinates, not a lowered bar',
    /Tier A is 0 because authoritative coordinates were inaccessible/.test(gate),
  );
  check(
    'the weigh-station rule is stated as binding in the gate',
    /must not be counted as truck parking/.test(gate),
  );
}

/* -------------------------- SOURCE ACQUISITION ---------------------------- */
{
  const acq = readFileSync(`${DIR}/SOURCE-ACQUISITION.md`, 'utf8');
  const json = JSON.parse(readFileSync(`${DIR}/source-acquisition.json`, 'utf8'));

  const REQUIRED = [
    'tpc-feed',
    'loves-master',
    'pilot-master',
    'ta-master',
    'fhwa-truck-parking',
    'statedot-restareas',
    'weigh-stations',
  ];
  check('all seven sources are listed', json.sources.length === 7, json.sources.length);
  for (const id of REQUIRED) {
    check(
      `source ${id} is present`,
      json.sources.some((s: { source_id: string }) => s.source_id === id),
    );
  }

  // Every field the brief requires, on every source.
  const FIELDS = [
    'url',
    'expected_format',
    'required_columns',
    'stable_source_id_field',
    'attribution',
    'update_frequency',
    'closure_signal',
    'priority',
    'deduplication',
    'represents',
  ];
  for (const s of json.sources as Record<string, unknown>[]) {
    for (const f of FIELDS) {
      check(
        `${s.source_id} specifies ${f}`,
        s[f] !== undefined && s[f] !== null && String(s[f]).length > 0,
      );
    }
    check(
      `${s.source_id} classifies what it represents`,
      (json.represents_values as string[]).some((v) => String(s.represents).includes(v)),
      s.represents,
    );
    check(`${s.source_id} lists required columns`, (s.required_columns as string[]).length >= 8);
  }

  check(
    'priorities are unique 1..7',
    new Set(json.sources.map((s: { priority: number }) => s.priority)).size === 7,
  );
  check("Love's is priority 1 and named as obtain-first", json.obtain_first === 'loves-master');
  check(
    "the markdown names Love's as the first file to obtain",
    /Obtain \*\*Love's Travel Stops\*\* first/.test(acq),
  );
  check(
    'every source carries a coordinate/space column requirement or is an operator feed',
    json.sources.every(
      (s: { required_columns: string[] }) =>
        s.required_columns.includes('latitude') && s.required_columns.includes('longitude'),
    ),
  );

  // Authorization and anti-scraping rules must be explicit and machine-readable.
  const tpc = json.sources.find((s: { source_id: string }) => s.source_id === 'tpc-feed');
  check('the TPC feed is marked authorization-required', tpc.authorization_required === true);
  check(
    'the no-scraping rule is machine-readable',
    /must not be reproduced without an authorized feed/.test(json.rules.no_scraping),
  );
  check('the markdown repeats the no-scraping rule', /Do not scrape/.test(acq));
  check(
    'the weigh-station rule is machine-readable',
    /never counted as truck parking/.test(json.rules.weigh_station_is_not_parking),
  );
  check('no invented attributes rule is present', !!json.rules.no_invented_attributes);
  check('no inferred coordinates rule is present', !!json.rules.no_inferred_coordinates);
  check('no speculative parsers rule is present', !!json.rules.no_speculative_parsers);
  check(
    'publication still requires separate authorization',
    json.rules.publication_requires_separate_authorization === true,
  );
  check(
    'the docs state that no URL was fetched this run',
    /No URL below was fetched or verified during this run/.test(acq) &&
      /was fetched or verified during this run/.test(json.note),
  );
  check(
    'the weigh-station source is typed as its own category, not parking',
    json.sources.find((s: { source_id: string }) => s.source_id === 'weigh-stations').represents ===
      'weigh_station',
  );
}

/* ------------------------------ INTAKE PROCESS ---------------------------- */
{
  const intake = readFileSync(`${DIR}/INTAKE-PROCESS.md`, 'utf8');
  const STEPS = [
    'Preserve the raw file and checksum it',
    'Parse without modifying the original',
    'Normalize fields',
    'Reconcile against existing rows',
    'Classify into updates, net-new, closures, duplicates',
    'Validate coordinates and route proximity',
    'Generate an unpublished, guarded import',
    'Run a small, diverse canary',
    'Measure coverage improvement',
    'Publish only after separate authorization',
  ];
  STEPS.forEach((s, i) => check(`intake step ${i + 1}: ${s}`, intake.includes(s)));
  check(
    'intake order is 1..10',
    STEPS.every((s, i) => intake.indexOf(s) > (i === 0 ? -1 : intake.indexOf(STEPS[i - 1]))),
  );
  check(
    'no speculative parser is built ahead of the file',
    /No parser exists yet, deliberately/.test(intake),
  );
  check(
    'net-new rows default to unpublished and unfeatured',
    /is_published = false`?, `?is_featured = false/.test(intake),
  );
  check(
    'is_indexable is left unchanged on intake',
    /`is_indexable` \*\*unchanged\*\*/.test(intake),
  );
  // Prose in these docs is hard-wrapped, so phrase assertions must tolerate a
  // newline anywhere a space appears.
  const phrase = (s: string) => new RegExp(s.replace(/ /g, '\\s+'));
  check(
    'closures are unpublished, never silently deleted',
    phrase('never a silent delete').test(intake),
  );
  check(
    'coverage is reported as % of source of record',
    /percentage of the source of record/.test(intake),
  );
  check(
    'row growth is explicitly rejected as a report',
    /is not a coverage statement/.test(intake),
  );
  check('the three authorizations stay separate', /three separate authorizations/.test(intake));
}

/* ------------------------------ LOVE'S INTAKE ----------------------------- */
// The first real source file. These lock the parking gate that produced the
// 604, and the defects the authoritative file exposed in our own data.
{
  const L = 'data/sources/loves-master/2026-07-27';
  const findings = readFileSync(`${L}/FINDINGS.md`, 'utf8');
  const profile = JSON.parse(readFileSync(`${L}/PROFILE.json`, 'utf8'));
  const checksum = readFileSync(`${L}/CHECKSUM.txt`, 'utf8');
  const norm = parseCsv(readFileSync(`${L}/normalized.csv`, 'utf8').trim());
  const quar = parseCsv(readFileSync(`${L}/quarantine.csv`, 'utf8').trim());
  const rec = parseCsv(readFileSync(`${L}/RECONCILIATION.csv`, 'utf8').trim());
  const conf = parseCsv(readFileSync(`${L}/CONFLICTS.csv`, 'utf8').trim());
  const snap = readFileSync(`${L}/DB-SNAPSHOT.tsv`, 'utf8').trim().split('\n');

  const SHA = 'ec5146ee475af473d037ed4913e4f9b4c1059c737581ff93d2b2eefcc5a89ab2';

  /* step 1: the raw file is preserved and pinned */
  check('raw file checksum is recorded', checksum.includes(SHA));
  check('the profile pins the same checksum', profile.sha256 === SHA);
  check(
    'the reconciler refuses to run if the source changes',
    readFileSync('scripts/reconcile-loves.mjs', 'utf8').includes(SHA),
  );

  /* step 2-3: parse and normalize, nothing invented */
  check('731 source rows parsed', profile.data_rows === 731 && norm.length === 731);
  check(
    'the profile records the columns the file lacks',
    profile.missing_expected_columns.includes('name') &&
      profile.missing_expected_columns.includes('status'),
  );
  check(
    'closure signal limited to absence is documented',
    /only closure signal available is\s+absence/i.test(findings.replace(/\*\*/g, '')),
  );
  check(
    'fuel prices are deliberately excluded',
    !Object.keys(norm[0]).some((k) => /fuel|diesel|unleaded|price/i.test(k)),
  );

  /* THE PARKING GATE — this is what produced 604 */
  const eligible = rec.filter((r) => r.disposition !== '');
  check('604 eligible truck-parking locations', eligible.length === 604, eligible.length);
  check(
    'every eligible row is a Travel Stop',
    eligible.every((r) => r.store_type === 'Travel Stop'),
    [...new Set(eligible.map((r) => r.store_type))],
  );
  check(
    'every eligible row has a stated space count > 0',
    eligible.every((r) => Number(r.parking_spaces) > 0),
  );
  check(
    'every eligible row has the operator overnight-parking flag',
    eligible.every((r) => r.overnight_parking === 'true'),
  );
  check(
    'every eligible row has a usable coordinate',
    eligible.every(
      (r) =>
        Number(r.lat) !== 0 &&
        Number(r.lng) !== 0 &&
        Number(r.lat) >= 24 &&
        Number(r.lat) <= 49.5 &&
        Number(r.lng) >= -125 &&
        Number(r.lng) <= -66.5,
    ),
  );

  /* CAR-ONLY and SERVICE-ONLY must never be eligible */
  for (const t of ['Car Stop', 'Truck Service', 'Country Store', 'Service Center']) {
    check(`no ${t} is eligible`, !eligible.some((r) => r.store_type === t));
    check(
      `${t} rows are quarantined`,
      quar.some((r) => r.store_type === t),
    );
  }
  check(
    'all 4 Car Stops are quarantined as car-only',
    quar.filter((r) => r.store_type === 'Car Stop').length === 4,
  );
  check(
    'the zero-space Travel Stop is quarantined',
    quar.some((r) => r.store_type === 'Travel Stop' && r.parking_spaces === '0'),
  );

  /* nothing dropped */
  check('eligible + quarantined = every source row', eligible.length + quar.length === 731);
  check(
    'every quarantined row carries an exact reason',
    quar.every((r) => r.quarantine_reason && r.quarantine_reason.length > 5),
  );

  /* no invented values */
  check(
    'no eligible row invents a space count of 0',
    !eligible.some((r) => r.parking_spaces === '0'),
  );
  // A stated 0 (Elk City #201) is honest data and must survive as 0; what must
  // never happen is a null being defaulted to 0. The source has 110 null space
  // counts, and all 110 must still be blank after normalization.
  check(
    'all 110 null space counts stayed blank, none defaulted to 0',
    quar.filter((r) => r.parking_spaces === '').length === 110,
    quar.filter((r) => r.parking_spaces === '').length,
  );
  // Six rows state a real 0 — Elk City #201 (a Travel Stop) and five Country
  // Stores. A stated zero is the operator saying "you cannot park here"; it is
  // data, and it must survive as 0 rather than being blanked or defaulted.
  check(
    'the six genuine zeros are preserved as 0, not blanked',
    quar.filter((r) => r.parking_spaces === '0').length === 6,
    quar.filter((r) => r.parking_spaces === '0').length,
  );
  check(
    'Elk City #201 is among them and is quarantined',
    quar.some((r) => r.source_ref === '201' && r.parking_spaces === '0'),
  );

  /* step 4: reconciliation is by store number against a verified snapshot */
  check('the DB snapshot holds 159 rows', snap.length - 1 === 159);
  check(
    'the snapshot digest is recorded and matches production',
    findings.includes('95c858c847c26d96ed799fae06529c83'),
  );
  check('541 net-new', rec.filter((r) => r.disposition === 'net-new').length === 541);
  check('62 update-existing', rec.filter((r) => r.disposition === 'update-existing').length === 62);

  /* step 5: the defects the authoritative file exposed */
  check('2 store-number conflicts detected', conf.length === 2, conf.length);
  check(
    '#618 conflict: source KY, DB also MI',
    conf.some((c) => c.source_ref === '618' && c.source_state === 'KY' && /MI/.test(c.db_states)),
  );
  check(
    '#420 conflict: source MS, DB SC',
    conf.some((c) => c.source_ref === '420' && c.source_state === 'MS' && c.db_states === 'SC'),
  );
  check(
    'the findings name the three PUBLISHED rows at risk',
    ['c32686ff', '485085d9', 'f6404302'].every((id) => findings.includes(id)),
  );
  check(
    '#306 Dandridge is called out as a closure candidate',
    /#306 is absent from the authoritative list/i.test(findings.replace(/\*\*/g, '')),
  );
  check(
    'the two non-defects are recorded so they are not re-raised',
    /Boss Truck Shop/.test(findings) && /trailing space/.test(findings),
  );
  check(
    'no row was changed in the database this run',
    /No\s+database\s+write\s+was\s+performed/i.test(findings),
  );

  /* colocation must not weaken the shared-coordinate guard */
  check(
    '45 colocated sites identified',
    rec.filter((r) => /colocated/.test(r.note)).length === 45,
    rec.filter((r) => /colocated/.test(r.note)).length,
  );
  check(
    'the guard is explicitly not weakened for colocation',
    /The guard must not be weakened/.test(findings),
  );

  /* completeness is not overclaimed */
  check(
    'completeness is flagged as unproven, not asserted',
    /should not be marked 100 % until Shawn confirms/i.test(findings.replace(/\*\*/g, '')),
  );
  const gate = readFileSync(`${DIR}/LAUNCH-GATE.md`, 'utf8');
  check(
    "the gate marks Love's in progress, not passed",
    /Love's Travel Stops \|\s*\*\*100 %\*\*\s*\|\s*\*\*604 eligible in hand\*\*/.test(gate),
  );
  check('the gate still reports that no line passes', /No gate line passes/.test(gate));
  check(
    'the preserved baseline still reads Tier A = 0',
    /\*\*Tier A candidates\*\* \|\s*\*\*0\*\*/.test(gate),
  );
}

console.log(`\nparking-expansion: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
