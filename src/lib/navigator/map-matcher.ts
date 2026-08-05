/**
 * Heading-aware map matcher (milestone N8c) — decides which roadway the
 * truck is ACTUALLY on, with an explicit confidence level, before any
 * recovery logic exists (N8d+). A single nearest-point calculation is
 * never trusted by itself: every match is judged on
 *
 *   1. lateral distance to the candidate segment,
 *   2. heading agreement with the segment's bearing,
 *   3. travel direction along the route,
 *   4. progression consistency against the predicted mile,
 *   5. candidate ambiguity (a second, distant candidate almost as close),
 *   6. fix quality (accuracy, speed, staleness),
 *
 * and HIGH confidence additionally requires consecutive agreeing fixes —
 * fast to doubt, slow to trust.
 *
 * The committed route mile ONLY advances on an advance-eligible match
 * (high/medium confidence, not reversing). Low/unknown confidence can
 * never advance progress, complete a maneuver, or feed any downstream
 * decision — `advanceEligible` is the single flag consumers may act on,
 * and in N8c nothing consumes it yet (observe-only by design).
 *
 * Pure: fixes arrive as arguments with their own timestamps. No I/O,
 * no clock, no timers.
 */

import { bearingDeg } from './geo';
import type { LatLng } from '@/lib/map/bounds';
import type { GeometryPoint } from './route-geometry';
import type { RouteSession } from './route-session';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type TravelDirection = 'forward' | 'reverse' | 'stationary' | 'unknown';

export type MatchFix = {
  position: LatLng;
  /** Degrees clockwise from true north, or null when the platform has none. */
  headingDeg: number | null;
  speedMph: number | null;
  accuracyM: number | null;
  tMs: number;
};

export type MapMatch = {
  matched: boolean;
  /** The engine's COMMITTED mile — advances only on eligible matches. */
  routeMile: number | null;
  /** The raw best candidate's mile for this fix (diagnostic). */
  candidateMile: number | null;
  lateralM: number | null;
  headingDeltaDeg: number | null;
  travelDirection: TravelDirection;
  confidence: MatchConfidence;
  /** True only when confidence is high/medium AND not reversing. */
  advanceEligible: boolean;
  /** Why confidence is what it is — codes, most severe first. */
  reasons: string[];
};

export type MapMatcher = {
  match(fix: MatchFix): MapMatch;
  last(): MapMatch;
};

// --- thresholds (all exported so tests pin the model, not magic numbers) ---

/** Lateral distance for a HIGH-eligible match; a modern fix on-lane is < 15 m. */
export const HIGH_LATERAL_M = 30;
/** Beyond this the fix is at best beside the road (frontage-road band). */
export const MEDIUM_LATERAL_M = 75;
/** Beyond this there is no match at all — the truck is somewhere else. */
export const MAX_MATCH_LATERAL_M = 150;

/** Heading agreement for HIGH; between the two, medium; beyond OPPOSING, low. */
export const HIGH_HEADING_DEG = 30;
export const MEDIUM_HEADING_DEG = 60;
export const OPPOSING_HEADING_DEG = 100;

/** Below this speed a magnetic/GPS heading is noise, not a bearing. */
export const HEADING_MIN_SPEED_MPH = 5;
/** Below this the truck is effectively stationary. */
export const STATIONARY_SPEED_MPH = 2;

/** Fix accuracy caps: worse than 30 m can't be high; worse than 50 m is low. */
export const MEDIUM_ACCURACY_M = 30;
export const LOW_ACCURACY_M = 50;

/** Progression: candidate may deviate this far from the predicted mile. */
export const PROGRESSION_TOLERANCE_MI = 0.5;
/** Re-anchor after this many consecutive fixes agreeing on a distant mile. */
export const REANCHOR_CONFIRM_FIXES = 5;
export const REANCHOR_CONSISTENCY_MI = 0.35;

/** Two candidates within this margin but far apart in mile = ambiguity. */
export const AMBIGUITY_MARGIN_M = 15;
export const AMBIGUITY_MILE_GAP_MI = 0.5;

/** HIGH requires this many consecutive fixes that meet every HIGH bar. */
export const HIGH_CONFIRM_FIXES = 3;

/** A gap longer than this resets consistency (tunnel, GPS loss). */
export const STALE_RESET_MS = 10_000;

/** Backward jitter that never lowers the committed mile (matches tracker). */
export const BACKWARD_JITTER_MI = 0.15;

/** Search window around the committed mile, miles each way. */
export const SEARCH_BEHIND_MI = 1.0;
export const SEARCH_AHEAD_MIN_MI = 2.0;

const METERS_PER_MILE = 1609.344;
const EARTH_M_PER_DEG_LAT = 111_320;

type Candidate = {
  mile: number;
  lateralM: number;
  segmentBearingDeg: number;
};

function angularDeltaDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Build the matcher for one route geometry. Fewer than two points yields
 * a degraded matcher that only ever answers `unknown` (malformed
 * geometry can never fake progress).
 */
export function createMapMatcher(geometry: readonly GeometryPoint[]): MapMatcher {
  const n = geometry.length;
  const usable = n >= 2;

  // Precomputed per-segment bearings; local-frame meters for projection.
  const segBearing = new Float64Array(Math.max(0, n - 1));
  for (let i = 0; i + 1 < n; i++) {
    segBearing[i] = bearingDeg(geometry[i].position, geometry[i + 1].position);
  }

  let committedMile: number | null = null;
  let lastTms: number | null = null;
  let highStreak = 0;
  let recentDeltas: number[] = [];
  let pendingJumpMile: number | null = null;
  let pendingJumpCount = 0;
  let last: MapMatch = emptyMatch();

  function emptyMatch(): MapMatch {
    return {
      matched: false,
      routeMile: committedMile,
      candidateMile: null,
      lateralM: null,
      headingDeltaDeg: null,
      travelDirection: 'unknown',
      confidence: 'unknown',
      advanceEligible: false,
      reasons: usable ? ['no-fix'] : ['degenerate-geometry'],
    };
  }

  /** Index of the last point with routeMile <= mile (binary search). */
  function indexAtMile(mile: number): number {
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (geometry[mid].routeMile <= mile) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Best + strongest DISTANT rival candidate over [from, to] segments. */
  function scan(
    position: LatLng,
    from: number,
    to: number,
  ): { best: Candidate | null; rival: Candidate | null } {
    const cosLat = Math.cos((position.lat * Math.PI) / 180);
    const mPerDegLng = EARTH_M_PER_DEG_LAT * cosLat;
    let best: Candidate | null = null;
    let rival: Candidate | null = null;

    for (let i = from; i < to; i++) {
      const a = geometry[i];
      const b = geometry[i + 1];
      const ax = (position.lng - a.position.lng) * mPerDegLng;
      const ay = (position.lat - a.position.lat) * EARTH_M_PER_DEG_LAT;
      const bx = (b.position.lng - a.position.lng) * mPerDegLng;
      const by = (b.position.lat - a.position.lat) * EARTH_M_PER_DEG_LAT;
      const len2 = bx * bx + by * by;
      const t = len2 > 0 ? Math.min(1, Math.max(0, (ax * bx + ay * by) / len2)) : 0;
      const dx = ax - t * bx;
      const dy = ay - t * by;
      const lateralM = Math.sqrt(dx * dx + dy * dy);
      if (lateralM > MAX_MATCH_LATERAL_M) continue;
      const mile = a.routeMile + (b.routeMile - a.routeMile) * t;
      const cand: Candidate = { mile, lateralM, segmentBearingDeg: segBearing[i] };
      if (best === null || lateralM < best.lateralM) {
        // The displaced best becomes the rival only if it is a genuinely
        // different stretch of route, not the adjacent segment.
        if (best !== null && Math.abs(best.mile - cand.mile) > AMBIGUITY_MILE_GAP_MI) rival = best;
        best = cand;
      } else if (
        Math.abs(cand.mile - best.mile) > AMBIGUITY_MILE_GAP_MI &&
        (rival === null || cand.lateralM < rival.lateralM)
      ) {
        rival = cand;
      }
    }
    return { best, rival };
  }

  function direction(speedMph: number | null): TravelDirection {
    if (speedMph !== null && speedMph < STATIONARY_SPEED_MPH) return 'stationary';
    if (recentDeltas.length < 2) return 'unknown';
    const sum = recentDeltas.reduce((s, d) => s + d, 0);
    if (sum > 0.02) return 'forward';
    if (sum < -0.02) return 'reverse';
    return speedMph !== null && speedMph < HEADING_MIN_SPEED_MPH ? 'stationary' : 'unknown';
  }

  function match(fix: MatchFix): MapMatch {
    if (!usable) {
      last = emptyMatch();
      return last;
    }
    const reasons: string[] = [];

    // Staleness: a long gap (tunnel, loss) keeps the mile but resets all
    // built-up trust — confidence must be re-earned on fresh evidence.
    const dtMs = lastTms === null ? null : fix.tMs - lastTms;
    const gapReset = dtMs !== null && (dtMs > STALE_RESET_MS || dtMs < 0);
    if (gapReset) {
      highStreak = 0;
      recentDeltas = [];
      pendingJumpMile = null;
      pendingJumpCount = 0;
      reasons.push('gap-reset');
    }
    lastTms = fix.tMs;

    // Candidate search: windowed around the committed mile; global scan
    // on a fresh start or when the window comes up empty.
    let from = 0;
    let to = n - 1;
    if (committedMile !== null) {
      const speed = fix.speedMph ?? 0;
      const aheadMi = Math.max(
        SEARCH_AHEAD_MIN_MI,
        dtMs !== null ? ((speed * dtMs) / 3_600_000) * 1.5 : SEARCH_AHEAD_MIN_MI,
      );
      from = indexAtMile(Math.max(0, committedMile - SEARCH_BEHIND_MI));
      to = Math.min(n - 1, indexAtMile(committedMile + aheadMi) + 1);
    }
    let { best, rival } = scan(fix.position, from, to);
    if (best === null && committedMile !== null) {
      ({ best, rival } = scan(fix.position, 0, n - 1));
      if (best !== null) reasons.push('position-jump');
    }

    if (best === null) {
      highStreak = 0;
      recentDeltas = [];
      last = {
        matched: false,
        routeMile: committedMile,
        candidateMile: null,
        lateralM: null,
        headingDeltaDeg: null,
        travelDirection:
          fix.speedMph !== null && fix.speedMph < STATIONARY_SPEED_MPH ? 'stationary' : 'unknown',
        confidence: 'unknown',
        advanceEligible: false,
        reasons: ['no-candidate', ...reasons],
      };
      return last;
    }

    // ---- evidence gathering -------------------------------------------
    const headingUsable =
      fix.headingDeg !== null &&
      Number.isFinite(fix.headingDeg) &&
      fix.speedMph !== null &&
      fix.speedMph >= HEADING_MIN_SPEED_MPH;
    const headingDelta = headingUsable
      ? angularDeltaDeg(fix.headingDeg as number, best.segmentBearingDeg)
      : null;

    // Progression prediction. Across a tunnel/loss gap the truck kept
    // moving — project the committed mile through the gap at the current
    // speed (up to 3 minutes; doc 06 mutes guidance past 60 s anyway).
    // Beyond that there is no honest prediction and progression is not
    // judged at all — the streak requirement guards re-acquisition.
    const predictable =
      committedMile !== null &&
      dtMs !== null &&
      dtMs > 0 &&
      fix.speedMph !== null &&
      (dtMs <= 30_000 || (gapReset && dtMs <= 180_000));
    const predictedMile = predictable
      ? (committedMile as number) + ((fix.speedMph as number) * (dtMs as number)) / 3_600_000
      : gapReset
        ? null
        : committedMile;
    const progressionErrMi = predictedMile === null ? null : Math.abs(best.mile - predictedMile);

    const ambiguous =
      rival !== null &&
      rival.lateralM - best.lateralM <= AMBIGUITY_MARGIN_M &&
      Math.abs(rival.mile - best.mile) > AMBIGUITY_MILE_GAP_MI;

    // ---- confidence ladder: start high, demote on every doubt ----------
    const ORDER: readonly MatchConfidence[] = ['high', 'medium', 'low', 'unknown'];
    let severity = 0;
    const demote = (level: MatchConfidence, reason: string) => {
      severity = Math.max(severity, ORDER.indexOf(level));
      reasons.push(reason);
    };

    if (best.lateralM > MEDIUM_LATERAL_M) demote('low', 'far-from-route');
    else if (best.lateralM > HIGH_LATERAL_M) demote('medium', 'beside-route');

    if (headingDelta !== null) {
      if (headingDelta > OPPOSING_HEADING_DEG) demote('low', 'opposing-heading');
      else if (headingDelta > MEDIUM_HEADING_DEG) demote('low', 'heading-disagrees');
      else if (headingDelta > HIGH_HEADING_DEG) demote('medium', 'heading-loose');
    } else {
      // No usable heading (slow or absent): high is unreachable.
      demote('medium', 'heading-unusable');
    }

    if (fix.accuracyM !== null) {
      if (fix.accuracyM > LOW_ACCURACY_M) demote('low', 'poor-accuracy');
      else if (fix.accuracyM > MEDIUM_ACCURACY_M) demote('medium', 'coarse-accuracy');
    }

    if (ambiguous) {
      // Overlapping highways / stacked interchanges: geometry alone cannot
      // decide, but consistent progression can carry a committed match
      // through at medium. A fresh start under an overlap stays low.
      const progressionHolds =
        progressionErrMi !== null && progressionErrMi <= PROGRESSION_TOLERANCE_MI;
      demote(progressionHolds ? 'medium' : 'low', 'ambiguous-candidates');
    }

    // Low-speed wandering beside the route (truck stop, fuel island,
    // rest area, weigh station): position drifts through the lot.
    if (
      fix.speedMph !== null &&
      fix.speedMph < HEADING_MIN_SPEED_MPH &&
      best.lateralM > HIGH_LATERAL_M
    ) {
      demote('low', 'low-speed-pull-in');
    }

    // Progression: a candidate far from the predicted mile is a crossing
    // or stacked roadway until proven otherwise by consistent evidence.
    if (progressionErrMi !== null && progressionErrMi > PROGRESSION_TOLERANCE_MI) {
      const consistent =
        pendingJumpMile !== null &&
        Math.abs(best.mile - pendingJumpMile) <= REANCHOR_CONSISTENCY_MI;
      pendingJumpCount = consistent ? pendingJumpCount + 1 : 1;
      pendingJumpMile = best.mile;
      if (pendingJumpCount >= REANCHOR_CONFIRM_FIXES && best.lateralM <= MEDIUM_LATERAL_M) {
        committedMile = best.mile;
        highStreak = 0;
        recentDeltas = [];
        pendingJumpMile = null;
        pendingJumpCount = 0;
        demote('medium', 'reanchored');
      } else {
        demote('low', 'progression-break');
      }
    } else {
      pendingJumpMile = null;
      pendingJumpCount = 0;
    }

    // ---- trust is earned: HIGH needs a streak of flawless fixes --------
    let confidence: MatchConfidence = ORDER[severity];
    if (confidence === 'high') {
      highStreak += 1;
      if (highStreak < HIGH_CONFIRM_FIXES) {
        confidence = 'medium';
        reasons.push('building-confidence');
      }
    } else {
      highStreak = 0;
    }

    // ---- direction + committed-mile advance ----------------------------
    const prevCommitted = committedMile;
    if (prevCommitted !== null && confidence !== 'low' && confidence !== 'unknown') {
      recentDeltas.push(best.mile - prevCommitted);
      if (recentDeltas.length > 3) recentDeltas.shift();
    }
    const travelDirection = direction(fix.speedMph);

    const advanceEligible =
      (confidence === 'high' || confidence === 'medium') && travelDirection !== 'reverse';

    if (advanceEligible) {
      if (committedMile === null) {
        committedMile = best.mile;
      } else if (best.mile >= committedMile) {
        committedMile = best.mile;
      } else if (committedMile - best.mile > BACKWARD_JITTER_MI) {
        // A real, sustained reversal is N8d's concern; the matcher simply
        // refuses to move backwards and keeps its committed mile.
        reasons.push('backward-held');
      }
    }

    last = {
      matched: true,
      routeMile: committedMile,
      candidateMile: best.mile,
      lateralM: Number(best.lateralM.toFixed(1)),
      headingDeltaDeg: headingDelta === null ? null : Number(headingDelta.toFixed(1)),
      travelDirection,
      confidence,
      advanceEligible,
      reasons,
    };
    return last;
  }

  return { match, last: () => last };
}

/** Matcher over a validated session's full-resolution geometry (N8b). */
export function matcherFromSession(session: RouteSession): MapMatcher {
  return createMapMatcher(session.geometry);
}
