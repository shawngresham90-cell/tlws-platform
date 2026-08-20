/**
 * Minimal PostgREST fake for offline harnesses (extracted from
 * scripts/test-sitemap-contract.ts so metadata/pagination harnesses can share
 * it). Speaks just enough PostgREST semantics for the app's real Supabase
 * reads: eq / is.null / not.is.null / in.(…) / gt / ilike filters,
 * order=<col>.asc|desc, limit, and the exact count via Content-Range when
 * `Prefer: count=exact` is sent (which is how collectAllRows corroborates a
 * complete scan). GET + `.maybeSingle()` needs nothing extra: postgrest-js
 * keeps `Accept: application/json` on GET and reduces the array client-side.
 * Anything the data layer starts using that this fake doesn't speak fails
 * loudly rather than returning a silently wrong answer.
 *
 * Two capabilities exist so a harness can reproduce a TRUNCATED read rather
 * than only assert about one (DIR-COMPLETE-2):
 *
 *   - MULTI-COLUMN ORDER. postgrest-js sends chained `.order()` calls as one
 *     comma-joined parameter (`order=state.asc,city.asc,name.asc`). Honoring
 *     only the first key would silently reorder a fixture and make a
 *     truncation test measure the wrong rows.
 *   - `maxRows`: a SERVER-SIDE response cap (PostgREST's `db-max-rows`),
 *     applied AFTER the client's own `limit` and reflected in Content-Range
 *     exactly as PostgREST does — the row window shrinks, the exact total
 *     does not. This is the shape a client cannot detect from the row count
 *     alone, and the reason a short page proves nothing.
 */

export type FixtureTables = Record<string, Record<string, unknown>[]>;

function applyFilter(rows: Record<string, unknown>[], col: string, raw: string) {
  if (raw.startsWith('eq.')) {
    const v = raw.slice(3);
    return rows.filter((r) => String(r[col]) === v);
  }
  if (raw === 'is.null') return rows.filter((r) => r[col] == null);
  if (raw === 'not.is.null') return rows.filter((r) => r[col] != null);
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const values = raw
      .slice(4, -1)
      .split(',')
      .map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
    return rows.filter((r) => values.includes(String(r[col])));
  }
  if (raw.startsWith('gt.')) {
    const v = raw.slice(3);
    return rows.filter((r) => String(r[col]) > v);
  }
  if (raw.startsWith('ilike.')) {
    const pattern = raw.slice(6).replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${pattern.replace(/[%*]/g, '.*')}$`, 'i');
    return rows.filter((r) => r[col] != null && re.test(String(r[col])));
  }
  throw new Error(`PostgREST fake: unsupported filter ${col}=${raw}`);
}

/**
 * Order by every key in a comma-joined PostgREST `order` value, in sequence:
 * `state.asc,city.asc,name.asc` sorts by state, ties broken by city, then by
 * name. Nulls sort last on asc, matching PostgREST's default.
 */
function applyOrder(rows: Record<string, unknown>[], order: string): void {
  const keys = order.split(',').map((part) => {
    const [col, ...flags] = part.split('.');
    return { col, desc: flags.includes('desc') };
  });
  rows.sort((a, b) => {
    for (const { col, desc } of keys) {
      const av = a[col];
      const bv = b[col];
      if (av == null && bv == null) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv));
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

/** Requests the fake has served since the last installPostgrestFake() call. */
let requestCount = 0;
export function postgrestRequestCount(): number {
  return requestCount;
}

/**
 * The full URL and apikey of every request served, in order. A harness that
 * wants to prove WHICH columns left the database, WHICH filters were applied
 * on every page, and WHICH key authenticated the read has to look at the
 * request the client actually sent — asserting on the source text only proves
 * what someone typed.
 */
export type PostgrestRequest = { url: string; apikey: string | null; prefer: string };
let requestLog: PostgrestRequest[] = [];
export function postgrestRequests(): PostgrestRequest[] {
  return requestLog;
}

function fakeRest(
  tables: FixtureTables,
  url: URL,
  prefer: string,
  maxRows: number | null,
): Response {
  const table = url.pathname.split('/').pop() ?? '';
  const fixture = tables[table];
  if (!fixture) throw new Error(`PostgREST fake: unknown table ${table}`);

  let rows = [...fixture];
  let order: string | null = null;
  let limit: number | null = null;
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'select' || key === 'apikey') continue;
    if (key === 'order') order = value;
    else if (key === 'limit') limit = parseInt(value, 10);
    else if (key === 'offset') throw new Error('PostgREST fake: offset unsupported');
    else rows = applyFilter(rows, key, value);
  }
  const total = rows.length;
  if (order) applyOrder(rows, order);
  if (limit != null) rows = rows.slice(0, limit);
  // The server cap lands LAST, on top of whatever the client asked for —
  // PostgREST truncates the response window, and says nothing about it
  // beyond the range it reports.
  if (maxRows != null && rows.length > maxRows) rows = rows.slice(0, maxRows);

  const headers = new Headers({ 'content-type': 'application/json' });
  if (/count=exact/.test(prefer)) {
    headers.set(
      'content-range',
      rows.length === 0 ? `*/${total}` : `0-${rows.length - 1}/${total}`,
    );
  }
  return new Response(JSON.stringify(rows), { status: 200, headers });
}

/**
 * Point global fetch at the fixture tables. Call before the code under test.
 * `maxRows` imposes a server-side response cap, the way a PostgREST instance
 * configured with `db-max-rows` does.
 */
export function installPostgrestFake(tables: FixtureTables, opts: { maxRows?: number } = {}): void {
  requestCount = 0;
  requestLog = [];
  const maxRows = opts.maxRows ?? null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href);
    if (!url.pathname.startsWith('/rest/v1/')) {
      throw new Error(`PostgREST fake: unexpected request ${url.pathname}`);
    }
    const headers = new Headers(
      init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : {}),
    );
    const prefer = headers.get('prefer') ?? '';
    requestCount++;
    requestLog.push({
      url: decodeURIComponent(url.href),
      apikey: headers.get('apikey') ?? url.searchParams.get('apikey'),
      prefer,
    });
    return fakeRest(tables, url, prefer, maxRows);
  }) as typeof fetch;
}
