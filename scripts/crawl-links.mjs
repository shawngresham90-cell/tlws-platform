/**
 * Internal broken-link crawler. BFS over same-origin links starting at "/",
 * following server-rendered HTML only. Any internal link that resolves to a
 * 4xx/5xx fails the run, with every referencing page listed.
 *
 * Usage: node scripts/crawl-links.mjs [baseUrl]   (default http://localhost:3111)
 *
 * Redirects (3xx) are followed and their destinations validated; external
 * links are recorded but not fetched (offline sandbox), so they are listed
 * for information only.
 *
 * WARN_ONLY_PREFIXES (comma-separated path prefixes): downgrade 404s under
 * these prefixes to warnings. For local runs without database access, where
 * DB-backed pages (e.g. /knowledge/<category>) cannot resolve — run the
 * crawler against a deployed preview without this variable for the
 * authoritative verdict.
 */
const BASE = process.argv[2] ?? 'http://localhost:3111';
const MAX_PAGES = 400;
const WARN_PREFIXES = (process.env.WARN_ONLY_PREFIXES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Queue of paths to visit; seed with the home page. */
const queue = ['/'];
const visited = new Set();
/** path -> Set of referrer paths */
const referrers = new Map();
const broken = [];
const warned = [];
const external = new Set();
let crawled = 0;

function normalize(href, fromPath) {
  if (!href || href.startsWith('#')) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) {
    if (href.startsWith(BASE)) return href.slice(BASE.length) || '/';
    external.add(href);
    return null;
  }
  if (!href.startsWith('/')) {
    // Relative link — resolve against the current path.
    const dir = fromPath.endsWith('/') ? fromPath : fromPath.replace(/\/[^/]*$/, '/');
    href = dir + href;
  }
  // Drop query + hash; Next.js routes don't depend on them for existence.
  return href.split('#')[0].split('?')[0] || '/';
}

function extractLinks(html) {
  const out = [];
  const re = /href="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}

async function visit(path) {
  crawled++;
  let res;
  // One retry: a transient connection error (reset, abort) is not a broken
  // link — only a repeatable failure or an HTTP error status counts.
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(BASE + path, { redirect: 'follow' });
      break;
    } catch (err) {
      if (attempt >= 3) {
        broken.push({ path, status: `fetch error: ${err.message}` });
        return;
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (res.status >= 400) {
    if (res.status === 404 && WARN_PREFIXES.some((p) => path.startsWith(p))) {
      warned.push({ path, status: res.status });
    } else {
      broken.push({ path, status: res.status });
    }
    return;
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return;
  const html = await res.text();
  for (const raw of extractLinks(html)) {
    const link = normalize(raw, path);
    if (!link) continue;
    if (!referrers.has(link)) referrers.set(link, new Set());
    referrers.get(link).add(path);
    if (!visited.has(link) && visited.size + queue.length < MAX_PAGES) {
      visited.add(link);
      queue.push(link);
    }
  }
}

visited.add('/');
while (queue.length > 0) {
  // Small batches keep the dev server responsive without serializing fully.
  const batch = queue.splice(0, 5);
  await Promise.all(batch.map(visit));
}

console.log(`Crawled ${crawled} internal URLs from ${BASE}`);
if (visited.size >= MAX_PAGES) {
  console.log(`NOTE: hit the ${MAX_PAGES}-page cap — coverage is a sample, not exhaustive.`);
}
console.log(`External links seen (not fetched): ${external.size}`);
for (const url of [...external].sort()) console.log(`  external: ${url}`);

if (warned.length > 0) {
  console.log(`\nWARN-ONLY 404s (verify against a deployed preview): ${warned.length}`);
  for (const w of warned) {
    const refs = [...(referrers.get(w.path) ?? [])].slice(0, 5).join(', ');
    console.log(`  ${w.status}  ${w.path}   ← linked from: ${refs || '(seed)'}`);
  }
}

if (broken.length > 0) {
  // BROKEN LIST FIRST, then the failing exit code via exitCode (NOT
  // process.exit, which can kill the process before piped stdout flushes —
  // that once swallowed this whole section in CI logs).
  console.log(`\nBROKEN INTERNAL LINKS: ${broken.length}`);
  for (const b of broken) {
    const refs = [...(referrers.get(b.path) ?? [])].slice(0, 5).join(', ');
    console.log(`  ${b.status}  ${b.path}   ← linked from: ${refs || '(seed)'}`);
  }
  process.exitCode = 1;
} else {
  console.log('\nNo broken internal links.');
}
