import { coordinateIssues } from '@/lib/map/geo';
import { toCsv } from './csv';
import {
  GEOCODING_COLUMNS,
  type GeocodingRow,
  type ValidatedRow,
} from './geocoding';

/**
 * Geocoding queue triage (research tooling). The console's exporters split a
 * batch only two ways — applicable vs. not — so a merely low-confidence
 * candidate and an outright-bad row land in the same "review" bucket. This
 * module adds a THREE-way triage used by the offline queue generator:
 *
 *   ready         — safe to apply after admin selection (all gates pass)
 *   manual-review — has a candidate coordinate but needs a human (low/medium
 *                   confidence, action=manual-review, would overwrite, etc.)
 *   rejected      — must not be applied as-is (skip, unresolved, no/invalid
 *                   coordinates, unknown id, identity mismatch, duplicate id)
 *
 * Pure and additive: it never mutates rows, never applies coordinates, and does
 * not change the existing console behaviour. It only reads the parsed batch (and
 * optionally the validator's cross-checked result).
 */

export const QUEUE_NAMES = ['ready', 'manual-review', 'rejected'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export type QueueVerdict = { queue: QueueName; reasons: string[] };

function hasCoords(row: Pick<GeocodingRow, 'proposed_latitude' | 'proposed_longitude'>): boolean {
  return row.proposed_latitude != null && row.proposed_longitude != null;
}

/**
 * Triage a parsed row WITHOUT a live cross-check (offline / pre-import). Uses
 * only the row's own action, confidence and proposed coordinates.
 */
export function classifyQueueStatic(row: GeocodingRow): QueueVerdict {
  const reasons: string[] = [];

  if (row.action === 'skip') return { queue: 'rejected', reasons: ['action=skip'] };
  if (row.confidence === 'unresolved')
    return { queue: 'rejected', reasons: ['confidence=unresolved'] };

  if (!hasCoords(row)) return { queue: 'rejected', reasons: ['no proposed coordinates'] };

  const issues = coordinateIssues(row.proposed_latitude as number, row.proposed_longitude as number);
  if (issues.length > 0) return { queue: 'rejected', reasons: [`invalid coordinates: ${issues.join(', ')}`] };

  if (row.action === 'ready' && row.confidence === 'high') {
    return { queue: 'ready', reasons: ['action=ready', 'confidence=high', 'valid coordinates'] };
  }

  if (row.action !== 'ready') reasons.push(`action=${row.action}`);
  if (row.confidence !== 'high') reasons.push(`confidence=${row.confidence}`);
  return { queue: 'manual-review', reasons: reasons.length ? reasons : ['needs human confirmation'] };
}

/**
 * Triage a validator-checked row (has live cross-check). Hard problems reject;
 * soft, recoverable states go to manual-review; fully applicable rows are ready.
 */
export function classifyQueueValidated(row: ValidatedRow): QueueVerdict {
  // Applicable AND not overwriting existing coordinates → ready. An applicable
  // row that would overwrite is held for manual review (explicit confirm).
  if (row.applicable && !row.wouldOverwrite) return { queue: 'ready', reasons: ['passes all gates'] };

  const HARD = new Set([
    'unknown-listing-id',
    'identity-mismatch',
    'invalid-coordinates',
    'duplicate-listing-id',
  ]);
  const hard = row.problems.filter((p) => HARD.has(p));
  if (row.action === 'skip' || row.confidence === 'unresolved' || !hasCoords(row) || hard.length > 0) {
    const reasons: string[] = [...hard];
    if (row.action === 'skip') reasons.push('action=skip');
    if (row.confidence === 'unresolved') reasons.push('confidence=unresolved');
    if (!hasCoords(row)) reasons.push('no proposed coordinates');
    return { queue: 'rejected', reasons: reasons.length ? reasons : ['not applicable'] };
  }

  const reasons = row.problems.filter((p) => !HARD.has(p)) as string[];
  if (row.wouldOverwrite) reasons.push('would overwrite existing coordinates');
  return { queue: 'manual-review', reasons: reasons.length ? reasons : ['needs human confirmation'] };
}

export type QueueSplit<T> = {
  ready: T[];
  manualReview: T[];
  rejected: T[];
  verdicts: Map<T, QueueVerdict>;
};

/** Split any row list into the three queues using the supplied classifier. */
export function splitQueues<T>(rows: T[], classify: (row: T) => QueueVerdict): QueueSplit<T> {
  const split: QueueSplit<T> = { ready: [], manualReview: [], rejected: [], verdicts: new Map() };
  for (const row of rows) {
    const verdict = classify(row);
    split.verdicts.set(row, verdict);
    if (verdict.queue === 'ready') split.ready.push(row);
    else if (verdict.queue === 'manual-review') split.manualReview.push(row);
    else split.rejected.push(row);
  }
  return split;
}

/**
 * Cross-row coordinate safety check: two DISTINCT listings proposing the exact
 * same coordinate is almost always a copy/paste error or an anchor reused
 * without offset. Returns one finding per shared coordinate.
 */
export type DuplicateCoordinateFinding = {
  latitude: number;
  longitude: number;
  listingIds: string[];
  names: string[];
};

export function duplicateCoordinateFindings(rows: GeocodingRow[]): DuplicateCoordinateFinding[] {
  const byCoord = new Map<string, GeocodingRow[]>();
  for (const r of rows) {
    if (!hasCoords(r)) continue;
    const key = `${r.proposed_latitude},${r.proposed_longitude}`;
    const list = byCoord.get(key) ?? [];
    list.push(r);
    byCoord.set(key, list);
  }
  const findings: DuplicateCoordinateFinding[] = [];
  for (const [, list] of byCoord) {
    const distinct = new Map(list.map((r) => [r.listing_id, r]));
    if (distinct.size > 1) {
      const first = list[0];
      findings.push({
        latitude: first.proposed_latitude as number,
        longitude: first.proposed_longitude as number,
        listingIds: [...distinct.keys()],
        names: [...distinct.values()].map((r) => r.business_name),
      });
    }
  }
  return findings;
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
 * Serialize a queue back to the exact 15-column geocoding contract, plus a
 * trailing `queue_reasons` column so the file is both re-importable and
 * self-documenting. Round-trips through parseGeocodingCsv.
 */
export function queueCsv(rows: GeocodingRow[], verdicts: Map<GeocodingRow, QueueVerdict>): string {
  return toCsv([
    [...GEOCODING_COLUMNS, 'queue_reasons'],
    ...rows.map((r) => [...rowCells(r), (verdicts.get(r)?.reasons ?? []).join('; ')]),
  ]);
}

export type QueueReport = {
  total: number;
  counts: Record<QueueName, number>;
  byConfidence: Record<string, number>;
  byAction: Record<string, number>;
  duplicateCoordinates: DuplicateCoordinateFinding[];
};

export function queueReport(
  rows: GeocodingRow[],
  split: QueueSplit<GeocodingRow>,
  duplicates: DuplicateCoordinateFinding[],
): QueueReport {
  const bump = (rec: Record<string, number>, k: string) => {
    rec[k] = (rec[k] ?? 0) + 1;
  };
  const byConfidence: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  for (const r of rows) {
    bump(byConfidence, r.confidence);
    bump(byAction, r.action);
  }
  return {
    total: rows.length,
    counts: {
      ready: split.ready.length,
      'manual-review': split.manualReview.length,
      rejected: split.rejected.length,
    },
    byConfidence,
    byAction,
    duplicateCoordinates: duplicates,
  };
}
