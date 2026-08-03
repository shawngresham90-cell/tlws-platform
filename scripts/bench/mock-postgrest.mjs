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
 * src/app/sitemap.ts):
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

/** uuid-shaped id whose lexicographic order equals insertion order. */
const idFor = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

function makeRow(i, { published, deleted, categoryOverride }) {
  const category =
    categoryOverride ?? OTHER_CATEGORIES[Math.floor(rand() * OTHER_CATEGORIES.length)];
  const state = STATES[Math.floor(rand() * STATES.length)];
  const interstate = rand() < 0.9 ? INTERSTATES[Math.floor(rand() * INTERSTATES.length)] : null;
  const exit = interstate && rand() < 0.85 ? String(1 + Math.floor(rand() * 400)) : null;
  const geocoded = true; // exact geocoded count is set in a post-pass below
  const created = new Date(Date.UTC(2025, 0, 1) + Math.floor(rand() * 500 * 864e5)).toISOString();
  return {
    id: idFor(i),
    name: `Bench Stop ${String(i).padStart(5, '0')}`,
    category_slug: category,
    state,
    city: `City${i % 500}`,
    slug: `bench-stop-${i}`,
    address: `${100 + (i % 900)} Benchmark Rd`,
    zip: String(10000 + (i % 89999)),
    phone: null,
    website: null,
    description: `Synthetic benchmark row ${i}.`,
    parking_spaces: rand() < 0.6 ? Math.floor(rand() * 250) : null,
    amenities: AMENITIES.filter(() => rand() < 0.3),
    free_parking: rand() < 0.5,
    paid_parking: rand() < 0.2,
    reserved_parking: rand() < 0.15,
    overnight_parking: rand() < 0.5,
    tpc_url: null,
    is_featured: rand() < 0.02,
    is_indexable: true,
    lat: geocoded ? 25 + rand() * 23 : null,
    lng: geocoded ? -124 + rand() * 57 : null,
    interstate,
    exit_number: exit,
    created_at: created,
    detail_slug: `bench-stop-${i}-city${i % 500}-${state.toLowerCase()}`,
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

    const dataset = table === 'locations' ? LOCATIONS : [];
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
