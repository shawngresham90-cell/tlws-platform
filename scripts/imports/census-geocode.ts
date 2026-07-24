/**
 * Census BATCH geocoder harness (calibration + future backfill input).
 *
 * Builds the official US Census batch-geocoder input, resolves the current
 * benchmark from the official endpoint, submits the multipart batch request,
 * and stores the RAW response unchanged. It never writes to Supabase, never
 * applies coordinates, and never auto-approves anything — parsing/validation
 * live in `scripts/validation/validate-geocodes.ts`, and the only path to a
 * live coordinate remains the admin console (action=ready + human sign-off).
 *
 * Reuses `@/lib/directory/census-geocoder` for address normalization and the
 * `CensusQuery` contract — this module adds only the BATCH (addressbatch)
 * transport + deterministic input framing, which the existing single-address
 * adapter does not cover.
 *
 * Official service (the ONLY one permitted here):
 *   https://geocoding.geo.census.gov/geocoder/locations/addressbatch
 *   benchmark: Public_AR_Current (resolved by name → id at run time)
 *
 * Run (build the input CSV from a directory snapshot, offline):
 *   npx esbuild scripts/imports/census-geocode.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/census-geocode.cjs && node /tmp/census-geocode.cjs build \
 *     data/geocoding/dry-run/directory-snapshot.json data/geocoding/census/calibration
 */
import { createHash } from 'crypto';
import { normalizeCensusAddress, type CensusQuery } from '@/lib/directory/census-geocoder';

/** The five official Census batch input columns, in order. */
export const CENSUS_INPUT_HEADER = ['Unique ID', 'Street address', 'City', 'State', 'ZIP'] as const;

/** A directory row eligible for Census submission (subset of a listing). */
export type EligibleRecord = {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

/** Deterministic SHA-256 of a text blob (input/raw-output checksums). */
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** CSV-quote a single field (RFC-4180): always quoted, embedded quotes doubled. */
function q(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/**
 * Eligibility gate for a Census submission. Requires a production UUID, a
 * non-blank street address, a city, and a two-letter state. ZIP is optional
 * and PRESERVED BLANK when absent (never invented). Rows that could only
 * produce junk (PO box, highway-only) are excluded up front — they are logged
 * by the caller, not silently dropped.
 */
export function isEligible(r: EligibleRecord): boolean {
  if (!r.id || !/^[0-9a-f-]{36}$/i.test(r.id)) return false;
  if (!r.city || r.city.trim() === '') return false;
  if (!r.state || !/^[A-Za-z]{2}$/.test(r.state.trim())) return false;
  const norm = normalizeCensusAddress({
    id: r.id,
    address: r.address ?? '',
    city: r.city,
    state: r.state,
    zip: r.zip ?? '',
  });
  return Boolean(norm.line);
}

/**
 * Build the official batch input CSV. Headerless by default (the addressbatch
 * endpoint expects no header row); pass `withHeader` for a human-readable copy.
 * ZIP is written as an empty quoted field when missing. Order is preserved,
 * so a rerun over the same records is byte-identical.
 */
export function buildBatchInputCsv(records: EligibleRecord[], withHeader = false): string {
  const lines: string[] = [];
  if (withHeader) lines.push(CENSUS_INPUT_HEADER.map(q).join(','));
  for (const r of records) {
    const street = (r.address ?? '').replace(/\s+/g, ' ').trim();
    lines.push(
      [
        q(r.id),
        q(street),
        q((r.city ?? '').trim()),
        q((r.state ?? '').trim().toUpperCase()),
        q((r.zip ?? '').trim()),
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

/** As-submitted `CensusQuery` for each record — the validator cross-checks against these. */
export function toQueries(records: EligibleRecord[]): CensusQuery[] {
  return records.map((r) => ({
    id: r.id,
    address: (r.address ?? '').trim(),
    city: (r.city ?? '').trim(),
    state: (r.state ?? '').trim().toUpperCase(),
    zip: (r.zip ?? '').trim(),
  }));
}

// --- Network transport (injected fetch; provably makes zero calls in tests) ---

export type FetchLike = (
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
) => Promise<{ status: number; text(): Promise<string>; json(): Promise<unknown> }>;

const BENCHMARKS_URL = 'https://geocoding.geo.census.gov/geocoder/benchmarks';
const ADDRESSBATCH_URL = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';

export type ResolvedBenchmark = { id: string; name: string };

/**
 * Resolve the CURRENT public benchmark from the official endpoint rather than
 * hardcoding a numeric id. Prefers the `Public_AR_Current` entry; returns its
 * benchmarkName + benchmarkId. Throws if the endpoint is unreachable — the
 * caller decides whether that means NETWORK BLOCKED.
 */
export async function resolveBenchmark(fetchFn: FetchLike): Promise<ResolvedBenchmark> {
  const res = await fetchFn(`${BENCHMARKS_URL}?format=json`);
  if (res.status !== 200) throw new Error(`benchmarks endpoint status ${res.status}`);
  const body = (await res.json()) as { benchmarks?: { id: string; benchmarkName: string }[] };
  const list = body.benchmarks ?? [];
  const current =
    list.find((b) => b.benchmarkName === 'Public_AR_Current') ??
    list.find((b) => /Public_AR_Current/i.test(b.benchmarkName));
  if (!current) throw new Error('Public_AR_Current benchmark not found in endpoint response');
  return { id: String(current.id), name: current.benchmarkName };
}

/**
 * Submit one batch and return the RAW response text unchanged. Multipart form:
 * `benchmark` + `addressFile` (the input CSV). Retry-safe on 429/5xx with
 * exponential backoff through the injected sleep. Never throws on a service
 * error after exhausting retries — returns the last raw body (or '' + throws
 * only on a total transport failure the caller treats as NETWORK BLOCKED).
 */
export async function submitBatch(
  inputCsv: string,
  opts: {
    fetchFn: FetchLike;
    benchmark: string;
    maxRetries?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<string> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = opts.maxRetries ?? 3;
  const form = new FormData();
  form.set('benchmark', opts.benchmark);
  form.set('addressFile', new Blob([inputCsv], { type: 'text/csv' }), 'addresses.csv');
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await opts.fetchFn(ADDRESSBATCH_URL, { method: 'POST', body: form });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
    }
  }
  throw new Error(`census addressbatch unreachable: ${(lastErr as Error)?.message ?? 'unknown'}`);
}

/** Run manifest — provenance for one batch submission (no coordinates here). */
export type RunManifest = {
  benchmark: string;
  benchmarkId: string | null;
  runTimestamp: string; // caller-supplied (deterministic in tests)
  recordCount: number;
  inputChecksum: string;
  rawOutputChecksum: string | null;
  networkStatus: 'submitted' | 'network-blocked' | 'not-attempted';
};

export function buildManifest(input: {
  benchmark: string;
  benchmarkId?: string | null;
  runTimestamp: string;
  records: EligibleRecord[];
  inputCsv: string;
  rawOutput?: string | null;
  networkStatus: RunManifest['networkStatus'];
}): RunManifest {
  return {
    benchmark: input.benchmark,
    benchmarkId: input.benchmarkId ?? null,
    runTimestamp: input.runTimestamp,
    recordCount: input.records.length,
    inputChecksum: sha256(input.inputCsv),
    rawOutputChecksum: input.rawOutput != null ? sha256(input.rawOutput) : null,
    networkStatus: input.networkStatus,
  };
}
