import type { Route, StopCandidate, RemainingClocks } from './types';
import type { RouteTiming } from './route-time-axis';
import { HOS } from './types';
import { NEED_CATEGORIES, hasConfirmedTruckParking, scoreCandidate } from './directory-layer';

/**
 * Last Stop selection (docs/trip-planner/last-stop-engine.md) — the named
 * slots layered OVER the organic itinerary, never replacing it. Pure and
 * deterministic; the caller supplies route, candidates, and driver-stated
 * clocks.
 *
 * Safety invariant (the product's contract): reachability is a FILTER,
 * never a score weight. A stop whose projected arrival falls outside
 * min(11-hr driving, 14-hr window) minus the safety buffer can never
 * appear in any slot — commission cannot outrank safety by construction.
 * Conservative wall-clock model: if the drive to a stop crosses the
 * 8-hour break clock, the required 30-minute break burns the 14-hour
 * window on the way (the trap new drivers miss).
 */

/*
 * ONE SAFETY BUFFER IN THE WHOLE SYSTEM.
 *
 * This module used to declare its own 30-minute default while
 * `drive-window.ts` declared a 45-minute one under the SAME NAME. Nothing
 * caught it, because each file's tests only ever saw its own constant —
 * and the two met for the first time on the results screen, where the
 * plan was computed against 30 minutes and captioned with whichever
 * preset the driver had tapped.
 *
 * A buffer is the margin a driver decides not to gamble. It cannot have
 * two values, so it is declared once, in the module that owns the drive
 * window, and re-exported here for the callers that already import it
 * from this path.
 */
import { DEFAULT_SAFETY_BUFFER_MIN } from './drive-window';
export { DEFAULT_SAFETY_BUFFER_MIN };

export type SlotLabel = 'best-reservable' | 'last-reservable' | 'backup-reservable' | 'last-free';

export type LastStopSlot = {
  label: SlotLabel;
  candidate: StopCandidate;
  /** Minutes of driving from departure to this stop (per-leg speeds). */
  driveMinutes: number;
  /** Projected arrival, epoch ms (includes a 30-min break when one is due en route). */
  arriveAtMs: number;
  /** The tighter of driving/window minutes still available on arrival. */
  hosRemainingMinAtArrival: number;
  /** Rough round-trip detour estimate from off-route miles (~2 min/mile). */
  detourMinutesEstimate: number;
  /** One-sentence driver-language reason — templated, never free-form. */
  reason: string;
};

export type LastStopResult = {
  /** min(driving, window) − buffer, floored at 0. */
  usableDriveMin: number;
  bufferMin: number;
  slots: LastStopSlot[];
  /** True when zero reservable candidates exist along the corridor at all. */
  noReservableOnCorridor: boolean;
  /**
   * False when the provider gave no usable timing for this route. Slots is
   * then empty BY REFUSAL, not because nothing was found — a distinction a
   * driver must be able to see, because "no parking within your clock" and
   * "we could not work out when you get there" call for different actions.
   */
  timingAvailable: boolean;
  /** Why timing was unavailable, when it was. */
  timingProblem?: string;
  /**
   * EVERY candidate that cleared the safety filter, best-scored first.
   *
   * `slots` answers a different question — the four NAMED slots (last
   * reservable, best reservable, backup, last free) that the original
   * Last Stop product is built around. Plan My Day promises a ranked top
   * three instead, and deriving that from the named slots silently caps
   * a free-parking corridor at one option. Both views come from the same
   * filtered set, so they can never disagree about what is reachable.
   */
  eligible: EligibleStop[];
};

export type EligibleStop = {
  candidate: StopCandidate;
  driveMinutes: number;
  arriveAtMs: number;
  hosRemainingMinAtArrival: number;
  detourMinutesEstimate: number;
  score: number;
};

/** The sentence shown when eligibility could not be determined. */
export const TIMING_UNAVAILABLE_NOTICE =
  'Cannot determine parking safely — the route provider did not return usable travel times.';

/** Minutes to drive from origin to `toMile` using per-leg average speeds. */
export function driveMinutesToMile(route: Route, toMile: number): number {
  let minutes = 0;
  let acc = 0;
  for (const leg of route.legs) {
    const legStart = acc;
    acc += leg.distanceMiles;
    const to = Math.min(toMile, acc);
    if (to > legStart) minutes += ((to - legStart) / leg.avgSpeedMph) * 60;
    if (acc >= toMile) break;
  }
  return Math.round(minutes);
}

type Reach = {
  driveMinutes: number;
  wallClockMinutes: number;
  hosRemainingMinAtArrival: number;
};

/**
 * Conservative reachability inside the driver's stated clocks minus the
 * buffer. Returns null when the stop is NOT safely reachable.
 */
export function reachWithinClocks(
  timing: RouteTiming,
  clocks: RemainingClocks,
  routeMile: number,
  bufferMin: number,
): Reach | null {
  /*
   * NO TIMING, NO ELIGIBILITY.
   *
   * The engine's promise is "you can legally park here". That sentence
   * needs the provider's travel times; an assumed average speed puts the
   * stop CLOSER in time than the truck will actually reach it, and does
   * so worst exactly when traffic is bad — handing a driver a stop they
   * cannot make on the day they most needed the warning. So a caller
   * without provider timing gets nothing, not an estimate.
   */
  if (timing.kind !== 'provider') return null;
  // Fail CLOSED on any non-finite input: NaN comparisons are all false, so
  // without this guard a corrupted clock would pass the filter as
  // "reachable" — the exact inversion this safety layer exists to prevent.
  if (
    !Number.isFinite(clocks.drivingMin) ||
    !Number.isFinite(clocks.windowMin) ||
    !Number.isFinite(clocks.untilBreakMin) ||
    !Number.isFinite(routeMile) ||
    !Number.isFinite(bufferMin)
  ) {
    return null;
  }
  const window = timing.minutesToMile(routeMile);
  if (window === null) return null;
  const { earliestMin, latestMin } = window;
  if (!Number.isFinite(earliestMin) || !Number.isFinite(latestMin)) return null;
  void earliestMin;

  /*
   * DECIDE ON THE WORST CASE. `latestMin` is the late end of the provider
   * window; a stop only counts as reachable if it is reachable even then.
   * `earliestMin` is used solely to detect the straddle below.
   */
  const passes = (driveMinutes: number) => {
    // A required 30-minute break extends wall-clock time (and burns the
    // 14-hour window) when the drive crosses the break clock.
    const breakMinutes = driveMinutes > clocks.untilBreakMin ? HOS.MIN_BREAK_MIN : 0;
    const wallClockMinutes = driveMinutes + breakMinutes;
    const drivingLeft = clocks.drivingMin - driveMinutes;
    const windowLeft = clocks.windowMin - wallClockMinutes;
    return {
      ok: drivingLeft >= bufferMin && windowLeft >= bufferMin,
      wallClockMinutes,
      hosRemainingMinAtArrival: Math.min(drivingLeft, windowLeft),
    };
  };

  /*
   * A coarse window that STRADDLES the deadline — reachable at the early
   * end, not at the late one — is excluded here by construction, because
   * failing on `latestMin` returns null. That is the conservative half of
   * the choice between excluding such a stop and offering it as a marked
   * maybe: a slot says "you can legally park here", and a maybe cannot
   * carry that sentence. Deciding on the worst case is the whole rule,
   * and it needs no second flag to enforce it.
   */
  const worst = passes(latestMin);
  if (!worst.ok) return null;

  return {
    driveMinutes: Math.round(latestMin),
    wallClockMinutes: worst.wallClockMinutes,
    hosRemainingMinAtArrival: worst.hosRemainingMinAtArrival,
  };
}

const PARKING_CATEGORIES = new Set(NEED_CATEGORIES.overnight);

/**
 * One row per physical place. See the call site for why: a driver offered
 * the same lot three times has been offered one option, not three.
 */
function dedupeByPlace<T extends { candidate: StopCandidate }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const c = row.candidate;
    const byId = `id:${c.id}`;
    // ~100 m: close enough that two records are the same lot, far enough
    // that neighbouring stops on the same exit stay distinct.
    const byPlace = `at:${c.name.trim().toLowerCase()}@${c.position.lat.toFixed(3)},${c.position.lng.toFixed(3)}`;
    if (seen.has(byId) || seen.has(byPlace)) continue;
    seen.add(byId);
    seen.add(byPlace);
    out.push(row);
  }
  return out;
}

const fmtHm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
};

function toSlot(
  label: SlotLabel,
  candidate: StopCandidate,
  reach: Reach,
  departAtMs: number,
  bufferMin: number,
): LastStopSlot {
  const reasons: Record<SlotLabel, string> = {
    'last-reservable': `Last reservable parking option before your ${bufferMin}-minute HOS safety buffer.`,
    'best-reservable': `Best-scored reservable parking you can safely reach — ${fmtHm(
      reach.hosRemainingMinAtArrival,
    )} left on your clock at arrival.`,
    'backup-reservable': 'Earlier reservable backup — more clock in hand if plans change.',
    'last-free': `Furthest free parking inside your window — ${fmtHm(
      reach.hosRemainingMinAtArrival,
    )} left at arrival.`,
  };
  return {
    label,
    candidate,
    driveMinutes: reach.driveMinutes,
    arriveAtMs: departAtMs + reach.wallClockMinutes * 60_000,
    hosRemainingMinAtArrival: reach.hosRemainingMinAtArrival,
    detourMinutesEstimate: Math.max(1, Math.round(candidate.offRouteMiles * 2)),
    reason: reasons[label],
  };
}

/**
 * Select the named Last Stop slots. Candidates must already be
 * route-positioned (`toStopCandidates`). Deduplicates: a candidate appears
 * in at most one slot (priority: last-reservable, best-reservable,
 * backup-reservable, last-free).
 */
export function selectLastStops(args: {
  /**
   * REQUIRED, and the reason this signature changed. Eligibility used to
   * come from `route`'s per-leg average speeds; it now comes from the
   * provider's own timings, or not at all. Passing
   * `timingUnavailable(reason)` yields an empty, clearly-labelled result
   * rather than a plausible one — which is what a straight-line estimate
   * must produce.
   */
  timing: RouteTiming;
  candidates: StopCandidate[];
  clocks: RemainingClocks;
  departAtMs: number;
  bufferMin?: number;
}): LastStopResult {
  const bufferMin = args.bufferMin ?? DEFAULT_SAFETY_BUFFER_MIN;

  // Zero-space safety rule: every Last Stop slot tells a driver "you can
  // legally park here", so a listing without a confirmed positive space
  // count (zero, negative, null, or non-numeric) can never enter ANY slot —
  // reservable or free — regardless of category or score.
  const parkingCandidates = args.candidates.filter(
    (c) => PARKING_CATEGORIES.has(c.categorySlug) && hasConfirmedTruckParking(c.parkingSpaces),
  );
  const reservableAll = parkingCandidates.filter((c) => c.reservationUrl);

  /*
   * EXISTENCE IS KNOWABLE WITHOUT TIMING; REACHABILITY IS NOT.
   *
   * Whether any reservable parking sits on this corridor is a property of
   * the directory, so it is computed above the timing guard and reported
   * either way. Only "can this driver get there in time" needs provider
   * travel times, and that is what goes silent below.
   */
  if (args.timing.kind !== 'provider') {
    return {
      usableDriveMin: 0,
      bufferMin,
      slots: [],
      noReservableOnCorridor: reservableAll.length === 0,
      timingAvailable: false,
      timingProblem: args.timing.reason,
      eligible: [],
    };
  }
  const timing = args.timing;
  const rawUsable = Math.min(args.clocks.drivingMin, args.clocks.windowMin) - bufferMin;
  const usableDriveMin = Number.isFinite(rawUsable) ? Math.max(0, rawUsable) : 0;

  type Scored = { candidate: StopCandidate; reach: Reach; score: number };
  const reachable = (list: StopCandidate[]): Scored[] =>
    list
      .map((candidate) => ({
        candidate,
        reach: reachWithinClocks(timing, args.clocks, candidate.routeMile, bufferMin),
        score: scoreCandidate(candidate, 'overnight').total,
      }))
      .filter((r): r is Scored => r.reach !== null);

  /*
   * SAFETY ELIGIBILITY FIRST, PREFERENCES SECOND. `reachable` applies the
   * hard filter — worst-case arrival inside the buffered deadline — and
   * only what survives it is ever scored or ordered below.
   */
  const reservable = reachable(reservableAll);
  // Free = the directory explicitly says free. Unknown is never assumed free.
  const free = reachable(parkingCandidates.filter((c) => c.freeParking === true));

  const slots: LastStopSlot[] = [];
  const used = new Set<string>();
  /** Take the first not-yet-used pick from an ordered preference list. */
  const takeFirst = (label: SlotLabel, ordered: Scored[]) => {
    const pick = ordered.find((p) => !used.has(p.candidate.id));
    if (!pick) return undefined;
    used.add(pick.candidate.id);
    slots.push(toSlot(label, pick.candidate, pick.reach, args.departAtMs, bufferMin));
    return pick;
  };

  const byScore = (a: Scored, b: Scored) =>
    b.score - a.score || a.candidate.offRouteMiles - b.candidate.offRouteMiles;
  const byFurthest = (a: Scored, b: Scored) => b.candidate.routeMile - a.candidate.routeMile;

  // Last reservable: furthest along before the buffer.
  const lastReservable = takeFirst('last-reservable', [...reservable].sort(byFurthest));

  // Best reservable: highest organic score (ties: fewer off-route miles),
  // preferring the back half of the usable window — the product answers
  // "where do I stop before my clock dies", not "what's near my departure".
  // Falls back through the overall list when the back half is empty/used.
  const backHalf = reservable.filter((r) => r.reach.driveMinutes >= usableDriveMin / 2);
  takeFirst('best-reservable', [...[...backHalf].sort(byScore), ...[...reservable].sort(byScore)]);

  // Backup reservable: best-scored option 15–45 drive-minutes before the
  // furthest chosen reservable stop (more clock in hand).
  if (lastReservable) {
    const anchorMin = lastReservable.reach.driveMinutes;
    takeFirst(
      'backup-reservable',
      reservable
        .filter(
          (r) => r.reach.driveMinutes >= anchorMin - 45 && r.reach.driveMinutes <= anchorMin - 15,
        )
        .sort(byScore),
    );
  }

  // Last free: furthest explicitly-free stop inside the window.
  takeFirst('last-free', [...free].sort(byFurthest));

  return {
    usableDriveMin,
    bufferMin,
    slots,
    noReservableOnCorridor: reservableAll.length === 0,
    timingAvailable: true,
    /*
     * Safety first, preference second — again. This list is the SAME
     * filtered set the slots came from, merely ordered by score, so a
     * caller taking the top three can never receive a stop the filter
     * rejected.
     *
     * DEDUPLICATED BY PLACE, NOT BY ROW. The directory can hold the same
     * physical truck stop twice — a re-submission, a chain rename, two
     * scrapes of one lot — and showing a driver "three options" that are
     * one lot listed three times is the same broken promise as padding
     * the list. Identity is the record id first, then name plus rounded
     * position (~100 m), which catches the duplicate rows that carry
     * different ids. The FIRST occurrence survives, and because this runs
     * after the sort that is always the best-scored of the duplicates.
     */
    eligible: dedupeByPlace(reachable(parkingCandidates).sort(byScore)).map((r) => ({
      candidate: r.candidate,
      driveMinutes: r.reach.driveMinutes,
      arriveAtMs: args.departAtMs + r.reach.wallClockMinutes * 60_000,
      hosRemainingMinAtArrival: r.reach.hosRemainingMinAtArrival,
      detourMinutesEstimate: Math.max(1, Math.round(r.candidate.offRouteMiles * 2)),
      score: r.score,
    })),
  };
}
