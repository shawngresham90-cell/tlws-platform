'use client';

import {
  validateEnteredClocks,
  CLOCKS_UNSET,
  type ClockEntryState,
  type DriverEnteredClocks,
} from '@/lib/navigator/hos-clocks';
import type { CycleRule } from '@/lib/trip-planner/types';
import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * The driver's entered hours-of-service clocks, remembered on this device
 * (pre-trip setup milestone).
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: an unreadable clock record
 * returns `unset`, never a fresh driver. Every other kind of storage
 * failure in this app degrades to a sensible default; this one degrades
 * to SILENCE, because the sensible-looking default here — eleven hours,
 * a full window, seventy hours of cycle — is a specific false claim about
 * a driver's legal standing.
 *
 * It is also why the clocks have their own key rather than riding the
 * truck record or the trip snapshot: a clock record damaged by a quota
 * failure, a half-write, or a hand edit must cost the driver their clocks
 * and nothing else. Not their verified truck. Not the trip they are in
 * the middle of.
 *
 * The values are re-validated on the way out. A stored clock that is out
 * of range for the rule it claims — more than eleven hours of driving
 * left, more window than the regulation allows — is not repaired into
 * something plausible; it is discarded, and the driver is asked again.
 */

export const CLOCKS_KEY = 'tlws-navigator-clocks-v1';
const CLOCKS_VERSION = 1;

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function shapeClocks(
  payload: Record<string, unknown>,
): Extract<ClockEntryState, { kind: 'set' }> | null {
  const entered = payload.entered;
  if (entered === null || typeof entered !== 'object') return null;
  const e = entered as Record<string, unknown>;
  const drivingMin = numberOrNull(e.drivingMin);
  const windowMin = numberOrNull(e.windowMin);
  const untilBreakMin = numberOrNull(e.untilBreakMin);
  const cycleMin = numberOrNull(e.cycleMin);
  if (drivingMin === null || windowMin === null || untilBreakMin === null || cycleMin === null) {
    return null;
  }
  // Only the two cycles the shipped engine models. An unknown rule is a
  // record we cannot honour, not one to guess at.
  if (e.cycleRule !== '60/7' && e.cycleRule !== '70/8') return null;
  const value: DriverEnteredClocks = {
    drivingMin,
    windowMin,
    untilBreakMin,
    cycleMin,
    cycleRule: e.cycleRule as CycleRule,
  };
  // Re-validated on read: a stored value that is out of range is
  // discarded rather than clamped into something believable.
  if (validateEnteredClocks(value).length > 0) return null;
  const enteredAtMs = numberOrNull(payload.enteredAtMs);
  if (enteredAtMs === null || enteredAtMs <= 0) return null;
  return {
    kind: 'set',
    entered: value,
    enteredAtMs,
    fromFreshShift: payload.fromFreshShift === true,
  };
}

/**
 * The saved clocks, or `unset`.
 *
 * `unset` is returned for a first-time driver AND for every failure mode.
 * The caller must render "Clocks not set" — the one thing it may not do
 * is substitute a full clock.
 */
export function readClocks(): ClockEntryState {
  const stored = readVersioned(CLOCKS_KEY, CLOCKS_VERSION, shapeClocks);
  return stored.ok ? stored.value : CLOCKS_UNSET;
}

/** Save clocks the driver entered. An `unset` state clears the record instead. */
export function writeClocks(state: ClockEntryState): void {
  if (state.kind !== 'set') {
    clearClocks();
    return;
  }
  writeVersioned(CLOCKS_KEY, CLOCKS_VERSION, {
    entered: state.entered,
    enteredAtMs: state.enteredAtMs,
    fromFreshShift: state.fromFreshShift,
  });
}

/** Forget the clocks. Nothing else is touched. */
export function clearClocks(): void {
  clearVersioned(CLOCKS_KEY);
}
