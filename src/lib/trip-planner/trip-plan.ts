import type { RemainingClocks } from './types';
import type { RouteTiming } from './route-time-axis';
import type { BreakPlan } from './break-plan';
import type { ParkingChoice } from './plan-my-day';
import type { TripLeg } from './route-legs';
import { driveWindow, type BindingRule } from './drive-window';
import { reachWithinClocks } from './last-stop';

/**
 * The chronological trip plan (TP-2) — the smallest event model that can
 * answer one question honestly:
 *
 *   "Given the clocks I have RIGHT NOW, what is the next legally
 *    reachable part of my trip, where should I stop if I cannot finish
 *    it, and when do I need to update my clocks before planning farther?"
 *
 * Pure. No clock, no I/O, no React.
 *
 * THE ONE RULE EVERYTHING HERE OBEYS: the planner knows only the clocks
 * the driver entered. It may SUBTRACT the time the planned drive
 * consumes; it may never ADD time the driver has not earned. There is no
 * assumed 10-hour reset, no 34-hour restart, no sleeper split, no recap
 * projection — after a real stop the future clock state is simply not
 * knowable from here, and the plan says so out loud instead of guessing.
 *
 * WHAT A PLAN THEREFORE COVERS: exactly one continuous driving stretch,
 * from departure to either the destination (when the current clocks
 * legally cover the whole drive) or a chosen parking stop before the
 * buffered cutoff. A via waypoint is a point the route passes THROUGH —
 * the provider times it as continuous driving — so it appears as a
 * chronological event, not as a rest. Whatever lies beyond the plan's
 * final stop is deliberately absent: rendering it would present
 * unearned hours as a plan.
 *
 * Every arrival time here is departure + PROVIDER driving time, decided
 * on the worst end of the provider's own window (the same conservative
 * rule parking eligibility uses). Nothing in this module converts a
 * distance to a time.
 */

/** The boundary sentence — the plan's honest edge, shown verbatim. */
export const CLOCK_UPDATE_NOTICE =
  'Update your clocks after this stop to continue the HOS-aware plan.';

/** Why the boundary exists, for the line under it. */
export const NO_PROJECTED_CLOCKS_NOTICE =
  'The planner never predicts your clocks after a rest — no 10-hour reset or recap is assumed. ' +
  'Enter your clocks again when you are back on duty.';

/** Shown when the destination is reachable but with less than the buffer. */
export const TIGHT_ARRIVAL_NOTICE =
  'You arrive with less than your safety buffer in hand. Consider stopping earlier.';

/** Shown when no qualified parking fits inside the buffered window. */
export const NO_PARKING_BEFORE_CUTOFF_NOTICE =
  'No qualified parking fits inside your buffered driving window. ' +
  'Only verified locations with confirmed truck parking are ever offered.';

export type TripPlanEvent =
  | { kind: 'start'; label: string; atMs: number }
  | {
      kind: 'break';
      /** Driving minutes from departure to the aimed-for break. */
      targetMin: number;
      /** Route mile at that time, when the provider timing places one. */
      targetMile: number | null;
      /** Worst-case wall-clock arrival there, epoch ms. */
      byMs: number;
      coarse: boolean;
    }
  | {
      kind: 'via';
      label: string;
      /** Route mile where the via falls (provider section boundary). */
      mile: number;
      /** Provider-timed passage, epoch ms (exact section-sum seconds). */
      atMs: number;
    }
  | {
      kind: 'parking';
      /** The top qualified choice — same list the parking cards render. */
      choice: ParkingChoice;
      /** How many further qualified choices exist beyond this one. */
      alternatives: number;
    }
  | { kind: 'no-parking'; notice: string }
  | {
      kind: 'destination';
      label: string;
      mile: number;
      /** Worst-case provider-timed arrival, epoch ms. */
      arriveByMs: number;
      /** Minutes left on the tightest clock at that arrival (subtraction only). */
      clockLeftMin: number;
      /** True when that margin is at least the driver's chosen buffer. */
      withinBuffer: boolean;
    }
  | { kind: 'clock-update'; notice: string; detail: string };

/** One leg of the drive, for the leg summary line. */
export type TripLegSummary = {
  index: number;
  fromLabel: string;
  toLabel: string;
  startMile: number;
  endMile: number;
  driveMinutes: number;
};

export type TripPlan =
  | {
      status: 'reachable' | 'not-reachable';
      /** The rule that binds this snapshot (driveWindow's answer). */
      limitedBy: BindingRule;
      /** The driver's buffer the plan was computed against. */
      bufferMin: number;
      /** Chronological, ascending. The last event is the plan's honest end. */
      events: TripPlanEvent[];
      /** Provider leg boundaries; one entry without a via, two with one. */
      legs: TripLegSummary[];
    }
  | {
      status: 'unavailable';
      why: 'clocks-not-set' | 'clocks-refused' | 'timing-unavailable';
      reason: string;
    };

/**
 * Assemble the chronological plan from pieces that already exist: the
 * whole-route provider timing, `driveWindow`'s binding rule, `planBreak`'s
 * placement, and the SAME ranked parking list the parking cards render —
 * one selection, so the timeline and the cards can never disagree.
 */
export function buildTripPlan(input: {
  /** Whole-route provider timing (composeQuote's single axis). */
  timing: RouteTiming;
  /** Driver-entered clocks at departure, or null when unset. */
  clocks: RemainingClocks | null;
  /** The buffer the caller resolved — Plan My Day always passes 60. */
  bufferMin: number;
  departAtMs: number;
  /** Provider route length in miles (summary value). */
  totalMiles: number;
  /** Provider leg slices (route-legs.ts). */
  legs: TripLeg[];
  labels: { origin: string; via: string | null; destination: string };
  /** The break the plan already placed (plan-my-day). */
  breakPlan: BreakPlan | null;
  /** The ranked qualified parking the cards render (plan-my-day). */
  parking: readonly ParkingChoice[];
}): TripPlan {
  const { timing, clocks, departAtMs, labels } = input;

  if (clocks === null) {
    return {
      status: 'unavailable',
      why: 'clocks-not-set',
      reason: 'Clocks not set — enter your remaining hours for an HOS-aware plan.',
    };
  }
  if (timing.kind !== 'provider') {
    return { status: 'unavailable', why: 'timing-unavailable', reason: timing.reason };
  }

  const window = driveWindow(clocks, input.bufferMin);
  if ('ok' in window) {
    return { status: 'unavailable', why: 'clocks-refused', reason: window.problem };
  }

  /*
   * DESTINATION REACHABILITY — the legal test, on provider time.
   *
   * `reachWithinClocks` with a ZERO buffer asks exactly "can these clocks
   * legally cover the worst-case provider drive time, break charge
   * included, on every rule — driving, window and cycle". The buffer is a
   * parking-search margin, not extra law, so it does not gate whether a
   * KNOWN endpoint is reachable — but the margin is reported, and an
   * arrival inside the buffer is flagged rather than celebrated.
   *
   * The probe steps a fraction short of the summary mileage because the
   * summary is rounded to 0.1 mi and may land a few dozen meters past the
   * timed axis; the fallbacks stay inside provider-timed road and the
   * whole probe fails closed (not reachable is never manufactured into
   * reachable — an untimeable end refuses instead).
   */
  const destinationMile =
    [input.totalMiles, input.totalMiles - 0.2, input.totalMiles * 0.995].find(
      (m) => m > 0 && timing.minutesToMile(m) !== null,
    ) ?? null;
  const destinationReach =
    destinationMile === null ? null : reachWithinClocks(timing, clocks, destinationMile, 0);

  const legSummaries: TripLegSummary[] = input.legs.map((leg, i) => ({
    index: leg.index,
    fromLabel: i === 0 ? labels.origin : (labels.via ?? labels.origin),
    toLabel: i === input.legs.length - 1 ? labels.destination : (labels.via ?? labels.destination),
    startMile: leg.startMile,
    endMile: leg.endMile,
    driveMinutes: leg.driveMinutes,
  }));

  /** The via passage, when the route carries one and boundaries exist. */
  const viaEvent = (): Extract<TripPlanEvent, { kind: 'via' }> | null => {
    if (labels.via === null || input.legs.length < 2) return null;
    const first = input.legs[0];
    return {
      kind: 'via',
      label: labels.via,
      mile: first.endMile,
      atMs: departAtMs + first.endS * 1000,
    };
  };

  /** The break, when one is owed inside the plan's driving. */
  const breakEvent = (
    beforeDrivingMin: number,
  ): Extract<TripPlanEvent, { kind: 'break' }> | null => {
    const b = input.breakPlan;
    if (b === null || b.required !== true) return null;
    if (b.targetMin >= beforeDrivingMin) return null;
    return {
      kind: 'break',
      targetMin: b.targetMin,
      targetMile: b.targetMile,
      byMs: b.byMs,
      coarse: b.coarse,
    };
  };

  const start: TripPlanEvent = { kind: 'start', label: labels.origin, atMs: departAtMs };

  if (destinationReach !== null && destinationMile !== null) {
    // ---- REACHABLE: start → (break) → (via) → destination. -------------
    // No parking stop is invented for a drive the clocks legally cover.
    const clockLeftMin = Math.floor(destinationReach.hosRemainingMinAtArrival);
    const events: TripPlanEvent[] = [start];
    const brk = breakEvent(destinationReach.driveMinutes);
    const via = viaEvent();
    // Chronological: order the break and the via by driving minutes.
    const middle: TripPlanEvent[] = [];
    if (brk) middle.push(brk);
    if (via) {
      const viaDriveMin = (via.atMs - departAtMs) / 60_000;
      if (brk && brk.targetMin > viaDriveMin) {
        middle.length = 0;
        middle.push(via, brk);
      } else {
        middle.push(via);
      }
    }
    events.push(...middle, {
      kind: 'destination',
      label: labels.destination,
      mile: destinationMile,
      arriveByMs: departAtMs + destinationReach.wallClockMinutes * 60_000,
      clockLeftMin,
      withinBuffer: clockLeftMin >= window.bufferMin,
    });
    return {
      status: 'reachable',
      limitedBy: window.limitedBy,
      bufferMin: window.bufferMin,
      events,
      legs: legSummaries,
    };
  }

  // ---- NOT REACHABLE: start → (break) → (via) → parking → boundary. ----
  const events: TripPlanEvent[] = [start];
  const top = input.parking[0];
  const stopDriveMin = top === undefined ? window.stopTargetMin : undefined;

  const planEndDrivingMin =
    top !== undefined
      ? // The chosen stop's worst-case driving minutes, recovered from its
        // provider-timed arrival (wall clock minus the break the reach
        // model charged — both were computed by the same rule).
        (top.arriveAtMs - departAtMs) / 60_000
      : (stopDriveMin ?? 0);

  const brk = breakEvent(planEndDrivingMin);
  const via = viaEvent();
  const middle: TripPlanEvent[] = [];
  if (brk) middle.push(brk);
  if (via) {
    const viaDriveMin = (via.atMs - departAtMs) / 60_000;
    // The via only appears when the truck actually passes it before the
    // plan's final stop — later legs are never shown as confirmed.
    if (viaDriveMin <= planEndDrivingMin) {
      if (brk && brk.targetMin > viaDriveMin) {
        middle.length = 0;
        middle.push(via, brk);
      } else {
        middle.push(via);
      }
    }
  }
  events.push(...middle);

  if (top !== undefined) {
    events.push(
      { kind: 'parking', choice: top, alternatives: Math.max(0, input.parking.length - 1) },
      { kind: 'clock-update', notice: CLOCK_UPDATE_NOTICE, detail: NO_PROJECTED_CLOCKS_NOTICE },
    );
  } else {
    events.push({ kind: 'no-parking', notice: NO_PARKING_BEFORE_CUTOFF_NOTICE });
  }

  return {
    status: 'not-reachable',
    limitedBy: window.limitedBy,
    bufferMin: window.bufferMin,
    events,
    legs: legSummaries,
  };
}
