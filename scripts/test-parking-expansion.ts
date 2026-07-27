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
const gate = readFileSync(`${DIR}/LAUNCH-GATE.md`, 'utf8');
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
  check('the gate declares the product not ready', /NOT READY/.test(gate));
  check(
    'total rows is explicitly rejected as the coverage metric',
    /Total rows are not the coverage metric/i.test(gate),
  );

  // All eight required thresholds, verbatim.
  for (const [label, pattern] of [
    ['Truck Parking Club 100%', /Truck Parking Club feed \|\s*\*\*100 %\*\*/],
    ["Love's 2a directory 100% of 615", /directory coverage\*\* \|\s*\*\*100 % of 615\*\*/],
    ["Love's 2b overnight 100% of 604", /overnight-parking coverage\*\* \|\s*\*\*100 % of 604\*\*/],
    ['Pilot 3a directory 100% of 820', /U\.S\. directory coverage\*\* \|\s*\*\*100 % of 820\*\*/],
    ['Pilot 3b parking 100% of 803', /U\.S\. truck-parking coverage\*\* \|\s*\*\*100 % of 803\*\*/],
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
    'every source requires a latitude and a longitude column',
    json.sources.every((s: { required_columns: string[] }) => {
      // An acquired source records the file's REAL header names; an unacquired
      // one still carries the generic checklist. Both must demand coordinates.
      const lower = s.required_columns.map((c) => c.toLowerCase());
      return lower.includes('latitude') && lower.includes('longitude');
    }),
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
  check('the gate still reports that no line passes', /No gate line passes/.test(gate));
  check(
    'the preserved baseline still reads Tier A = 0',
    /\*\*Tier A candidates\*\* \|\s*\*\*0\*\*/.test(gate),
  );
}

/* ==========================================================================
 * LOVE'S — the two gates must stay separate, and 11 stores must never be
 * offered as overnight parking.
 * ======================================================================== */
{
  const S = 'data/sources/loves-master/2026-07-27';
  const P = 'data/imports/loves-2026-07-27';
  const dir615 = parseCsv(readFileSync(`${S}/DIRECTORY-615.csv`, 'utf8'));
  const over604 = parseCsv(readFileSync(`${S}/OVERNIGHT-604.csv`, 'utf8'));
  const non11 = parseCsv(readFileSync(`${S}/NON-OVERNIGHT-11.csv`, 'utf8'));

  check('gate 2a universe is 615', dir615.length === 615, dir615.length);
  check('gate 2b universe is 604', over604.length === 604, over604.length);
  check('11 non-overnight Travel Stops', non11.length === 11, non11.length);
  check('615 = 604 + 11', over604.length + non11.length === dir615.length);

  /* The two gates are DIFFERENT numbers. A single figure reported for both is
   * the specific mistake this block exists to catch. */
  check('2a and 2b are not the same number', over604.length !== dir615.length);

  check(
    'every one of the 604 is overnight-eligible with a positive space count',
    over604.every((r) => r.overnight_parking === 'true' && Number(r.parking_spaces) > 0),
  );
  check(
    'no non-overnight store leaks into the 604',
    !over604.some((r) => non11.some((n) => n.source_ref === r.source_ref)),
  );
  check(
    'every one of the 11 is still represented as a truck stop',
    non11.every(
      (r) => r.store_type === 'Travel Stop' && r.directory_representation === 'truck stop',
    ),
  );
  check(
    'every one of the 11 is explicitly barred from parking',
    non11.every((r) => /never offered as overnight/i.test(r.parking_representation)),
  );

  /* #201 Elk City has zero stated spaces and must not qualify as parking. */
  const elk = non11.find((r) => r.source_ref === '201');
  check('#201 Elk City is in the non-overnight set', Boolean(elk));
  check('#201 Elk City states zero spaces', elk?.parking_spaces === '0', elk?.parking_spaces);
  check('#201 Elk City is in Oklahoma', elk?.state === 'OK', elk?.state);
  check(
    '#201 Elk City never appears in the overnight set',
    !over604.some((r) => r.source_ref === '201'),
  );

  const publishState = readFileSync(`${P}/PUBLISH-PER-STATE.sql`, 'utf8');
  const canarySql = readFileSync(`${P}/PUBLISH-CANARY.sql`, 'utf8');
  const insertSql = readFileSync(`${P}/INSERT-NET-NEW.sql`, 'utf8');
  const verifySql = readFileSync(`${P}/VERIFY.sql`, 'utf8');

  check(
    'per-state publish filters on the overnight flag',
    /overnight_parking is true/.test(publishState),
  );
  check(
    'per-state publish asserts no non-overnight row was published',
    /non-overnight row\(s\) were published/.test(publishState),
  );
  check('canary rejects non-overnight rows', /are not overnight-eligible/.test(canarySql));
  check(
    'verify carries the non-overnight safety invariant',
    /overnight_parking is not true/.test(verifySql),
  );

  /* Nothing may arrive published, featured, or with is_indexable touched. */
  check('inserts are unpublished and unfeatured', /is_published, is_featured\)/.test(insertSql));
  check(
    "is_indexable is never written by the Love's insert",
    !/is_indexable\s*=/.test(insertSql) && !/is_indexable[,)]/.test(insertSql),
  );
  check(
    'the insert keeps the coordinate-collision guard',
    /coordinate\(s\) shared by more than one site/.test(insertSql),
  );

  /* Map-pin rule: colocated service rows are reconciled but get no pin. */
  const svc = parseCsv(readFileSync(`${S}/COLOCATED-SERVICE-ROWS.csv`, 'utf8'));
  check('colocated service rows are reconciled', svc.length === 62, svc.length);
  check(
    'no colocated service row receives a map pin',
    svc.every((r) => r.receives_map_pin === 'false'),
  );
  const enr = parseCsv(readFileSync(`${S}/ENRICHMENT-PLAN.csv`, 'utf8'));
  check(
    'every enrichment target receives the pin',
    enr.every((r) => r.receives_map_pin === 'true'),
  );
  check('62 map pins enriched', enr.length === 62, enr.length);

  /* Corrections package: exact IDs, nothing deleted, Florence left alone. */
  const corr = readFileSync(`${P}/CORRECTIONS.sql`, 'utf8');
  for (const id of [
    'c32686ff-6cf3-4422-af97-80b823e07eb9',
    '485085d9-98c6-4e88-9661-862c3bc0c514',
    'f6404302-7971-4884-8f37-82f098913d65',
  ]) {
    check(`corrections target ${id.slice(0, 8)} by exact id`, corr.includes(id));
  }
  check('corrections never delete', !/\bdelete\s+from\b/i.test(corr.replace(/^\s*--.*$/gm, '')));
  check('corrections guard the exactly-3 row count', /expected 3 published target rows/.test(corr));
  check('corrections protect the correct KY #618 rows', /Sadieville/.test(corr));
  check('corrections carry a value-matched rollback', /republish exactly 3 row\(s\)/.test(corr));
  check(
    'Florence SC is quarantined with no statement proposed',
    /beb05d53-db50-49cb-8790-ec01b45c8187/.test(corr) &&
      !/update[\s\S]{0,400}beb05d53/i.test(corr.replace(/^\s*--.*$/gm, '')),
  );
  const quarantineMd = readFileSync(`${P}/QUARANTINE.md`, 'utf8');
  check('Florence has a quarantine record', /beb05d53/.test(quarantineMd));

  /* The launch gate must split 2a and 2b, and must not mark either passed. */
  check('gate line 2a names the 615 directory universe', /\*\*2a\*\*[\s\S]{0,200}?615/.test(gate));
  check('gate line 2b names the 604 overnight universe', /\*\*2b\*\*[\s\S]{0,200}?604/.test(gate));
  check(
    "neither Love's gate is marked passed",
    !/\*\*2a\*\*[^\n]*✅/.test(gate) && !/\*\*2b\*\*[^\n]*✅/.test(gate),
  );
  check(
    'the gate states that a complete source is not coverage',
    /That closes the acquisition\. It does not move either gate\./.test(gate),
  );

  const acq = JSON.parse(readFileSync(`${DIR}/source-acquisition.json`, 'utf8')) as {
    sources: Record<string, unknown>[];
    obtain_next: string;
  };
  const loves = acq.sources.find((s) => s.source_id === 'loves-master') as Record<string, unknown>;
  check("Love's acquisition is complete", loves.acquisition_status === 'COMPLETE');
  check(
    "Love's required columns no longer claim a status column",
    !(loves.required_columns as string[]).includes('status'),
  );
  check(
    "Love's records the absent status column",
    (loves.columns_absent_from_export as string[]).includes('status'),
  );
  const lg = loves.gates as Record<string, number | string>;
  check("Love's manifest keeps 2a = 615", lg['2a_directory_coverage'] === 615);
  check("Love's manifest keeps 2b = 604", lg['2b_overnight_parking_coverage'] === 604);
}

/* ==========================================================================
 * PILOT / FLYING J / ONE9 — U.S. denominators, brand identity, zero-space
 * exclusion, and the refusal to invent overnight permission.
 * ======================================================================== */
{
  const S = 'data/sources/pilot-master/2026-07-27';
  const P = 'data/imports/pilot-2026-07-27';
  const dir820 = parseCsv(readFileSync(`${S}/DIRECTORY-820.csv`, 'utf8'));
  const park803 = parseCsv(readFileSync(`${S}/PARKING-803.csv`, 'utf8'));
  const zero17 = parseCsv(readFileSync(`${S}/ZERO-SPACE-17.csv`, 'utf8'));
  const canada55 = parseCsv(readFileSync(`${S}/CANADA-55.csv`, 'utf8'));
  const normUs = parseCsv(readFileSync(`${S}/normalized-us.csv`, 'utf8'));

  /* ---- denominators. 875 is never the U.S. number. ---- */
  check('gate 3a universe is 820 U.S. locations', dir820.length === 820, dir820.length);
  check('gate 3b universe is 803', park803.length === 803, park803.length);
  check('17 zero-space U.S. locations', zero17.length === 17, zero17.length);
  check('55 Canadian locations held separately', canada55.length === 55, canada55.length);
  check('820 = 803 + 17', park803.length + zero17.length === dir820.length);
  check('875 = 820 + 55', dir820.length + canada55.length === 875);
  check('3a and 3b are not the same number', park803.length !== dir820.length);
  check('the U.S. file contains no Canadian row', normUs.length === 820);
  const CA = new Set([
    'AB',
    'BC',
    'MB',
    'NB',
    'NL',
    'NS',
    'NT',
    'NU',
    'ON',
    'PE',
    'QC',
    'SK',
    'YT',
  ]);
  check('no province leaks into the U.S. set', !normUs.some((r) => CA.has(r.state)));
  check(
    'every Canadian row really is Canadian',
    canada55.every((r) => CA.has(r.state)),
  );
  check('43 U.S. states', new Set(normUs.map((r) => r.state)).size === 43);
  check(
    '72,189 stated U.S. parking spaces',
    park803.reduce((a, r) => a + Number(r.parking_spaces), 0) === 72189,
  );

  /* ---- zero-space locations must never be parking ---- */
  check(
    'every zero-space row states 0, not blank',
    zero17.every((r) => r.parking_spaces === '0'),
  );
  check(
    'every zero-space row is barred from parking and last-stop',
    zero17.every(
      (r) =>
        /never returned as parking/i.test(r.parking_representation) &&
        /never a last-legal-stop recommendation/i.test(r.parking_representation),
    ),
  );
  check(
    'no zero-space row leaks into the parking set',
    !park803.some((r) => zero17.some((z) => z.source_ref === r.source_ref)),
  );
  check(
    'every parking row has a positive count',
    park803.every((r) => Number(r.parking_spaces) > 0),
  );

  /* ---- overnight permission is never invented ---- */
  check(
    'no U.S. row asserts overnight permission',
    normUs.every((r) => r.overnight_parking === ''),
  );
  check(
    'no U.S. row asserts parking restrictions',
    normUs.every((r) => r.parking_restrictions === ''),
  );

  /* ---- brand identity preserved ---- */
  const brands = new Set(normUs.map((r) => r.official_name));
  for (const b of [
    'Pilot Travel Center',
    'Flying J Travel Center',
    'ONE9 Travel Center',
    'ONE9 Dealer',
    'Pilot Dealer',
    'Mr. Fuel Travel Center',
    'Pilot Licensed Location',
    'Flying J Dealer',
  ]) {
    check(`brand preserved: ${b}`, brands.has(b));
  }
  check(
    'both published ONE9 casings are preserved',
    brands.has('ONE9 Travel Center') && brands.has('One9 Travel Center'),
  );
  check('nothing was flattened to a bare "Pilot"', !brands.has('Pilot'));
  check(
    'every derived name keeps the official name and the store number',
    normUs.every((r) => r.name === `${r.official_name} #${r.source_ref}`),
  );

  /* ---- coordinates are the operator's, never inferred ---- */
  check(
    'every U.S. row carries a coordinate',
    normUs.every((r) => r.lat !== '' && r.lng !== ''),
  );
  check(
    'every coordinate sits in the continental envelope',
    normUs.every(
      (r) =>
        Number(r.lat) >= 24 &&
        Number(r.lat) <= 49.5 &&
        Number(r.lng) >= -125 &&
        Number(r.lng) <= -66.5,
    ),
  );
  check(
    'no two U.S. locations share a coordinate',
    new Set(normUs.map((r) => `${r.lat},${r.lng}`)).size === 820,
  );
  check('no duplicate store numbers', new Set(normUs.map((r) => r.source_ref)).size === 820);

  /* ---- every row is classified in both directions ---- */
  const dispo = new Map<string, number>();
  for (const r of dir820) dispo.set(r.disposition, (dispo.get(r.disposition) ?? 0) + 1);
  check(
    'every official row has a disposition',
    dir820.every((r) => r.disposition !== ''),
  );
  check(
    '705 net-new with parking',
    dispo.get('net-new-official-location') === 705,
    dispo.get('net-new-official-location'),
  );
  check('87 exact authoritative matches', dispo.get('exact-authoritative-match') === 87);
  check('14 net-new zero-space', dispo.get('net-new-zero-space-directory-only') === 14);
  check('8 blank-only enrichments', dispo.get('blank-only-enrichment') === 8);
  check(
    '5 matched by address rather than store number',
    dispo.get('address-matched-enrichment') === 5,
  );
  check('1 conflicting record', dispo.get('conflicting-record') === 1);

  const closure = parseCsv(readFileSync(`${S}/CLOSURE-REVIEW.csv`, 'utf8'));
  const services = parseCsv(readFileSync(`${S}/COLOCATED-SERVICE-ROWS.csv`, 'utf8'));
  const enrich = parseCsv(readFileSync(`${S}/ENRICHMENT-PLAN.csv`, 'utf8'));
  const conflicts = parseCsv(readFileSync(`${S}/CONFLICTS.csv`, 'utf8'));
  check('all 222 directory rows are accounted for', 101 + services.length + closure.length === 222);
  check('92 colocated service rows', services.length === 92, services.length);
  check('29 rows in closure review', closure.length === 29, closure.length);
  check('84 enrichment targets', enrich.length === 84, enrich.length);
  check('5 conflicting records', conflicts.length === 5, conflicts.length);

  /* ---- absence from one export never triggers a delete or an unpublish ---- */
  check(
    'every closure-review row records NO action',
    closure.every((r) => /^NONE\./.test(r.action)),
  );
  check(
    'closure review states that absence is not proof of closure',
    closure.every((r) => /not proof of closure/.test(r.action)),
  );
  const closureSqlLeak = [
    'INSERT-NET-NEW.sql',
    'ENRICH-EXISTING.sql',
    'PUBLISH-CANARY.sql',
    'PUBLISH-PER-STATE.sql',
  ].map((f) => readFileSync(`${P}/${f}`, 'utf8').replace(/^\s*--.*$/gm, ''));
  check(
    'no forward statement deletes anything',
    closureSqlLeak.every((s) => !/\bdelete\s+from\b/i.test(s)),
  );
  check(
    'no forward statement unpublishes anything',
    closureSqlLeak.every((s) => !/is_published\s*=\s*false/i.test(s)),
  );

  /* ---- matching never relies on a loose business name ---- */
  check(
    'every match records its evidence',
    dir820
      .filter((r) => !r.disposition.startsWith('net-new'))
      .every((r) => r.match_evidence !== ''),
  );
  check(
    'no match is justified by name alone',
    dir820.every((r) => !/^name$/.test(r.match_evidence)),
  );
  const addrMatched = parseCsv(readFileSync(`${S}/ADDRESS-MATCHED.csv`, 'utf8'));
  check(
    'address matches carry brand and state, not just an address',
    addrMatched.every((r) => /brand\+state/.test(r.evidence)),
  );
  check(
    'address matches are flagged as weaker than a store-number match',
    addrMatched.every((r) => /Weaker than a store-number match/.test(r.note)),
  );

  /* ---- the #749 / #876 address contradiction must stay a conflict ---- */
  const contradiction = conflicts.find((c) => c.source_ref === '749');
  check('#749 is held as a conflict', Boolean(contradiction));
  check(
    '#749 is a street-number contradiction, not a state mismatch',
    contradiction?.conflict === 'store-number-matches-but-street-number-contradicts',
  );
  check('#749 enrichment is refused', /REFUSED/.test(contradiction?.resolution ?? ''));
  check(
    '#749 is not in the enrichment plan',
    !enrich.some((r) => r.db_id === '9b0bb934-cb3a-499c-b362-8f665e065b81'),
  );

  /* ---- blank-only really is blank-only, checked against real values ---- */
  check(
    'no enrichment row restages a parking count the directory already has',
    enrich.every((r) => !(r.parking_spaces !== '' && r.existing_parking_spaces !== '')),
  );
  check(
    'overnight_parking is recorded as never written',
    enrich.every((r) => /overnight_parking/.test(r.never_written)),
  );
  check(
    'is_indexable is recorded as never written',
    enrich.every((r) => /is_indexable/.test(r.never_written)),
  );
  check(
    'every enrichment target receives the map pin',
    enrich.every((r) => r.receives_map_pin === 'true'),
  );
  check(
    'no colocated service row receives a map pin',
    services.every((r) => r.receives_map_pin === 'false'),
  );

  /* ---- the guarded SQL ---- */
  const ins = readFileSync(`${P}/INSERT-NET-NEW.sql`, 'utf8');
  const enrSql = readFileSync(`${P}/ENRICH-EXISTING.sql`, 'utf8');
  const canSql = readFileSync(`${P}/PUBLISH-CANARY.sql`, 'utf8');
  const pubSql = readFileSync(`${P}/PUBLISH-PER-STATE.sql`, 'utf8');
  const verSql = readFileSync(`${P}/VERIFY.sql`, 'utf8');
  const rbSql = readFileSync(`${P}/ROLLBACK.sql`, 'utf8');
  const fpSql = readFileSync(`${P}/FINGERPRINT.sql`, 'utf8');
  const insBody = ins.replace(/^\s*--.*$/gm, '');

  check('inserts arrive unpublished and unfeatured', /false, false\s*$/m.test(insBody));
  // Named in a post-check guard is fine and wanted; WRITTEN is not. Both
  // columns must be absent from every insert column list and never assigned.
  const insertColumnLists = insBody.match(/insert into public\.locations[\s\S]*?\)/g) ?? [];
  check(
    'the insert names its columns explicitly',
    insertColumnLists.length === 43,
    insertColumnLists.length,
  );
  check(
    'is_indexable is never written by the insert',
    !/is_indexable\s*=/.test(ins) && insertColumnLists.every((c) => !/is_indexable/.test(c)),
  );
  check(
    'overnight_parking is never written by the insert',
    !/overnight_parking\s*=/.test(ins) &&
      insertColumnLists.every((c) => !/overnight_parking/.test(c)),
  );
  check(
    'the insert keeps the coordinate-collision guard',
    /coordinate\(s\) shared by more than one site/.test(ins),
  );
  check(
    'the insert keeps the 150 m proximity guard',
    /within ~150 m of a published location/.test(ins),
  );
  check(
    'the insert excludes third-party numbering from the store-number check',
    /southern tire mart\|speedway\|blue beacon\|pro stop/.test(ins),
  );
  check('the insert asserts nothing became indexable', /published\/featured\/indexable/.test(ins));
  check(
    'the insert asserts no row claims overnight parking',
    /row\(s\) claim overnight parking/.test(ins),
  );
  check(
    'one transaction per state',
    (ins.match(/^begin;$/gm) ?? []).length === 43,
    (ins.match(/^begin;$/gm) ?? []).length,
  );

  check('enrichment is blank-only per field', /Blank-only violated/.test(enrSql));
  check('enrichment refuses non truck-stops targets', /are not truck-stops rows/.test(enrSql));
  check('enrichment keeps the collision guard', /collide with a published pin/.test(enrSql));
  check(
    'enrichment never writes overnight_parking',
    !/set[\s\S]*?overnight_parking\s*=/.test(enrSql),
  );

  check('the canary requires a positive parking count', /no stated parking spaces/.test(canSql));
  check('the canary publishes exactly 10', /publish exactly 10 row\(s\)/.test(canSql));
  check(
    'per-state publish excludes zero-space rows',
    /coalesce\(parking_spaces, 0\) > 0/.test(pubSql),
  );
  check(
    'per-state publish asserts no zero-space row was published',
    /zero-space row\(s\) were published/.test(pubSql),
  );

  check('verify asserts no Canadian row was imported', /NO CANADIAN ROW WAS IMPORTED/.test(verSql));
  check('verify carries the zero-space safety invariant', /THE SAFETY INVARIANT/.test(verSql));
  check(
    'verify asserts no invented overnight permission',
    /NO INVENTED OVERNIGHT PERMISSION/.test(verSql),
  );
  check('verify checks the map-pin rule', /MAP-PIN RULE/.test(verSql));

  check(
    'rollback is value-matched and scoped by source tag',
    /pilot-master-2026-07-27/.test(rbSql),
  );
  check('rollback refuses to delete published rows', /Rollback refused/.test(rbSql));
  check('rollback refuses to delete rows predating the import', /predate this import/.test(rbSql));

  check(
    'fingerprints record a measured control digest',
    /576f641146dfdb8ddb0de518acaa100d/.test(fpSql),
  );
  check(
    'fingerprints record the verified snapshot id digest',
    /130a63b248982b1e7d7977c6c728c484/.test(fpSql),
  );
  check('fingerprints assert third-party rows must not change', /MUST NOT CHANGE/.test(fpSql));

  /* ---- the canary is geographically diverse ---- */
  const canary = JSON.parse(readFileSync(`${P}/canary.json`, 'utf8')) as Record<
    string,
    string | number
  >[];
  check('canary is 10 locations', canary.length === 10);
  check('canary spans 10 states', new Set(canary.map((c) => c.state)).size === 10);
  check('canary spans 10 corridors', new Set(canary.map((c) => c.interstate)).size === 10);
  check('canary spans at least 4 regions', new Set(canary.map((c) => c.region)).size >= 4);
  check(
    'no region holds more than 3 canary sites',
    [...new Set(canary.map((c) => c.region))].every(
      (r) => canary.filter((c) => c.region === r).length <= 3,
    ),
  );
  check(
    'every canary site has a positive space count',
    canary.every((c) => Number(c.parking_spaces) > 0),
  );
  check(
    'every canary site has a coordinate',
    canary.every((c) => c.lat !== '' && c.lng !== ''),
  );
  check(
    'the canary does not claim overnight permission',
    canary.every((c) => /NOT CONFIRMED/.test(String(c.overnight_parking))),
  );

  /* ---- the launch gate splits 3a / 3b and passes neither ---- */
  check(
    'gate line 3a names the 820 U.S. directory universe',
    /\*\*3a\*\*[\s\S]{0,200}?820/.test(gate),
  );
  check('gate line 3b names the 803 parking universe', /\*\*3b\*\*[\s\S]{0,200}?803/.test(gate));
  check(
    'neither Pilot gate is marked passed',
    !/\*\*3a\*\*[^\n]*✅/.test(gate) && !/\*\*3b\*\*[^\n]*✅/.test(gate),
  );
  check(
    'the gate states 875 is never the U.S. number',
    /875 is never the U\.S\. coverage number/.test(gate),
  );
  check(
    'the gate records that overnight permission is absent from this source',
    /no overnight-permission field/.test(gate),
  );

  const acq = JSON.parse(readFileSync(`${DIR}/source-acquisition.json`, 'utf8')) as {
    sources: Record<string, unknown>[];
    obtain_next: string;
    rules: Record<string, string>;
  };
  const pilot = acq.sources.find((s) => s.source_id === 'pilot-master') as Record<string, unknown>;
  check('Pilot acquisition is complete', pilot.acquisition_status === 'COMPLETE');
  check(
    'Pilot sha256 recorded',
    pilot.sha256 === 'd39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a',
  );
  check('Pilot record count recorded as 875', pilot.record_count === 875);
  const pg = pilot.gates as Record<string, number | string>;
  check('manifest keeps 3a = 820', pg['3a_us_directory_coverage'] === 820);
  check('manifest keeps 3b = 803', pg['3b_us_truck_parking_coverage'] === 803);
  check('manifest records 55 Canadian exclusions', pg.canadian_locations_excluded === 55);
  check(
    'manifest records the absent status column',
    (pilot.columns_absent_from_export as string[]).includes('status'),
  );
  check(
    'manifest records the absent overnight field',
    (pilot.columns_absent_from_export as string[]).includes('overnight_permission'),
  );
  check('the next source to obtain is the TA master export', acq.obtain_next === 'ta-master');
  check(
    'a rule bars counting Canada toward U.S. coverage',
    Boolean(acq.rules.canada_excluded_from_us_denominator),
  );
  check(
    'a rule bars inventing overnight permission',
    Boolean(acq.rules.no_invented_overnight_permission),
  );
  check('a rule states absence is not closure', Boolean(acq.rules.absence_is_not_closure));
}

console.log(`\nparking-expansion: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
