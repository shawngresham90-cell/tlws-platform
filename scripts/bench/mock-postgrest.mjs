/**
 * Mock PostgREST server for offline directory benchmarks.
 *
 * Purpose: `next build` and `next start` read the directory through
 * supabase-js, which speaks PostgREST over HTTP. CI builds against a
 * placeholder URL, so every read fails soft and the build's real query
 * traffic has never been measurable offline. This server stands in for
 * PostgREST with a deterministic, production-shaped `locations` dataset so
 * that build/runtime cost can be measured — request counts, query shapes,
 * wall time — without touching any real database.
 *
 * Fidelity is limited to what the user-facing read paths actually use
 * (verified against src/lib/directory, src/lib/map, src/app/(directory),
 * src/lib/seo/sitemap-entries.ts):
 *
 *   filters   eq, is.null/true/false, not.is.null, in.(...), gt, gte, lt, lte
 *   shaping   select (column projection), order (multi-key asc/desc),
 *             limit, offset, Range headers
 *   counting  Prefer: count=exact on GET and HEAD (Content-Range)
 *   singles   Accept: application/vnd.pgrst.object+json (single/maybeSingle)
 *   rpc       POST /rest/v1/rpc/* -> [] (nearby_locations et al.)
 *
 * Every other table returns an empty set, which matches the placeholder-URL
 * behavior those page sections already have in CI — and is identical on both
 * sides of any before/after comparison, so it cancels out.
 *
 * Environment:
 *   MOCK_PORT        listen port                      (default 54999)
 *   MOCK_LOG         JSONL request log path           (default no log)
 *   MOCK_LATENCY_MS  artificial per-request latency   (default 0)
 *   MOCK_ROWS        published row count              (default 2454)
 *   MOCK_TRUCK_STOPS published truck-stops rows       (default 1882)
 *   MOCK_TEXT_PROFILE 'production' widens listing text (default compact)
 *   MOCK_FIELD_PROFILE 'production' matches live field
 *                    presence rates + description length (default synthetic)
 *   MOCK_FAIL_TABLE  table whose reads answer 500      (default none)
 *   MOCK_REVENUE     serves fixture `sponsors` rows so the revenue console
 *                    can be driven in a browser. Off by default: with it off
 *                    the table answers [], which is the LIVE production state
 *                    (zero CRM rows) and the empty states worth checking.
 *   MOCK_PARKING_QUALITY shapes the unpublished `parking` rows to the live
 *                    provenance mix — 91 `csv-import` rows with NO coordinate
 *                    and 5 `ntad-2019-v04` rows with a coordinate but no
 *                    recorded geocode source (default off)
 *
 * The dataset is generated with a fixed-seed PRNG: two runs, or two branches,
 * see byte-identical data. Row scale defaults mirror the production counts
 * recorded in PR #216 (2,454 published; 1,882 truck-stops; 1,940 geocoded).
 */
import * as http from 'node:http';
import * as fs from 'node:fs';

const PORT = Number(process.env.MOCK_PORT ?? 54999);
const LOG = process.env.MOCK_LOG ?? '';
const LATENCY = Number(process.env.MOCK_LATENCY_MS ?? 0);
const N_PUBLISHED = Number(process.env.MOCK_ROWS ?? 2454);
const N_TRUCK_STOPS = Number(process.env.MOCK_TRUCK_STOPS ?? 1882);
/** Table whose reads answer 500, for exercising read-failure UI. Off by default. */
const FAIL_TABLE = process.env.MOCK_FAIL_TABLE ?? '';
/**
 * Opt-in, default-off like every other profile knob, so the datasets the
 * DIR-COMPLETE-2 and DIR-PAYLOAD-1 benches measure stay byte-identical.
 */
const PARKING_QUALITY = process.env.MOCK_PARKING_QUALITY === '1';
const REVENUE = process.env.MOCK_REVENUE === '1';

/**
 * Fixture sponsor pipeline for the revenue console bench.
 *
 * Deliberately awkward rather than tidy: an absurdly long company name (the
 * one that breaks a table layout), a duplicate pair (the flag has to show), a
 * live placement whose term lapsed three weeks ago (the red overdue warning),
 * a paid deal waiting to be activated, and a lost deal. Dates are fixed
 * strings so the bench does not drift with the calendar.
 *
 * Every value here is invented. No real business, person, email or phone.
 */
const SPONSOR_FIXTURES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    company: 'Fixture Truck Wash & Roadside Service of the Northern Georgia Corridor, LLC',
    contact_name: 'Fixture Contact',
    email: 'fixture-a@example.invalid',
    phone: '(555) 555-0100',
    stage: 'prospect',
    status: 'new',
    tier_interest: 'corridor-sponsor',
    pledged_cents: 0,
    paid_cents: 0,
    priority: 3,
    next_action: 'Reply to this inquiry',
    next_action_date: '2026-08-20',
    notes: 'Came from: i75\n\nRegarding directory listing: Fixture Truck Wash · truck-washes · GA · I-75 (/directory/location/fixture-truck-wash)',
    created_at: '2026-08-20T10:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    company: 'Fixture Truck Wash of the Northern Georgia Corridor LLC',
    contact_name: 'Fixture Contact',
    email: 'fixture-a@example.invalid',
    phone: null,
    stage: 'contacted',
    status: 'contacted',
    tier_interest: 'featured-listing',
    pledged_cents: 0,
    paid_cents: 0,
    priority: 2,
    next_action: null,
    next_action_date: null,
    notes: 'Came from: fb-launch-1',
    created_at: '2026-08-21T10:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    company: 'Fixture Tire Repair',
    contact_name: 'Fixture Contact',
    email: 'fixture-b@example.invalid',
    phone: '(555) 555-0111',
    stage: 'committed',
    status: 'paid',
    tier_interest: 'corridor-sponsor',
    pledged_cents: 299900,
    paid_cents: 299900,
    priority: 1,
    next_action: 'Activate the placement that was paid for',
    next_action_date: '2026-08-30',
    notes:
      'Agreed offer: corridor-sponsor · annual · quoted $2,999 · by Shawn on 2026-08-28\n\n' +
      'Payment confirmed: $2,999 received 2026-08-29 · ref: check 1042 · by Shawn on 2026-08-29',
    created_at: '2026-08-10T10:00:00Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    company: 'Fixture Roadside Service',
    contact_name: 'Fixture Contact',
    email: 'fixture-c@example.invalid',
    phone: '(555) 555-0122',
    stage: 'closed_won',
    status: 'active',
    tier_interest: 'featured-listing',
    pledged_cents: 9900,
    paid_cents: 9900,
    priority: 1,
    next_action: 'Stop or renew the featured listing — it will NOT lapse on its own',
    next_action_date: '2026-08-01',
    notes:
      'Agreed offer: featured-listing · monthly · quoted $99 · by Shawn on 2026-06-28\n\n' +
      'Payment confirmed: $99 received 2026-06-29 · ref: bank transfer · by Shawn on 2026-06-29',
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    company: 'Fixture Diner',
    contact_name: 'Fixture Contact',
    email: 'fixture-d@example.invalid',
    phone: '(555) 555-0133',
    stage: 'closed_lost',
    status: 'contacted',
    tier_interest: 'directory-placement',
    pledged_cents: 0,
    paid_cents: 0,
    priority: 5,
    next_action: null,
    next_action_date: null,
    notes: 'Closed lost: reason — no marketing budget this year · by Shawn on 2026-08-05',
    created_at: '2026-07-15T10:00:00Z',
  },
];

/* ------------------------------------------------------------------ seed */

/** mulberry32 — tiny deterministic PRNG; the fixed seed is the contract. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x7715);

const STATES = (
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV ' +
  'NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'
).split(' ');
const INTERSTATES = (
  'I-5 I-10 I-15 I-20 I-24 I-25 I-30 I-35 I-40 I-44 I-55 I-64 I-65 I-70 I-71 I-75 I-76 ' +
  'I-77 I-80 I-81 I-84 I-85 I-90 I-94 I-95'
).split(' ');
const AMENITIES = ['Showers', 'Diesel', 'DEF', 'Scales', 'Laundry', 'WiFi', 'Restaurant'];

/**
 * Non-truck-stop remainder, spread across the real category slugs
 * (src/lib/directory/categories.ts). Proportions are approximate; what the
 * benchmark needs is (a) one category far past the old 1,000-row cap and
 * (b) a realistic facet spread — not a census.
 */
const OTHER_CATEGORIES = ['parking', 'cat-scales', 'rest-areas', 'weigh-stations', 'truck-washes'];

/**
 * TEXT PROFILE. The default names ("Bench Stop 00001") and cities ("City123")
 * are shorter than the real ones, which does not matter for request counts or
 * wall time — the fields are never compared — but understates any measurement
 * of BYTES SERIALIZED INTO A PAGE by ~24 bytes per row.
 *
 * `MOCK_TEXT_PROFILE=production` widens name / city / detail_slug to the live
 * table's measured averages (26.0 / 8.4 / 37.2 characters over 2,454 rows,
 * read 2026-08-20), so a payload benchmark measures production scale rather
 * than fixture scale. Default is unchanged, so every existing bench and every
 * before/after comparison built on it stays byte-identical.
 */
const TEXT_PROFILE = process.env.MOCK_TEXT_PROFILE ?? 'compact';

/**
 * FIELD PROFILE. `MOCK_TEXT_PROFILE` widened name / city / detail_slug, but
 * left every other column at its synthetic rate — and several of those are
 * badly off the live table, in BOTH directions:
 *
 *                        synthetic   live (2,454 published, read 2026-08-20)
 *   description present     100%       49.2%   (1,208 rows)
 *   description length     ~29 ch       167 ch
 *   phone present              0%       41.2%   (1,011)
 *   website present            0%       30.0%   (736)
 *   tpc_url present            0%        2.3%   (57)
 *   parking_spaces present    60%       75.7%   (1,857)
 *   free / paid / reserved  50/20/15%  7.8 / 6.2 / 6.2%
 *   amenities per row       ~2.1        1.59  (only 43.1% carry any)
 *   is_featured                2%        0%
 *
 * A payload measurement taken against the synthetic rates is wrong in a way
 * that MATTERS: it understates `description` fivefold while overstating the
 * parking chips that make up most of `amenities`, so the two errors hide each
 * other in the total and misreport which field is worth removing.
 *
 * `MOCK_FIELD_PROFILE=production` sets these to the measured live rates. It
 * is opt-in, and — this is the constraint that shapes the code below — it
 * DRAWS THE SAME NUMBER OF rand() VALUES IN THE SAME ORDER as the default.
 * Presence that has no rand() call to reuse is derived from the row index
 * instead of adding one. So with the profile off, every generated row is
 * byte-identical to before, and every bench built on the default (including
 * DIR-COMPLETE-2's) measures exactly what it measured yesterday.
 */
const FIELD_PROFILE = process.env.MOCK_FIELD_PROFILE ?? 'synthetic';
const LIVE = FIELD_PROFILE === 'production';

/** Thresholds compared against the SAME rand() draws either way. */
const RATE = LIVE
  ? { spaces: 0.757, free: 0.078, paid: 0.062, reserved: 0.062, amenity: 0.221, featured: 0 }
  : { spaces: 0.6, free: 0.5, paid: 0.2, reserved: 0.15, amenity: 0.3, featured: 0.02 };

/**
 * Deterministic 0-999 spread for row i. A plain `i % 1000` would put every
 * presence decision on a 1,000-row block boundary, so the final partial block
 * (rows 2,000-2,453) would be uniformly "present" and skew every rate. The
 * multiplicative hash spreads them evenly at any row count, with no rand()
 * draw and no dependence on where the published set happens to end.
 */
const spread = (i, salt) => (Math.imul(i + salt, 2654435761) >>> 0) % 1000;

/**
 * Live descriptions: present on 49.2% of rows, averaging 167 characters.
 * Built from the row's own facts, so the text varies the way real listing
 * copy does rather than being one repeated string a compressor would flatter.
 */
function descriptionFor(i, name, city, state) {
  if (!LIVE) return `Synthetic benchmark row ${i}.`;
  if (spread(i, 11) >= 492) return null;
  return (
    `${name} is a driver stop in ${city}, ${state}, with truck parking and ` +
    `fuel lanes on site. Amenities and hours are verified against the operator listing.`
  );
}

/**
 * Coordinate PRECISION, which turned out to be one of the three biggest
 * payload drivers on the map page. A JS float serializes every digit it has:
 * `25 + rand() * 23` produces 25.082000711699948 — seventeen significant
 * digits of incompressible noise, seventeen bytes per coordinate, and NOT
 * what the live table holds. Measured decimal places over the 1,940 geocoded
 * published rows (2026-08-20):
 *
 *   13 dp  584 rows      6 dp  769 rows      3 dp   28 rows
 *   12 dp   56           5 dp  155           2 dp    1
 *   11 dp   10           4 dp  243
 *    9 dp    1           7 dp   90
 *    8 dp    3
 *
 * Rounding the synthetic value to a live-shaped number of places keeps the
 * geography identical while making the SERIALIZED WIDTH honest, so a payload
 * measurement is not dominated by digits production never had.
 */
const DP_BUCKETS = [
  [584, 13],
  [56, 12],
  [10, 11],
  [1, 9],
  [3, 8],
  [90, 7],
  [769, 6],
  [155, 5],
  [243, 4],
  [28, 3],
  [1, 2],
];
const DP_TOTAL = DP_BUCKETS.reduce((a, [n]) => a + n, 0);
function decimalsFor(i) {
  let at = spread(i, 71) * (DP_TOTAL / 1000);
  for (const [n, dp] of DP_BUCKETS) {
    if (at < n) return dp;
    at -= n;
  }
  return 6;
}
const roundTo = (v, dp) => Number(v.toFixed(dp));

/** Live phone / website / tpc presence, index-derived for the same reason. */
const phoneFor = (i) =>
  LIVE && spread(i, 23) < 412 ? `423-555-${String(1000 + (i % 9000))}` : null;
const websiteFor = (i, city, state) =>
  LIVE && spread(i, 37) < 300
    ? `https://www.example-truckstop.com/${state.toLowerCase()}/${city.toLowerCase()}/${i}`
    : null;
const tpcFor = (i) =>
  LIVE && spread(i, 53) < 23 ? `https://truckparkingclub.com/l/bench-${i}?ref=tlws` : null;
const CHAIN_NAMES = [
  'Pilot Travel Center',
  'Love’s Travel Stop',
  'TA Travel Center',
  'Petro Stopping Center',
  'Flying J Travel Plaza',
  'Bosselman Pump & Pantry',
  'Sapp Bros Travel Center',
  'Roady’s Truck Stop',
];
const CITY_NAMES = [
  'Dalton',
  'Chattanooga',
  'Knoxville',
  'Cartersville',
  'Ringgold',
  'Calhoun',
  'Effingham',
  'Sweetwater',
  'Bowling Green',
  'Jeffersonville',
  'Amarillo',
  'Laramie',
  'Walcott',
  'Ontario',
  'North Platte',
  'Baytown',
  'Wytheville',
];

/** Name and city for row i, at the configured text scale. */
function textFor(i, state) {
  if (TEXT_PROFILE !== 'production') {
    return { name: `Bench Stop ${String(i).padStart(5, '0')}`, city: `City${i % 500}` };
  }
  return {
    name: `${CHAIN_NAMES[i % CHAIN_NAMES.length]} #${String(1000 + i).padStart(4, '0')}`,
    city: CITY_NAMES[i % CITY_NAMES.length],
  };
}

/** uuid-shaped id whose lexicographic order equals insertion order. */
const idFor = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Mirrors location_detail_slug_base(): the DB derives this, so the mock does. */
const slugify = (name, city, state) =>
  `${name}-${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 100) || 'listing';

function makeRow(i, { published, deleted, categoryOverride }) {
  const category =
    categoryOverride ?? OTHER_CATEGORIES[Math.floor(rand() * OTHER_CATEGORIES.length)];
  const state = STATES[Math.floor(rand() * STATES.length)];
  const interstate = rand() < 0.9 ? INTERSTATES[Math.floor(rand() * INTERSTATES.length)] : null;
  const exit = interstate && rand() < 0.85 ? String(1 + Math.floor(rand() * 400)) : null;
  const geocoded = true; // exact geocoded count is set in a post-pass below
  const created = new Date(Date.UTC(2025, 0, 1) + Math.floor(rand() * 500 * 864e5)).toISOString();
  const { name, city } = textFor(i, state);
  return {
    id: idFor(i),
    name,
    category_slug: category,
    state,
    city,
    slug: `bench-stop-${i}`,
    address: `${100 + (i % 900)} Benchmark Rd`,
    zip: String(10000 + (i % 89999)),
    phone: phoneFor(i),
    website: websiteFor(i, city, state),
    description: descriptionFor(i, name, city, state),
    parking_spaces: rand() < RATE.spaces ? Math.floor(rand() * 250) : null,
    amenities: AMENITIES.filter(() => rand() < RATE.amenity),
    free_parking: rand() < RATE.free,
    paid_parking: rand() < RATE.paid,
    reserved_parking: rand() < RATE.reserved,
    overnight_parking: rand() < 0.5,
    tpc_url: tpcFor(i),
    is_featured: rand() < RATE.featured,
    is_indexable: true,
    lat: geocoded ? (LIVE ? roundTo(25 + rand() * 23, decimalsFor(i)) : 25 + rand() * 23) : null,
    lng: geocoded
      ? LIVE
        ? roundTo(-124 + rand() * 57, decimalsFor(i))
        : -124 + rand() * 57
      : null,
    interstate,
    exit_number: exit,
    created_at: created,
    detail_slug:
      TEXT_PROFILE === 'production'
        ? `${slugify(name, city, state)}-${i}`
        : `bench-stop-${i}-city${i % 500}-${state.toLowerCase()}`,
    updated_at: created,
    verified_at: null,
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: ['yes', 'no', 'unknown'][Math.floor(rand() * 3)],
    overnight_status_source: null,
    is_published: published,
    deleted_at: deleted ? created : null,
  };
}

const LOCATIONS = [];
{
  let i = 0;
  for (; i < N_TRUCK_STOPS; i++)
    LOCATIONS.push(makeRow(i, { published: true, categoryOverride: 'truck-stops' }));
  for (; i < N_PUBLISHED; i++) LOCATIONS.push(makeRow(i, { published: true }));
  // Unpublished + soft-deleted rows exist so the filters do real work.
  for (; i < N_PUBLISHED + 200; i++) LOCATIONS.push(makeRow(i, { published: false }));
  for (; i < N_PUBLISHED + 250; i++) LOCATIONS.push(makeRow(i, { published: true, deleted: true }));
  // A fixed slice of published rows is non-indexable (prod: 2,439 of 2,454).
  for (let k = 0; k < 15; k++) LOCATIONS[k * 37].is_indexable = false;

  // Strip coordinates from a deterministic slice of published rows so the
  // geocoded count is EXACT (prod: 1,940 of 2,454), not probabilistic.
  const N_GEOCODED = Number(process.env.MOCK_GEOCODED ?? 1940);
  let toStrip = Math.max(0, N_PUBLISHED - N_GEOCODED);
  for (let k = 0; k < LOCATIONS.length && toStrip > 0; k++) {
    const r = LOCATIONS[k];
    if (r.is_published && r.deleted_at === null && r.lat !== null && k % 4 === 2) {
      r.lat = null;
      r.lng = null;
      toStrip--;
    }
  }
  if (toStrip > 0) throw new Error(`mock-postgrest: could not reach MOCK_GEOCODED=${N_GEOCODED}`);

  // PARKING-QUALITY-1: give the unpublished `parking` rows the provenance
  // shape the live table actually has, so the admin queue renders a real
  // classification rather than a uniform one. Live: 91 csv-import rows with
  // no coordinate at all, 5 NTAD rows with a coordinate but no recorded
  // geocode source. Both classes are blocked, for different reasons.
  if (PARKING_QUALITY) {
    const unpublishedParking = LOCATIONS.filter(
      (r) => !r.is_published && r.deleted_at === null && r.category_slug === 'parking',
    );
    unpublishedParking.forEach((r, k) => {
      if (k < 5) {
        r.source = 'ntad-2019-v04';
        r.geocode_source = null;
        r.coord_verification_status = null;
        r.name = `${r.name} (I-95 Northbound)`;
        r.website = null;
        r.address = null;
      } else {
        r.source = 'csv-import';
        r.lat = null;
        r.lng = null;
        r.geocode_source = null;
        r.coord_verification_status = null;
        r.website = 'https://www.fdot.gov/maintenance/restareas.shtm';
        if (k % 3 === 0) r.name = `${r.name} Rest Area (Northbound)`;
        if (k % 11 === 0) r.name = `${r.name} Weigh Station`;
      }
      r.manually_verified_at = null;
      r.hours = {};
      r.overnight_status = null;
      r.overnight_status_source = null;
    });
  }
}

/* -------------------------------------------------------- filter engine */

function cmp(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function parseScalar(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

/** One `column=op.value` filter -> predicate. Unsupported ops throw loudly. */
function predicateFor(column, raw) {
  let neg = false;
  let rest = raw;
  if (rest.startsWith('not.')) {
    neg = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf('.');
  const op = dot === -1 ? rest : rest.slice(0, dot);
  const val = dot === -1 ? '' : rest.slice(dot + 1);
  let base;
  switch (op) {
    case 'eq':
      base = (r) => String(r[column]) === val;
      break;
    case 'is':
      base = (r) =>
        parseScalar(val) === null
          ? r[column] === null || r[column] === undefined
          : r[column] === parseScalar(val);
      break;
    case 'in': {
      const items = val
        .replace(/^\(/, '')
        .replace(/\)$/, '')
        .split(',')
        .map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
      base = (r) => items.includes(String(r[column]));
      break;
    }
    case 'gt':
      base = (r) => cmp(r[column], parseScalar(val)) > 0;
      break;
    case 'gte':
      base = (r) => cmp(r[column], parseScalar(val)) >= 0;
      break;
    case 'lt':
      base = (r) => cmp(r[column], parseScalar(val)) < 0;
      break;
    case 'lte':
      base = (r) => cmp(r[column], parseScalar(val)) <= 0;
      break;
    /*
     * `ilike` — case-insensitive pattern match.
     *
     * Needed because the exit and corridor pages narrow by corridor
     * number with `.ilike('interstate', '%75%')` before canonicalizing in
     * application code. Without it every /directory/<hwy>/exit-<n> page
     * threw during prerender, which made the whole site unbuildable
     * against this mock — and any bench that needs a built site with a
     * populated directory unrunnable with it.
     *
     * PostgREST wildcards are `*` on the wire; supabase-js sends `%`.
     * Both are accepted here, and everything else in the pattern is
     * escaped so a listing name containing `.` or `(` cannot turn into a
     * regex of its own.
     */
    case 'like':
    case 'ilike': {
      const rx = new RegExp(
        `^${val.replace(/[.*+?^${}()|[\]\\%]/g, (c) => (c === '%' || c === '*' ? '.*' : `\\${c}`))}$`,
        op === 'ilike' ? 'i' : '',
      );
      base = (r) =>
        r[column] === null || r[column] === undefined ? false : rx.test(String(r[column]));
      break;
    }
    default:
      throw new Error(`mock-postgrest: unsupported operator "${op}" on ${column}=${raw}`);
  }
  return neg ? (r) => !base(r) : base;
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function runQuery(rows, url) {
  const params = url.searchParams;
  let out = rows;
  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key)) continue;
    out = out.filter(predicateFor(key, value));
  }
  const total = out.length;

  const order = params.get('order');
  if (order) {
    const keys = order.split(',').map((k) => {
      const [col, dir] = k.split('.');
      return { col, desc: dir === 'desc' };
    });
    out = [...out].sort((a, b) => {
      for (const { col, desc } of keys) {
        const c = cmp(a[col], b[col]);
        if (c !== 0) return desc ? -c : c;
      }
      return 0;
    });
  }

  const offset = Number(params.get('offset') ?? 0);
  const limit = params.get('limit') !== null ? Number(params.get('limit')) : null;
  out = limit !== null ? out.slice(offset, offset + limit) : out.slice(offset);

  const select = params.get('select');
  if (select && select !== '*') {
    const cols = select.split(',').map((c) => c.trim());
    out = out.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  }
  return { rows: out, total, offset };
}

/* --------------------------------------------------------------- server */

let requestCount = 0;
const logStream = LOG ? fs.createWriteStream(LOG, { flags: 'a' }) : null;

const server = http.createServer((req, res) => {
  const handle = () => {
    requestCount++;
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const table = url.pathname.replace(/^\/rest\/v1\//, '').split('/')[0];

    // Response size + service time are appended by logDone at end of handling,
    // so the log carries the full cost picture per request.
    const started = process.hrtime.bigint();
    const logDone = (bytes) => {
      if (!logStream) return;
      logStream.write(
        JSON.stringify({
          n: requestCount,
          ts: Date.now(),
          method: req.method,
          table,
          query: url.search,
          prefer: req.headers.prefer ?? null,
          range: req.headers.range ?? null,
          bytes,
          serviceUs: Number((process.hrtime.bigint() - started) / 1000n),
        }) + '\n',
      );
    };

    // Health probe for the bench orchestrator.
    if (url.pathname === '/__mock/health') {
      const body = JSON.stringify({ ok: true, requests: requestCount, rows: LOCATIONS.length });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
      logDone(body.length);
      return;
    }

    // RPCs used by user-facing paths (nearby_locations) return empty sets.
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
      logDone(2);
      return;
    }

    // A read that FAILS is a state the pages must render honestly, and it
    // cannot be reached from a healthy fixture. Opt-in, default off, so every
    // other bench sees the server it always saw.
    if (FAIL_TABLE && table === FAIL_TABLE) {
      const body = JSON.stringify({
        code: '57014',
        message: 'canceling statement due to statement timeout',
      });
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(body);
      logDone(body.length);
      return;
    }

    const dataset =
      table === 'locations'
        ? LOCATIONS
        : table === 'sponsors' && REVENUE
          ? SPONSOR_FIXTURES
          : [];
    let result;
    try {
      // supabase-js .range() arrives as a Range header; normalize to offset/limit.
      const range = req.headers.range;
      if (range && /^\d+-\d+$/.test(range)) {
        const [from, to] = range.split('-').map(Number);
        url.searchParams.set('offset', String(from));
        url.searchParams.set('limit', String(to - from + 1));
      }
      result = runQuery(dataset, url);
    } catch (err) {
      const body = JSON.stringify({ code: 'MOCK400', message: String(err?.message ?? err) });
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(body);
      logDone(body.length);
      return;
    }

    const wantsCount = /count=(exact|planned|estimated)/.test(req.headers.prefer ?? '');
    const headers = { 'content-type': 'application/json' };
    if (wantsCount) {
      const upper = result.rows.length ? result.offset + result.rows.length - 1 : null;
      headers['content-range'] =
        upper === null ? `*/${result.total}` : `${result.offset}-${upper}/${result.total}`;
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      logDone(0);
      return;
    }

    // single()/maybeSingle() negotiate the object media type; zero rows is
    // PGRST116, which supabase-js maybeSingle() maps back to data: null.
    if ((req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')) {
      if (result.rows.length === 1) {
        const body = JSON.stringify(result.rows[0]);
        res.writeHead(200, headers);
        res.end(body);
        logDone(body.length);
      } else {
        const body = JSON.stringify({
          code: 'PGRST116',
          message: `JSON object requested, multiple (or no) rows returned: ${result.rows.length}`,
        });
        res.writeHead(406, { 'content-type': 'application/json' });
        res.end(body);
        logDone(body.length);
      }
      return;
    }

    const body = JSON.stringify(result.rows);
    res.writeHead(200, headers);
    res.end(body);
    logDone(body.length);
  };

  if (LATENCY > 0) setTimeout(handle, LATENCY);
  else handle();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `mock-postgrest listening on 127.0.0.1:${PORT} — ${LOCATIONS.length} location rows ` +
      `(${N_PUBLISHED} published, ${N_TRUCK_STOPS} truck-stops), latency ${LATENCY}ms`,
  );
});
