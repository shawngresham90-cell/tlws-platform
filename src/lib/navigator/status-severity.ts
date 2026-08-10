/**
 * Warning-rail severity for the driving screen (Design Blueprint Phase 2).
 *
 * This module READS the existing status vocabulary and answers one purely
 * presentational question: how loudly should the cockpit dress the status
 * line? It owns no state, decides no behavior, and is deliberately not a
 * state machine — the navigation controller's status stays authoritative,
 * and every safety system (off-route, reroute budgets, voice arbitration,
 * HOS priority) runs exactly as before whether or not anything reads this.
 *
 * The blueprint's semantic ladder, applied to states that really exist:
 *
 *   quiet     — healthy or pre-drive states. NO rail chrome at all: a
 *               warning surface that decorates good news teaches drivers
 *               to stop reading it (blueprint: the rail must not become a
 *               permanent cluster).
 *   advisory  — degraded-but-guiding: accuracy-gated fixes, or position
 *               held at last known. Amber, always beside the words.
 *   critical  — guidance is genuinely not running: permission denied, or
 *               the platform cannot provide position at all. Red, always
 *               beside the words.
 *
 * Color never stands alone (blueprint law 9): callers pair the severity
 * with the status TEXT that already renders, plus a distinct aria-hidden
 * shape from `severityGlyph`, so severity survives colorblindness and
 * grayscale sunlight legibility alike.
 *
 * Pure: strings in, strings out. No clock, no I/O, no globals.
 */

import type { DrivingScreenStatus } from './navigation-controller';

export type StatusSeverity = 'quiet' | 'advisory' | 'critical';

const ADVISORY: ReadonlySet<DrivingScreenStatus> = new Set(['position-degraded', 'position-lost']);

const CRITICAL: ReadonlySet<DrivingScreenStatus> = new Set(['denied', 'position-unavailable']);

export function statusSeverity(status: DrivingScreenStatus): StatusSeverity {
  if (CRITICAL.has(status)) return 'critical';
  if (ADVISORY.has(status)) return 'advisory';
  return 'quiet';
}

/**
 * The severity's shape, distinct per level so color is never the only
 * signal: a warning triangle for advisories, a no-entry sign for states
 * where navigation is genuinely not running. Null for quiet — a healthy
 * status line carries no badge at all.
 */
export function severityGlyph(severity: StatusSeverity): string | null {
  if (severity === 'critical') return '⛔';
  if (severity === 'advisory') return '⚠';
  return null;
}
