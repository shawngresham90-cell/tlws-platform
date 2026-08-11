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

function fakeRest(tables: FixtureTables, url: URL, prefer: string): Response {
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
  if (order) {
    const [col] = order.split('.');
    rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])));
    if (order.split('.').includes('desc')) rows.reverse();
  }
  if (limit != null) rows = rows.slice(0, limit);

  const headers = new Headers({ 'content-type': 'application/json' });
  if (/count=exact/.test(prefer)) {
    headers.set(
      'content-range',
      rows.length === 0 ? `*/${total}` : `0-${rows.length - 1}/${total}`,
    );
  }
  return new Response(JSON.stringify(rows), { status: 200, headers });
}

/** Point global fetch at the fixture tables. Call before the code under test. */
export function installPostgrestFake(tables: FixtureTables): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href);
    if (!url.pathname.startsWith('/rest/v1/')) {
      throw new Error(`PostgREST fake: unexpected request ${url.pathname}`);
    }
    const prefer = new Headers(
      init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : {}),
    ).get('prefer');
    return fakeRest(tables, url, prefer ?? '');
  }) as typeof fetch;
}
