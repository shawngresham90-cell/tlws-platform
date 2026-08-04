/**
 * Navigator core object models (Phase 1: milestones N0–N3 of the
 * docs/navigator architecture package, PR #221). Pure types — no runtime
 * code, no network, no database, no browser globals. Every time value is
 * epoch milliseconds; distances are statute miles unless a field name says
 * meters. The core never reads a clock itself: callers supply all
 * timestamps, which keeps every module deterministic and offline-testable —
 * the same rule `src/lib/trip-planner/types.ts` establishes.
 *
 * Privacy invariant (AD-7): position values exist in memory for the session
 * only. Nothing in this layer may persist, log, or transmit them, and no
 * type here is ever written to storage.
 */

/** One raw geolocation sample as delivered by a GeolocationPort adapter. */
export type RawGeoFix = {
  lat: number;
  lng: number;
  /** Reported 68%-confidence radius, meters. */
  accuracyM: number;
  /** Device-reported ground speed in meters/second, when the platform has one. */
  speedMps: number | null;
  /** Device-reported heading in degrees clockwise from true north. */
  headingDeg: number | null;
  /** Sample timestamp, epoch ms — supplied by the platform, never read here. */
  tMs: number;
};

/** A gated, accepted fix — the only position shape downstream code sees. */
export type PositionFix = {
  lat: number;
  lng: number;
  accuracyM: number;
  tMs: number;
  /** Miles/hour; null until a second gated fix allows derivation (never from one fix). */
  speedMph: number | null;
  /** Degrees clockwise from true north; null until derivable. */
  headingDeg: number | null;
};

/**
 * GPS health vocabulary (architecture doc 04 §2).
 * `unknown-is-locked` semantics belong to the N4 safety lock, not here.
 */
export type PositionHealth = 'good' | 'degraded' | 'lost' | 'denied' | 'unavailable';

/** The GPS session snapshot. Owned solely by the GPS session (one writer). */
export type PositionState = {
  /** Latest gated fix; held through `degraded`, cleared on reset. */
  fix: PositionFix | null;
  health: PositionHealth;
  /** tMs of the last ACCEPTED fix; 0 before the first. */
  lastFixMs: number;
  /** Accuracy of the last accepted fix, meters; NaN before the first. */
  accuracyM: number;
  speedMph: number | null;
  headingDeg: number | null;
  /**
   * Phase 1 constant `false`. Dead-reckoning advancement (doc 05 §1) needs an
   * on-route navigation session and controller ticks — that is N5 engine
   * behavior. The field exists now so the state shape is stable.
   */
  deadReckoning: boolean;
};

/** Errors a geolocation adapter can surface, normalized. */
export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout';

/** Route-tracker snapshot (doc 04 §3): route-mile is monotonic by construction. */
export type TrackerState = {
  /** Cumulative miles from origin along the route. Never decreases except a confirmed reversal. */
  routeMile: number;
  remainingMi: number;
  /** Distance from the route at the last projection; null while unprojectable. */
  offRouteMiles: number | null;
  /** 'low' while unprojectable or while holding against back-projection. */
  confidence: 'high' | 'low';
  /** Consecutive backward projections currently being held (0 when tracking normally). */
  heldBackwardFixes: number;
};
