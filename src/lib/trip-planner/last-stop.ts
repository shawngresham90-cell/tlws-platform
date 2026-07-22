import type { Route, StopCandidate, RemainingClocks } from './types';
import { HOS } from './types';
import { NEED_CATEGORIES, scoreCandidate } from './directory-layer';

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

export const DEFAULT_SAFETY_BUFFER_MIN = 30;

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
};

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
  route: Route,
  clocks: RemainingClocks,
  routeMile: number,
  bufferMin: number,
): Reach | null {
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
  const driveMinutes = driveMinutesToMile(route, routeMile);
  if (!Number.isFinite(driveMinutes)) return null;
  // A required 30-minute break extends wall-clock time (and burns the
  // 14-hour window) when the drive crosses the break clock.
  const breakMinutes = driveMinutes > clocks.untilBreakMin ? HOS.MIN_BREAK_MIN : 0;
  const wallClockMinutes = driveMinutes + breakMinutes;
  const drivingLeft = clocks.drivingMin - driveMinutes;
  const windowLeft = clocks.windowMin - wallClockMinutes;
  if (!(drivingLeft >= bufferMin && windowLeft >= bufferMin)) return null;
  return {
    driveMinutes,
    wallClockMinutes,
    hosRemainingMinAtArrival: Math.min(drivingLeft, windowLeft),
  };
}

const PARKING_CATEGORIES = new Set(NEED_CATEGORIES.overnight);

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
  route: Route;
  candidates: StopCandidate[];
  clocks: RemainingClocks;
  departAtMs: number;
  bufferMin?: number;
}): LastStopResult {
  const bufferMin = args.bufferMin ?? DEFAULT_SAFETY_BUFFER_MIN;
  const rawUsable = Math.min(args.clocks.drivingMin, args.clocks.windowMin) - bufferMin;
  const usableDriveMin = Number.isFinite(rawUsable) ? Math.max(0, rawUsable) : 0;

  const parkingCandidates = args.candidates.filter((c) => PARKING_CATEGORIES.has(c.categorySlug));
  const reservableAll = parkingCandidates.filter((c) => c.reservationUrl);

  type Scored = { candidate: StopCandidate; reach: Reach; score: number };
  const reachable = (list: StopCandidate[]): Scored[] =>
    list
      .map((candidate) => ({
        candidate,
        reach: reachWithinClocks(args.route, args.clocks, candidate.routeMile, bufferMin),
        score: scoreCandidate(candidate, 'overnight').total,
      }))
      .filter((r): r is Scored => r.reach !== null);

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
  };
}
