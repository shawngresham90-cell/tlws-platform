'use client';

import {
  asVisibility,
  HOS_VISIBILITY_DEFAULT,
  type HosVisibility,
} from '@/lib/navigator/hos-visibility';
import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * Whether the driver wants the clocks on screen while driving.
 *
 * A fourth versioned record beside the name, the truck and the clocks,
 * and by far the smallest: one word, 'shown' or 'hidden'. It earns its
 * own key for the same reason the others do — a damaged preference must
 * cost the preference and nothing else. Losing it means the driver sees
 * the strip and taps once; losing it in a way that took the CLOCKS with
 * it would be a different and much worse bug.
 *
 * localStorage, matching the other three: "restore it on reload and
 * future visits" is what the milestone asks for, and sessionStorage dies
 * with the tab.
 *
 * WHAT THIS RECORD MAY CONTAIN, exhaustively: one of two string
 * literals. Not a clock value, not a name, not a position, not a
 * timestamp that could act as one. It is a display choice about the
 * driver's own screen, and it is never transmitted — not to HERE, not to
 * search, not to routing, not to analytics. That is enforced by test
 * against every module that could carry it toward a wire.
 */

export const HOS_VISIBILITY_KEY = 'tlws-navigator-hos-visible-v1';
const HOS_VISIBILITY_VERSION = 1;

function shapeVisibility(payload: Record<string, unknown>): { visibility: HosVisibility } | null {
  const visibility = asVisibility(payload.visibility);
  return visibility === null ? null : { visibility };
}

/**
 * The saved choice, or the documented first-use default.
 *
 * Every failure — no storage, no record, bad JSON, wrong version, a word
 * this build does not know — lands on the default. That is safe here in
 * a way it deliberately is NOT for the clocks: showing a driver their
 * clocks when they asked for them hidden is a small annoyance, while
 * showing a driver clocks they never entered would be a false claim
 * about their legal standing. Different records, different fallbacks.
 */
export function readHosVisibility(): HosVisibility {
  const stored = readVersioned(HOS_VISIBILITY_KEY, HOS_VISIBILITY_VERSION, shapeVisibility);
  return stored.ok ? stored.value.visibility : HOS_VISIBILITY_DEFAULT;
}

/** Remember the driver's choice on this device. */
export function writeHosVisibility(visibility: HosVisibility): void {
  writeVersioned(HOS_VISIBILITY_KEY, HOS_VISIBILITY_VERSION, { visibility });
}

/** Forget it, and fall back to the first-use default. Nothing else is touched. */
export function clearHosVisibility(): void {
  clearVersioned(HOS_VISIBILITY_KEY);
}
