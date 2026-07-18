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

/**
 * OPTIONAL evidence columns (Milestone 21). A 15-column batch file stays
 * fully valid; when any of these headers are present their values ride along
 * into the review console (evidence drawer, priority sorting, review-queue
 * export). None of them affect applicability — action + confidence remain
 * the only gates.
 */
export const GEOCODING_EVIDENCE_COLUMNS = [
  'confidence_reason',
  'source_count',
  'source_urls',
  'last_researched',
  'reviewer_notes',
  'side_of_road_confirmed',
  'property_confirmed',
  'city_state_validated',
  'priority',
  'concern_flag',
  'status',
] as const;

export const CANDIDATE_STATUS_VALUES = [
  'ready',
  'manual-review',
  'skipped',
  'rejected',
  'applied',
] as const;
export const PRIORITY_VALUES = ['high', 'normal', 'low'] as const;

export type GeocodingEvidence = {
  confidenceReason: string;
  sourceCount: number | null;
  /** Multiple URLs, ;-separated in the cell. */
  sourceUrls: string[];
  lastResearched: string;
  reviewerNotes: string;
  sideOfRoadConfirmed: boolean | null;
  propertyConfirmed: boolean | null;
  cityStateValidated: boolean | null;
  priority: (typeof PRIORITY_VALUES)[number] | '';
  concernFlag: boolean;
  /** Candidate lifecycle status when tracked ('' when the column is absent). */
  status: (typeof CANDIDATE_STATUS_VALUES)[number] | '';
};

const EMPTY_EVIDENCE: GeocodingEvidence = {
  confidenceReason: '',
  sourceCount: null,
  sourceUrls: [],
  lastResearched: '',
  reviewerNotes: '',
  sideOfRoadConfirmed: null,
  propertyConfirmed: null,
  cityStateValidated: null,
  priority: '',
  concernFlag: false,
  status: '',
};

const parseYesNo = (v: string): boolean | null => {
  const s = v.trim().toLowerCase();
  if (['yes', 'y', 'true'].includes(s)) return true;
  if (['no', 'n', 'false'].includes(s)) return false;
  return null;
};

function parseEvidence(record: Record<string, string>): GeocodingEvidence {
  const count = Number((record.source_count ?? '').trim());
  const priority = (record.priority ?? '').trim().toLowerCase();
  const status = (record.status ?? '').trim().toLowerCase();
  return {
    confidenceReason: (record.confidence_reason ?? '').trim(),
    sourceCount: Number.isFinite(count) && (record.source_count ?? '').trim() !== '' ? count : null,
    sourceUrls: (record.source_urls ?? '')
      .split(';')
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u)),
    lastResearched: (record.last_researched ?? '').trim(),
    reviewerNotes: (record.reviewer_notes ?? '').trim(),
    sideOfRoadConfirmed: parseYesNo(record.side_of_road_confirmed ?? ''),
    propertyConfirmed: parseYesNo(record.property_confirmed ?? ''),
    cityStateValidated: parseYesNo(record.city_state_validated ?? ''),
    priority: (PRIORITY_VALUES as readonly string[]).includes(priority)
      ? (priority as GeocodingEvidence['priority'])
      : '',
    concernFlag: parseYesNo(record.concern_flag ?? '') === true,
    status: (CANDIDATE_STATUS_VALUES as readonly string[]).includes(status)
      ? (status as GeocodingEvidence['status'])
      : '',
  };
}

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

export type GeocodingRow = z.infer<typeof rowSchema> & { evidence: GeocodingEvidence };

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
  // Optional evidence columns: captured when present, ignored when absent.
  const evidenceIdx = Object.fromEntries(
    GEOCODING_EVIDENCE_COLUMNS.filter((c) => header.includes(c)).map((c) => [c, header.indexOf(c)]),
  );

  const rows: GeocodingRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (raw.every((cell) => cell.trim() === '')) continue;
    const record = Object.fromEntries(GEOCODING_COLUMNS.map((c) => [c, raw[idx[c]] ?? '']));
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push(`Row ${i + 1}: ${first.path.join('.')}: ${first.message}`);
      continue;
    }
    const evidenceRecord = Object.fromEntries(
      Object.entries(evidenceIdx).map(([c, col]) => [c, raw[col as number] ?? '']),
    );
    rows.push({
      ...parsed.data,
      evidence:
        Object.keys(evidenceRecord).length > 0
          ? parseEvidence(evidenceRecord)
          : { ...EMPTY_EVIDENCE },
    });
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
  /** Optional corridor tag — rides into review enrichment when provided. */
  interstate?: string | null;
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
  live: {
    name: string;
    lat: number | null;
    lng: number | null;
    interstate?: string | null;
  } | null;
};

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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
      live: liveRow
        ? {
            name: liveRow.name,
            lat: liveRow.lat,
            lng: liveRow.lng,
            interstate: liveRow.interstate ?? null,
          }
        : null,
    };
  });
}

/* ============================================================ console helpers */

export type BatchSummary = {
  total: number;
  applicable: number;
  overwrites: number;
  concerns: number;
  byConfidence: Record<string, number>;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  byProblem: Record<string, number>;
};

/** Summary counts for the review console header. */
export function batchSummary(rows: ValidatedRow[]): BatchSummary {
  const bump = (record: Record<string, number>, key: string) => {
    record[key] = (record[key] ?? 0) + 1;
  };
  const summary: BatchSummary = {
    total: rows.length,
    applicable: rows.filter((r) => r.applicable).length,
    overwrites: rows.filter((r) => r.wouldOverwrite).length,
    concerns: rows.filter((r) => r.evidence.concernFlag).length,
    byConfidence: {},
    byAction: {},
    byStatus: {},
    byProblem: {},
  };
  for (const r of rows) {
    bump(summary.byConfidence, r.confidence);
    bump(summary.byAction, r.action);
    if (r.evidence.status) bump(summary.byStatus, r.evidence.status);
    for (const p of r.problems) bump(summary.byProblem, p);
  }
  return summary;
}

/** OpenStreetMap link for eyeballing a coordinate (no API key, no Google). */
export function osmUrl(lat: number, lng: number, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

const rowCells = (r: GeocodingRow): (string | number | null)[] => [
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
];

/**
 * Staging file for a selected subset — the same 15-column contract the apply
 * tool takes, so a reviewed slice of a big batch can be saved, re-checked,
 * and applied later as its own file.
 */
export function stagingCsv(rows: ValidatedRow[], selectedIds: Set<string>): string {
  const selected = rows.filter((r) => selectedIds.has(r.listing_id));
  return toCsv([[...GEOCODING_COLUMNS], ...selected.map(rowCells)]);
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, '': 1, low: 2 };

/**
 * The manual-review queue: everything not applicable, priority-first, with
 * evidence columns appended so the researcher sees the full picture offline.
 */
export function reviewQueueCsv(rows: ValidatedRow[]): string {
  const queue = rows
    .filter((r) => !r.applicable)
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.evidence.priority] ?? 1) - (PRIORITY_ORDER[b.evidence.priority] ?? 1) ||
        a.state.localeCompare(b.state) ||
        a.business_name.localeCompare(b.business_name),
    );
  return toCsv([
    [...GEOCODING_COLUMNS, ...GEOCODING_EVIDENCE_COLUMNS, 'problems'],
    ...queue.map((r) => [
      ...rowCells(r),
      r.evidence.confidenceReason,
      r.evidence.sourceCount,
      r.evidence.sourceUrls.join(';'),
      r.evidence.lastResearched,
      r.evidence.reviewerNotes,
      r.evidence.sideOfRoadConfirmed == null ? '' : r.evidence.sideOfRoadConfirmed ? 'yes' : 'no',
      r.evidence.propertyConfirmed == null ? '' : r.evidence.propertyConfirmed ? 'yes' : 'no',
      r.evidence.cityStateValidated == null ? '' : r.evidence.cityStateValidated ? 'yes' : 'no',
      r.evidence.priority,
      r.evidence.concernFlag ? 'yes' : '',
      r.evidence.status,
      r.problemDetails.join('; ') || r.problems.join('; '),
    ]),
  ]);
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
