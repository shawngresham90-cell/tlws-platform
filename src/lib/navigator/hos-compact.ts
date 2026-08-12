/**
 * The COMPACT HOS view (pilot round 3, item "declutter truck profile and
 * restore a visible HOS display").
 *
 * PR #304 gave the map the whole driving screen, and the ~230 px HOS card
 * yielded to it — the clocks kept counting and the HOS voice warnings kept
 * firing, but a driver mid-shift could no longer SEE how much drive time
 * was left. This module shapes the same clocks into one glanceable strip:
 * four labelled cells (DRIVE · WINDOW · CYCLE · BREAK) and one explicitly
 * marked limiting clock.
 *
 * NO NEW HOS RULES LIVE HERE, and that is the point:
 *
 *   - the four numbers come from `remainingClocks` in the trip-planner
 *     hos-engine, unchanged and unforked;
 *   - which clock is LIMITING comes from that same engine's own
 *     `limitedBy` verdict, never from a second sort in this file — a
 *     display that ranked clocks itself could disagree with the engine
 *     that drives the voice warnings, and the driver would have no way to
 *     tell which one was lying;
 *   - severity comes from the shipped `clockSeverity` thresholds in
 *     hos-strip.ts, the same ones the warning line and the voice
 *     announcer already use.
 *
 * HONESTY RAILS:
 *
 *   - a clock whose value is not a finite number is `null`, never zero and
 *     never a guess: the component renders an em dash and says "unknown"
 *     to assistive tech. The app has no ELD connection, so nothing here
 *     may invent a number the engine did not produce.
 *   - every state that matters is carried by a WORD (`OVER`, `URGENT`,
 *     `LOW`, `SOON`) beside the number, so severity never rides on color
 *     alone — the same discipline the warning line established.
 *
 * Pure: clocks in, display shape out. No clock read, no I/O, no storage.
 */

import { remainingClocks } from '@/lib/trip-planner/hos-engine';
import type { ClockState, RemainingClocks } from '@/lib/trip-planner/types';
import { clockSeverity, formatHM, type HosSeverity } from './hos-strip';

export type HosClockKey = 'drive' | 'window' | 'cycle' | 'break';

/**
 * The word that carries severity independently of color. `over` is a
 * distinct state rather than a louder `urgent`: a clock at zero is not
 * "nearly out", it is spent, and the driver reads a different decision
 * out of it.
 */
export type HosCellState = 'ok' | 'soon' | 'low' | 'urgent' | 'over';

export type HosCompactCell = {
  key: HosClockKey;
  /** Plain-language label, always shown beside the value. */
  label: 'DRIVE' | 'WINDOW' | 'CYCLE' | 'BREAK';
  /** Minutes remaining, or null when the engine has no usable number. */
  minutes: number | null;
  /** "6:42", or null when unknown — the component shows an em dash. */
  text: string | null;
  severity: HosSeverity;
  state: HosCellState;
  /** The single clock that runs out first, per the engine's `limitedBy`. */
  limiting: boolean;
  /** Screen-reader sentence: the cell's full meaning in words. */
  spoken: string;
};

export type HosCompactView = {
  cells: readonly HosCompactCell[];
  /** Which clock the engine says is binding right now. */
  limitingKey: HosClockKey;
  /** The worst severity on the strip — what the rail treatment reads. */
  severity: HosSeverity;
};

/** The engine's own vocabulary → this strip's cells. One mapping, here. */
const LIMITED_BY_TO_KEY: Record<RemainingClocks['limitedBy'], HosClockKey> = {
  '11-hour': 'drive',
  '14-hour': 'window',
  '30-minute-break': 'break',
  cycle: 'cycle',
};

const LABELS: Record<HosClockKey, HosCompactCell['label']> = {
  drive: 'DRIVE',
  window: 'WINDOW',
  cycle: 'CYCLE',
  break: 'BREAK',
};

/** What each clock MEANS, for the accessible sentence. */
const MEANING: Record<HosClockKey, string> = {
  drive: 'driving time left',
  window: 'on-duty window left',
  cycle: 'cycle time left',
  break: 'driving left before a 30-minute break',
};

const SEVERITY_WORD: Record<HosCellState, string> = {
  ok: '',
  soon: 'SOON',
  low: 'LOW',
  urgent: 'URGENT',
  over: 'OVER',
};

/** The word a cell shows beside its number; '' while the clock is calm. */
export function cellStateWord(state: HosCellState): string {
  return SEVERITY_WORD[state];
}

function cellFor(key: HosClockKey, raw: number, limitingKey: HosClockKey): HosCompactCell {
  const known = typeof raw === 'number' && Number.isFinite(raw);
  const minutes = known ? raw : null;
  const severity: HosSeverity = known ? clockSeverity(raw) : 'none';
  const state: HosCellState = !known
    ? 'ok'
    : raw <= 0
      ? 'over'
      : severity === 'critical'
        ? 'urgent'
        : severity === 'warning'
          ? 'low'
          : severity === 'notice'
            ? 'soon'
            : 'ok';
  const limiting = key === limitingKey;
  const text = minutes === null ? null : formatHM(minutes);
  const spoken =
    minutes === null
      ? `${MEANING[key]} unknown`
      : state === 'over'
        ? `${MEANING[key]}: none remaining`
        : `${MEANING[key]}: ${text}${state === 'ok' ? '' : `, ${SEVERITY_WORD[state].toLowerCase()}`}` +
          (limiting ? ' — this is the limiting clock' : '');
  return { key, label: LABELS[key], minutes, text, severity, state, limiting, spoken };
}

const SEVERITY_ORDER: readonly HosSeverity[] = ['none', 'notice', 'warning', 'critical'];

/**
 * Shape one clock state into the compact strip. The cell ORDER is fixed
 * — DRIVE, WINDOW, CYCLE, BREAK — so the strip never rearranges itself
 * under a driver's glance; urgency is shown by marking a cell, never by
 * moving it.
 */
export function hosCompactView(state: ClockState): HosCompactView {
  return hosCompactViewFrom(remainingClocks(state));
}

/** The same shaping from an already-computed RemainingClocks — used where
 *  the caller already has the engine's answer and must not recompute it. */
export function hosCompactViewFrom(remaining: RemainingClocks): HosCompactView {
  const limitingKey = LIMITED_BY_TO_KEY[remaining.limitedBy] ?? 'drive';
  const cells: HosCompactCell[] = [
    cellFor('drive', remaining.drivingMin, limitingKey),
    cellFor('window', remaining.windowMin, limitingKey),
    cellFor('cycle', remaining.cycleMin, limitingKey),
    cellFor('break', remaining.untilBreakMin, limitingKey),
  ];
  let severity: HosSeverity = 'none';
  for (const c of cells) {
    if (SEVERITY_ORDER.indexOf(c.severity) > SEVERITY_ORDER.indexOf(severity)) {
      severity = c.severity;
    }
  }
  return { cells, limitingKey, severity };
}
