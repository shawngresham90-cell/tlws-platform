import { STATE_BOUNDS } from '@/lib/map/bounds';
import { milesOutsideBounds } from './coordinate-verification';
import { coordinateIssues } from '@/lib/map/geo';
import type { ExternalGeocoderAdapter } from './geocode-pipeline';

/**
 * US Census Bureau geocoder adapter (Phase 2B, Step 3) behind the
 * ExternalGeocoderAdapter seam. FREE federal service only
 * (geocoding.geo.census.gov) — no key, no billing, no paid fallback.
 *
 * Design rules:
 * - All network I/O goes through an INJECTED fetch, so the entire module is
 *   testable offline and provably makes zero calls unless a caller wires a
 *   real fetch in.
 * - Deterministic confidence: Census "Exact" match in the expected state and
 *   inside its bounds → 'high'; "Non_Exact" that still lands in-state →
 *   'medium'; everything else is rejected or flagged. Ties, wrong-state
 *   results, impossible coordinates, PO boxes, and highway-only addresses
 *   never produce a usable coordinate.
 * - NOTHING here is auto-approvable: results flow into the batch-CSV manual
 *   review queue with action='manual-review'; the admin console's
 *   action=ready + confidence=high gate stays the only door to the database,
 *   and this module never writes anywhere.
 */

export type CensusQuery = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

export type CensusRejection =
  | 'po-box'
  | 'highway-only-address'
  | 'blank-address'
  | 'no-match'
  | 'tie'
  | 'wrong-state'
  | 'impossible-coordinates';

export type CensusResult = {
  id: string;
  status: 'exact' | 'approximate' | 'rejected';
  rejection?: CensusRejection;
  lat: number | null;
  lng: number | null;
  confidence: 'high' | 'medium' | null;
  /** Exactly what was sent to the service. */
  submittedAddress: string;
  /** Exactly what the service matched, verbatim. */
  matchedAddress: string;
  /** Census matchType field verbatim ('Exact' | 'Non_Exact' | ''). */
  matchType: string;
  /** Returned geography — state/county/tract identifiers when present. */
  geography: { state?: string; county?: string; tract?: string };
};

/** PO boxes never geocode to the business's physical location. */
const PO_BOX = /\bP\.?\s*O\.?\s*BOX\b/i;
/**
 * "I-40 & SR 5"-style addresses have no house number/street for the Census
 * TIGER matcher; sending them yields junk or false ties.
 */
const HIGHWAY_ONLY =
  /^\s*(?:(?:i|us|sr|st|hwy|highway|interstate|route|rt)[-\s.]*\d+\w*)(?:\s*(?:&|and|at|\/|@)\s*(?:(?:i|us|sr|st|hwy|highway|interstate|route|rt)[-\s.]*\d+\w*|exit\s*\d+\w*))*\s*$/i;

/**
 * Normalize an address for submission: collapse whitespace, strip
 * suite/unit/lot suffixes the TIGER matcher does not use, and refuse
 * addresses that cannot produce a trustworthy rooftop match.
 */
export function normalizeCensusAddress(q: CensusQuery): {
  line?: string;
  rejection?: CensusRejection;
} {
  const raw = q.address.replace(/\s+/g, ' ').trim();
  if (raw === '') return { rejection: 'blank-address' };
  if (PO_BOX.test(raw)) return { rejection: 'po-box' };
  if (HIGHWAY_ONLY.test(raw)) return { rejection: 'highway-only-address' };
  const line = raw.replace(/[,\s]+(?:suite|ste|unit|lot|#)\s*[\w-]*\s*$/i, '').trim();
  return { line };
}

/** Shape of one Census /locations response (the fields we consume). */
export type CensusApiResponse = {
  result?: {
    addressMatches?: {
      coordinates?: { x?: number; y?: number };
      matchedAddress?: string;
      tigerLine?: { side?: string };
      addressComponents?: { state?: string };
      geographies?: Record<
        string,
        { GEOID?: string; STATE?: string; COUNTY?: string; TRACT?: string }[]
      >;
      matchType?: string;
    }[];
  };
};

/**
 * Deterministic classification of a Census response for one query. Pure —
 * this is where every rejection/confidence rule lives, and the only place.
 */
export function classifyCensusResponse(
  q: CensusQuery,
  submittedAddress: string,
  api: CensusApiResponse,
): CensusResult {
  const base = {
    id: q.id,
    submittedAddress,
    matchedAddress: '',
    matchType: '',
    geography: {} as CensusResult['geography'],
  };
  const matches = api.result?.addressMatches ?? [];
  if (matches.length === 0) {
    return {
      ...base,
      status: 'rejected',
      rejection: 'no-match',
      lat: null,
      lng: null,
      confidence: null,
    };
  }
  if (matches.length > 1) {
    // Multiple candidate roofs = tie. Never pick one silently.
    return {
      ...base,
      status: 'rejected',
      rejection: 'tie',
      lat: null,
      lng: null,
      confidence: null,
    };
  }
  const m = matches[0];
  const lat = m.coordinates?.y ?? null;
  const lng = m.coordinates?.x ?? null;
  const matchedAddress = m.matchedAddress ?? '';
  const matchType = m.matchType ?? '';
  const matchedState = (m.addressComponents?.state ?? '').trim().toUpperCase();
  const expectedState = q.state.trim().toUpperCase();
  const enriched = { ...base, matchedAddress, matchType };

  if (lat == null || lng == null || coordinateIssues(lat, lng).length > 0) {
    return {
      ...enriched,
      status: 'rejected',
      rejection: 'impossible-coordinates',
      lat: null,
      lng: null,
      confidence: null,
    };
  }
  if (matchedState && expectedState && matchedState !== expectedState) {
    return {
      ...enriched,
      status: 'rejected',
      rejection: 'wrong-state',
      lat: null,
      lng: null,
      confidence: null,
    };
  }
  const bounds = STATE_BOUNDS[expectedState];
  // 5-mi tolerance matches the interpolation gate — framing rectangles clip
  // legitimate river-border towns (Memphis, Chattanooga).
  if (bounds && milesOutsideBounds(bounds, { lat, lng }) > 5) {
    return {
      ...enriched,
      status: 'rejected',
      rejection: 'wrong-state',
      lat: null,
      lng: null,
      confidence: null,
    };
  }
  if (matchType === 'Exact') {
    return { ...enriched, status: 'exact', lat, lng, confidence: 'high' };
  }
  return { ...enriched, status: 'approximate', lat, lng, confidence: 'medium' };
}

export type CensusFetch = (url: string) => Promise<{ status: number; json(): Promise<unknown> }>;

export type CensusGeocoderOptions = {
  fetchFn: CensusFetch;
  /** Milliseconds between requests (free service — stay polite). */
  minIntervalMs?: number;
  /** Retries per request on 429/5xx/network failure. */
  maxRetries?: number;
  /** Injected sleep so tests never wait. */
  sleep?: (ms: number) => Promise<void>;
};

const BASE_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

/**
 * Geocode one query against the live service through the injected fetch,
 * with retry/backoff on 429 and 5xx. Returns a classified result — never
 * throws on service errors; a request that keeps failing becomes 'no-match'
 * rejection with matchType 'service-error'.
 */
export async function censusGeocodeOne(
  q: CensusQuery,
  opts: CensusGeocoderOptions,
): Promise<CensusResult> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = opts.maxRetries ?? 3;
  const norm = normalizeCensusAddress(q);
  if (!norm.line) {
    return {
      id: q.id,
      status: 'rejected',
      rejection: norm.rejection,
      lat: null,
      lng: null,
      confidence: null,
      submittedAddress: '',
      matchedAddress: '',
      matchType: '',
      geography: {},
    };
  }
  const submitted = `${norm.line}, ${q.city}, ${q.state} ${q.zip}`.replace(/\s+/g, ' ').trim();
  const url =
    `${BASE_URL}?address=${encodeURIComponent(submitted)}` +
    `&benchmark=Public_AR_Current&format=json`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await opts.fetchFn(url);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        break;
      }
      if (res.status !== 200) break;
      const body = (await res.json()) as CensusApiResponse;
      return classifyCensusResponse(q, submitted, body);
    } catch {
      if (attempt < maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      break;
    }
  }
  return {
    id: q.id,
    status: 'rejected',
    rejection: 'no-match',
    lat: null,
    lng: null,
    confidence: null,
    submittedAddress: submitted,
    matchedAddress: '',
    matchType: 'service-error',
    geography: {},
  };
}

/**
 * Batch driver: sequential with a polite minimum interval (the free service
 * has no SLA to burn). Results preserve input order.
 */
export async function censusGeocodeBatch(
  queries: CensusQuery[],
  opts: CensusGeocoderOptions,
): Promise<CensusResult[]> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const interval = opts.minIntervalMs ?? 500;
  const out: CensusResult[] = [];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0 && interval > 0) await sleep(interval);
    out.push(await censusGeocodeOne(queries[i], opts));
  }
  return out;
}

/**
 * ExternalGeocoderAdapter implementation. Confidence mirrors the
 * deterministic classification; callers still route every result through the
 * manual-review queue — the adapter interface carries no apply capability.
 */
export function createCensusGeocoder(opts: CensusGeocoderOptions): ExternalGeocoderAdapter {
  return {
    name: 'us-census',
    geocode: async (query) => {
      const result = await censusGeocodeOne({ id: 'adhoc', ...query }, opts);
      if (result.status === 'rejected' || result.lat == null || result.lng == null) return null;
      return {
        lat: result.lat,
        lng: result.lng,
        confidence: result.confidence === 'high' ? 'high' : 'medium',
      };
    },
  };
}

/**
 * Turn Census results into rows for the EXISTING manual-review batch CSV.
 * Every row ships action='manual-review' — deliberately never 'ready', so a
 * human must inspect and upgrade each one in the console before any apply.
 */
export function censusResultsToReviewRows(
  results: CensusResult[],
  listings: Map<
    string,
    {
      name: string;
      categorySlug: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      lat: number | null;
      lng: number | null;
    }
  >,
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const r of results) {
    if (r.status === 'rejected' || r.lat == null || r.lng == null) continue;
    const l = listings.get(r.id);
    if (!l) continue;
    rows.push([
      r.id,
      l.name,
      l.categorySlug,
      l.address,
      l.city,
      l.state,
      l.zip,
      l.lat ?? '',
      l.lng ?? '',
      r.lat.toFixed(6),
      r.lng.toFixed(6),
      r.confidence ?? 'medium',
      'https://geocoding.geo.census.gov/',
      `census ${r.status} match (${r.matchType}); submitted: ${r.submittedAddress}; matched: ${r.matchedAddress}`,
      'manual-review',
    ]);
  }
  return rows;
}
