/**
 * Pilot / Flying J / ONE9 intake — steps 2-6 of
 * data/imports/nationwide-parking-2026-07-26/INTAKE-PROCESS.md.
 *
 * READ-ONLY against the source file, and it touches no database: the existing
 * directory rows are supplied as a committed snapshot exported by a read-only
 * query (DB-SNAPSHOT.tsv, id digest verified against production), so this is
 * reproducible offline and in CI.
 *
 * Written AFTER the real file arrived, against its real headers — per the
 * intake rule that no parser is built speculatively.
 *
 * Emits, into data/sources/pilot-master/2026-07-27/:
 *   PROFILE.json                what the file actually contains
 *   normalized-us.csv           the 820 U.S. rows, normalized
 *   CANADA-55.csv               the 55 Canadian rows, preserved separately
 *   DIRECTORY-820.csv           gate 3a universe, one row per official U.S. site
 *   PARKING-803.csv             gate 3b universe (Parking Spaces Count > 0)
 *   ZERO-SPACE-17.csv           directory-only, never parking
 *   EXACT-MATCH.csv             store-number + state + address agree
 *   ENRICHMENT-PLAN.csv         blank-only fills, by exact id
 *   NET-NEW.csv                 official rows with no directory row
 *   COLOCATED-SERVICE-ROWS.csv  CAT scale / tire / wash rows — no map pin
 *   CONFLICTS.csv               store number disagrees with the export
 *   DUPLICATES.csv              two directory rows for one official site
 *   CLOSURE-REVIEW.csv          in the directory, absent from this export
 *   QUARANTINE.csv              everything refused, with an exact reason
 *
 * Run: node scripts/reconcile-pilot.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DIR = 'data/sources/pilot-master/2026-07-27';
const CSV = `${DIR}/all_locations.csv`;

/* ---- checksum the raw file every run: the parse is only valid for this file */
const EXPECTED_SHA = 'd39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a';
const sha = createHash('sha256').update(readFileSync(CSV)).digest('hex');
if (sha !== EXPECTED_SHA) {
  console.error(`Source file checksum changed.\n  expected ${EXPECTED_SHA}\n  got      ${sha}`);
  console.error('Re-profile before trusting any mapping. Refusing to continue.');
  process.exit(1);
}

/* ------------------------------------------------------------- RFC4180 read */
function parseCsv(t) {
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(f);
      f = '';
    } else if (c === '\n') {
      row.push(f);
      rows.push(row);
      row = [];
      f = '';
    } else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

const grid = parseCsv(readFileSync(CSV, 'utf8'));
const header = grid[0];
const rows = grid.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

const counter = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const num = (v) => {
  const x = Number(String(v ?? '').trim());
  return Number.isFinite(x) && String(v ?? '').trim() !== '' ? x : null;
};

/* ===================== U.S. / CANADA SPLIT — DENOMINATOR RULE ==============
 * Canadian locations are real and are preserved, but they are NOT part of any
 * U.S. launch-gate denominator. 875 is never the U.S. coverage number.
 */
const CA_PROVINCES = new Set([
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
const isCanada = (r) => CA_PROVINCES.has(String(r.State).trim().toUpperCase());

/* -------------------------------------------------------------- normalize */
// The export ships Name and Store # separately. The display name is DERIVED as
// `${Name} #${Store #}` — which preserves the operator's own brand string
// verbatim. Nothing is flattened to "Pilot": ONE9, Flying J, Mr. Fuel, dealer
// and licensed formats all keep the exact Name value the operator published.
const BRAND_FAMILY = (name) => {
  const n = name.toLowerCase();
  if (n.startsWith('flying j')) return 'Flying J';
  if (n.startsWith('one9') || n.startsWith('one 9')) return 'ONE9';
  if (n.startsWith('pilot')) return 'Pilot';
  return name; // Mr. Fuel, Shell Cardlock, EZ Trip, Pride, Stamart, Arco, Xpress Fuel
};

// "I-70, Exit 96" -> I-70 / 96 ; "I-5/CA-46, Exit 278" -> I-5 / 278
// "US-285 and Co Rd 114" -> null / null (not an Interstate)
const corridorOf = (s) => {
  const m = /^(I-\d{1,3})\b/.exec(String(s ?? '').trim());
  return m ? m[1] : null;
};
const exitOf = (s) => {
  const m = /,\s*Exit\s+(.+)$/i.exec(String(s ?? '').trim());
  return m ? m[1].trim() : null;
};

const normalize = (r) => {
  const officialName = String(r.Name).trim();
  const store = String(r['Store #']).trim();
  const amenities = String(r.Amenities ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    source_ref: store,
    official_name: officialName, // verbatim, never rewritten
    brand_family: BRAND_FAMILY(officialName),
    name: `${officialName} #${store}`, // DERIVED = official name + stable store number
    address: String(r.Address ?? '').trim(),
    city: String(r.City ?? '').trim(),
    state: String(r.State ?? '')
      .trim()
      .toUpperCase(),
    zip: String(r['Zip Code'] ?? '').trim(),
    lat: num(r.Latitude),
    lng: num(r.Longitude),
    interstate: corridorOf(r.Interstate),
    exit_number: exitOf(r.Interstate),
    interstate_raw: String(r.Interstate ?? '').trim(),
    // Only what the source states. Absent stays null — never 0, never a default.
    parking_spaces: num(r['Parking Spaces Count']),
    fuel_lanes: num(r['Fuel Lane Count']),
    showers: num(r['Shower Count']),
    // THE EXPORT HAS NO OVERNIGHT-PERMISSION FIELD. It is left null on purpose.
    // A positive space count confirms truck parking for directory/map purposes
    // and nothing more. Overnight permission, duration limits and access hours
    // stay UNKNOWN until another authoritative source states them.
    overnight_parking: null,
    parking_restrictions: null,
    has_showers: amenities.some((a) => /shower/i.test(a)) || (num(r['Shower Count']) ?? 0) > 0,
    cat_scale: amenities.some((a) => /cat scale/i.test(a)),
    amenities,
  };
};

const all = rows.map(normalize);
const us = all.filter((_, i) => !isCanada(rows[i]));
const canada = all.filter((_, i) => isCanada(rows[i]));

/* ============================ THE TWO SEPARATE U.S. GATES ==================
 * Gate 3a — DIRECTORY coverage: 820 U.S. official-network locations.
 * Gate 3b — PARKING coverage:   803 of those with Parking Spaces Count > 0.
 *
 * They are deliberately not the same number and must never be reported as one.
 * The 17 zero-space U.S. locations are real network listings and belong in the
 * directory — but they must NEVER be returned as parking, and never as a
 * last-legal-stop recommendation.
 */
const hasParking = (n) => n.parking_spaces !== null && n.parking_spaces > 0;

const coordOk = (n) =>
  n.lat !== null &&
  n.lng !== null &&
  n.lat !== 0 &&
  n.lng !== 0 &&
  n.lat >= 24 &&
  n.lat <= 49.5 &&
  n.lng >= -125 &&
  n.lng <= -66.5;

const parking = us.filter(hasParking);
const zeroSpace = us.filter((n) => !hasParking(n));

/* ------------------------------------------------------------------ profile */
const profile = {
  source_file: 'all_locations.csv',
  sha256: sha,
  columns: header,
  data_rows: all.length,
  us_rows: us.length,
  canada_rows: canada.length,
  us_states: [...new Set(us.map((n) => n.state))].sort(),
  ca_provinces: [...new Set(canada.map((n) => n.state))].sort(),
  official_name_values: Object.fromEntries(
    [...counter(all.map((n) => n.official_name))].sort((a, b) => b[1] - a[1]),
  ),
  us_parking_positive: parking.length,
  us_parking_zero: zeroSpace.length,
  us_stated_spaces: parking.reduce((a, n) => a + n.parking_spaces, 0),
  ca_stated_spaces: canada.reduce((a, n) => a + (n.parking_spaces ?? 0), 0),
  duplicate_store_numbers: all.length - new Set(all.map((n) => n.source_ref)).size,
  duplicate_coordinates: all.length - new Set(all.map((n) => `${n.lat},${n.lng}`)).size,
  duplicate_name_address_state:
    all.length - new Set(all.map((n) => `${n.official_name}|${n.address}|${n.state}`)).size,
  us_without_usable_coordinate: us.filter((n) => !coordOk(n)).length,
  us_without_interstate: us.filter((n) => n.interstate === null).length,
  blank_cells: Object.fromEntries(
    header.map((h) => [h, rows.filter((r) => String(r[h] ?? '').trim() === '').length]),
  ),
  // Columns the acquisition manifest asked for that this export does NOT carry.
  missing_expected_columns: ['status', 'overnight_permission', 'parking_duration_limit'],
  notes: [
    'No status column: closure is only detectable as absence from a later full export.',
    'No overnight-permission field. A positive space count confirms parking, not overnight legality.',
    'Two casing variants of the ONE9 brand string are present and are preserved verbatim.',
  ],
};

/* --------------------------- reconcile against the committed DB snapshot */
// Snapshot columns: id store_number state city category_slug is_published
//                   has_coord address zip lat lng interstate source name
const snapLines = readFileSync(`${DIR}/DB-SNAPSHOT.tsv`, 'utf8').trim().split('\n');
const snapCols = snapLines[0].split('\t');
const snap = snapLines.slice(1).map((l) => {
  const parts = l.split('\t');
  return Object.fromEntries(snapCols.map((c, i) => [c, parts[i] ?? '']));
});
if (snap.length !== 222) {
  console.error(`DB snapshot expected 222 rows, found ${snap.length}. Refusing to continue.`);
  process.exit(1);
}

/* Existing parking_spaces values, so "blank-only" is truthful rather than
 * assumed. 73 of the 222 rows already carry a count; digest verified against
 * production as ce75ae3373cc538a15b72d8cac0e3181. */
const existingParking = new Map(
  readFileSync(`${DIR}/DB-EXISTING-PARKING.tsv`, 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => {
      const [id, v] = l.split('\t');
      return [id, Number(v)];
    }),
);
if (existingParking.size !== 73) {
  console.error(`Expected 73 existing parking_spaces rows, found ${existingParking.size}.`);
  process.exit(1);
}
/* overnight_parking is NON-NULL on all 222 directory rows, and this export
 * carries no overnight-permission field. It is therefore never a fill target
 * and never written by any statement this package generates. */
const NEVER_WRITTEN = ['overnight_parking', 'parking_restrictions', 'is_indexable'];

/* THE MAP-PIN RULE. Exactly one DB row per physical site carries the
 * coordinate: the `truck-stops` row. CAT scale, tire, wash and roadside rows at
 * the same address are reconciled as service records and get NO coordinate, so
 * the coordinate-collision guard is never weakened and the map never shows two
 * pins for one site. */
const MAP_PIN_CATEGORY = 'truck-stops';

/* Rows whose name carries ANOTHER operator's numbering must never join on the
 * Pilot store number — that would produce a phantom match.
 *   Southern Tire Mart #297/#314/#330  -> STM's own shop numbers
 *   Speedway #9651                     -> Speedway's number
 *   "(CAT #876)"                       -> a CAT Scale number, not a store number
 * Blue Beacon and the unnumbered truck wash carry no number at all. */
const FOREIGN_NUMBERING = /^(southern tire mart|speedway|blue beacon)\b/i;
const CAT_OWN_NUMBER = /\(CAT #\d+\)/i;

const joinable = (s) =>
  s.store_number && !FOREIGN_NUMBERING.test(s.name) && !CAT_OWN_NUMBER.test(s.name);

const byStore = new Map();
for (const s of snap) {
  if (!joinable(s)) continue;
  byStore.set(s.store_number, [...(byStore.get(s.store_number) ?? []), s]);
}

/* --------- address / coordinate helpers, used only as SECONDARY evidence --- */
const ABBR = {
  road: 'rd',
  street: 'st',
  highway: 'hwy',
  boulevard: 'blvd',
  drive: 'dr',
  avenue: 'ave',
  lane: 'ln',
  parkway: 'pkwy',
  circle: 'cir',
  court: 'ct',
  place: 'pl',
  terrace: 'ter',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  route: 'rt',
  county: 'co',
  saint: 'st',
};
const normAddr = (a) =>
  String(a ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ABBR[w] ?? w)
    .join(' ')
    .trim();

const addrMatch = (a, b) => {
  const x = normAddr(a);
  const y = normAddr(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // house number must agree; then require substantial token overlap
  const hx = /^\d+/.exec(x)?.[0];
  const hy = /^\d+/.exec(y)?.[0];
  if (hx && hy && hx !== hy) return false;
  const tx = new Set(x.split(' '));
  const ty = new Set(y.split(' '));
  const inter = [...tx].filter((t) => ty.has(t)).length;
  return inter >= Math.min(tx.size, ty.size) * 0.7;
};

/* A POSITIVE address disagreement, not merely a formatting difference: both
 * sides give a street number and the numbers differ. A store-number match whose
 * address is contradicted this way is a CONFLICT, never a silent enrichment —
 * otherwise one site's coordinate lands on another site's row. */
const addrConflict = (a, b) => {
  const x = normAddr(a);
  const y = normAddr(b);
  if (!x || !y) return false;
  const hx = /^\d+/.exec(x)?.[0];
  const hy = /^\d+/.exec(y)?.[0];
  return Boolean(hx && hy && hx !== hy);
};

const metres = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* ============================== CLASSIFICATION ============================
 * Three phases, in the evidence order the brief requires:
 *   A. official store number (authoritative, tried first)
 *   B. address / coordinate / brand proximity, for directory rows the store
 *      number could not reach
 *   C. disposition, enrichment and net-new, computed from A + B
 * A loose business name is never sufficient on its own at any phase.
 */
const directory = []; // one entry per official U.S. row — gate 3a ledger
const exactMatch = [];
const enrichment = []; // blank-only, exact id, map pins only
const serviceRows = []; // colocated, reconciled, NO coordinate
const netNew = [];
const conflicts = [];
const duplicates = [];
const quarantine = [];

const claimedDbIds = new Set();
const SERVICE_CATEGORIES = new Set([
  'cat-scales',
  'tire-repair',
  'truck-washes',
  'roadside-service',
]);

/** per official U.S. row: { pin, services[], evidence } */
const match = new Map(us.map((t) => [t.source_ref, { pin: null, services: [], evidence: null }]));

/* ---------------- PHASE A — official store number, same state -------------- */
for (const t of us) {
  const hits = byStore.get(t.source_ref) ?? [];
  if (!hits.length) continue;

  for (const h of hits.filter((h) => h.state !== t.state)) {
    conflicts.push({
      source_ref: t.source_ref,
      official_name: t.official_name,
      source_state: t.state,
      source_city: t.city,
      source_address: t.address,
      db_id: h.id,
      db_state: h.state,
      db_city: h.city,
      db_address: h.address,
      db_category: h.category_slug,
      db_published: h.is_published,
      conflict: 'store-number-state-mismatch',
      resolution:
        'The export is authoritative for where this store number is. The directory row in the other state is NOT this location. Needs exact-ID verification; no SQL is proposed and nothing is unpublished.',
    });
  }

  const sameState = hits.filter((h) => h.state === t.state);
  if (!sameState.length) continue;
  for (const h of sameState) claimedDbIds.add(h.id);

  const m = match.get(t.source_ref);
  const pins = sameState.filter((h) => h.category_slug === MAP_PIN_CATEGORY);
  m.services.push(...sameState.filter((h) => h.category_slug !== MAP_PIN_CATEGORY));

  if (pins.length > 1) {
    const scored = pins
      .map((p) => ({ p, addr: addrMatch(p.address, t.address), pub: p.is_published === 'true' }))
      .sort((a, b) => Number(b.addr) - Number(a.addr) || Number(b.pub) - Number(a.pub));
    for (const { p, addr } of scored.slice(1)) {
      duplicates.push({
        source_ref: t.source_ref,
        official_name: t.official_name,
        state: t.state,
        keep_id: scored[0].p.id,
        keep_name: scored[0].p.name,
        duplicate_id: p.id,
        duplicate_name: p.name,
        duplicate_city: p.city,
        duplicate_address: p.address,
        duplicate_published: p.is_published,
        address_matches_export: addr,
        resolution: 'Proposed for closure review, not deletion. Needs exact-ID verification.',
      });
    }
    m.pin = scored[0].p;
  } else if (pins.length === 1) {
    m.pin = pins[0];
  }
  m.evidence = 'store_number';
}

/* ------ PHASE B — address / coordinate / brand, for what A could not reach --
 * Only directory rows the store number could not claim are considered, and a
 * candidate must agree on STATE and ADDRESS (house number must match, then 70 %
 * token overlap) or sit within 150 m. Brand family must also agree, so a
 * Southern Tire Mart never becomes a Pilot Travel Center. Ambiguous matches
 * (more than one candidate) are refused and quarantined, never guessed. */
const BRAND_OF_DB = (name) => {
  const n = name.toLowerCase();
  if (/southern tire mart|blue beacon|speedway|pro stop/.test(n)) return 'THIRD-PARTY';
  // Mr. Fuel FIRST: those rows also name the ONE9 fuel network ("Mr. Fuel
  // Travel Center (One9 Fuel Network)"), and testing ONE9 first would misbrand
  // them and lose the match. Network membership is not the brand.
  if (/mr\.?\s*fuel/.test(n)) return 'Mr. Fuel Travel Center';
  // "Pilot Flying J" as one phrase is the PARENT COMPANY name, used for the
  // Truck Care service brand that sits at both Pilot and Flying J sites. It is
  // not a claim about which retail format the site is.
  if (/pilot flying j/.test(n)) return 'PILOT-FLYING-J-CORPORATE';
  if (/flying\s*j/.test(n) && /pilot/.test(n)) return 'Pilot'; // "Pilot ... (Flying J #722)"
  if (/flying\s*j/.test(n)) return 'Flying J';
  if (/one\s*9|one9/.test(n)) return 'ONE9';
  if (/pilot/.test(n)) return 'Pilot';
  return 'UNKNOWN';
};
const brandCompatible = (dbBrand, officialBrand) => {
  if (dbBrand === 'THIRD-PARTY') return false;
  if (dbBrand === 'UNKNOWN') return false;
  // The corporate service brand sits at any first-party network format.
  if (dbBrand === 'PILOT-FLYING-J-CORPORATE') {
    return officialBrand === 'Pilot' || officialBrand === 'Flying J' || officialBrand === 'ONE9';
  }
  if (dbBrand === officialBrand) return true;
  // ONE9 sites are frequently recorded as "Pilot / ONE9" or a former Pilot
  // number, and the operator's own export moves sites between the two.
  return (
    (dbBrand === 'Pilot' && officialBrand === 'ONE9') ||
    (dbBrand === 'ONE9' && officialBrand === 'Pilot') ||
    (dbBrand === 'Flying J' && officialBrand === 'ONE9') ||
    (dbBrand === 'ONE9' && officialBrand === 'Flying J')
  );
};

const usByState = new Map();
for (const t of us) usByState.set(t.state, [...(usByState.get(t.state) ?? []), t]);

const addressMatched = [];
for (const s of snap) {
  if (claimedDbIds.has(s.id)) continue;
  if (FOREIGN_NUMBERING.test(s.name)) continue; // third-party brand, never re-branded
  const dbBrand = BRAND_OF_DB(s.name);
  if (dbBrand === 'THIRD-PARTY' || dbBrand === 'UNKNOWN') continue;

  const dbLat = num(s.lat);
  const dbLng = num(s.lng);
  const candidates = (usByState.get(s.state) ?? []).filter((t) => {
    if (!brandCompatible(dbBrand, t.brand_family)) return false;
    if (addrMatch(s.address, t.address)) return true;
    if (dbLat !== null && dbLng !== null && coordOk(t)) {
      return metres({ lat: dbLat, lng: dbLng }, { lat: t.lat, lng: t.lng }) <= 150;
    }
    return false;
  });

  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      quarantine.push({
        source_ref: '',
        official_name: s.name,
        state: s.state,
        city: s.city,
        address: s.address,
        quarantine_reason: `ambiguous-address-match: ${candidates.length} official rows in ${s.state} match this address; refused rather than guessed (db_id ${s.id})`,
      });
    }
    continue;
  }

  const t = candidates[0];
  const m = match.get(t.source_ref);
  const why = addrMatch(s.address, t.address)
    ? 'address+brand+state'
    : 'coordinate_150m+brand+state';

  if (s.category_slug === MAP_PIN_CATEGORY) {
    if (m.pin) {
      // The store number already found a pin. A second one is a duplicate.
      duplicates.push({
        source_ref: t.source_ref,
        official_name: t.official_name,
        state: t.state,
        keep_id: m.pin.id,
        keep_name: m.pin.name,
        duplicate_id: s.id,
        duplicate_name: s.name,
        duplicate_city: s.city,
        duplicate_address: s.address,
        duplicate_published: s.is_published,
        address_matches_export: true,
        resolution: `Second directory row for one official site, found by ${why}. Closure review, not deletion.`,
      });
      claimedDbIds.add(s.id);
      continue;
    }
    m.pin = s;
    m.evidence = m.evidence ? `${m.evidence}+${why}` : why;
  } else if (SERVICE_CATEGORIES.has(s.category_slug)) {
    m.services.push(s);
  } else {
    continue;
  }
  claimedDbIds.add(s.id);
  addressMatched.push({
    db_id: s.id,
    db_name: s.name,
    source_ref: t.source_ref,
    official_name: t.official_name,
    state: s.state,
    city: s.city,
    address: s.address,
    category_slug: s.category_slug,
    evidence: why,
    note: 'matched WITHOUT a store number — address/coordinate + brand + state. Weaker than a store-number match; verify by exact ID before publishing.',
  });
}

/* ------------------ PHASE C — disposition, enrichment, net-new ------------- */
for (const t of us) {
  const m = match.get(t.source_ref);
  const parkingOk = hasParking(t);
  const pin = m.pin;

  const push = (disposition, note) =>
    directory.push({
      ...t,
      amenities: t.amenities.join(' | '),
      has_parking: parkingOk,
      disposition,
      db_ids: [pin?.id, ...m.services.map((s) => s.id)].filter(Boolean).join(' '),
      match_evidence: m.evidence ?? '',
      note,
    });

  for (const sv of m.services) {
    serviceRows.push({
      db_id: sv.id,
      source_ref: t.source_ref,
      db_name: sv.name,
      category_slug: sv.category_slug,
      state: sv.state,
      city: sv.city,
      currently_published: sv.is_published,
      receives_map_pin: false,
      note: 'colocated service record at the same network site — reconciled, no coordinate, no second map pin',
    });
  }

  if (!pin) {
    const d = parkingOk ? 'net-new-official-location' : 'net-new-zero-space-directory-only';
    push(
      d,
      m.services.length
        ? `${m.services.length} colocated service row(s) exist but no map-pin row`
        : '',
    );
    netNew.push({ ...t, amenities: t.amenities.join(' | '), has_parking: parkingOk });
    continue;
  }

  const dbLat = num(pin.lat);
  const dbLng = num(pin.lng);
  const near =
    dbLat !== null && dbLng !== null && coordOk(t)
      ? metres({ lat: dbLat, lng: dbLng }, { lat: t.lat, lng: t.lng })
      : null;
  const addrOk = addrMatch(pin.address, t.address);
  const evidence = [
    m.evidence,
    addrOk ? 'address' : null,
    near !== null && near <= 150 ? `coordinate_${Math.round(near)}m` : null,
    'brand',
  ]
    .filter(Boolean)
    .join('+');

  if (near !== null && near > 150) {
    conflicts.push({
      source_ref: t.source_ref,
      official_name: t.official_name,
      source_state: t.state,
      source_city: t.city,
      source_address: t.address,
      db_id: pin.id,
      db_state: pin.state,
      db_city: pin.city,
      db_address: pin.address,
      db_category: pin.category_slug,
      db_published: pin.is_published,
      conflict: `existing-coordinate-${Math.round(near)}m-from-official`,
      resolution:
        'Existing coordinate is outside 150 m of the operator coordinate. Blank-only enrichment will NOT overwrite it. Flagged for exact-ID review.',
    });
  }

  /* The store number agrees but the street number does not. The directory row
   * describes a DIFFERENT site from the one the export gives this number to.
   * Refuse to enrich it — a coordinate written here would be the wrong site's. */
  const contradicted = addrConflict(pin.address, t.address);
  if (contradicted) {
    conflicts.push({
      source_ref: t.source_ref,
      official_name: t.official_name,
      source_state: t.state,
      source_city: t.city,
      source_address: t.address,
      db_id: pin.id,
      db_state: pin.state,
      db_city: pin.city,
      db_address: pin.address,
      db_category: pin.category_slug,
      db_published: pin.is_published,
      conflict: 'store-number-matches-but-street-number-contradicts',
      resolution:
        "The directory row carries this store number at a different street address. Enrichment is REFUSED — writing the export coordinate here would place one site on another site's row. Needs exact-ID verification.",
    });
    push(
      'conflicting-record',
      'store number matches, street address contradicts — no enrichment proposed',
    );
    continue;
  }

  const isExact = m.evidence?.startsWith('store_number') && addrOk;
  if (isExact) {
    exactMatch.push({
      db_id: pin.id,
      source_ref: t.source_ref,
      official_name: t.official_name,
      db_name: pin.name,
      state: t.state,
      city: t.city,
      address: t.address,
      evidence,
      db_published: pin.is_published,
      db_has_coord: pin.has_coord,
    });
  }

  /* Blank-only enrichment: ONLY fields the directory row is actually missing.
   * parking_spaces is checked against the real existing value, not assumed. */
  const fills = [];
  if (pin.has_coord !== 'true' && coordOk(t)) fills.push('lat', 'lng');
  if (!pin.interstate && t.interstate) fills.push('interstate');
  if (parkingOk && !existingParking.has(pin.id)) fills.push('parking_spaces');
  if (fills.length) {
    enrichment.push({
      db_id: pin.id,
      source_ref: t.source_ref,
      official_name: t.official_name,
      db_name: pin.name,
      state: t.state,
      city: t.city,
      lat: fills.includes('lat') ? t.lat : '',
      lng: fills.includes('lng') ? t.lng : '',
      interstate: fills.includes('interstate') ? t.interstate : '',
      exit_number: t.exit_number ?? '',
      parking_spaces: fills.includes('parking_spaces') ? t.parking_spaces : '',
      existing_parking_spaces: existingParking.get(pin.id) ?? '',
      fills: fills.join('+'),
      never_written: NEVER_WRITTEN.join('+'),
      evidence,
      currently_published: pin.is_published,
      currently_has_coord: pin.has_coord,
      receives_map_pin: true,
    });
  }

  push(
    isExact
      ? 'exact-authoritative-match'
      : m.evidence?.startsWith('store_number')
        ? 'blank-only-enrichment'
        : 'address-matched-enrichment',
    m.services.length ? `${m.services.length} colocated service row(s), no map pin` : '',
  );
}
/* --------- every zero-space U.S. row is recorded as parking-ineligible ----- */
for (const z of zeroSpace) {
  quarantine.push({
    source_ref: z.source_ref,
    official_name: z.official_name,
    state: z.state,
    city: z.city,
    address: z.address,
    quarantine_reason:
      'zero-stated-parking-spaces; IN DIRECTORY as a network truck stop, NEVER as parking and NEVER as a last-legal-stop recommendation',
  });
}

/* ------------- Canadian rows: preserved, excluded from U.S. denominators --- */
for (const c of canada) {
  quarantine.push({
    source_ref: c.source_ref,
    official_name: c.official_name,
    state: c.state,
    city: c.city,
    address: c.address,
    quarantine_reason:
      'canada; preserved in CANADA-55.csv; excluded from every U.S. coverage denominator',
  });
}

/* ---- directory rows not reachable from this export -> CLOSURE REVIEW ONLY -
 * Absence from a single export is NOT evidence of closure. Nothing here is
 * deleted or unpublished by this package; it is a review queue. */
const closureReview = snap
  .filter((s) => !claimedDbIds.has(s.id))
  .map((s) => {
    const foreign = FOREIGN_NUMBERING.test(s.name);
    const catOwn = CAT_OWN_NUMBER.test(s.name);
    const noNumber = !s.store_number;
    return {
      db_id: s.id,
      db_name: s.name,
      state: s.state,
      city: s.city,
      address: s.address,
      category_slug: s.category_slug,
      is_published: s.is_published,
      store_number: s.store_number,
      reason: foreign
        ? 'third-party brand at a network site (own numbering) — not a Pilot-network location, no closure implied'
        : catOwn
          ? 'name carries a CAT Scale number, not a store number — unresolved, needs exact-ID review'
          : noNumber
            ? 'no store number in the directory row — unresolved, cannot be joined authoritatively'
            : 'store number absent from this export — PROBABLE CLOSURE CANDIDATE, review only',
      action:
        'NONE. Not deleted, not unpublished. Absence from one export is not proof of closure.',
    };
  });

/* ------------------------------------------------------------------- write */
const csv = (rowsIn, cols) =>
  [
    cols.join(','),
    ...rowsIn.map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? '';
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    ),
  ].join('\n') + '\n';

const NORM_COLS = [
  'source_ref',
  'official_name',
  'brand_family',
  'name',
  'address',
  'city',
  'state',
  'zip',
  'lat',
  'lng',
  'interstate',
  'exit_number',
  'interstate_raw',
  'parking_spaces',
  'fuel_lanes',
  'showers',
  'overnight_parking',
  'parking_restrictions',
  'cat_scale',
  'amenities',
];
const flat = (xs) =>
  xs.map((n) => ({
    ...n,
    amenities: Array.isArray(n.amenities) ? n.amenities.join(' | ') : n.amenities,
  }));

writeFileSync(`${DIR}/PROFILE.json`, JSON.stringify(profile, null, 2) + '\n');
writeFileSync(`${DIR}/normalized-us.csv`, csv(flat(us), NORM_COLS));
writeFileSync(`${DIR}/CANADA-55.csv`, csv(flat(canada), NORM_COLS));
writeFileSync(
  `${DIR}/DIRECTORY-820.csv`,
  csv(directory, [...NORM_COLS, 'has_parking', 'disposition', 'db_ids', 'match_evidence', 'note']),
);
writeFileSync(
  `${DIR}/ADDRESS-MATCHED.csv`,
  csv(addressMatched, [
    'db_id',
    'db_name',
    'source_ref',
    'official_name',
    'state',
    'city',
    'address',
    'category_slug',
    'evidence',
    'note',
  ]),
);
writeFileSync(`${DIR}/PARKING-803.csv`, csv(flat(parking), NORM_COLS));
writeFileSync(
  `${DIR}/ZERO-SPACE-17.csv`,
  csv(
    flat(zeroSpace).map((z) => ({
      ...z,
      directory_representation: 'network truck stop',
      parking_representation:
        'NONE — never returned as parking, never a last-legal-stop recommendation',
    })),
    [...NORM_COLS, 'directory_representation', 'parking_representation'],
  ),
);
writeFileSync(`${DIR}/NET-NEW.csv`, csv(netNew, [...NORM_COLS, 'has_parking']));
writeFileSync(
  `${DIR}/EXACT-MATCH.csv`,
  csv(exactMatch, [
    'db_id',
    'source_ref',
    'official_name',
    'db_name',
    'state',
    'city',
    'address',
    'evidence',
    'db_published',
    'db_has_coord',
  ]),
);
writeFileSync(
  `${DIR}/ENRICHMENT-PLAN.csv`,
  csv(enrichment, [
    'db_id',
    'source_ref',
    'official_name',
    'db_name',
    'state',
    'city',
    'lat',
    'lng',
    'interstate',
    'exit_number',
    'parking_spaces',
    'existing_parking_spaces',
    'fills',
    'never_written',
    'evidence',
    'currently_published',
    'currently_has_coord',
    'receives_map_pin',
  ]),
);
writeFileSync(
  `${DIR}/COLOCATED-SERVICE-ROWS.csv`,
  csv(serviceRows, [
    'db_id',
    'source_ref',
    'db_name',
    'category_slug',
    'state',
    'city',
    'currently_published',
    'receives_map_pin',
    'note',
  ]),
);
writeFileSync(
  `${DIR}/CONFLICTS.csv`,
  csv(conflicts, [
    'source_ref',
    'official_name',
    'source_state',
    'source_city',
    'source_address',
    'db_id',
    'db_state',
    'db_city',
    'db_address',
    'db_category',
    'db_published',
    'conflict',
    'resolution',
  ]),
);
writeFileSync(
  `${DIR}/DUPLICATES.csv`,
  csv(duplicates, [
    'source_ref',
    'official_name',
    'state',
    'keep_id',
    'keep_name',
    'duplicate_id',
    'duplicate_name',
    'duplicate_city',
    'duplicate_address',
    'duplicate_published',
    'address_matches_export',
    'resolution',
  ]),
);
writeFileSync(
  `${DIR}/CLOSURE-REVIEW.csv`,
  csv(closureReview, [
    'db_id',
    'db_name',
    'state',
    'city',
    'address',
    'category_slug',
    'is_published',
    'store_number',
    'reason',
    'action',
  ]),
);
writeFileSync(
  `${DIR}/QUARANTINE.csv`,
  csv(quarantine, ['source_ref', 'official_name', 'state', 'city', 'address', 'quarantine_reason']),
);

/* ------------------------------------------------------------------ report */
const by = (xs, f) => Object.fromEntries([...counter(xs.map(f))].sort((a, b) => b[1] - a[1]));
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

console.log(`source rows                        ${all.length}`);
console.log(`  U.S.                             ${us.length}`);
console.log(`  Canada (separate, excluded)      ${canada.length}`);
console.log(`GATE 3a U.S. directory coverage    ${us.length}`);
console.log(`GATE 3b U.S. parking coverage      ${parking.length}`);
console.log(`  zero-space, directory only       ${zeroSpace.length}  (never parking)`);
console.log(`\ndirectory dispositions:`);
for (const [k, v] of Object.entries(by(directory, (r) => r.disposition)))
  console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log(`\nexact authoritative matches        ${exactMatch.length}`);
console.log(`blank-only enrichment plans        ${enrichment.length}`);
console.log(`colocated service rows (no pin)    ${serviceRows.length}`);
console.log(`net-new                            ${netNew.length}`);
console.log(`conflicting records                ${conflicts.length}`);
console.log(`duplicates                         ${duplicates.length}`);
console.log(`closure review (no action)         ${closureReview.length}`);
console.log(`quarantined (with reason)          ${quarantine.length}`);

console.log(`\nconflicts:`);
for (const c of conflicts)
  console.log(
    `  #${c.source_ref} ${c.official_name} src=${c.source_state}/${c.source_city} db=${c.db_state}/${c.db_city} [${c.conflict}]`,
  );
console.log(`\nduplicates:`);
for (const d of duplicates)
  console.log(
    `  #${d.source_ref} keep ${d.keep_id.slice(0, 8)} drop ${d.duplicate_id.slice(0, 8)} (${d.duplicate_city} ${d.state}, published=${d.duplicate_published})`,
  );
console.log(`\nclosure-review breakdown:`);
for (const [k, v] of Object.entries(by(closureReview, (r) => r.reason)))
  console.log(`  ${String(v).padStart(4)}  ${k}`);

console.log(`\nbrand families preserved:`);
for (const [k, v] of Object.entries(by(us, (n) => n.brand_family)))
  console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log(`distinct official Name values      ${new Set(us.map((n) => n.official_name)).size}`);

console.log(`\ncoverage:`);
console.log(`  U.S. states (directory)          ${new Set(us.map((n) => n.state)).size}`);
console.log(`  U.S. states (parking)            ${new Set(parking.map((n) => n.state)).size}`);
console.log(
  `  corridors (parking)              ${new Set(parking.map((n) => n.interstate).filter(Boolean)).size}`,
);
console.log(`  stated U.S. spaces               ${sum(parking, (n) => n.parking_spaces)}`);
console.log(`  U.S. rows with usable coordinate ${us.filter(coordOk).length} / ${us.length}`);

const netNewCount = directory.filter((d) => d.disposition.startsWith('net-new')).length;
console.log(`\nintegrity:`);
console.log(
  `  ${all.length} = ${us.length} US + ${canada.length} CA -> ${us.length + canada.length === all.length ? 'OK' : 'MISMATCH'}`,
);
console.log(
  `  ${us.length} = ${parking.length} parking + ${zeroSpace.length} zero-space -> ${parking.length + zeroSpace.length === us.length ? 'OK' : 'MISMATCH'}`,
);
console.log(
  `  directory ledger rows ${directory.length} = US rows ${us.length} -> ${directory.length === us.length ? 'OK' : 'MISMATCH'}`,
);
console.log(
  `  net-new ${netNew.length} = ledger net-new ${netNewCount} -> ${netNew.length === netNewCount ? 'OK' : 'MISMATCH'}`,
);
console.log(
  `  snapshot rows accounted ${claimedDbIds.size} matched + ${closureReview.length} review = ${claimedDbIds.size + closureReview.length} / ${snap.length} -> ${claimedDbIds.size + closureReview.length === snap.length ? 'OK' : 'MISMATCH'}`,
);
