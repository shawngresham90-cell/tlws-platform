import { createSign } from 'node:crypto';
import { DATA_LAG_DAYS, GSC_ROW_LIMIT, WINDOW_DAYS } from './config';
import { ScoutError, type DateWindow, type GscRow, type ScoutWindows } from './types';

/**
 * Read-only Search Console client. Zero dependencies: the service-account
 * JWT is signed with node:crypto and both HTTP calls use global fetch.
 *
 * CREDENTIAL RULES (non-negotiable):
 *  - the service-account JSON arrives ONLY via the GSC_SERVICE_ACCOUNT_JSON
 *    environment variable (a CI secret / local env var);
 *  - it is parsed in this module and never returned, logged, thrown, or
 *    embedded in any report — errors carry the field NAME at most;
 *  - nothing under src/ imports this module, so it can never reach the
 *    browser bundle. scripts/test-seo-scout.ts enforces both properties.
 *
 * If credentials are absent the Scout fails CLEARLY (exit path in the CLI)
 * — it never fabricates Search Console data.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

type ServiceAccount = { client_email: string; private_key: string };

export function loadServiceAccount(env: NodeJS.ProcessEnv = process.env): ServiceAccount {
  const raw = env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === '') {
    throw new ScoutError(
      'MISSING_CREDENTIALS',
      'GSC_SERVICE_ACCOUNT_JSON is not set. Create a Google Cloud service account, ' +
        'enable the Search Console API, add the account as a user on the property, ' +
        'and provide its JSON key via this environment variable / CI secret. ' +
        'See docs/operations/seo-engine-1-scout.md.',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ScoutError('BAD_CREDENTIALS', 'GSC_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  const sa = parsed as Partial<ServiceAccount>;
  if (typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') {
    throw new ScoutError(
      'BAD_CREDENTIALS',
      'GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key.',
    );
  }
  return { client_email: sa.client_email, private_key: sa.private_key };
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Sign a one-hour readonly-scope JWT for the OAuth token exchange. */
export function buildJwt(sa: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key).toString('base64url');
  return `${header}.${claims}.${signature}`;
}

async function fetchAccessToken(sa: ServiceAccount): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(sa),
    }),
  });
  if (!res.ok) {
    // Deliberately no response body in the error: token-endpoint errors can
    // echo request material. Status + hint only.
    throw new ScoutError(
      'GSC_HTTP_ERROR',
      `OAuth token exchange failed (HTTP ${res.status}). Check that the service ` +
        'account key is current and the Search Console API is enabled.',
    );
  }
  const body = (await res.json()) as { access_token?: string };
  if (typeof body.access_token !== 'string') {
    throw new ScoutError('MALFORMED_RESPONSE', 'OAuth token response had no access_token.');
  }
  return body.access_token;
}

/** Compute the two complete comparison windows for a run date (UTC). */
export function computeWindows(today = new Date()): ScoutWindows {
  const day = 24 * 60 * 60 * 1000;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(today.getTime() - DATA_LAG_DAYS * day);
  const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * day);
  const priorEnd = new Date(start.getTime() - 1 * day);
  const priorStart = new Date(priorEnd.getTime() - (WINDOW_DAYS - 1) * day);
  return {
    current: { startDate: iso(start), endDate: iso(end) },
    prior: { startDate: iso(priorStart), endDate: iso(priorEnd) },
  };
}

/**
 * Validate one Search Analytics API response into GscRows. Only the fields
 * the Scout needs are read — no user identity, no device/country dimensions.
 * Anything shape-unexpected is a MALFORMED_RESPONSE, never silently coerced.
 */
export function parseSearchAnalyticsResponse(payload: unknown): GscRow[] {
  if (payload === null || typeof payload !== 'object') {
    throw new ScoutError('MALFORMED_RESPONSE', 'Search Analytics response was not an object.');
  }
  const rows = (payload as { rows?: unknown }).rows;
  if (rows === undefined) return []; // a valid, honest zero-data period
  if (!Array.isArray(rows)) {
    throw new ScoutError('MALFORMED_RESPONSE', 'Search Analytics rows was not an array.');
  }
  return rows.map((r, i) => {
    const row = r as {
      keys?: unknown;
      clicks?: unknown;
      impressions?: unknown;
      ctr?: unknown;
      position?: unknown;
    };
    const keys = row.keys;
    if (
      !Array.isArray(keys) ||
      keys.length !== 2 ||
      typeof keys[0] !== 'string' ||
      typeof keys[1] !== 'string' ||
      typeof row.clicks !== 'number' ||
      typeof row.impressions !== 'number' ||
      typeof row.ctr !== 'number' ||
      typeof row.position !== 'number' ||
      !Number.isFinite(row.clicks) ||
      !Number.isFinite(row.impressions) ||
      !Number.isFinite(row.ctr) ||
      !Number.isFinite(row.position)
    ) {
      throw new ScoutError('MALFORMED_RESPONSE', `Search Analytics row ${i} is malformed.`);
    }
    return {
      query: keys[0],
      page: keys[1],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
  });
}

/** Fetch one window of (query, page) rows. Read-only POST per the API. */
export async function fetchWindow(
  property: string,
  window: DateWindow,
  token: string,
): Promise<GscRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    property,
  )}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ['query', 'page'],
      rowLimit: GSC_ROW_LIMIT,
      dataState: 'final',
    }),
  });
  if (!res.ok) {
    throw new ScoutError(
      'GSC_HTTP_ERROR',
      `Search Analytics query failed (HTTP ${res.status}) for ${window.startDate}..${window.endDate}. ` +
        'A 403 usually means the service account is not a user on the property.',
    );
  }
  return parseSearchAnalyticsResponse(await res.json());
}

/** Fetch both comparison windows. */
export async function fetchBothWindows(
  property: string,
  windows: ScoutWindows,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ current: GscRow[]; prior: GscRow[] }> {
  const sa = loadServiceAccount(env);
  const token = await fetchAccessToken(sa);
  const current = await fetchWindow(property, windows.current, token);
  const prior = await fetchWindow(property, windows.prior, token);
  return { current, prior };
}
