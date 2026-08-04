/**
 * Exit-page routing vs. facet normalization (the generic Exit 369 class).
 *
 * /directory/i75/exit-369 once 404'd with 11 published rows present. The
 * error-collapse half of that incident is pinned by test-directory-false-404;
 * THIS harness pins the other half: the facet builder normalized stored
 * `interstate` / `exit_number` values while the entry queries matched them
 * EXACTLY, so any cosmetically dirty row ("369 ", " i-75") could make facets
 * and the sitemap advertise an exit whose page query then found zero rows —
 * a false 404 minted from data that merely had whitespace or casing quirks.
 *
 * The defect class is proven here against the REAL data layer: these checks
 * run `getDirectoryFacetsResult` / `getEntriesByExitResult` /
 * `getEntriesByInterstateResult` against an in-process PostgREST-shaped
 * server seeded with production-shaped rows (the clean I-75 Exit 369 / 201 /
 * 207 shapes measured in production on 2026-08-04, plus dirty variants of
 * the same shape). The central invariant: EVERY exit facets advertise must
 * resolve AND return at least one entry — sitemap and page can never
 * disagree again.
 *
 * Run:
 *   npx esbuild scripts/test-exit-routing.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-exit-routing.cjs \
 *   && node /tmp/test-exit-routing.cjs
 */
import { createServer, type Server } from 'node:http';
import {
  getDirectoryFacetsResult,
  getEntriesByExitResult,
  getEntriesByInterstateResult,
} from '@/lib/directory/data';
import {
  canonicalDesignation,
  canonicalExitNumber,
  exitSlug,
  exitFromSlug,
  interstateSlug,
  interstateBySlug,
} from '@/lib/directory/interstates';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/* ------------------------------------------------- production-shaped rows */

type Row = Record<string, unknown>;
let nextId = 1;
function row(interstate: string | null, exit_number: string | null, over: Row = {}): Row {
  const id = String(nextId++).padStart(6, '0');
  return {
    id,
    name: `Fixture Stop ${id}`,
    category_slug: 'truck-stops',
    state: 'TN',
    city: 'Ooltewah',
    address: '5111 Hunter Rd',
    is_published: true,
    deleted_at: null,
    interstate,
    exit_number,
    lat: 35.06,
    lng: -85.06,
    detail_slug: `fixture-stop-${id}`,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const ROWS: Row[] = [
  // The real incident shape: 11 published, clean rows at I-75 Exit 369.
  ...Array.from({ length: 11 }, () => row('I-75', '369')),
  // Controls, mirroring production counts measured 2026-08-04: 201×8, 207×1.
  ...Array.from({ length: 8 }, () => row('I-75', '201', { state: 'GA' })),
  row('I-75', '207', { state: 'GA' }),
  // DEFECT CLASS A — padded exit: every row at this exit carries "414 ".
  // Pre-fix: facets advertised 414, the eq() lookup found nothing → 404.
  ...Array.from({ length: 3 }, () => row('I-75', '414 ')),
  // DEFECT CLASS B — dirty corridor spelling: " i-24" (padding + casing).
  // Pre-fix: facets/sitemap advertised /directory/i24/exit-11 under the
  // "i-24" bucket while the page resolved facets under "I-24" → 404.
  ...Array.from({ length: 2 }, () => row(' i-24', '11', { state: 'GA' })),
  // Duplicate normalized pair: "84" and "84 " are one physical exit.
  row('I-75', '84', { state: 'GA' }),
  row('I-75', '84 ', { state: 'GA' }),
  // Non-interstate designation: never an exit page, must not crash facets.
  row('US-41', '5'),
];

/* -------------------------------------- minimal PostgREST-shaped server */

function matches(r: Row, key: string, op: string): boolean {
  const v = r[key];
  if (op === 'is.null') return v === null || v === undefined;
  if (op.startsWith('eq.')) return String(v) === op.slice(3);
  if (op.startsWith('gt.')) return String(v) > op.slice(3);
  if (op.startsWith('ilike.')) {
    const pat = op.slice(6).replace(/\*/g, '%');
    const re = new RegExp(
      `^${pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`,
      'i',
    );
    return re.test(String(v ?? ''));
  }
  return true;
}

function startMock(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (!url.pathname.endsWith('/locations')) {
      res.writeHead(404).end('{}');
      return;
    }
    let rows = ROWS.slice();
    let limit = 1000;
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'select' || key === 'order') continue;
      if (key === 'limit') {
        limit = Number(value);
        continue;
      }
      rows = rows.filter((r) => matches(r, key, value));
    }
    rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const total = rows.length;
    const page = rows.slice(0, limit);
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-range': `0-${Math.max(page.length - 1, 0)}/${total}`,
    });
    res.end(JSON.stringify(page));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

/* ------------------------------------------------------------------ main */

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'harness-anon-key';

  // Failure ≠ 404: with the database unreachable, facets must report
  // failure — the exit page turns that into a 5xx, never a cached 404.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:59998';
  const down = await getDirectoryFacetsResult();
  check('db failure: facets report ok:false (never an empty truth)', down.ok === false);
  const downEntries = await getEntriesByExitResult('I-75', '369');
  check('db failure: exit entries report ok:false', downEntries.ok === false);

  const PORT = 59997;
  const server = await startMock(PORT);
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${PORT}`;

  const facetsResult = await getDirectoryFacetsResult();
  check('facets read ok against production-shaped rows', facetsResult.ok);
  if (!facetsResult.ok) throw new Error('facets failed; cannot continue');
  const facets = facetsResult.data;

  // The incident row shape: clean I-75/369 resolves with all 11 rows.
  check('I-75 facet bucket exists', !!facets.exitsByInterstate['I-75']);
  check('exit 369 advertised', facets.exitsByInterstate['I-75'].includes('369'));
  const e369 = await getEntriesByExitResult('I-75', '369');
  check('exit 369 returns all 11 rows', e369.ok && e369.data.length === 11, e369);
  const e201 = await getEntriesByExitResult('I-75', '201');
  check('control exit 201 returns 8 rows', e201.ok && e201.data.length === 8);
  const e207 = await getEntriesByExitResult('I-75', '207');
  check('control exit 207 returns 1 row', e207.ok && e207.data.length === 1);

  // DEFECT CLASS A (padded exit values): advertised AND resolvable.
  check(
    'padded exit "414 " advertised canonically',
    facets.exitsByInterstate['I-75'].includes('414'),
  );
  const e414 = await getEntriesByExitResult('I-75', '414');
  check(
    'REGRESSION: padded-exit rows reachable (was 0 rows → false 404)',
    e414.ok && e414.data.length === 3,
    e414,
  );

  // DEFECT CLASS B (dirty corridor spelling): one canonical bucket.
  check('dirty " i-24" rows bucket under canonical I-24', !!facets.exitsByInterstate['I-24']);
  check(
    'no separate dirty "i-24"/" i-24" facet bucket',
    !('i-24' in facets.exitsByInterstate) && !(' i-24' in facets.exitsByInterstate),
  );
  const e24 = await getEntriesByExitResult('I-24', '11');
  check(
    'REGRESSION: dirty-corridor rows reachable (was 0 rows → false 404)',
    e24.ok && e24.data.length === 2,
    e24,
  );
  const c24 = await getEntriesByInterstateResult('I-24');
  check('corridor page sees dirty-spelling rows too', c24.ok && c24.data.length === 2);

  // Duplicate normalized pair: deterministic — ONE facet value, ONE page,
  // BOTH rows on it.
  const dup = facets.exitsByInterstate['I-75'].filter((e) => canonicalExitNumber(e) === '84');
  check('duplicate pair "84"/"84 " collapses to one facet value', dup.length === 1, dup);
  const e84 = await getEntriesByExitResult('I-75', '84');
  check('duplicate pair: one page carries both rows', e84.ok && e84.data.length === 2);

  // Superset narrowing: canonical matching must not leak I-175/I-275-style
  // corridors into I-75 (the server-side ilike is a superset by design).
  const c75 = await getEntriesByInterstateResult('I-75');
  check(
    'corridor I-75 contains only canonical I-75 rows',
    c75.ok && c75.data.every((e) => canonicalDesignation(e.interstate ?? null) === 'I-75'),
  );

  // Non-interstate designations never mint exit pages and never crash.
  check('US-41 never becomes an exit-page corridor', interstateSlug('US-41') === null);

  // THE CENTRAL INVARIANT — sitemap and page lookup can never disagree:
  // every (corridor, exit) pair facets advertise must (a) round-trip through
  // the slug the sitemap prints, and (b) return at least one entry.
  let advertised = 0;
  for (const [hwy, exits] of Object.entries(facets.exitsByInterstate)) {
    const slug = interstateSlug(hwy);
    if (!slug) continue; // non-interstate buckets never reach the sitemap
    const corridor = interstateBySlug(slug);
    check(`registry resolves ${hwy}`, corridor?.designation === canonicalDesignation(hwy));
    for (const exit of exits) {
      advertised++;
      const resolved = exitFromSlug(exitSlug(exit), exits);
      if (resolved === undefined) {
        check(`advertised ${hwy} ${exit} resolves from its own slug`, false);
        continue;
      }
      const entries = await getEntriesByExitResult(hwy, resolved);
      check(
        `advertised ${hwy} exit ${exit} returns >=1 entry (no false 404)`,
        entries.ok && entries.data.length >= 1,
        entries.ok ? entries.data.length : entries,
      );
    }
  }
  check('invariant actually exercised advertised exits', advertised >= 6, advertised);

  // Nonexistent exits still 404: not advertised, resolves to nothing, and a
  // successful read returns zero rows (the page's legitimate-404 branch).
  check('nonexistent exit not advertised', !facets.exitsByInterstate['I-75'].includes('999'));
  check(
    'nonexistent exit slug resolves to nothing',
    exitFromSlug('exit-999', facets.exitsByInterstate['I-75']) === undefined,
  );
  const e999 = await getEntriesByExitResult('I-75', '999');
  check(
    'nonexistent exit: successful EMPTY read (404), not an error',
    e999.ok && e999.data.length === 0,
  );

  server.close();

  // Pure canonicalizers — the one spelling both ends now share.
  const hwyCases: [string, string | null][] = [
    ['I-75', 'I-75'],
    ['i-75', 'I-75'],
    [' i75 ', 'I-75'],
    ['I 75', 'I-75'],
    ['US-41', null],
    ['', null],
  ];
  for (const [raw, want] of hwyCases) {
    check(
      `canonicalDesignation(${JSON.stringify(raw)}) → ${want}`,
      canonicalDesignation(raw) === want,
    );
  }
  const exitCases: [string | null, string | null][] = [
    ['369', '369'],
    ['369 ', '369'],
    [' 369', '369'],
    ['7b', '7B'],
    ['84A', '84A'],
    ['  ', null],
    [null, null],
  ];
  for (const [raw, want] of exitCases) {
    check(
      `canonicalExitNumber(${JSON.stringify(raw)}) → ${want}`,
      canonicalExitNumber(raw) === want,
    );
  }
  check(
    'canonical exit keeps the same public URL',
    exitSlug('7B') === 'exit-7b' && exitSlug('7b') === 'exit-7b',
  );

  console.log(`exit-routing: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.log('FATAL:', err);
  process.exit(1);
});
