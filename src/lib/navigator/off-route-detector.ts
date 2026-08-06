/**
 * Observe-only off-route detection (milestone N8d) — decides, with high
 * confidence and at ZERO routing cost, that the truck has left the
 * planned route. This module consumes ONLY the N8c map matcher's outputs
 * plus fix metadata the caller already has; it can never contact a
 * provider, replace a route, prompt the driver, or speak — it emits
 * internal state-change events and nothing else. Route replacement is a
 * later milestone that will CONSUME these decisions.
 *
 * Off-route is NEVER declared from a single GPS fix. Confirmation
 * requires consecutive qualifying observations AND elapsed time AND the
 * absence of every suppression condition — pulling into a truck stop,
 * fuel island, weigh station, rest area, or parking lot must never look
 * like leaving the route (doc 05: the planned-stop exclusion is
 * essential; doc 06 §7: never fire within 150 m of a planned stop).
 *
 * Pure: observations arrive as arguments with their own timestamps.
 * No I/O, no clock, no timers.
 */

import type { MapMatch } from './map-matcher';
import { haversineMiles } from './geo';
import type { LatLng } from '@/lib/map/bounds';

export type OffRouteState = 'on-route' | 'suspected' | 'confirmed' | 'recovering' | 'recovered';

export type ObserveInput = {
  /** The N8c matcher's verdict for this fix — the ONLY roadway evidence. */
  match: MapMatch;
  /** Fix timestamp, epoch ms. */
  tMs: number;
  /** Fix speed; null when the platform has none. */
  speedMph: number | null;
  /**
   * Distance to the nearest PLANNED stop in meters, when the caller has
   * stops (the doc 06 §7 exclusion). Null/omitted = no stop nearby known.
   * Callers can compute it with `nearestStopDistanceM`.
   */
  nearestPlannedStopM?: number | null;
  /** Miles remaining to the destination, when the caller knows it. */
  remainingMi?: number | null;
  /**
   * Fix accuracy in meters, when the caller has it (pilot round 1). A
   * loose fix is GPS drift, not evidence of leaving the road: it can
   * never build a departure episode, though it also never dissolves one.
   */
  accuracyM?: number | null;
};

export type OffRouteEvent = {
  from: OffRouteState;
  to: OffRouteState;
  tMs: number;
  /** Matcher confidence at the transition. */
  confidence: MapMatch['confidence'];
  lateralM: number | null;
  routeMile: number | null;
  /** Consecutive qualifying observations at the time of the transition. */
  qualifyingFixes: number;
  /** Elapsed ms since the first qualifying observation of this episode. */
  elapsedMs: number;
};

export type DetectorSnapshot = {
  state: OffRouteState;
  qualifyingFixes: number;
  /** Timestamp of the first qualifying observation of this episode. */
  episodeStartMs: number | null;
  suppressed: boolean;
  suppressionReason: string | null;
};

export type OffRouteDetector = {
  observe(input: ObserveInput): DetectorSnapshot;
  state(): DetectorSnapshot;
  /** Internal event log (bounded); newest last. */
  events(): readonly OffRouteEvent[];
};

/** Every threshold is configuration — road testing will calibrate them. */
export type DetectorConfig = {
  /** Lateral distance that makes an observation qualify, meters. */
  qualifyLateralM: number;
  /** Consecutive qualifying observations required to confirm. */
  confirmFixes: number;
  /** Minimum elapsed time across those observations, ms. */
  confirmMinElapsedMs: number;
  /** Clean observations required to complete a recovery. */
  recoverFixes: number;
  /** Suppress everything below this speed (lots, fuel islands, queues). */
  suppressLowSpeedMph: number;
  /** Suppress within this distance of a planned stop, meters (doc 06 §7). */
  suppressPlannedStopM: number;
  /** Suppress low-speed approaches inside this remaining distance, miles. */
  suppressDestinationMi: number;
  /** ...when slower than this, mph. */
  suppressDestinationSpeedMph: number;
  /**
   * Highway-committed speed (pilot round 1). An episode whose every
   * qualifying observation was at or above this speed confirms on the
   * FAST thresholds below: at 45 mph the truck covers ~200 ft per second,
   * so the slow ladder spent half a mile before guidance reacted.
   */
  fastConfirmSpeedMph: number;
  fastConfirmFixes: number;
  fastConfirmMinElapsedMs: number;
  /**
   * Wrong-direction evidence (pilot round 1): the matcher's
   * 'opposing-heading' reason means the truck's bearing disagrees with
   * the route by more than a right angle — driving the planned roadway
   * the wrong way. That never moves the truck laterally off the line, so
   * without this it could never qualify. Requires real road speed, since
   * a heading below the matcher's own floor is noise.
   */
  wrongDirectionSpeedMph: number;
  /**
   * Fix accuracy beyond which an observation is drift, not evidence.
   * Null accuracy (platform has none) is trusted, as elsewhere.
   */
  maxEvidenceAccuracyM: number;
  /** Event log bound. */
  maxEvents: number;
};

export const DETECTOR_DEFAULTS: DetectorConfig = {
  qualifyLateralM: 75,
  confirmFixes: 4,
  confirmMinElapsedMs: 8_000,
  recoverFixes: 3,
  suppressLowSpeedMph: 10,
  suppressPlannedStopM: 150,
  suppressDestinationMi: 1.0,
  suppressDestinationSpeedMph: 25,
  fastConfirmSpeedMph: 45,
  fastConfirmFixes: 2,
  fastConfirmMinElapsedMs: 3_000,
  wrongDirectionSpeedMph: 20,
  maxEvidenceAccuracyM: 40,
  maxEvents: 100,
};

/** Caller helper for the planned-stop exclusion. */
export function nearestStopDistanceM(position: LatLng, stops: readonly LatLng[]): number | null {
  let best: number | null = null;
  for (const s of stops) {
    const m = haversineMiles(position, s) * 1609.344;
    if (best === null || m < best) best = m;
  }
  return best;
}

export function createOffRouteDetector(config: Partial<DetectorConfig> = {}): OffRouteDetector {
  const cfg: DetectorConfig = { ...DETECTOR_DEFAULTS, ...config };

  let state: OffRouteState = 'on-route';
  let qualifying = 0;
  let episodeStartMs: number | null = null;
  // True while EVERY qualifying observation of this episode was at
  // highway-committed speed — the fast confirmation ladder's precondition.
  let episodeAllFast = false;
  let recoverStreak = 0;
  let suppressed = false;
  let suppressionReason: string | null = null;
  const log: OffRouteEvent[] = [];

  function snapshot(): DetectorSnapshot {
    return { state, qualifyingFixes: qualifying, episodeStartMs, suppressed, suppressionReason };
  }

  function transition(to: OffRouteState, input: ObserveInput): void {
    if (to === state) return;
    const event: OffRouteEvent = {
      from: state,
      to,
      tMs: input.tMs,
      confidence: input.match.confidence,
      lateralM: input.match.lateralM,
      routeMile: input.match.routeMile,
      qualifyingFixes: qualifying,
      elapsedMs: episodeStartMs === null ? 0 : input.tMs - episodeStartMs,
    };
    log.push(event);
    if (log.length > cfg.maxEvents) log.shift();
    state = to;
  }

  /** A suppression zone means: whatever this looks like, it is not a departure. */
  function suppression(input: ObserveInput): string | null {
    if (
      input.nearestPlannedStopM !== undefined &&
      input.nearestPlannedStopM !== null &&
      input.nearestPlannedStopM <= cfg.suppressPlannedStopM
    ) {
      return 'planned-stop';
    }
    if (input.speedMph !== null && input.speedMph < cfg.suppressLowSpeedMph) {
      return 'low-speed';
    }
    if (input.match.reasons.includes('low-speed-pull-in')) return 'pull-in';
    // Backing (docks, fuel islands, parking): the truck is moving
    // opposite the route by design. Never a departure. (Pilot round 1.)
    if (input.match.travelDirection === 'reverse') return 'backing';
    if (
      input.remainingMi !== undefined &&
      input.remainingMi !== null &&
      input.remainingMi <= cfg.suppressDestinationMi &&
      input.speedMph !== null &&
      input.speedMph < cfg.suppressDestinationSpeedMph
    ) {
      return 'destination-approach';
    }
    return null;
  }

  /**
   * Does this observation look like the truck is genuinely off the
   * planned roadway? Evidence only ever comes from the matcher:
   * confidently matched near the line = no; far from the line or no
   * candidate at all, while genuinely moving = yes. Matcher-internal
   * doubt (re-anchoring after a jump, building confidence, gap resets)
   * is NOT departure evidence.
   */
  function qualifies(input: ObserveInput): boolean {
    const m = input.match;
    if (input.speedMph === null || input.speedMph < cfg.suppressLowSpeedMph) return false;
    if (m.reasons.includes('gap-reset')) return false;
    // A loose fix is drift, not a departure (pilot round 1). It cannot
    // build evidence; `clean()` still governs whether it dissolves one.
    if (
      input.accuracyM !== undefined &&
      input.accuracyM !== null &&
      input.accuracyM > cfg.maxEvidenceAccuracyM
    ) {
      return false;
    }
    if (!m.matched) return m.confidence === 'unknown'; // beyond every candidate bound
    if (m.lateralM !== null && m.lateralM > cfg.qualifyLateralM) return true;
    // Wrong direction on the planned roadway (pilot round 1): the truck
    // is on the line, so lateral distance says nothing — the matcher's
    // opposing-heading verdict is the only evidence there is.
    if (m.reasons.includes('opposing-heading') && input.speedMph >= cfg.wrongDirectionSpeedMph) {
      return true;
    }
    return false;
  }

  /** Highway-committed: a departure at this speed is deliberate, not drift. */
  function isFast(input: ObserveInput): boolean {
    return input.speedMph !== null && input.speedMph >= cfg.fastConfirmSpeedMph;
  }

  /** A clean observation: confidently matched, near the line. */
  function clean(input: ObserveInput): boolean {
    const m = input.match;
    return (
      m.matched &&
      (m.confidence === 'high' || m.confidence === 'medium') &&
      m.lateralM !== null &&
      m.lateralM <= cfg.qualifyLateralM
    );
  }

  function observe(input: ObserveInput): DetectorSnapshot {
    suppressionReason = suppression(input);
    suppressed = suppressionReason !== null;

    // A gap (tunnel, GPS loss) invalidates any half-built episode: the
    // evidence chain must be continuous.
    if (
      input.match.reasons.includes('gap-reset') &&
      (state === 'suspected' || state === 'recovering')
    ) {
      qualifying = 0;
      episodeStartMs = null;
      episodeAllFast = false;
      recoverStreak = 0;
      transition(state === 'suspected' ? 'on-route' : 'confirmed', input);
      return snapshot();
    }

    const q = !suppressed && qualifies(input);
    const c = clean(input);

    switch (state) {
      case 'on-route':
      case 'recovered': {
        if (state === 'recovered') {
          // 'recovered' is a one-observation acknowledgment state.
          transition('on-route', input);
        }
        if (q) {
          qualifying = 1;
          episodeStartMs = input.tMs;
          episodeAllFast = isFast(input);
          transition('suspected', input);
        } else {
          qualifying = 0;
          episodeStartMs = null;
          episodeAllFast = false;
        }
        break;
      }
      case 'suspected': {
        if (suppressed) {
          // Entering a suppression zone mid-episode: this was a stop
          // approach, not a departure. Stand down entirely.
          qualifying = 0;
          episodeStartMs = null;
          episodeAllFast = false;
          transition('on-route', input);
          break;
        }
        if (q) {
          qualifying += 1;
          episodeAllFast = episodeAllFast && isFast(input);
          const elapsed = episodeStartMs === null ? 0 : input.tMs - episodeStartMs;
          const needFixes = episodeAllFast ? cfg.fastConfirmFixes : cfg.confirmFixes;
          const needElapsed = episodeAllFast
            ? cfg.fastConfirmMinElapsedMs
            : cfg.confirmMinElapsedMs;
          if (qualifying >= needFixes && elapsed >= needElapsed) {
            transition('confirmed', input);
          }
        } else if (c) {
          // False-positive prevention: one confident on-line observation
          // before confirmation dissolves the episode.
          qualifying = 0;
          episodeStartMs = null;
          episodeAllFast = false;
          transition('on-route', input);
        }
        // Ambiguous observations (neither qualifying nor clean) hold the
        // episode without growing it — never confirm on doubt.
        break;
      }
      case 'confirmed': {
        if (c) {
          recoverStreak = 1;
          transition('recovering', input);
        }
        break;
      }
      case 'recovering': {
        if (c && input.match.advanceEligible) {
          recoverStreak += 1;
          if (recoverStreak >= cfg.recoverFixes) {
            qualifying = 0;
            episodeStartMs = null;
            episodeAllFast = false;
            recoverStreak = 0;
            transition('recovered', input);
          }
        } else if (q) {
          recoverStreak = 0;
          transition('confirmed', input);
        }
        break;
      }
    }

    return snapshot();
  }

  return { observe, state: snapshot, events: () => log.slice() };
}
