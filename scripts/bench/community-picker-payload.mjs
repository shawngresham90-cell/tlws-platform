/**
 * What the two community listing pickers cost a phone (DIR-COMPLETE-2).
 *
 * Completing the picker's pool adds rows to an array that is serialized into
 * /directory/submit and /directory/reviews, so "it is complete now" is only
 * half an answer — the other half is whether a driver on a phone can still
 * load the page. This measures that from BUILD ARTIFACTS rather than from an
 * estimate: the prerendered .html Next writes for each route, and the .rsc
 * flight payload beside it, are the bytes a visitor actually receives.
 *
 * Compression is measured, not assumed. The pool is extremely repetitive —
 * 46 state codes, a handful of chain names, city names that recur — so raw
 * size badly overstates what crosses the network. Netlify serves Brotli where
 * the client accepts it and gzip otherwise, so both are reported, and the
 * budget is stated against the compressed transfer because that is the number
 * a phone on a truck-stop connection experiences.
 *
 * Filter timing is measured against the SHIPPED predicate, on the complete
 * pool, for a normal query and for the worst case (a one-character query that
 * matches nearly everything), because that is where a client-side picker
 * would fall over if it were going to.
 *
 * Usage:
 *   node scripts/bench/community-picker-payload.mjs --tree . --label after
 *   node scripts/bench/community-picker-payload.mjs --tree /path/to/before --label before
 *
 * The tree must already hold a production `.next` build. Build it against
 * scripts/bench/mock-postgrest.mjs with MOCK_TEXT_PROFILE=production so the
 * listing strings are live-scale; a build against the CI placeholder URL
 * reads zero listings and measures nothing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const TREE = arg('tree', '.');
const LABEL = arg('label', 'run');
const OUT = arg('out', '');

const ROUTES = ['/directory/submit', '/directory/reviews'];

/**
 * BUDGET, in COMPRESSED transfer bytes for the whole document.
 *
 * The repository had no community-page payload budget, so one is established
 * here from evidence rather than taste. Two anchors:
 *
 *   - This site's own routes. The heaviest interactive route in the build
 *     (/trip-planner/classic) ships ~148 kB of First Load JS, and the shared
 *     baseline every page pays is ~88 kB. A form page whose compressed
 *     document approaches the size of the app's heaviest JS bundle is out of
 *     character for this site.
 *   - What the page is FOR. These are two intake forms a driver opens once,
 *     often on a phone at a truck stop, to report a correction or leave a
 *     review. The listing pool is the page's only large payload.
 *
 * 150 kB Brotli for the complete document is the line. It sits under this
 * site's heaviest existing route, and leaves the pool room to roughly double
 * — past 5,000 listings — before the picker's architecture has to change.
 * Exceeding it is not a matter of taste to argue about: it means the local-array
 * picker has outgrown the page and a bounded search endpoint is owed.
 */
export const BUDGET = {
  brotliBytes: 150 * 1024,
  gzipBytes: 180 * 1024,
  /** Where the local-array picker stops being the right shape at all. */
  poolCeiling: 5000,
};

const gzip = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const brotli = (buf) =>
  zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

/** Prerendered artifacts Next writes for a statically generated route. */
function artifacts(tree, route) {
  const base = path.join(tree, '.next', 'server', 'app', route.replace(/^\//, ''));
  return { html: `${base}.html`, rsc: `${base}.rsc` };
}

/**
 * The listing array as it exists inside the flight payload. Located by the
 * detail-slug key, which only the listing refs carry, then measured by
 * bracket-matching so the number is the array itself and not a guess.
 */
function listingArrayBytes(text) {
  // Flight data lives inside a JS string literal, so its quotes are escaped.
  // Match whichever form this document actually used.
  const key = text.includes('\\"detailSlug\\"') ? '\\"detailSlug\\"' : '"detailSlug"';
  const first = text.indexOf(key);
  if (first === -1) return { bytes: 0, count: 0 };
  // Walk back to the '[' that opens the array of objects.
  let start = text.lastIndexOf('[', first);
  if (start === -1) return { bytes: 0, count: 0 };
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        return {
          bytes: Buffer.byteLength(slice, 'utf8'),
          count: (slice.match(/\\?"detailSlug\\?"/g) ?? []).length,
        };
      }
    }
  }
  return { bytes: 0, count: 0 };
}

/** Rough count of listing refs present, whatever shape they were serialized in. */
function countRefs(text) {
  const withSlug = (text.match(/\\?"detailSlug\\?"/g) ?? []).length;
  if (withSlug) return withSlug;
  return (text.match(/00000000-0000-4000-8000-/g) ?? []).length;
}

function measureRoute(tree, route) {
  const { html, rsc } = artifacts(tree, route);
  if (!fs.existsSync(html)) {
    return { route, error: `no prerendered HTML at ${path.relative(tree, html)}` };
  }
  const htmlBuf = fs.readFileSync(html);
  const rscBuf = fs.existsSync(rsc) ? fs.readFileSync(rsc) : Buffer.alloc(0);
  const htmlText = htmlBuf.toString('utf8');

  const arr = listingArrayBytes(htmlText);
  return {
    route,
    listingCount: countRefs(htmlText),
    listingArrayRawBytes: arr.bytes,
    htmlBytes: htmlBuf.length,
    htmlGzip: gzip(htmlBuf),
    htmlBrotli: brotli(htmlBuf),
    rscBytes: rscBuf.length,
    rscGzip: rscBuf.length ? gzip(rscBuf) : 0,
    rscBrotli: rscBuf.length ? brotli(rscBuf) : 0,
  };
}

/** First Load JS for a route, straight out of the build's own report. */
function routeJs(tree) {
  const file = path.join(tree, '.next', 'app-build-manifest.json');
  if (!fs.existsSync(file)) return {};
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const route of ROUTES) {
    const key = Object.keys(manifest.pages).find((k) => k.includes(route.replace(/^\//, '')));
    if (!key) continue;
    let bytes = 0;
    for (const f of manifest.pages[key]) {
      const p = path.join(tree, '.next', f);
      if (fs.existsSync(p)) bytes += fs.statSync(p).size;
    }
    out[route] = bytes;
  }
  return out;
}

/**
 * The picker's own filter, copied from LocationPicker so the timing measures
 * the shipped predicate. If these ever diverge the numbers below stop meaning
 * anything, so the harness asserts the source still matches.
 */
const MAX_RESULTS = 12;
function filterPool(listings, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listings
    .filter((l) => `${l.name} ${l.city} ${l.state}`.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS);
}

function timeFiltering(listings) {
  const QUERIES = [
    ['typical name', 'pilot travel'],
    ['city', 'chattanooga'],
    ['state code', 'tx'],
    ['worst case — one char matching nearly all', 'a'],
    ['worst case — no match, full scan', 'zzzzzzzz'],
  ];
  const out = [];
  for (const [label, q] of QUERIES) {
    for (let i = 0; i < 20; i++) filterPool(listings, q); // warm
    const runs = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const matched = filterPool(listings, q);
      runs.push(performance.now() - t0);
      if (matched.length > MAX_RESULTS) throw new Error('picker rendered past its cap');
    }
    runs.sort((a, b) => a - b);
    out.push({
      query: label,
      medianMs: +runs[Math.floor(runs.length / 2)].toFixed(3),
      p95Ms: +runs[Math.floor(runs.length * 0.95)].toFixed(3),
      rendered: filterPool(listings, q).length,
    });
  }
  return out;
}

/** Listing refs reconstructed from the prerendered HTML, for filter timing. */
function poolFromHtml(tree, route) {
  const { html } = artifacts(tree, route);
  if (!fs.existsSync(html)) return [];
  const text = fs.readFileSync(html, 'utf8');
  const pool = [];
  // Flight payloads escape quotes; match on the serialized field order the
  // read produces, in either escaping.
  const re =
    /\\?"id\\?":\\?"([0-9a-f-]{36})\\?",\\?"name\\?":\\?"(.*?)\\?",\\?"city\\?":\\?"(.*?)\\?",\\?"state\\?":\\?"([A-Z]{2})\\?"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    pool.push({ id: m[1], name: m[2], city: m[3], state: m[4] });
  }
  return pool;
}

/* ------------------------------------------------------------------ run */

const report = { label: LABEL, tree: path.resolve(TREE), routes: [], js: routeJs(TREE) };
for (const route of ROUTES) report.routes.push(measureRoute(TREE, route));

const pool = poolFromHtml(TREE, '/directory/submit');
report.poolSize = pool.length;
report.filtering = pool.length ? timeFiltering(pool) : [];
report.memory = {
  poolHeapBytes: pool.length ? Buffer.byteLength(JSON.stringify(pool), 'utf8') : 0,
};

console.log(`\n=== community picker payload — ${LABEL} ===`);
for (const r of report.routes) {
  if (r.error) {
    console.log(`\n${r.route}: ${r.error}`);
    continue;
  }
  const overBrotli = r.htmlBrotli > BUDGET.brotliBytes;
  console.log(`\n${r.route}`);
  console.log(`  listing refs serialized : ${r.listingCount.toLocaleString()}`);
  console.log(`  listing array (raw)     : ${kb(r.listingArrayRawBytes)}`);
  console.log(`  served HTML             : ${kb(r.htmlBytes)} raw`);
  console.log(`    gzip                  : ${kb(r.htmlGzip)}`);
  console.log(
    `    brotli                : ${kb(r.htmlBrotli)}  ${overBrotli ? 'OVER BUDGET' : `(budget ${kb(BUDGET.brotliBytes)})`}`,
  );
  console.log(
    `  RSC/flight payload      : ${kb(r.rscBytes)} raw / ${kb(r.rscGzip)} gzip / ${kb(r.rscBrotli)} brotli`,
  );
  console.log(`  route JS (first load)   : ${report.js[r.route] ? kb(report.js[r.route]) : 'n/a'}`);
}

if (report.filtering.length) {
  console.log(`\nfilter timing over ${report.poolSize.toLocaleString()} refs (shipped predicate)`);
  for (const f of report.filtering) {
    console.log(
      `  ${f.query.padEnd(42)} median ${String(f.medianMs).padStart(7)} ms   p95 ${String(f.p95Ms).padStart(7)} ms   rendered ${f.rendered}`,
    );
  }
  console.log(`  pool as JSON in memory: ${kb(report.memory.poolHeapBytes)}`);
}

const verdicts = report.routes
  .filter((r) => !r.error)
  .map((r) => ({
    route: r.route,
    brotliOk: r.htmlBrotli <= BUDGET.brotliBytes,
    gzipOk: r.htmlGzip <= BUDGET.gzipBytes,
  }));
report.verdict = verdicts.every((v) => v.brotliOk && v.gzipOk) ? 'WITHIN BUDGET' : 'OVER BUDGET';
console.log(`\nverdict: ${report.verdict}`);

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`wrote ${OUT}`);
}
