/**
 * TA / Petro / TA Express — full three-way reconciliation.
 *
 * READ-ONLY. Touches no database. Every input is committed and
 * digest-verified against production:
 *
 *   data/sources/ta-master/2026-07-27/locmaster.xlsx
 *       The current official location master. Content verified fact-by-fact
 *       (all ten stated facts) against Shawn's official 2026-07-27 download;
 *       see CHECKSUM.txt for the dual-hash provenance note.
 *   data/imports/ta-petro/ta-petro-import-ready.csv
 *       Faithful proxy for the 304 production rows imported on 2026-07-25.
 *       PROVEN: name+state digest e7843f7412c831ca5eb0687b37ab6018 and value
 *       digest 2ac6c65968f6da9013ee0896b377003b both match production exactly.
 *   data/sources/ta-master/2026-07-27/LEGACY-91.tsv
 *       The 91 TA-network production rows NOT created by that import.
 *       PROVEN byte-identical: md5 4aabb580c32b3959b196d4c2b8e0aa34.
 *   data/imports/ta-petro/ta-petro-review.csv        prior dispositions (354)
 *   data/imports/ta-petro/ta-petro-merge-review.csv  site_id -> production id (37)
 *
 * Emits, into data/sources/ta-master/2026-07-27/:
 *   RECONCILIATION-354.csv   every official row classified
 *   DB-ACCOUNTING-395.csv    every production TA-network row classified
 *   ENRICHMENT-PLAN.csv      blank-only fills, by exact id
 *   DUPLICATES.csv           two production rows for one official site
 *   CLOSURE-REVIEW.csv       production rows no official site explains
 *   FINDINGS.md is written by hand, not here.
 *
 * Run: node scripts/reconcile-ta.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DIR = 'data/sources/ta-master/2026-07-27';
const XLSX = `${DIR}/locmaster20260727.xlsx`; // the EXACT official artifact

/* ---- pin every input to the exact bytes this reconciliation is valid for */
const PINS = [
  // The exact official artifact (committed 2026-07-27, checksum-verified).
  [XLSX, 'a0c612f0426d141c481f84aae59dc15a0204617183bbf9c0866bfbb726ed63f7'],
  // The earlier working copy, kept for the recorded provenance chain. Cell-diff
  // against the artifact: identical except TA Kingman AZ's two service-hours
  // cells — columns this reconciliation never reads.
  [`${DIR}/locmaster.xlsx`, '5ebe0e9f034153536fe3946a3e5cc3d5a45c9a59b010131d5ccee20e21553303'],
];
for (const [f, want] of PINS) {
  const got = createHash('sha256').update(readFileSync(f)).digest('hex');
  if (got !== want) {
    console.error(`${f}: checksum changed.\n  expected ${want}\n  got      ${got}`);
    process.exit(1);
  }
}
const legacyRaw = readFileSync(`${DIR}/LEGACY-91.tsv`, 'utf8');
{
  const body = legacyRaw.replace(/\n$/, '').split('\n').slice(1).join('\n');
  const got = createHash('md5').update(body).digest('hex');
  if (got !== '4aabb580c32b3959b196d4c2b8e0aa34') {
    console.error(`LEGACY-91.tsv digest mismatch: ${got}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------- readers */
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

const raw = execFileSync(
  'python3',
  [
    '-c',
    `
import openpyxl, json, sys
wb = openpyxl.load_workbook(${JSON.stringify(XLSX)}, read_only=True, data_only=True)
ws = wb["sheet1"]
rows = list(ws.iter_rows(values_only=True))
hdr = [h for h in rows[0]]
out = []
for r in rows[1:]:
    d = {}
    for i, h in enumerate(hdr):
        if h is None:
            continue
        if h in d and d[h] is not None:
            continue
        d[h] = r[i]
    out.append(d)
sys.stdout.write(json.dumps(out))
`,
  ],
  { maxBuffer: 1 << 28, encoding: 'utf8' },
);
const official = JSON.parse(raw);
if (official.length !== 354) throw new Error(`expected 354 official rows, got ${official.length}`);

const importReady = parseCsv(
  readFileSync('data/imports/ta-petro/ta-petro-import-ready.csv', 'utf8'),
);
const review = parseCsv(readFileSync('data/imports/ta-petro/ta-petro-review.csv', 'utf8'));
const legacy = legacyRaw
  .replace(/\n$/, '')
  .split('\n')
  .slice(1)
  .map((l) => {
    const [
      id,
      state,
      city,
      category_slug,
      is_published,
      has_coord,
      lat,
      lng,
      address,
      zip,
      parking_spaces,
      interstate,
      source,
      name,
    ] = l.split('\t');
    return {
      id,
      state,
      city,
      category_slug,
      is_published,
      has_coord,
      lat,
      lng,
      address,
      zip,
      parking_spaces,
      interstate,
      source,
      name,
    };
  });
if (importReady.length !== 304)
  throw new Error(`expected 304 import rows, got ${importReady.length}`);
if (review.length !== 354) throw new Error(`expected 354 review rows, got ${review.length}`);
if (legacy.length !== 91) throw new Error(`expected 91 legacy rows, got ${legacy.length}`);

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && String(v ?? '').trim() !== '' ? x : null;
};
const STATE_CODE = {
  Alabama: 'AL',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Florida: 'FL',
  Georgia: 'GA',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maryland: 'MD',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

const HELD_BRANDS = new Set(['Goasis', 'Thorntons']);

/* Official rows, normalized. Site ID and Location ID are the stable keys. */
const sites = official.map((r) => ({
  site_id: String(r['Site ID']).trim(),
  location_id: String(r['Location ID']).trim(),
  brand: String(r.Brand).trim(),
  name: String(r.Location).trim(),
  state: STATE_CODE[String(r.State).trim()],
  city: String(r.City ?? '').trim(),
  address: String(r.Address ?? '').trim(),
  zip: String(r.Zipcode ?? '').trim(),
  lat: num(r.Latitude),
  lng: num(r.Longitude),
  spaces: num(r['Truck Parking Spaces']),
  directions: String(r.Directions ?? '').trim(),
}));

/* Prior artifacts, keyed by site. */
const reviewBySite = new Map(review.map((r) => [r.site_id, r]));
const importByNameState = new Map(importReady.map((r) => [`${r.name}|${r.state}`, r]));
const legacyById = new Map(legacy.map((l) => [l.id, l]));

/* --------- address / coordinate helpers -------------------------------- */
const zip5 = (z) =>
  String(z ?? '')
    .split('-')[0]
    .trim();
const normAddr = (a) =>
  String(a ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
const houseNo = (a) => /^\d+/.exec(normAddr(a))?.[0] ?? null;
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

/* ================================ OFFICIAL SIDE ==========================
 * Buckets: exact-match | safe-enrichment | held | zero-parking |
 *          missing-net-new | conflict
 *
 * Matching runs in ORDERED PHASES so weak evidence can never steal a row
 * that stronger evidence explains:
 *   1. held brands, then rows imported 2026-07-25 (digest-proven)
 *   2. review-linked claims carrying STRONG evidence — the row's name cites
 *      the site number, or the street number agrees, or the prior review
 *      recorded the addresses as identical
 *   3. name-token fallbacks among still-unclaimed rows (verify before publish)
 *   4. cross-brand conflicts and genuine misses
 */
const SERVICE_CATS = new Set(['cat-scales', 'tire-repair', 'roadside-service', 'truck-washes']);
const reconciliation = [];
const enrichment = [];
const claimedLegacy = new Set();

const tokens = (t) =>
  String(t)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
const nameCompatible = (legRow, site) => {
  if (legRow.state !== site.state) return false;
  const rowTok = new Set(tokens(legRow.name));
  return tokens(site.name).every((t) => rowTok.has(t));
};
/* "#311" in a row name IS the operator site number — the strongest key. */
const citesSiteNumber = (legRow, site) =>
  legRow.state === site.state && new RegExp(`#\\s*0*${Number(site.site_id)}\\b`).test(legRow.name);

const decisions = new Map(); // site_id -> {kind, leg?, evidence?}

/* ---- phase 1: held, imported, and review rows staged ------------------- */
const deferred = [];
for (const s of sites) {
  const rev = reviewBySite.get(s.site_id);
  if (HELD_BRANDS.has(s.brand)) {
    decisions.set(s.site_id, { kind: 'held', rev });
    continue;
  }
  if (importByNameState.has(`${s.name}|${s.state}`)) {
    decisions.set(s.site_id, { kind: 'imported', rev });
    continue;
  }
  deferred.push({ s, rev });
}

/* ---- phase 2: strong review-linked claims ------------------------------ */
const strongOnes = [];
for (const d of deferred) {
  const prodId = d.rev?.matched_production_id ?? '';
  const leg = legacyById.get(prodId);
  if (!leg || claimedLegacy.has(prodId)) continue;
  const addrIdentical = /address identical/.test(d.rev?.disposition_reason ?? '');
  const houseAgree = houseNo(leg.address) !== null && houseNo(leg.address) === houseNo(d.s.address);
  const siteNo = citesSiteNumber(leg, d.s);
  if (siteNo || houseAgree || addrIdentical || nameCompatible(leg, d.s)) {
    claimedLegacy.add(prodId);
    decisions.set(d.s.site_id, {
      kind: 'legacy',
      leg,
      rev: d.rev,
      evidence: [
        'site_id->prior-review-exact-production-id',
        siteNo ? 'row-name-cites-site-number' : null,
        addrIdentical ? 'address-identical' : houseAgree ? 'street-number-agrees' : null,
      ]
        .filter(Boolean)
        .join('+'),
      strong: siteNo || houseAgree || addrIdentical,
    });
    strongOnes.push(d.s.site_id);
  }
}

/* ---- phase 3: fallbacks among unclaimed rows --------------------------- */
for (const d of deferred) {
  if (decisions.has(d.s.site_id)) continue;
  const fallback = legacy.find(
    (l) =>
      !claimedLegacy.has(l.id) &&
      l.category_slug === 'truck-stops' &&
      (citesSiteNumber(l, d.s) ||
        (nameCompatible(l, d.s) &&
          normAddr(l.city) === normAddr(d.s.city) &&
          zip5(l.zip) === zip5(d.s.zip))),
  );
  if (fallback) {
    claimedLegacy.add(fallback.id);
    decisions.set(d.s.site_id, {
      kind: 'legacy',
      leg: fallback,
      rev: d.rev,
      evidence: citesSiteNumber(fallback, d.s)
        ? 'row-name-cites-site-number (prior review linked a different row; verify before publish)'
        : 'name+city+state+zip5 (prior review linked the wrong row; verify before publish)',
      strong: citesSiteNumber(fallback, d.s),
    });
  }
}

/* ---- phase 4: emit every site in file order ----------------------------- */
for (const s of sites) {
  const rev = reviewBySite.get(s.site_id);
  const d = decisions.get(s.site_id);
  const zeroParking = (s.spaces ?? 0) <= 0;
  const base = {
    site_id: s.site_id,
    location_id: s.location_id,
    brand: s.brand,
    name: s.name,
    state: s.state ?? '',
    city: s.city,
    truck_parking_spaces: s.spaces ?? 0,
    prior_disposition: rev?.disposition ?? '',
  };

  if (d?.kind === 'held') {
    reconciliation.push({
      ...base,
      bucket: 'held',
      db_id: '',
      evidence: '',
      reason: `brand ${s.brand} is held — separate and untouched unless explicitly authorized; never imported (prior disposition: ${rev?.disposition ?? 'other-pending-category'})`,
    });
    continue;
  }
  if (d?.kind === 'imported') {
    reconciliation.push({
      ...base,
      bucket: zeroParking ? 'zero-parking' : 'exact-match',
      db_id: '(imported-row: name+state unique, value digest 2ac6c659… proven)',
      evidence: 'site->import name+state; import CSV proven byte-equivalent to production',
      reason: zeroParking
        ? 'in the directory as a truck stop; ZERO stated spaces — never counted as truck-parking coverage'
        : 'imported 2026-07-25 from content-identical official data; production values proven unchanged by digest',
    });
    continue;
  }
  if (d?.kind === 'legacy') {
    const leg = d.leg;
    const dbLat = num(leg.lat);
    const near =
      dbLat !== null && s.lat !== null
        ? Math.round(metres({ lat: dbLat, lng: num(leg.lng) }, { lat: s.lat, lng: s.lng }))
        : null;
    const evidence = [d.evidence, near !== null && near <= 150 ? `coordinate_${near}m` : null]
      .filter(Boolean)
      .join('+');

    const fills = [];
    if (leg.has_coord !== 'true' && s.lat !== null) fills.push('lat', 'lng');
    if (!leg.parking_spaces && (s.spaces ?? 0) > 0) fills.push('parking_spaces');
    if (!leg.zip && s.zip) fills.push('zip');

    if (fills.length) {
      enrichment.push({
        db_id: leg.id,
        site_id: s.site_id,
        location_id: s.location_id,
        db_name: leg.name,
        state: s.state,
        city: s.city,
        lat: fills.includes('lat') ? s.lat : '',
        lng: fills.includes('lng') ? s.lng : '',
        parking_spaces: fills.includes('parking_spaces') ? s.spaces : '',
        zip: fills.includes('zip') ? s.zip : '',
        fills: fills.join('+'),
        evidence,
        confidence: d.strong ? 'address-anchored' : 'name-anchored (verify before publish)',
        currently_published: leg.is_published,
        currently_has_coord: leg.has_coord,
      });
    }
    reconciliation.push({
      ...base,
      bucket: zeroParking ? 'zero-parking' : fills.length ? 'safe-enrichment' : 'exact-match',
      db_id: leg.id,
      evidence,
      reason: zeroParking
        ? 'matched to an existing row; ZERO stated spaces — never counted as truck-parking coverage'
        : fills.length
          ? `existing row is missing ${fills.join(', ')}; blank-only fill prepared from the official master`
          : 'existing row already carries everything the master states',
    });
    continue;
  }

  /* Unresolved. A review match pointing OUTSIDE the TA-network scope is a
   * mislabeled row carrying another brand's name — a cross-brand conflict. */
  const prodId = rev?.matched_production_id ?? '';
  if (prodId && !legacyById.has(prodId)) {
    reconciliation.push({
      ...base,
      bucket: 'conflict',
      db_id: prodId,
      evidence: `prior review: ${rev.disposition_reason ?? ''}`,
      reason:
        "CROSS-BRAND MISLABEL — the production row at this site's address carries another brand's name. Correction proposed separately with exact-ID guards; nothing executed.",
    });
    continue;
  }
  reconciliation.push({
    ...base,
    bucket: 'missing-net-new',
    db_id: '',
    evidence: '',
    reason: 'no production row found by site id, prior review, or import name — would be net-new',
  });
}

/* ================================ DB SIDE ================================
 * Every one of the 395 production rows ends in exactly one bucket.
 */
const dbAccounting = [];

/* imported rows: one line summarizing the proven set, then per-row entries
 * reconstructed from the proven proxy CSV. */
for (const r of importReady) {
  dbAccounting.push({
    db_id: '(see id map note)',
    name: r.name,
    state: r.state,
    city: r.city,
    category_slug: 'truck-stops',
    is_published: 'true',
    bucket: 'exact-match',
    reason:
      'imported 2026-07-25; value digest 2ac6c659… proves production still equals the import CSV, which equals the current official master',
  });
}

/* legacy rows */
const officialByNameState = new Map(sites.map((s) => [`${s.name}|${s.state}`, s]));
const importCoords = importReady
  .map((r) => ({ lat: num(r.latitude), lng: num(r.longitude), name: r.name, state: r.state }))
  .filter((r) => r.lat !== null);

const duplicates = [];
const closureReview = [];

for (const l of legacy) {
  if (claimedLegacy.has(l.id)) {
    const hasPlan = enrichment.some((e) => e.db_id === l.id);
    dbAccounting.push({
      db_id: l.id,
      name: l.name,
      state: l.state,
      city: l.city,
      category_slug: l.category_slug,
      is_published: l.is_published,
      bucket: hasPlan ? 'safe-enrichment' : 'exact-match',
      reason: hasPlan
        ? 'the site’s own row; enrichment plan prepared for its blanks'
        : 'the site’s own row; already carries everything the master states',
    });
    continue;
  }
  if (SERVICE_CATS.has(l.category_slug)) {
    dbAccounting.push({
      db_id: l.id,
      name: l.name,
      state: l.state,
      city: l.city,
      category_slug: l.category_slug,
      is_published: l.is_published,
      bucket: 'service-only',
      reason:
        'colocated service record (CAT scale / truck service / roadside) at a network site — reconciled, never a map pin, never parking coverage',
    });
    continue;
  }

  /* legacy truck-stop not claimed by any site: duplicate of an imported row,
   * or a probable closure. Duplicate = an imported row within 300 m, or an
   * official site at the same normalized street number in the same state+city. */
  const lLat = num(l.lat);
  let twin = null;
  if (lLat !== null) {
    twin = importCoords.find(
      (c) => c.state === l.state && metres({ lat: lLat, lng: num(l.lng) }, c) <= 300,
    );
  }
  if (!twin) {
    /* Same street number in the same state, anchored by either city or zip5 —
     * "1650 County Road 210 W" and "1650 C.R. 210 West" are one address. */
    const sameAddr = sites.find(
      (s) =>
        s.state === l.state &&
        houseNo(s.address) !== null &&
        houseNo(s.address) === houseNo(l.address) &&
        (normAddr(s.city) === normAddr(l.city) || (zip5(s.zip) && zip5(s.zip) === zip5(l.zip))),
    );
    if (sameAddr) twin = { name: sameAddr.name, state: sameAddr.state, via: 'address' };
  }

  if (twin) {
    duplicates.push({
      duplicate_db_id: l.id,
      duplicate_name: l.name,
      state: l.state,
      city: l.city,
      is_published: l.is_published,
      has_coord: l.has_coord,
      shadows_official_site: twin.name,
      resolution:
        'second production row for one official site. PROPOSED for guarded unpublish pending exact-ID verification — never deleted. The imported row is the site of record.',
    });
    dbAccounting.push({
      db_id: l.id,
      name: l.name,
      state: l.state,
      city: l.city,
      category_slug: l.category_slug,
      is_published: l.is_published,
      bucket: 'duplicate',
      reason: `duplicates official site "${twin.name}" which already has its own (imported) production row`,
    });
  } else {
    closureReview.push({
      db_id: l.id,
      name: l.name,
      state: l.state,
      city: l.city,
      is_published: l.is_published,
      reason:
        'legacy TA-network truck-stop row matching no site in the current official master — PROBABLE CLOSURE candidate, review only',
      action:
        'NONE. Not deleted, not unpublished. Absence from one export is not proof of closure.',
    });
    dbAccounting.push({
      db_id: l.id,
      name: l.name,
      state: l.state,
      city: l.city,
      category_slug: l.category_slug,
      is_published: l.is_published,
      bucket: 'probable-closure',
      reason: 'matches no site in the current official master',
    });
  }
}

/* --------------------------------- write ------------------------------- */
const csvOut = (rowsIn, cols) =>
  [
    cols.join(','),
    ...rowsIn.map((r) =>
      cols
        .map((c) => {
          const s = String(r[c] ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    ),
  ].join('\n') + '\n';

writeFileSync(
  `${DIR}/RECONCILIATION-354.csv`,
  csvOut(reconciliation, [
    'site_id',
    'location_id',
    'brand',
    'name',
    'state',
    'city',
    'truck_parking_spaces',
    'prior_disposition',
    'bucket',
    'db_id',
    'evidence',
    'reason',
  ]),
);
writeFileSync(
  `${DIR}/DB-ACCOUNTING-395.csv`,
  csvOut(dbAccounting, [
    'db_id',
    'name',
    'state',
    'city',
    'category_slug',
    'is_published',
    'bucket',
    'reason',
  ]),
);
writeFileSync(
  `${DIR}/ENRICHMENT-PLAN.csv`,
  csvOut(enrichment, [
    'db_id',
    'site_id',
    'location_id',
    'db_name',
    'state',
    'city',
    'lat',
    'lng',
    'parking_spaces',
    'zip',
    'fills',
    'evidence',
    'confidence',
    'currently_published',
    'currently_has_coord',
  ]),
);
writeFileSync(
  `${DIR}/DUPLICATES.csv`,
  csvOut(duplicates, [
    'duplicate_db_id',
    'duplicate_name',
    'state',
    'city',
    'is_published',
    'has_coord',
    'shadows_official_site',
    'resolution',
  ]),
);
writeFileSync(
  `${DIR}/CLOSURE-REVIEW.csv`,
  csvOut(closureReview, ['db_id', 'name', 'state', 'city', 'is_published', 'reason', 'action']),
);

/* --------------------------------- report ------------------------------ */
const count = (xs, f) => xs.filter(f).length;
const byBucket = (xs) =>
  Object.fromEntries(
    [...xs.reduce((m, r) => m.set(r.bucket, (m.get(r.bucket) ?? 0) + 1), new Map())].sort(
      (a, b) => b[1] - a[1],
    ),
  );

console.log('OFFICIAL SIDE (354):', JSON.stringify(byBucket(reconciliation)));
console.log('DB SIDE (395):      ', JSON.stringify(byBucket(dbAccounting)));
console.log(`enrichment plans     ${enrichment.length}`);
console.log(
  `  address-anchored   ${count(enrichment, (e) => e.confidence === 'address-anchored')}`,
);
console.log(`  proximity-only     ${count(enrichment, (e) => e.confidence === 'proximity-only')}`);
console.log(
  `duplicates           ${duplicates.length} (${count(duplicates, (d) => d.is_published === 'true')} published)`,
);
console.log(
  `closure review       ${closureReview.length} (${count(closureReview, (d) => d.is_published === 'true')} published)`,
);

/* gates */
const taBrand = reconciliation.filter((r) => !HELD_BRANDS.has(r.brand));
const held = reconciliation.filter((r) => HELD_BRANDS.has(r.brand));
const zero = reconciliation.filter((r) => r.bucket === 'zero-parking');
console.log(`\nGATE 4a universe (TA/Petro/TA Express) ${taBrand.length}`);
console.log(`GATE 4b universe (positive parking)     ${taBrand.length - zero.length}`);
console.log(`held (Goasis+Thorntons)                 ${held.length}`);
console.log(`zero-parking among TA brands            ${zero.length}`);

/* integrity */
const okA = reconciliation.length === 354;
const okB = dbAccounting.length === 395;
const missing = reconciliation.filter((r) => r.bucket === 'missing-net-new').length;
console.log(`\nintegrity: official ledger ${reconciliation.length}/354 ${okA ? 'OK' : 'MISMATCH'}`);
console.log(`           db ledger       ${dbAccounting.length}/395 ${okB ? 'OK' : 'MISMATCH'}`);
console.log(`           missing-net-new ${missing} (expected 0)`);
if (!okA || !okB) process.exit(1);
