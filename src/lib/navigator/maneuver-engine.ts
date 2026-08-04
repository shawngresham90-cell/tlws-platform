/**
 * ManeuverEngine (Navigator milestone N5, visual only) — turns the parsed
 * HERE maneuver list plus the tracker's route-mile into "what's next".
 * Pure; no clocks, no announcements (voice is N7), no route fetching. The
 * caller supplies the route-mile of every geometry index, because maneuver
 * offsets index the PARSED route geometry (here-routing rebases them
 * across sections) — this engine never guesses geometry.
 */

import type { HereManeuver } from '@/lib/trip-planner/here-routing';

export type EngineManeuver = {
  action: string;
  instruction: string;
  direction: string | null;
  /** Route mile where the maneuver occurs. */
  mileMi: number;
};

export type ManeuverView = {
  /** The maneuver the driver is approaching, or null past the last one. */
  next: EngineManeuver | null;
  /** The one after it, for the "then …" preview line. */
  following: EngineManeuver | null;
  /** Miles from the current position to `next` (never negative). */
  distanceMi: number | null;
};

export type ManeuverEngine = {
  view(currentMile: number): ManeuverView;
  count(): number;
};

/** Behind-us tolerance: projection jitter must not skip a live maneuver. */
export const PASSED_TOLERANCE_MI = 0.03;

/**
 * `positionMiles[i]` = route mile of parsed geometry index i. Maneuvers
 * with out-of-range offsets clamp to the last point (mirrors the parse's
 * own defensive clamp). Malformed inputs yield an engine with no
 * maneuvers rather than a throw — the screen renders "route unavailable".
 */
export function createManeuverEngine(
  maneuvers: readonly HereManeuver[],
  positionMiles: readonly number[],
): ManeuverEngine {
  const list: EngineManeuver[] = [];
  if (positionMiles.length > 0) {
    for (const m of maneuvers) {
      if (typeof m.instruction !== 'string' || !m.instruction) continue;
      const offset = Math.min(Math.max(m.offset, 0), positionMiles.length - 1);
      const mileMi = positionMiles[offset];
      if (!Number.isFinite(mileMi)) continue;
      list.push({
        action: m.action,
        instruction: m.instruction,
        direction: m.direction,
        mileMi,
      });
    }
    list.sort((a, b) => a.mileMi - b.mileMi);
  }

  function view(currentMile: number): ManeuverView {
    const idx = list.findIndex((m) => m.mileMi >= currentMile - PASSED_TOLERANCE_MI);
    if (idx === -1) return { next: null, following: null, distanceMi: null };
    const next = list[idx];
    return {
      next,
      following: list[idx + 1] ?? null,
      distanceMi: Math.max(0, next.mileMi - currentMile),
    };
  }

  return { view, count: () => list.length };
}
