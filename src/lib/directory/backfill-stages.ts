import type { PipelineReport, ClassifiedRow } from './geocode-pipeline';
import type { CensusResult } from './census-geocoder';
import { resolveCorridor } from './concurrency';

/**
 * Staged backfill plan (Phase 2B, Step 6). Pure classification of pipeline +
 * Census results into the four approved stages. Stages are PLANS — nothing
 * here applies anything, and every stage's records still flow through the
 * admin console's per-row manual review.
 *
 *   A — current interpolation candidates on I-75 GA/TN (the proven corridor)
 *   B — interpolation candidates on newly calibrated corridors
 *   C — Census exact (high-confidence) address matches
 *   D — everything else: medium/ambiguous/concurrency/unresolved → manual
 *       research queue only, never automatic geocoding
 */

export type BackfillStage = 'A' | 'B' | 'C' | 'D';

export type StagedRecord = {
  id: string;
  name: string;
  state: string;
  corridor: string;
  exit: string;
  stage: BackfillStage;
  method: 'interpolation' | 'census' | 'manual-research';
  confidence: string;
  reason: string;
};

const STAGE_A_CORRIDORS = new Set(['I-75|GA', 'I-75|TN']);

export function assignStages(
  report: PipelineReport,
  censusResults: CensusResult[],
): StagedRecord[] {
  const censusById = new Map(censusResults.map((r) => [r.id, r]));
  const out: StagedRecord[] = [];

  for (const row of report.rows) {
    const l = row.listing;
    if (row.klass === 'already-geocoded') continue; // verified live coordinate
    const res = resolveCorridor(l.state, l.interstate, l.exitNumber);
    const corridorKey = `${res.canonical}|${l.state.trim().toUpperCase()}`;
    const base = {
      id: l.id,
      name: l.name,
      state: l.state.trim().toUpperCase(),
      corridor: res.canonical || l.interstate,
      exit: l.exitNumber,
    };

    // Suspect/invalid existing coordinates are research work, never applies.
    if (row.klass === 'existing-suspect' || row.klass === 'existing-invalid') {
      out.push({
        ...base,
        stage: 'D',
        method: 'manual-research',
        confidence: 'unresolved',
        reason:
          row.klass === 'existing-invalid'
            ? 'existing coordinate fails hard validation — research required'
            : 'existing coordinate flagged suspect (state/corridor triage) — research required',
      });
      continue;
    }

    if (row.klass === 'interpolated' && row.proposed && !res.rule) {
      const stage: BackfillStage = STAGE_A_CORRIDORS.has(corridorKey) ? 'A' : 'B';
      out.push({
        ...base,
        stage,
        method: 'interpolation',
        confidence: row.proposed.confidence,
        reason:
          stage === 'A'
            ? 'interpolated on the proven I-75 GA/TN calibration'
            : 'interpolated on a newly calibrated corridor',
      });
      continue;
    }

    // Concurrency-normalized rows never auto-stage — corridor identity must
    // be human-confirmed first (matches neverAutoGeocode).
    if (row.klass === 'interpolated' && row.proposed && res.rule) {
      out.push({
        ...base,
        stage: 'D',
        method: 'interpolation',
        confidence: row.proposed.confidence,
        reason:
          'interpolates cleanly, but sits on an interstate concurrency — corridor identity must be human-confirmed',
      });
      continue;
    }

    const census = censusById.get(l.id);
    if (census && census.status === 'exact' && census.confidence === 'high') {
      out.push({
        ...base,
        stage: 'C',
        method: 'census',
        confidence: 'high',
        reason: 'Census exact address match in expected state',
      });
      continue;
    }

    const why =
      row.klass === 'conflict'
        ? 'existing coordinate conflicts with corridor math'
        : res.rule
          ? `concurrency-normalized corridor (${res.rule.reason.slice(0, 60)}…)`
          : census
            ? `census ${census.status}${census.rejection ? `: ${census.rejection}` : ''}`
            : (row.notes[0] ?? 'no automatic path');
    out.push({
      ...base,
      stage: 'D',
      method: census && census.status === 'approximate' ? 'census' : 'manual-research',
      confidence: census?.confidence ?? 'unresolved',
      reason: why,
    });
  }
  return out;
}

export type StageSummary = {
  stage: BackfillStage;
  records: number;
  byCorridor: Record<string, number>;
  byConfidence: Record<string, number>;
};

export function summarizeStages(records: StagedRecord[]): StageSummary[] {
  const stages: BackfillStage[] = ['A', 'B', 'C', 'D'];
  return stages.map((stage) => {
    const rows = records.filter((r) => r.stage === stage);
    const byCorridor: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};
    for (const r of rows) {
      const key = `${r.corridor} ${r.state}`;
      byCorridor[key] = (byCorridor[key] ?? 0) + 1;
      byConfidence[r.confidence] = (byConfidence[r.confidence] ?? 0) + 1;
    }
    return { stage, records: rows.length, byCorridor, byConfidence };
  });
}

/**
 * Projected coordinate coverage after each stage completes (assuming every
 * stage record survives manual review — the optimistic ceiling; reviewers
 * rejecting rows only lowers it).
 */
export function projectedCoverage(
  totalActive: number,
  alreadyGeocoded: number,
  summaries: StageSummary[],
): { stage: BackfillStage | 'current'; cumulative: number; pct: number }[] {
  let cum = alreadyGeocoded;
  const rows: { stage: BackfillStage | 'current'; cumulative: number; pct: number }[] = [
    { stage: 'current', cumulative: cum, pct: Number(((cum / totalActive) * 100).toFixed(1)) },
  ];
  for (const s of summaries) {
    // Stage D is a research queue, not an apply stage — it adds no automatic coverage.
    if (s.stage !== 'D') cum += s.records;
    rows.push({
      stage: s.stage,
      cumulative: cum,
      pct: Number(((cum / totalActive) * 100).toFixed(1)),
    });
  }
  return rows;
}

/** Records that must NEVER be automatically geocoded, with the reason. */
export function neverAutoGeocode(
  report: PipelineReport,
): { id: string; name: string; reason: string }[] {
  const out: { id: string; name: string; reason: string }[] = [];
  for (const row of report.rows) {
    const l = row.listing;
    if (row.klass === 'already-geocoded') continue;
    const res = resolveCorridor(l.state, l.interstate, l.exitNumber);
    if (row.klass === 'existing-suspect' || row.klass === 'existing-invalid') {
      out.push({
        id: l.id,
        name: l.name,
        reason: 'existing coordinate flagged by validation — human adjudication required',
      });
    } else if (row.klass === 'conflict') {
      out.push({
        id: l.id,
        name: l.name,
        reason: 'existing coordinate disputes corridor math — human adjudication required',
      });
    } else if (res.rule) {
      out.push({
        id: l.id,
        name: l.name,
        reason: 'sits on an interstate concurrency — corridor identity must be human-confirmed',
      });
    } else if (row.klass === 'unresolved' && l.address.trim() === '') {
      out.push({
        id: l.id,
        name: l.name,
        reason: 'no exit number and no street address — research required',
      });
    }
  }
  return out;
}
