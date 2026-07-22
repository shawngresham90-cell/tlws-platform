import { z } from 'zod';
import { parseCsv, toCsv, safeCsvCell } from './csv';

/**
 * Truck Parking Club URL domain (Milestone 21). Pure logic: strict URL
 * validation against the approved TPC domain, candidate detection, data
 * warnings, and the bulk-correction CSV pipeline (same contract as the
 * geocoding batch tool: stable id + city/state identity cross-check, per-row
 * problems, explicit applicability). Nothing here ever guesses or fabricates
 * a URL — proposed values come only from an uploaded file, and only validated
 * rows can be applied.
 */

/** The only hosts a TPC affiliate link may point at. Everything else is rejected. */
export const TPC_ALLOWED_HOSTS = ['truckparkingclub.com', 'www.truckparkingclub.com'] as const;

/* ------------------------------------------------------- partner constants */
/* Phase 1 revenue model (owner-confirmed, July 2026): first-time TPC users
 * who book with promo code SHAWN20 generate $20 for TLWS. Link-out only —
 * no API, no availability, no pricing until the partner supplies them.
 * Centralized here the way lib/store/amazon.ts centralizes the Amazon
 * program, so every surface renders the same code, name, and disclosure. */

export const TPC_PARTNER_NAME = 'Truck Parking Club';
export const TPC_PROMO_CODE = 'SHAWN20';
export const TPC_HOME_URL = 'https://truckparkingclub.com';
/** Material-connection disclosure — shown on every surface with a Reserve CTA. */
export const TPC_DISCLOSURE =
  'Trucking Life earns a commission when first-time Truck Parking Club users book with ' +
  'promo code SHAWN20. Partnerships never change organic rankings.';
/** Honesty line for partner cards: we hold no availability or pricing data. */
export const TPC_AVAILABILITY_NOTE = 'Availability and pricing are set by Truck Parking Club.';
export const TPC_REL = 'sponsored noopener noreferrer';

export type TpcUrlResult = { ok: true; normalized: string } | { ok: false; reason: string };

/**
 * Validate + normalize a Truck Parking Club URL.
 * Rules: https only (kills javascript:, data:, file:, http:), no credentials,
 * no explicit port, hostname must equal an approved host exactly (no
 * "truckparkingclub.com.evil.io", no unexpected subdomains, no IPs, no
 * localhost), harmless trailing slashes normalized away, query preserved
 * (affiliate params), fragments dropped.
 */
export function validateTpcUrl(raw: string): TpcUrlResult {
  const value = (raw ?? '').trim();
  if (!value) return { ok: false, reason: 'URL is empty' };
  if (value.length > 300) return { ok: false, reason: 'URL is too long (max 300 chars)' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'not a valid absolute URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: `must use https:// (got "${url.protocol}//")` };
  }
  if (url.username || url.password) return { ok: false, reason: 'credentials in URL' };
  if (url.port) return { ok: false, reason: 'explicit port is not allowed' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { ok: false, reason: 'localhost is not allowed' };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    return { ok: false, reason: 'IP-address hosts are not allowed' };
  }
  if (!(TPC_ALLOWED_HOSTS as readonly string[]).includes(host)) {
    return { ok: false, reason: `"${host}" is not an approved Truck Parking Club domain` };
  }
  const path = url.pathname.replace(/\/+$/, '');
  return { ok: true, normalized: `https://${host}${path}${url.search}` };
}

/** Two stored URLs that normalize identically are the same link. */
export function tpcUrlsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const va = a ? validateTpcUrl(a) : null;
  const vb = b ? validateTpcUrl(b) : null;
  if (!va?.ok || !vb?.ok) return (a ?? '') === (b ?? '');
  return va.normalized === vb.normalized;
}

/* ============================================================ candidates */

export type TpcListingRef = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string;
  state: string;
  tpcUrl: string | null;
  published: boolean;
  detailSlug: string | null;
};

const normalize = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Categories where a reservation link makes sense. */
export const TPC_RELEVANT_CATEGORIES = new Set(['parking', 'truck-stops', 'hotels-truck-parking']);

/**
 * A listing that LIKELY belongs on Truck Parking Club but has no URL yet:
 * explicitly TPC-branded, or in the parking category. Deliberately narrow —
 * this feeds a human worklist, never an automatic write.
 */
export function isTpcCandidate(row: Pick<TpcListingRef, 'name' | 'category' | 'tpcUrl'>): boolean {
  if (row.tpcUrl) return false;
  const name = normalize(row.name);
  if (name.includes('truck parking club')) return true;
  return row.category === 'parking';
}

export type TpcWarning = {
  id: string;
  name: string;
  kind: 'no-address' | 'duplicate-url' | 'not-parking-related' | 'invalid-url';
  detail: string;
};

/** Data-quality warnings over the stored TPC URLs. */
export function tpcWarnings(rows: TpcListingRef[]): TpcWarning[] {
  const warnings: TpcWarning[] = [];
  const byNormalizedUrl = new Map<string, TpcListingRef[]>();

  for (const row of rows) {
    if (!row.tpcUrl) continue;
    const check = validateTpcUrl(row.tpcUrl);
    if (!check.ok) {
      warnings.push({
        id: row.id,
        name: row.name,
        kind: 'invalid-url',
        detail: `Stored TPC URL is invalid: ${check.reason}`,
      });
      continue;
    }
    byNormalizedUrl.set(check.normalized, [...(byNormalizedUrl.get(check.normalized) ?? []), row]);

    if (row.published && !row.address) {
      warnings.push({
        id: row.id,
        name: row.name,
        kind: 'no-address',
        detail: 'Published with a TPC URL but no street address',
      });
    }
    if (
      row.category &&
      !TPC_RELEVANT_CATEGORIES.has(row.category) &&
      !normalize(row.name).includes('parking')
    ) {
      warnings.push({
        id: row.id,
        name: row.name,
        kind: 'not-parking-related',
        detail: `Category "${row.category}" does not look parking-related for a reservation link`,
      });
    }
  }

  for (const [url, group] of byNormalizedUrl) {
    if (group.length < 2) continue;
    for (const row of group) {
      warnings.push({
        id: row.id,
        name: row.name,
        kind: 'duplicate-url',
        detail: `Same TPC URL used by ${group.length} listings (${url})`,
      });
    }
  }
  return warnings;
}

/* ============================================================ bulk CSV */

export const TPC_CSV_COLUMNS = [
  'listing_id',
  'business_name',
  'category',
  'address',
  'city',
  'state',
  'current_tpc_url',
  'proposed_tpc_url',
  'action',
] as const;

export const TPC_ACTIONS = ['set', 'clear', 'skip'] as const;
export type TpcAction = (typeof TPC_ACTIONS)[number];

const tpcRowSchema = z.object({
  listing_id: z.string().uuid('listing_id must be a UUID'),
  business_name: z.string().trim().min(1, 'business_name is required'),
  category: z.string().trim(),
  address: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim().toUpperCase(),
  current_tpc_url: z.string().trim(),
  proposed_tpc_url: z.string().trim(),
  action: z.enum(TPC_ACTIONS),
});

export type TpcCsvRow = z.infer<typeof tpcRowSchema>;

export const TPC_MAX_ROWS = 2000;

/** Parse + schema-validate a TPC correction CSV. Structural errors are fatal. */
export function parseTpcCsv(text: string): { rows: TpcCsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ['The file is empty.'] };
  if (table.length - 1 > TPC_MAX_ROWS) {
    return { rows: [], errors: [`Too many rows (${table.length - 1}; max ${TPC_MAX_ROWS}).`] };
  }
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = TPC_CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(', ')}`] };
  }
  const idx = Object.fromEntries(TPC_CSV_COLUMNS.map((c) => [c, header.indexOf(c)]));
  const rows: TpcCsvRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (raw.every((cell) => cell.trim() === '')) continue;
    const record = Object.fromEntries(TPC_CSV_COLUMNS.map((c) => [c, raw[idx[c]] ?? '']));
    const parsed = tpcRowSchema.safeParse(record);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push(`Row ${i + 1}: ${first.path.join('.')}: ${first.message}`);
      continue;
    }
    rows.push(parsed.data);
  }
  return { rows, errors };
}

export type TpcRowProblem =
  | 'duplicate-listing-id'
  | 'unknown-listing-id'
  | 'identity-mismatch'
  | 'invalid-url'
  | 'skip-action'
  | 'no-change';

export type ValidatedTpcRow = TpcCsvRow & {
  applicable: boolean;
  problems: TpcRowProblem[];
  problemDetails: string[];
  /** Live row already has a DIFFERENT URL — needs explicit confirmation. */
  wouldOverwrite: boolean;
  /** The exact value an apply would write (normalized URL or null for clear). */
  nextValue: string | null;
  live: { name: string; tpcUrl: string | null } | null;
};

/**
 * Cross-check TPC rows against live listings. Identity is id + city/state
 * (address too when both sides have one) — the same contract as geocoding;
 * a matching name alone is never enough. Only `set` rows with a valid
 * approved-domain URL and `clear` rows are applicable.
 */
export function validateTpcBatch(
  rows: TpcCsvRow[],
  live: Map<string, TpcListingRef>,
): ValidatedTpcRow[] {
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.listing_id, (seen.get(r.listing_id) ?? 0) + 1);

  return rows.map((row) => {
    const problems: TpcRowProblem[] = [];
    const problemDetails: string[] = [];
    const liveRow = live.get(row.listing_id) ?? null;
    let nextValue: string | null = null;

    if ((seen.get(row.listing_id) ?? 0) > 1) {
      problems.push('duplicate-listing-id');
      problemDetails.push('listing_id appears more than once in the file');
    }
    if (!liveRow) {
      problems.push('unknown-listing-id');
      problemDetails.push('no live listing with this id');
    } else {
      const cityOk = normalize(liveRow.city) === normalize(row.city);
      const stateOk = normalize(liveRow.state) === normalize(row.state);
      const addressOk =
        !row.address || !liveRow.address || normalize(liveRow.address) === normalize(row.address);
      if (!cityOk || !stateOk || !addressOk) {
        problems.push('identity-mismatch');
        problemDetails.push(
          `file says "${row.address || '—'}, ${row.city}, ${row.state}" but the live listing is ` +
            `"${liveRow.address ?? '—'}, ${liveRow.city}, ${liveRow.state}"`,
        );
      }
    }

    if (row.action === 'skip') {
      problems.push('skip-action');
      problemDetails.push('row is marked skip');
    } else if (row.action === 'set') {
      const check = validateTpcUrl(row.proposed_tpc_url);
      if (!check.ok) {
        problems.push('invalid-url');
        problemDetails.push(`proposed_tpc_url: ${check.reason}`);
      } else {
        nextValue = check.normalized;
        if (liveRow && tpcUrlsEqual(liveRow.tpcUrl, check.normalized)) {
          problems.push('no-change');
          problemDetails.push('live listing already has this URL');
        }
      }
    } else if (row.action === 'clear') {
      nextValue = null;
      if (liveRow && !liveRow.tpcUrl) {
        problems.push('no-change');
        problemDetails.push('live listing has no URL to clear');
      }
    }

    const wouldOverwrite = Boolean(
      liveRow?.tpcUrl && row.action === 'set' && !tpcUrlsEqual(liveRow.tpcUrl, nextValue),
    );

    return {
      ...row,
      applicable: problems.length === 0,
      problems,
      problemDetails,
      wouldOverwrite,
      nextValue,
      live: liveRow ? { name: liveRow.name, tpcUrl: liveRow.tpcUrl } : null,
    };
  });
}

/** Candidate worklist as a correction-CSV starting point (formula-safe). */
export function tpcCandidatesCsv(rows: TpcListingRef[]): string {
  const candidates = rows.filter((r) => isTpcCandidate(r));
  return toCsv([
    [...TPC_CSV_COLUMNS],
    ...candidates.map((r) => [
      r.id,
      safeCsvCell(r.name),
      r.category ?? '',
      safeCsvCell(r.address ?? ''),
      safeCsvCell(r.city),
      r.state,
      r.tpcUrl ?? '',
      '',
      'skip',
    ]),
  ]);
}
