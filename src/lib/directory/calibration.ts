import { haversineMiles } from '@/lib/map/geo';
import { normalizeInterstate } from './coordinate-verification';
import {
  EXIT_NUMBERING,
  parseExitNumber,
  calibrationKey,
  type CalibrationSet,
  type MilepostAnchor,
} from './interpolation';

/**
 * Calibration building (Phase 2A): turn ALREADY-VERIFIED coordinates into
 * milepost anchors. Pure — inputs are plain rows, output is a CalibrationSet.
 * No coordinate here is invented: every anchor is traceable to either a
 * coordinate already applied in the directory (source 'directory-verified')
 * or a human-researched geocoding batch row (source 'geocoding-batch',
 * high/medium confidence only).
 */

export type AnchorSourceRow = {
  listingId: string;
  state: string;
  interstate: string;
  exitNumber: string;
  lat: number;
  lng: number;
  /** Provenance label recorded on the anchor. */
  source: string;
};

export type CalibrationBuildResult = {
  calibrations: CalibrationSet;
  /** Anchors dropped because a neighbor-distance sanity check failed. */
  rejected: { anchor: MilepostAnchor; corridor: string; reason: string }[];
  /** Rows skipped before anchoring (no milepost, sequential state, ...). */
  skipped: { listingId: string; reason: string }[];
};

/**
 * Build per-(interstate,state) calibrations. Rows without a numeric exit, in
 * sequential-exit states, or duplicating an already-anchored milepost are
 * skipped. After sorting, anchors that sit implausibly far from BOTH
 * neighbors for their milepost gaps are rejected (a wrong anchor poisons
 * every interpolation that brackets with it — better fewer, honest anchors).
 */
export function buildCalibrations(rows: AnchorSourceRow[]): CalibrationBuildResult {
  const skipped: CalibrationBuildResult['skipped'] = [];
  const byCorridor = new Map<
    string,
    { state: string; interstate: string; anchors: MilepostAnchor[] }
  >();

  for (const row of rows) {
    const state = row.state.trim().toUpperCase();
    const interstate = normalizeInterstate(row.interstate);
    const milepost = parseExitNumber(row.exitNumber);
    if (!interstate) {
      skipped.push({ listingId: row.listingId, reason: 'no-interstate' });
      continue;
    }
    if (milepost === null) {
      skipped.push({ listingId: row.listingId, reason: 'no-exit-number' });
      continue;
    }
    const numbering = EXIT_NUMBERING[state];
    if (numbering !== 'milepost') {
      skipped.push({
        listingId: row.listingId,
        reason: numbering === 'sequential' ? 'sequential-exit-state' : 'unknown-exit-numbering',
      });
      continue;
    }
    const key = calibrationKey(interstate, state);
    let corridor = byCorridor.get(key);
    if (!corridor) {
      corridor = { state, interstate, anchors: [] };
      byCorridor.set(key, corridor);
    }
    if (corridor.anchors.some((a) => a.milepost === milepost)) {
      skipped.push({ listingId: row.listingId, reason: 'duplicate-milepost' });
      continue;
    }
    corridor.anchors.push({
      milepost,
      lat: row.lat,
      lng: row.lng,
      listingId: row.listingId,
      source: row.source,
    });
  }

  const rejected: CalibrationBuildResult['rejected'] = [];
  const calibrations: CalibrationSet = [];
  // How far an anchor may sit from an adjacent anchor before the pair is
  // implausible: road distance can exceed straight-line, never the reverse
  // (plus slack for short gaps where exit ramps dominate).
  const pairImplausibility = (a: MilepostAnchor, n: MilepostAnchor): number => {
    const gap = Math.abs(n.milepost - a.milepost);
    return Math.max(0, haversineMiles(a, n) - (gap * 1.5 + 2));
  };
  for (const [key, corridor] of byCorridor) {
    // One bad anchor makes its innocent neighbors look bad too, so reject
    // iteratively: while any adjacent pair is implausible, drop the single
    // anchor with the worst total disagreement and re-evaluate the rest.
    const keep = corridor.anchors.sort((a, b) => a.milepost - b.milepost);
    for (;;) {
      let worstIdx = -1;
      let worstScore = 0;
      for (let i = 0; i < keep.length; i++) {
        const neighbors = [keep[i - 1], keep[i + 1]].filter(Boolean) as MilepostAnchor[];
        const score = neighbors.reduce((sum, n) => sum + pairImplausibility(keep[i], n), 0);
        if (score > worstScore) {
          worstScore = score;
          worstIdx = i;
        }
      }
      if (worstIdx === -1) break;
      rejected.push({ anchor: keep[worstIdx], corridor: key, reason: 'implausible-vs-neighbors' });
      keep.splice(worstIdx, 1);
    }
    if (keep.length >= 2) {
      calibrations.push({ interstate: corridor.interstate, state: corridor.state, anchors: keep });
    }
  }
  calibrations.sort((a, b) =>
    calibrationKey(a.interstate, a.state).localeCompare(calibrationKey(b.interstate, b.state)),
  );
  return { calibrations, rejected, skipped };
}
