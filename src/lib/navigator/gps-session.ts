/**
 * GPSSessionManager (Navigator milestone N2) — the gating layer between raw
 * geolocation samples and everything downstream. Pure: fixes, errors and
 * time arrive as arguments (the adapter in the component layer owns the
 * actual `watchPosition` subscription); nothing here reads a clock, touches
 * the browser, or persists anything (AD-7: position lives in memory for the
 * session and nowhere else).
 *
 * Gates, exactly as specified in docs/navigator 04 §2 and 05 §1 (PR #221):
 *
 *   accuracy > 50 m            -> discard; hold last good fix; health 'degraded'
 *   implied speed > 100 mph    -> discard as spurious (position teleport)
 *   no accepted fix for > 10 s -> health 'lost' (caller drives this via tick())
 *   speed                      -> device speed if present, else derived from
 *                                 the previous ACCEPTED fix; never from one fix
 *   heading                    -> device heading if present, else bearing from
 *                                 the previous accepted fix
 *
 * Dead reckoning (advancing route-mile through a signal gap) needs an
 * on-route navigation session and controller ticks — that is N5 engine
 * behavior. `deadReckoning` is carried as a stable field and is always
 * `false` in Phase 1.
 */

import type { GeoErrorKind, PositionFix, PositionState, RawGeoFix } from './types';
import { bearingDeg, haversineMiles } from './geo';

export const MAX_ACCURACY_M = 50;
export const STALE_AFTER_MS = 10_000;
export const MAX_IMPLIED_SPEED_MPH = 100;

const MPS_TO_MPH = 2.236936;

const INITIAL_STATE: PositionState = {
  fix: null,
  health: 'unavailable',
  lastFixMs: 0,
  accuracyM: Number.NaN,
  speedMph: null,
  headingDeg: null,
  deadReckoning: false,
};

export type GpsSession = {
  /** Gate one raw sample; returns the resulting snapshot. */
  ingestFix(raw: RawGeoFix): PositionState;
  /** Normalize a platform error into health. */
  ingestError(kind: GeoErrorKind): PositionState;
  /** Caller-driven staleness check ('now' is supplied, never read). */
  tick(nowMs: number): PositionState;
  /** Drop everything — used when the watch stops. Position is ephemeral. */
  reset(): PositionState;
  state(): PositionState;
};

function isFiniteCoord(raw: RawGeoFix): boolean {
  return (
    Number.isFinite(raw.lat) &&
    Number.isFinite(raw.lng) &&
    Math.abs(raw.lat) <= 90 &&
    Math.abs(raw.lng) <= 180 &&
    Number.isFinite(raw.accuracyM) &&
    raw.accuracyM >= 0 &&
    Number.isFinite(raw.tMs)
  );
}

export function createGpsSession(): GpsSession {
  let state: PositionState = INITIAL_STATE;

  function ingestFix(raw: RawGeoFix): PositionState {
    if (!isFiniteCoord(raw)) return state; // malformed sample: ignore entirely

    // Accuracy gate: discard and hold the last good fix. A REJECTED sample
    // may only ever downgrade `good` to `degraded` — it must not resurrect
    // a `lost` fix as "approximate current position" (that produced a 1 Hz
    // lost/degraded flap in audit), and with no fix held there is nothing
    // to describe as degraded, so acquisition states pass through
    // unchanged. Same-state samples return the same reference so the
    // provider's setState bails out.
    if (raw.accuracyM > MAX_ACCURACY_M) {
      if (state.fix !== null && state.health === 'good') {
        state = { ...state, health: 'degraded' };
      }
      return state;
    }

    const prev = state.fix;

    // Out-of-order or duplicate timestamps make speed math meaningless —
    // and a stream replaying the past is spurious by definition.
    if (prev && raw.tMs <= prev.tMs) return state;

    // Jump gate: a fix implying > 100 mph from the last ACCEPTED fix is a
    // teleport, not a truck. Discarded without touching health — the next
    // plausible fix resumes normally.
    if (prev) {
      const dtHours = (raw.tMs - prev.tMs) / 3_600_000;
      const impliedMph = haversineMiles(prev, raw) / dtHours;
      if (impliedMph > MAX_IMPLIED_SPEED_MPH) return state;
    }

    // Speed: device value wins; otherwise derive from the previous accepted
    // fix. Never from a single fix — the first fix reports null.
    let speedMph: number | null = null;
    if (raw.speedMps !== null && Number.isFinite(raw.speedMps) && raw.speedMps >= 0) {
      speedMph = raw.speedMps * MPS_TO_MPH;
    } else if (prev) {
      const dtHours = (raw.tMs - prev.tMs) / 3_600_000;
      speedMph = haversineMiles(prev, raw) / dtHours;
    }

    let headingDeg: number | null = null;
    if (raw.headingDeg !== null && Number.isFinite(raw.headingDeg)) {
      headingDeg = ((raw.headingDeg % 360) + 360) % 360;
    } else if (prev && (prev.lat !== raw.lat || prev.lng !== raw.lng)) {
      headingDeg = bearingDeg(prev, raw);
    }

    const fix: PositionFix = {
      lat: raw.lat,
      lng: raw.lng,
      accuracyM: raw.accuracyM,
      tMs: raw.tMs,
      speedMph,
      headingDeg,
    };
    state = {
      fix,
      health: 'good',
      lastFixMs: raw.tMs,
      accuracyM: raw.accuracyM,
      speedMph,
      headingDeg,
      deadReckoning: false,
    };
    return state;
  }

  function ingestError(kind: GeoErrorKind): PositionState {
    if (kind === 'denied') {
      // Fail-safe: denial clears position outright. Navigation cannot start.
      state = { ...INITIAL_STATE, health: 'denied' };
      return state;
    }
    // unavailable, or timeout: with a fix in hand a timeout is a gap
    // (lost); with none, the platform simply has nothing yet. Repeats of
    // the same condition return the same reference (no render churn).
    const next: PositionState['health'] =
      kind === 'unavailable' ? 'unavailable' : state.fix ? 'lost' : 'unavailable';
    if (state.health !== next) state = { ...state, health: next };
    return state;
  }

  function tick(nowMs: number): PositionState {
    if (
      state.fix &&
      (state.health === 'good' || state.health === 'degraded') &&
      nowMs - state.lastFixMs > STALE_AFTER_MS
    ) {
      state = { ...state, health: 'lost' };
    }
    return state;
  }

  function reset(): PositionState {
    state = INITIAL_STATE;
    return state;
  }

  return { ingestFix, ingestError, tick, reset, state: () => state };
}
