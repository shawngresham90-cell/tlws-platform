/**
 * What the Directory's interactive pages cost a phone (DIR-PAYLOAD-1).
 *
 * Measured from BUILD ARTIFACTS — the prerendered `.html` Next writes for a
 * route and the `.rsc` flight payload beside it are the bytes a visitor
 * actually receives — never from source file sizes, which measure nothing a
 * driver downloads.
 *
 * The number that matters is the DIRECTORY-DATA CONTRIBUTION: the bytes in
 * the delivered document that exist because of listings. That is three
 * things, and a measurement that counts only the first is the reason this
 * problem went unnoticed for so long:
 *
 *   1. the listing array serialized into the flight payload,
 *   2. the listing objects inside the ItemList JSON-LD, and
 *   3. the listing cards rendered into the initial HTML.
 *
 * On /directory/map (3) was the single largest item — 1,940 result cards,
 * 2.5 MB of markup — and it is invisible to any measure of "how big is the
 * data we serialize".
 *
 * Compression is measured, not assumed. Netlify serves Brotli where the
 * client accepts it and gzip otherwise, so both are reported and the budget
 * is stated against Brotli, because that is the number a phone on a
 * truck-stop connection experiences.
 *
 * Usage:
 *   node scripts/bench/directory-payload.mjs --tree . --label after
 *   node scripts/bench/directory-payload.mjs --tree /path/to/saved --label before
 *   node scripts/bench/directory-payload.mjs --tree . --baseline before.json
 *
 * `--tree` accepts either a checkout holding a production `.next` build, or a
 * directory holding a saved `server/app/directory` artifact tree. Build it
 * against scripts/bench/mock-postgrest.mjs with BOTH
 * MOCK_TEXT_PROFILE=production and MOCK_FIELD_PROFILE=production, or the
 * listing text and field presence are fixture-shaped and the measurement is
 * of the fixture rather than of the directory.
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
const BASELINE = arg('baseline', '');

/**
 * BUDGET, in COMPRESSED transfer bytes.
 *
 * Three lines, each anchored to something measured rather than chosen:
 *
 *   documentBrotli 150 kB — the same ceiling DIR-COMPLETE-2 set for the
 *     community pages, kept so the site has ONE answer to "how big may a
 *     page be". It sits under this build's heaviest route
 *     (/trip-planner/classic, ~148 kB First Load JS).
 *
 *   dataBrotli 90 kB — stricter, and specific to this milestone: the listing
 *     data alone may not exceed 90 kB Brotli. A directory page is mostly
 *     listings, so a document budget alone would let the data eat the whole
 *     allowance and leave nothing for the page around it.
 *
 *   initialCards 30..120 — a RANGE, because both ends are real failures.
 *     Too many is the defect this milestone exists to fix: /directory/map
 *     rendered 1,940 result cards, 23,120 DOM elements, before a driver
 *     touched anything. Too FEW is the failure a payload fix invites and
 *     nothing else would notice — a page that ships its data but renders no
 *     cards is smaller on every byte measure and worse in every other way:
 *     no server-rendered detail links for a crawler, nothing on screen until
 *     hydration. (This is not hypothetical: an early cut of this milestone
 *     rendered zero, because the window constant was imported from a `'use
 *     client'` module and arrived as a client reference. Every byte number
 *     improved.) The ceiling is 120 because a GROUPED page — state and
 *     corridor pages show up to 12 per category or state — is bounded by
 *     construction at roughly 12 x the number of groups — and its FLOOR is
 *     one group preview, not one flat window, for the same reason.
 *
 *   domElements 4000 — what the card count is a proxy for. The map page was
 *     at 23,120.
 *
 * REDUCTION TARGETS are separate from the budget and are the milestone's:
 * at least 45% off the directory-data contribution on the worst category
 * page and on the map page. A page can sit inside the budget and still fail
 * the target, which is the point — being small already is not a reason to
 * stay wasteful.
 */
export const BUDGET = {
  documentBrotli: 150 * 1024,
  dataBrotli: 90 * 1024,
  minInitialCards: 30,
  /** One group preview — the floor for a grouped state/corridor page. */
  groupedPreview: 12,
  maxInitialCards: 120,
  domElements: 4000,
  reductionTarget: 0.45,
};

/** Routes measured, and why each one is in the list. */
const ROUTES = [
  { route: 'truck-stops', why: 'largest registry category (1,882 live rows)' },
  { route: 'map', why: 'every coordinate-ready listing (1,940 live rows)' },
  { route: 'parking', why: 'custom page on the same wide-array path' },
  { route: 'washington', why: 'largest state page in the fixture' },
  { route: 'i55', why: 'largest corridor page in the fixture' },
  { route: 'cat-scales', why: 'mid-size category' },
  { route: 'truck-washes', why: 'small category — control' },
];

const gzip = (b) => zlib.gzipSync(Buffer.from(b), { level: 9 }).length;
const brotli = (b) =>
  zlib.brotliCompressSync(Buffer.from(b), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;

function artifactDir(tree) {
  for (const candidate of [
    path.join(tree, '.next', 'server', 'app', 'directory'),
    path.join(tree, 'server', 'app', 'directory'),
    path.join(tree, 'directory'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`no prerendered directory artifacts under ${tree}`);
}

/**
 * Pull the flight payload back out of the document. Next writes it as a
 * sequence of `self.__next_f.push([1,"…"])` calls whose string argument is
 * JS-escaped; a reader that takes them one at a time sees an array that spans
 * a chunk boundary as two halves of nothing, so they are decoded and joined
 * before anything is looked for in them.
 */
function flightOf(html) {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map((m) => JSON.parse(m[1]))
    .join('');
}

/** The balanced JSON value that starts at `from` (an `[` or `{`). */
function balancedFrom(text, from) {
  let depth = 0;
  for (let p = from; p < text.length; p++) {
    const c = text[p];
    if (c === '"') {
      p++;
      while (p < text.length && text[p] !== '"') {
        if (text[p] === '\\') p++;
        p++;
      }
      continue;
    }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return text.slice(from, p + 1);
    }
  }
  return null;
}

/** Every listing payload on the page (a page may ship an index AND cards). */
function allListingPayloads(flight) {
  const found = [];
  for (const key of ['"entries":', '"index":', '"initialCards":']) {
    let at = flight.indexOf(key);
    while (at !== -1) {
      const start = flight.indexOf('[', at + key.length - 1);
      const raw = start === -1 ? null : balancedFrom(flight, start);
      if (raw) found.push({ key: key.slice(1, -2), raw });
      at = flight.indexOf(key, at + key.length);
    }
  }
  return found;
}

function jsonLdOf(html) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
}

/** The rendered listing cards: map result <li>s, or directory card links. */
function renderedCards(html) {
  const mapList = html.indexOf('aria-label="Map results"');
  if (mapList !== -1) {
    const start = html.lastIndexOf('<ul', mapList);
    let depth = 0;
    const re = /<\/?ul\b/g;
    re.lastIndex = start;
    let m;
    while ((m = re.exec(html))) {
      if (m[0] === '<ul') depth++;
      else if (--depth === 0) {
        const list = html.slice(start, re.lastIndex);
        return { count: (list.match(/data-entry-id=/g) || []).length, markup: list };
      }
    }
  }
  // Category / state / interstate cards: one "View details" link per card.
  const cards = [
    ...html.matchAll(
      /<div class="flex flex-col rounded-card[\s\S]*?(?=<div class="flex flex-col rounded-card|<\/div><\/div>)/g,
    ),
  ];
  const markup = cards.map((c) => c[0]).join('');
  return { count: (html.match(/aria-label="View details for /g) || []).length, markup };
}

function measure(dir, route) {
  const htmlPath = path.join(dir, `${route}.html`);
  const rscPath = path.join(dir, `${route}.rsc`);
  if (!fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const rsc = fs.existsSync(rscPath) ? fs.readFileSync(rscPath) : Buffer.alloc(0);

  const flight = flightOf(html);
  const payloads = allListingPayloads(flight);
  const payloadRaw = payloads.reduce((a, p) => a + Buffer.byteLength(p.raw), 0);
  const payloadBrotli = payloads.length ? brotli(payloads.map((p) => p.raw).join('')) : 0;
  const rowCount = payloads.reduce((a, p) => {
    try {
      return a + JSON.parse(p.raw).length;
    } catch {
      return a;
    }
  }, 0);

  const ld = jsonLdOf(html);
  const ldJoined = ld.join('');
  let itemListItems = 0;
  let itemListNumberOfItems = null;
  for (const block of ld) {
    try {
      const parsed = JSON.parse(block);
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node && node['@type'] === 'ItemList') {
          itemListItems += (node.itemListElement || []).length;
          itemListNumberOfItems = node.numberOfItems ?? null;
        }
      }
    } catch {
      /* a non-JSON ld block is a separate contract's problem, not this one's */
    }
  }
  const ldBrotli = ldJoined ? brotli(ldJoined) : 0;

  const cards = renderedCards(html);
  const cardsBrotli = cards.markup ? brotli(cards.markup) : 0;

  // Two list layouts with two different bounds. A FLAT list (category, map)
  // renders one window of 30. A GROUPED list (state, corridor) renders up to
  // 12 per category or state, so a scope with few rows per group legitimately
  // paints fewer than 30 in total. `id="scope-search"` is the grouped
  // browser's own search box.
  const grouped = html.includes('id="scope-search"');
  const groupCount = (html.match(/<section aria-labelledby=/g) || []).length;

  return {
    route,
    rows: rowCount,
    payloadKeys: payloads.map((p) => p.key),
    html: { raw: Buffer.byteLength(html), gzip: gzip(html), brotli: brotli(html) },
    rsc: {
      raw: rsc.length,
      gzip: rsc.length ? gzip(rsc) : 0,
      brotli: rsc.length ? brotli(rsc) : 0,
    },
    data: { raw: payloadRaw, brotli: payloadBrotli },
    jsonLd: {
      raw: Buffer.byteLength(ldJoined),
      brotli: ldBrotli,
      items: itemListItems,
      numberOfItems: itemListNumberOfItems,
    },
    cards: { count: cards.count, raw: Buffer.byteLength(cards.markup), brotli: cardsBrotli },
    layout: grouped ? 'grouped' : 'flat',
    groupCount,
    detailLinks: (html.match(/\/directory\/location\//g) || []).length,
    domNodes: (html.match(/<[a-zA-Z]/g) || []).length,
    // The listing-attributable total: serialized data + schema + rendered cards.
    directoryDataBrotli: payloadBrotli + ldBrotli + cardsBrotli,
  };
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const pct = (a, b) => (b === 0 ? '—' : `${(((b - a) / b) * 100).toFixed(1)}%`);

const dir = artifactDir(TREE);
const results = ROUTES.map(({ route, why }) => {
  const m = measure(dir, route);
  return m ? { ...m, why } : { route, why, missing: true };
});

const baseline =
  BASELINE && fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
const priorOf = (route) => baseline?.results?.find((r) => r.route === route);

console.log(`\nDIRECTORY PAYLOAD — ${LABEL}`);
console.log(`artifacts: ${dir}\n`);

for (const r of results) {
  if (r.missing) {
    console.log(`/directory/${r.route}  — NOT PRERENDERED (${r.why})`);
    continue;
  }
  const prior = priorOf(r.route);
  console.log(`/directory/${r.route}  — ${r.why}`);
  console.log(
    `  rows serialized      ${r.rows}${r.payloadKeys.length ? ` (${r.payloadKeys.join(' + ')})` : ''}`,
  );
  console.log(
    `  document             ${kb(r.html.raw)} raw · ${kb(r.html.gzip)} gzip · ${kb(r.html.brotli)} brotli`,
  );
  console.log(`  flight (.rsc)        ${kb(r.rsc.raw)} raw · ${kb(r.rsc.brotli)} brotli`);
  console.log(`  listing data         ${kb(r.data.raw)} raw · ${kb(r.data.brotli)} brotli`);
  console.log(
    `  ItemList JSON-LD     ${r.jsonLd.items} items · ${kb(r.jsonLd.raw)} raw · ${kb(r.jsonLd.brotli)} brotli`,
  );
  console.log(
    `  rendered cards       ${r.cards.count} · ${kb(r.cards.raw)} raw · ${kb(r.cards.brotli)} brotli`,
  );
  console.log(`  detail links in HTML ${r.detailLinks} · DOM elements ${r.domNodes}`);
  console.log(
    `  DIRECTORY DATA       ${kb(r.directoryDataBrotli)} brotli${prior ? `   (was ${kb(prior.directoryDataBrotli)}, ${pct(r.directoryDataBrotli, prior.directoryDataBrotli)} off)` : ''}`,
  );
  console.log('');
}

/* ------------------------------------------------------------- verdicts */

let failures = 0;
const verdict = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

console.log('BUDGET');
console.log(
  `  document ≤ ${kb(BUDGET.documentBrotli)} · listing data ≤ ${kb(BUDGET.dataBrotli)} · ` +
    `cards ${BUDGET.minInitialCards}-${BUDGET.maxInitialCards} · DOM ≤ ${BUDGET.domElements}`,
);
for (const r of results) {
  if (r.missing) continue;
  verdict(
    `/directory/${r.route} document`,
    r.html.brotli <= BUDGET.documentBrotli,
    kb(r.html.brotli),
  );
  verdict(
    `/directory/${r.route} listing data`,
    r.directoryDataBrotli <= BUDGET.dataBrotli,
    kb(r.directoryDataBrotli),
  );
  // A page holding fewer listings than one window renders all of them; that
  // is the floor for it, not 30. A grouped page's floor is one group preview,
  // because its bound is per group rather than per page.
  const floor =
    r.layout === 'grouped'
      ? Math.min(BUDGET.groupedPreview, r.rows)
      : Math.min(BUDGET.minInitialCards, r.rows);
  verdict(
    `/directory/${r.route} initial cards`,
    r.cards.count >= floor && r.cards.count <= BUDGET.maxInitialCards,
    `${r.cards.count} (want ${floor}-${BUDGET.maxInitialCards})`,
  );
  verdict(
    `/directory/${r.route} DOM elements`,
    r.domNodes <= BUDGET.domElements,
    String(r.domNodes),
  );
}

if (baseline) {
  /**
   * COMPLETENESS, checked before any byte target — because every byte target
   * is trivially satisfiable by shipping fewer listings, and that is the one
   * outcome this milestone must not produce. The row count a page serializes
   * may never fall below what it serialized before the change.
   *
   * This is the guard for page WIRING, which the offline harness cannot see:
   * it drives the modules, so a page that projected `entries.slice(0, 30)`
   * into its index would pass every scenario there and fail here.
   */
  console.log('\nCOMPLETENESS (no page may serialize fewer listings than it did)');
  for (const r of results) {
    if (r.missing) continue;
    const was = priorOf(r.route);
    if (!was) continue;
    verdict(`/directory/${r.route} rows serialized`, r.rows >= was.rows, `${was.rows} → ${r.rows}`);
  }

  console.log('\nREDUCTION TARGET (≥45% off the directory-data contribution)');
  for (const route of ['truck-stops', 'map']) {
    const now = results.find((r) => r.route === route);
    const was = priorOf(route);
    if (!now || now.missing || !was) continue;
    const cut = (was.directoryDataBrotli - now.directoryDataBrotli) / was.directoryDataBrotli;
    verdict(
      `/directory/${route}`,
      cut >= BUDGET.reductionTarget,
      `${kb(was.directoryDataBrotli)} → ${kb(now.directoryDataBrotli)} (${(cut * 100).toFixed(1)}% off)`,
    );
  }
}

/* --------------------------------------------------- filter timing (p95) */

/**
 * The shipped predicate, on the shipped index, for a normal query and for the
 * worst case a driver can type — a single character that matches nearly every
 * row. A local-array browser falls over here or nowhere.
 */
async function filterTiming() {
  const idxRoute = results.find((r) => !r.missing && r.route === 'truck-stops');
  if (!idxRoute) return null;
  const html = fs.readFileSync(path.join(dir, 'truck-stops.html'), 'utf8');
  const payloads = allListingPayloads(flightOf(html));
  let rows = [];
  for (const p of payloads) {
    try {
      const parsed = JSON.parse(p.raw);
      if (parsed.length > rows.length) rows = parsed;
    } catch {
      /* ignore */
    }
  }
  if (rows.length === 0) return null;
  const clean = rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) if (v !== '$undefined') o[k] = v;
    return o;
  });
  const { filterAndSortEntries } = await import('../../src/lib/directory/browse.ts').catch(
    () => ({}),
  );
  const run = filterAndSortEntries ?? null;
  if (!run)
    return { rows: clean.length, note: 'predicate not importable from .mjs — see the harness' };
  const timeOne = (query, sort) => {
    const samples = [];
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      run(clean, { query, state: '', city: '', sort, origin: null });
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    return { p50: samples[20], p95: samples[38] };
  };
  return {
    rows: clean.length,
    typical: timeOne('knoxville', 'featured'),
    worst: timeOne('e', 'alpha'),
  };
}

const timing = await filterTiming().catch(() => null);
if (timing?.typical) {
  console.log('\nFILTER TIMING (shipped predicate, complete pool)');
  console.log(`  rows ${timing.rows}`);
  console.log(
    `  typical query  p50 ${timing.typical.p50.toFixed(2)} ms · p95 ${timing.typical.p95.toFixed(2)} ms`,
  );
  console.log(
    `  worst case     p50 ${timing.worst.p50.toFixed(2)} ms · p95 ${timing.worst.p95.toFixed(2)} ms`,
  );
}

console.log(
  `\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} budget violation${failures === 1 ? '' : 's'}\n`,
);

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify({ label: LABEL, budget: BUDGET, results, timing }, null, 2));
  console.log(`wrote ${OUT}`);
}

process.exit(failures === 0 ? 0 : 1);
