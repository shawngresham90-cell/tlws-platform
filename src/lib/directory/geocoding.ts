import { z } from 'zod';
import { parseCsv, toCsv } from './csv';
import { coordinateIssues } from '@/lib/map/geo';

/**
 * Geocoding batch domain (Milestone 17): the CSV contract for verified
 * coordinate batches and the PURE validation pipeline behind the admin apply
 * tool. Matching is ALWAYS listing_id + address/city/state cross-check —
 * never name-only. Only rows that are action=ready AND confidence=high AND
 * carry valid US coordinates are applicable; everything else is preserved,
 * labeled, and downloadable for manual review.
 */

export const GEOCODING_COLUMNS = [
  'listing_id',
  'business_name',
  'category',
  'address',
  'city',
  'state',
  'zip',
  'current_latitude',
  'current_longitude',
  'proposed_latitude',
  'proposed_longitude',
  'confidence',
  'source_url',
  'verification_notes',
  'action',
] as const;

export const CONFIDENCE_VALUES = ['high', 'medium', 'low', 'unresolved'] as const;
export const ACTION_VALUES = ['ready', 'manual-review', 'skip'] as const;

export type Confidence = (typeof CONFIDENCE_VALUES)[number];
export type GeocodingAction = (typeof ACTION_VALUES)[number];

/** '' → null, otherwise a finite number. */
const optionalNumber = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.coerce.number().finite().nullable(),
);

const rowSchema = z.object({
  listing_id: z.string().uuid('listing_id must be a UUID'),
  business_name: z.string().trim().min(1, 'business_name is required'),
  category: z.string().trim(),
  address: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim().toUpperCase(),
  zip: z.string().trim(),
  current_latitude: optionalNumber,
  current_longitude: optionalNumber,
  proposed_latitude: optionalNumber,
  proposed_longitude: optionalNumber,
  confidence: z.enum(CONFIDENCE_VALUES),
  source_url: z.string().trim(),
  verification_notes: z.string().trim(),
  action: z.enum(ACTION_VALUES),
});

export type GeocodingRow = z.infer<typeof rowSchema>;

export type ParsedBatch = {
  rows: GeocodingRow[];
  /** Fatal file-level or row-level errors ("row 7: ..."). */
  errors: string[];
};

/** Parse + schema-validate the batch CSV. Structural errors are fatal. */
export function parseGeocodingCsv(text: string): ParsedBatch {
  const errors: string[] = [];
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ['The file is empty.'] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = GEOCODING_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(', ')}`] };
  }
  const idx = Object.fromEntries(GEOCODING_COLUMNS.map((c) => [c, header.indexOf(c)]));

  const rows: GeocodingRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (raw.every((cell) => cell.trim() === '')) continue;
    const record = Object.fromEntries(
      GEOCODING_COLUMNS.map((c) => [c, raw[idx[c]] ?? '']),
    );
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push(`Row ${i + 1}: ${first.path.join('.')}: ${first.message}`);
      continue;
    }
    rows.push(parsed.data);
  }
  return { rows, errors };
}

/** What the validator needs to know about each live listing. */
export type LiveListingRef = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
};

export type RowProblem =
  | 'duplicate-listing-id'
  | 'unknown-listing-id'
  | 'identity-mismatch'
  | 'not-ready'
  | 'not-high-confidence'
  | 'missing-coordinates'
  | 'invalid-coordinates';

export type ValidatedRow = GeocodingRow & {
  /** True only when this row may be applied (still needs admin selection). */
  applicable: boolean;
  problems: RowProblem[];
  /** Human detail per problem (e.g. which coordinate check failed). */
  problemDetails: string[];
  /** Live row already has different coordinates — needs explicit confirm. */
  wouldOverwrite: boolean;
  live: { name: string; lat: number | null; lng: number | null } | null;
};

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Cross-check parsed rows against the live listings. A row is applicable
 * only if: unique known id, its address/city/state agree with the live row
 * (id alone is never trusted), action=ready, confidence=high, and the
 * proposed coordinates are valid US coordinates.
 */
export function validateBatch(
  rows: GeocodingRow[],
  live: Map<string, LiveListingRef>,
): ValidatedRow[] {
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.listing_id, (seen.get(r.listing_id) ?? 0) + 1);

  return rows.map((row) => {
    const problems: RowProblem[] = [];
    const problemDetails: string[] = [];
    const liveRow = live.get(row.listing_id) ?? null;

    if ((seen.get(row.listing_id) ?? 0) > 1) {
      problems.push('duplicate-listing-id');
      problemDetails.push('listing_id appears more than once in the file');
    }
    if (!liveRow) {
      problems.push('unknown-listing-id');
      problemDetails.push('no live listing with this id');
    } else {
      // Identity cross-check: city+state must match; address must match when
      // both sides have one. Name similarity alone is NEVER enough.
      const cityOk = norm(liveRow.city) === norm(row.city);
      const stateOk = norm(liveRow.state) === norm(row.state);
      const addressOk =
        !row.address || !liveRow.address || norm(liveRow.address) === norm(row.address);
      if (!cityOk || !stateOk || !addressOk) {
        problems.push('identity-mismatch');
        problemDetails.push(
          `file says "${row.address || '—'}, ${row.city}, ${row.state}" but the live listing is ` +
            `"${liveRow.address ?? '—'}, ${liveRow.city}, ${liveRow.state}"`,
        );
      }
    }

    if (row.action !== 'ready') {
      problems.push('not-ready');
      problemDetails.push(`action is "${row.action}"`);
    }
    if (row.confidence !== 'high') {
      problems.push('not-high-confidence');
      problemDetails.push(`confidence is "${row.confidence}"`);
    }

    if (row.proposed_latitude == null || row.proposed_longitude == null) {
      if (row.action === 'ready') {
        problems.push('missing-coordinates');
        problemDetails.push('ready row has no proposed coordinates');
      }
    } else {
      const issues = coordinateIssues(row.proposed_latitude, row.proposed_longitude);
      if (issues.length > 0) {
        problems.push('invalid-coordinates');
        problemDetails.push(`coordinate checks failed: ${issues.join(', ')}`);
      }
    }

    const hasCoords = row.proposed_latitude != null && row.proposed_longitude != null;
    const wouldOverwrite = Boolean(
      liveRow &&
        hasCoords &&
        liveRow.lat != null &&
        liveRow.lng != null &&
        (liveRow.lat !== row.proposed_latitude || liveRow.lng !== row.proposed_longitude),
    );

    return {
      ...row,
      applicable: problems.length === 0 && hasCoords,
      problems,
      problemDetails,
      wouldOverwrite,
      live: liveRow ? { name: liveRow.name, lat: liveRow.lat, lng: liveRow.lng } : null,
    };
  });
}

/** Rows that are NOT applicable, as a downloadable CSV for manual review. */
export function rejectedRowsCsv(rows: ValidatedRow[]): string {
  const rejected = rows.filter((r) => !r.applicable);
  return toCsv([
    [...GEOCODING_COLUMNS, 'problems'],
    ...rejected.map((r) => [
      r.listing_id,
      r.business_name,
      r.category,
      r.address,
      r.city,
      r.state,
      r.zip,
      r.current_latitude,
      r.current_longitude,
      r.proposed_latitude,
      r.proposed_longitude,
      r.confidence,
      r.source_url,
      r.verification_notes,
      r.action,
      r.problemDetails.join('; ') || r.problems.join('; '),
    ]),
  ]);
}
